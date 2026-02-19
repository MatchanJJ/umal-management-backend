<?php

namespace App\Services;

use App\Models\College;
use App\Models\Event;
use App\Models\Member;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * AssignAI Chat Service
 *
 * Powers the GitHub Copilot-style right slide-in chat panel on the event
 * show page.  Each turn parses a natural language message for constraints
 * (gender, new/old, class conflict, college, priority) and returns
 * ML-ranked volunteer recommendations that accumulate across turns.
 */
class AssignAIChatService
{
    protected string $nlpUrl;
    protected int    $timeout;

    public function __construct()
    {
        $this->nlpUrl  = config('services.nlp.url', 'http://localhost:8001');
        $this->timeout = config('services.nlp.timeout', 30);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Process one chat turn.
     *
     * @param  Event   $event
     * @param  string  $message              The user's latest message.
     * @param  array   $conversationHistory  Array of {role, content} objects from previous turns.
     * @return array{reply:string, recommendations:array, merged_constraints:array, turn_index:int}
     */
    public function chat(Event $event, string $message, array $conversationHistory, ?array $previousMerged = null): array
    {
        $eventDate  = Carbon::parse($event->date)->toDateString();
        $timeBlock  = $event->time_block ?? 'Morning';
        $eventSize  = (int) $event->required_volunteers;
        $turnIndex  = count(array_filter($conversationHistory, fn($t) => ($t['role'] ?? '') === 'user'));

        try {
            // 1. Parse message + merge constraints with history via NLP /chat
            $nlpResult = $this->callChat($message, $conversationHistory, $eventDate, $timeBlock, $eventSize, $previousMerged);
            if (!$nlpResult) {
                return $this->fallbackReply($turnIndex, "I'm having trouble connecting to my language model right now. Please try again in a moment.");
            }

            $mergedConstraints = $nlpResult['merged_constraints'] ?? [];
            $naturalReply      = $nlpResult['natural_reply'] ?? "Got it! Fetching recommendations…";
            $isConfirming      = (bool) ($nlpResult['is_confirming'] ?? false);

            // Short-circuit: user is confirming — let frontend auto-assign last recs
            if ($isConfirming) {
                return [
                    'reply'              => '✅ Understood — assigning the selected volunteers now…',
                    'recommendations'    => [],
                    'merged_constraints' => $mergedConstraints,
                    'turn_index'         => $turnIndex,
                    'is_confirming'      => true,
                ];
            }

            // 2. Fetch all eligible members with 11-feature ML arrays
            $allMembers = $this->getEligibleMembersWithFeatures($eventDate, $timeBlock);
            if ($allMembers->isEmpty()) {
                return $this->fallbackReply($turnIndex, "No eligible members found for this event.", $mergedConstraints);
            }

            // 3. Resolve groups and produce recommendations
            //    New schema: {groups:[{count,college,gender,new_old}], global:{conflict_ok,priority_rules}}
            //    Legacy fallback schema also normalised by SemanticParser to same shape.
            $groups      = $mergedConstraints['groups']  ?? [];
            $globalMeta  = $mergedConstraints['global']  ?? [];
            $priorityRules = $globalMeta['priority_rules'] ?? [];
            $conflictOk    = $globalMeta['conflict_ok']    ?? null;
            $heightRule    = $globalMeta['height_rule']    ?? null;

            $recommendations = [];

            if (!empty($groups)) {
                // ── Multi-group mode ──────────────────────────────────────────
                // Each group defines its own filters + count.
                // We pick the best ML-scored members for each group independently.
                $usedMemberIds = [];

                foreach ($groups as $group) {
                    $groupCount = (int) ($group['count'] ?? 1);
                    $pool = $allMembers;

                    // Global conflict filter
                    if ($conflictOk === false) {
                        $pool = $pool->filter(fn($m) => ($m['has_class_conflict'] ?? 0) === 0);
                    }

                    // Group college filter
                    if (!empty($group['college'])) {
                        $abbrev   = strtoupper(trim($group['college']));
                        $keyword  = strtolower($this->expandCollegeAbbreviation($abbrev));
                        $pool = $pool->filter(function ($m) use ($abbrev, $keyword) {
                            $name = strtolower($m['college'] ?? '');
                            return str_contains($name, strtolower($abbrev)) || str_contains($name, $keyword);
                        });
                    }

                    // Group gender filter
                    if (!empty($group['gender'])) {
                        $g = $group['gender'];
                        $pool = $pool->filter(fn($m) => ($m['gender_label'] ?? '') === $g);
                    }

                    // Group new/old filter
                    if (!empty($group['new_old'])) {
                        $no = $group['new_old'];
                        $pool = $pool->filter(function ($m) use ($no) {
                            $isNew = ($m['is_new_member'] ?? 0) === 1;
                            return $no === 'new' ? $isNew : !$isNew;
                        });
                    }

                    // Group height filters
                    if (!empty($group['height_min'])) {
                        $hmin = (int) $group['height_min'];
                        $pool = $pool->filter(fn($m) => ($m['height'] ?? 0) >= $hmin);
                    }
                    if (!empty($group['height_max'])) {
                        $hmax = (int) $group['height_max'];
                        $pool = $pool->filter(fn($m) => ($m['height'] ?? 999) <= $hmax);
                    }

                    // Height-based sort within this group
                    if ($heightRule === 'tallest_first') {
                        $pool = $pool->sortByDesc(fn($m) => $m['height'] ?? 0);
                    } elseif ($heightRule === 'shortest_first') {
                        $pool = $pool->sortBy(fn($m) => $m['height'] ?? 0);
                    } elseif ($heightRule === 'male_taller_than_female') {
                        $genderHere = $group['gender'] ?? null;
                        if ($genderHere === 'M') {
                            $pool = $pool->sortByDesc(fn($m) => $m['height'] ?? 0);
                        } elseif ($genderHere === 'F') {
                            $pool = $pool->sortBy(fn($m) => $m['height'] ?? 0);
                        }
                    } elseif ($heightRule === 'female_taller_than_male') {
                        $genderHere = $group['gender'] ?? null;
                        if ($genderHere === 'F') {
                            $pool = $pool->sortByDesc(fn($m) => $m['height'] ?? 0);
                        } elseif ($genderHere === 'M') {
                            $pool = $pool->sortBy(fn($m) => $m['height'] ?? 0);
                        }
                    }

                    // Exclude members already assigned to a previous group
                    $pool = $pool->filter(fn($m) => !in_array($m['member_id'] ?? '', $usedMemberIds));

                    if ($pool->isEmpty()) {
                        continue; // Skip group if no candidates
                    }

                    $ranked = $this->getRankedFromNlp($pool->values()->all(), $eventDate, $groupCount);
                    $ranked = $this->applyPrioritySortRaw($ranked, $priorityRules);
                    $ranked = array_slice($ranked, 0, $groupCount);

                    foreach ($ranked as $r) {
                        $usedMemberIds[] = $r['member_id'] ?? '';
                        $recommendations[] = array_merge($r, ['_group' => $group]);
                    }
                }
            } else {
                // ── Single-pool mode (no explicit groups) ────────────────────
                $pool = $allMembers;
                if ($conflictOk === false) {
                    $pool = $pool->filter(fn($m) => ($m['has_class_conflict'] ?? 0) === 0);
                }
                if ($pool->isEmpty()) {
                    return $this->fallbackReply($turnIndex, "No available members match the current constraints.", $mergedConstraints);
                }
                $ranked          = $this->getRankedFromNlp($pool->values()->all(), $eventDate, $eventSize);
                $recommendations = $this->applyPrioritySortRaw($ranked, $priorityRules);
                $recommendations = array_slice($recommendations, 0, $eventSize);
            }

            if (empty($recommendations)) {
                return $this->fallbackReply($turnIndex, "No members match the current constraints. Try relaxing some requirements.", $mergedConstraints);
            }

            return [
                'reply'               => $naturalReply,
                'recommendations'     => $recommendations,
                'merged_constraints'  => $mergedConstraints,
                'turn_index'          => $turnIndex,
                'is_confirming'       => false,
            ];

        } catch (\Exception $e) {
            Log::error('AssignAIChatService::chat failed', [
                'event_id' => $event->id,
                'message'  => $message,
                'error'    => $e->getMessage(),
                'trace'    => $e->getTraceAsString(),
            ]);

            return $this->fallbackReply($turnIndex, "An unexpected error occurred: " . $e->getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NLP service calls
    // ─────────────────────────────────────────────────────────────────────────

    protected function callChat(
        string $message,
        array  $history,
        string $eventDate,
        string $timeBlock,
        int    $eventSize,
        ?array $previousMerged = null
    ): ?array {
        try {
            $payload = [
                'message'               => $message,
                'conversation_history'  => $history,
                'event_context'         => [
                    'date'       => $eventDate,
                    'time_block' => $timeBlock,
                    'event_size' => $eventSize,
                ],
            ];
            if ($previousMerged !== null) {
                $payload['previous_merged_constraints'] = $previousMerged;
            }

            $response = Http::timeout($this->timeout)
                ->post("{$this->nlpUrl}/chat", $payload);

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('NLP /chat returned non-200', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('NLP /chat connection failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Rank members locally using a fairness score derived from participation
     * history and attendance. Replaces the old /predict-assignments NLP call.
     *
     * Score = attendance_rate * 10
     *       + (days_since_last_assignment / 30)  ← reward infrequent assignees
     *       - assignments_last_30_days * 0.5     ← penalise recently heavy load
     */
    protected function getRankedFromNlp(array $memberFeatures, string $eventDate, int $eventSize): array
    {
        $scored = array_map(function (array $m) {
            $attendance    = (float) ($m['attendance_rate']              ?? 0.8);
            $daysSince     = (int)   ($m['days_since_last_assignment']   ?? 30);
            $recent30      = (int)   ($m['assignments_last_30_days']     ?? 0);

            $score = ($attendance * 10)
                   + ($daysSince  / 30)
                   - ($recent30   * 0.5);

            return array_merge($m, [
                'assignment_probability'    => round(min(max($score / 12.0, 0.0), 1.0), 4),
                'fairness_adjusted_score'  => round($score, 4),
                'fairness_bias'            => $score > 8 ? 'positive' : ($score < 4 ? 'negative' : 'neutral'),
                'should_assign'            => ($m['is_available'] ?? 1) === 1,
            ]);
        }, $memberFeatures);

        usort($scored, fn($a, $b) =>
            $b['fairness_adjusted_score'] <=> $a['fairness_adjusted_score']
        );

        return array_slice($scored, 0, $eventSize);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Member fetching / feature building
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch all assignable members and compute their 11 ML features.
     *
     * Returns a Collection of arrays with member data + pre-computed features.
     */
    protected function getEligibleMembersWithFeatures(string $eventDate, string $timeBlock): \Illuminate\Support\Collection
    {
        $members = Member::with(['college', 'course'])
            ->whereHas('role', fn($q) => $q->where('name', 'member'))
            ->get();

        return $members->map(function (Member $member) use ($eventDate, $timeBlock) {
            $features = $member->toMLFeatures($eventDate, $timeBlock);
            return array_merge($features, [
                // Extra metadata for filtering / display (not fed to ML)
                'full_name'    => $member->first_name . ' ' . $member->last_name,
                'college_id'   => $member->college_id,
                'college'      => optional($member->college)->name ?? '',
                'year_level'   => $member->year_level,
                'gender_label' => $member->gender,         // 'M' or 'F' string (not the ML int)
                'batch_year'   => $member->batch_year,
                'height'       => $member->height,          // cm, nullable
            ]);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Hard filters
    // ─────────────────────────────────────────────────────────────────────────

    protected function applyHardFilters(
        \Illuminate\Support\Collection $members,
        array $constraints
    ): \Illuminate\Support\Collection {
        $filtered = $members;

        // College filter — match college name using keyword or abbreviation expansion
        $collegeFilter = $constraints['college_filter'] ?? null;
        if ($collegeFilter) {
            $keyword = strtolower(trim($collegeFilter));
            $expanded = strtolower($this->expandCollegeAbbreviation($keyword));
            $filtered = $filtered->filter(function ($m) use ($keyword, $expanded) {
                $collegeName = strtolower($m['college'] ?? '');
                return str_contains($collegeName, $keyword) ||
                       str_contains($collegeName, $expanded);
            });
        }

        // Conflict filter — if conflict_ok is explicitly false, exclude those with a class
        $conflictOk = $constraints['conflict_ok'] ?? null;
        if ($conflictOk === false) {
            $filtered = $filtered->filter(fn($m) => ($m['has_class_conflict'] ?? 0) === 0);
        }

        return $filtered->values();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gender split recommend
    // ─────────────────────────────────────────────────────────────────────────

    protected function splitGenderRecommend(
        \Illuminate\Support\Collection $pool,
        string $eventDate,
        int    $eventSize,
        array  $constraints
    ): array {
        $males   = $pool->filter(fn($m) => ($m['gender_label'] ?? '') === 'M')->values()->all();
        $females = $pool->filter(fn($m) => ($m['gender_label'] ?? '') === 'F')->values()->all();

        $halfM = (int) ceil($eventSize / 2);
        $halfF = $eventSize - $halfM;

        $rankedM = $this->getRankedFromNlp($males,   $eventDate, $halfM);
        $rankedF = $this->getRankedFromNlp($females, $eventDate, $halfF);

        $combined = array_merge(
            array_slice($this->applyPrioritySort($rankedM, $constraints), 0, $halfM),
            array_slice($this->applyPrioritySort($rankedF, $constraints), 0, $halfF)
        );

        return $combined;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Priority sort
    // ─────────────────────────────────────────────────────────────────────────

    protected function applyPrioritySort(array $ranked, array $constraints): array
    {
        return $this->applyPrioritySortRaw($ranked, $constraints['priority_rules'] ?? []);
    }

    protected function applyPrioritySortRaw(array $ranked, array $rules): array
    {
        if (empty($rules)) {
            return $ranked;
        }
        usort($ranked, function ($a, $b) use ($rules) {
            foreach ($rules as $rule) {
                $cmp = $this->comparePriority($a, $b, $rule);
                if ($cmp !== 0) {
                    return $cmp;
                }
            }
            return ($b['fairness_adjusted_score'] ?? 0) <=> ($a['fairness_adjusted_score'] ?? 0);
        });
        return $ranked;
    }

    protected function comparePriority(array $a, array $b, string $rule): int
    {
        return match ($rule) {
            'male_first'       => ($b['gender_label'] === 'M' ? 1 : 0) <=> ($a['gender_label'] === 'M' ? 1 : 0),
            'female_first'     => ($b['gender_label'] === 'F' ? 1 : 0) <=> ($a['gender_label'] === 'F' ? 1 : 0),
            'new_first'        => ($b['is_new_member'] ?? 0) <=> ($a['is_new_member'] ?? 0),
            'old_first'        => ($a['is_new_member'] ?? 0) <=> ($b['is_new_member'] ?? 0),
            'attendance_first' => ($b['attendance_rate'] ?? 0) <=> ($a['attendance_rate'] ?? 0),
            default            => 0,
        };
    }

    protected function expandCollegeAbbreviation(string $abbrev): string
    {
        return match (strtoupper($abbrev)) {
            'CCE'  => 'computing',
            'CTE'  => 'teacher',
            'CEE'  => 'engineering',
            'CAE'  => 'accounting',
            'CCJE' => 'criminal',
            'CBAE' => 'business',
            'CHE'  => 'hospitality',
            'CHSE' => 'health',
            'CASE' => 'art',
            'CAFE' => 'architecture',
            default => $abbrev,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    protected function describeFilters(array $constraints): string
    {
        $parts = [];
        if ($cf = $constraints['college_filter'] ?? null) {
            $parts[] = "college={$cf}";
        }
        if (($constraints['conflict_ok'] ?? null) === false) {
            $parts[] = "no class conflicts";
        }
        if ($gf = $constraints['gender_filter'] ?? null) {
            $parts[] = "gender={$gf}";
        }
        return implode(', ', $parts) ?: 'unknown';
    }

    protected function fallbackReply(int $turnIndex, string $message, array $mergedConstraints = []): array
    {
        return [
            'reply'              => $message,
            'recommendations'    => [],
            'merged_constraints' => $mergedConstraints,
            'turn_index'         => $turnIndex,
            'is_confirming'      => false,
        ];
    }
}
