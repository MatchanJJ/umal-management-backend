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
    public function chat(Event $event, string $message, array $conversationHistory): array
    {
        $eventDate  = Carbon::parse($event->date)->toDateString();
        $timeBlock  = $event->time_block ?? 'Morning';
        $eventSize  = (int) $event->required_volunteers;
        $turnIndex  = count(array_filter($conversationHistory, fn($t) => ($t['role'] ?? '') === 'user'));

        try {
            // 1. Parse message + merge constraints with history via NLP /chat
            $nlpResult = $this->callChat($message, $conversationHistory, $eventDate, $timeBlock, $eventSize);
            if (!$nlpResult) {
                return $this->fallbackReply($turnIndex, "I'm having trouble connecting to my language model right now. Please try again in a moment.");
            }

            $mergedConstraints = $nlpResult['merged_constraints'] ?? [];
            $naturalReply      = $nlpResult['natural_reply'] ?? "Got it! Fetching recommendations…";            $isConfirming      = (bool) ($nlpResult['is_confirming'] ?? false);

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

            // 3. Apply hard PHP filters
            $filtered = $this->applyHardFilters($allMembers, $mergedConstraints);

            if ($filtered->isEmpty()) {
                $why = $this->describeFilters($mergedConstraints);
                return $this->fallbackReply(
                    $turnIndex,
                    "No members match the current constraints ({$why}). Try relaxing some requirements.",
                    $mergedConstraints
                );
            }

            // 4.  Gender pool split or unified pool
            $genderFilter = $mergedConstraints['gender_filter'] ?? null;

            if ($genderFilter === 'split') {
                $recommendations = $this->splitGenderRecommend(
                    $filtered, $eventDate, $eventSize, $mergedConstraints
                );
            } else {
                $pool = $filtered;
                if ($genderFilter === 'M') {
                    $pool = $filtered->filter(fn($m) => ($m['gender_label'] ?? '') === 'M');
                } elseif ($genderFilter === 'F') {
                    $pool = $filtered->filter(fn($m) => ($m['gender_label'] ?? '') === 'F');
                }

                if ($pool->isEmpty()) {
                    return $this->fallbackReply($turnIndex, "No {$genderFilter} members match the current constraints.", $mergedConstraints);
                }

                $ranked       = $this->getRankedFromNlp($pool->values()->all(), $eventDate, $eventSize);
                $recommendations = $this->applyPrioritySort($ranked, $mergedConstraints);
                $recommendations = array_slice($recommendations, 0, $eventSize);
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
        int    $eventSize
    ): ?array {
        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->nlpUrl}/chat", [
                    'message'               => $message,
                    'conversation_history'  => $history,
                    'event_context'         => [
                        'date'       => $eventDate,
                        'time_block' => $timeBlock,
                        'event_size' => $eventSize,
                    ],
                ]);

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

    protected function getRankedFromNlp(array $memberFeatures, string $eventDate, int $eventSize): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->nlpUrl}/predict-assignments", [
                    'members'    => $memberFeatures,
                    'event_date' => $eventDate,
                    'event_size' => $eventSize,
                ]);

            if ($response->successful()) {
                return $response->json('recommended', []);
            }

            Log::warning('NLP /predict-assignments failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            return [];
        } catch (\Exception $e) {
            Log::error('NLP /predict-assignments connection failed', ['error' => $e->getMessage()]);
            return [];
        }
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
        $rules = $constraints['priority_rules'] ?? [];

        if (empty($rules)) {
            return $ranked;
        }

        // Primary sort key determined by first priority rule
        usort($ranked, function ($a, $b) use ($rules) {
            foreach ($rules as $rule) {
                $cmp = $this->comparePriority($a, $b, $rule);
                if ($cmp !== 0) {
                    return $cmp;
                }
            }
            // Fall back to ML fairness score
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
