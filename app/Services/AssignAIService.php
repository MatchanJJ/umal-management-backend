<?php

namespace App\Services;

use App\Models\Event;
use App\Models\Member;
use App\Models\VolunteerAssignment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * AssignAI Service - Agentic NLP-based volunteer assignment
 * 
 * Interprets natural language requests and generates intelligent 
 * assignment recommendations with human-in-the-loop approval.
 */
class AssignAIService
{
    protected string $nlpServiceUrl;
    protected int $timeout;

    public function __construct()
    {
        $this->nlpServiceUrl = config('services.nlp.url', 'http://localhost:8001');
        $this->timeout = config('services.nlp.timeout', 30);
    }

    /**
     * Main AssignAI suggestion endpoint
     * 
     * Takes natural language prompt and returns assignment recommendations
     */
    public function suggestAssignments(string $prompt, ?int $eventId = null): array
    {
        try {
            // Step 1: Parse natural language using NLP service
            $parsed = $this->parsePrompt($prompt);
            
            if (!$parsed) {
                return $this->errorResponse('Failed to parse prompt. NLP service unavailable.');
            }

            // Step 2: Resolve or detect event
            $eventResolution = $this->resolveEvent($parsed, $eventId);
            
            if (!$eventResolution['exists']) {
                return $this->eventNotFoundResponse($parsed, $eventResolution);
            }

            $event = $eventResolution['event'];
            $eventDate = Carbon::parse($event->date)->toDateString();

            // Step 3: Get eligible members with calculated ML features
            $members = $this->getEligibleMembersWithFeatures(
                $eventDate,
                $parsed['time_block'] ?? 'Morning'
            );

            if ($members->isEmpty()) {
                return $this->errorResponse('No eligible members found for this event.');
            }

            // Step 4: Get ML-based recommendations from NLP service
            $recommendations = $this->predictAssignments(
                $members->toArray(),
                $eventDate,
                $parsed['slots_needed']
            );

            if (!$recommendations) {
                return $this->errorResponse('Assignment prediction failed.');
            }

            // Step 5: Format response with explanations
            return $this->successResponse(
                $event,
                $recommendations,
                $parsed,
                $members
            );

        } catch (\Exception $e) {
            Log::error('AssignAI suggestion failed', [
                'prompt' => $prompt,
                'error' => $e->getMessage()
            ]);

            return $this->errorResponse($e->getMessage());
        }
    }

    /**
     * Parse natural language prompt locally (regex-based).
     * Extracts slots_needed, day, and time_block without calling the NLP service.
     */
    protected function parsePrompt(string $prompt): ?array
    {
        $prompt = strtolower($prompt);

        // Extract number of slots
        preg_match('/\b(\d+)\s*(?:volunteer|member|student|person|people|slot|s)?\b/i', $prompt, $numMatch);
        $slotsNeeded = isset($numMatch[1]) ? (int) $numMatch[1] : 5;

        // Extract day
        $days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        $day  = null;
        foreach ($days as $d) {
            if (str_contains($prompt, $d)) {
                $day = ucfirst($d);
                break;
            }
        }

        // Extract time block
        $timeBlock = 'Morning';
        if (str_contains($prompt, 'afternoon') || str_contains($prompt, 'pm')) {
            $timeBlock = 'Afternoon';
        }

        return [
            'day'          => $day,
            'time_block'   => $timeBlock,
            'slots_needed' => $slotsNeeded,
            'confidence'   => 1.0,
            'top_match'    => $prompt,
        ];
    }

    /**
     * Resolve event from parsed data or event ID
     * 
     * Returns: ['exists' => bool, 'event' => Event|null, 'suggestions' => array]
     */
    protected function resolveEvent(array $parsed, ?int $eventId = null): array
    {
        // Case A: Event ID provided (from event view)
        if ($eventId) {
            $event = Event::find($eventId);
            
            if ($event) {
                return [
                    'exists' => true,
                    'event' => $event,
                    'suggestions' => null
                ];
            }
        }

        // Case B: Try to find matching event from parsed data
        $eventDate = $this->extractEventDate($parsed);
        
        if ($eventDate) {
            $event = $this->findMatchingEvent($eventDate, $parsed['time_block'] ?? null);
            
            if ($event) {
                return [
                    'exists' => true,
                    'event' => $event,
                    'suggestions' => null
                ];
            }
        }

        // Case C: No matching event found
        return [
            'exists' => false,
            'event' => null,
            'suggestions' => $this->generateEventCreationSuggestions($parsed)
        ];
    }

    /**
     * Extract event date from parsed NLP data
     */
    protected function extractEventDate(array $parsed): ?string
    {
        $day = $parsed['day'] ?? null;
        
        if (!$day) {
            return null;
        }

        // Map day name to next occurrence
        $daysOfWeek = [
            'Monday' => Carbon::MONDAY,
            'Tuesday' => Carbon::TUESDAY,
            'Wednesday' => Carbon::WEDNESDAY,
            'Thursday' => Carbon::THURSDAY,
            'Friday' => Carbon::FRIDAY,
            'Saturday' => Carbon::SATURDAY,
        ];

        if (isset($daysOfWeek[$day])) {
            return Carbon::now()
                ->next($daysOfWeek[$day])
                ->toDateString();
        }

        return null;
    }

    /**
     * Find matching event by date and time
     */
    protected function findMatchingEvent(string $date, ?string $timeBlock): ?Event
    {
        $query = Event::whereDate('date', $date)
            ->where('status', '!=', 'cancelled');

        if ($timeBlock) {
            $query->where('time_block', $timeBlock);
        }

        return $query->first();
    }

    /**
     * Generate suggestions for event creation
     */
    protected function generateEventCreationSuggestions(array $parsed): array
    {
        $date = $this->extractEventDate($parsed);
        $timeBlock = $parsed['time_block'] ?? 'Morning';

        return [
            'date' => $date,
            'time_block' => $timeBlock,
            'volunteer_count' => $parsed['slots_needed'] ?? 5,
            'title' => "Event on {$parsed['day']} {$timeBlock}",
        ];
    }

    /**
     * Get eligible members with calculated ML features
     */
    protected function getEligibleMembersWithFeatures(string $eventDate, string $timeBlock): \Illuminate\Support\Collection
    {
        return Member::where('role_id', '!=', 1) // Exclude admins
            ->whereHas('role', function ($q) {
                $q->whereIn('name', ['member', 'adviser']);
            })
            ->get()
            ->map(function ($member) use ($eventDate, $timeBlock) {
                return $member->toMLFeatures($eventDate, $timeBlock);
            });
    }

    /**
     * Rank members locally using a fairness score derived from participation
     * history and attendance. Replaces the old /predict-assignments NLP call.
     *
     * Returns a structure compatible with the existing successResponse() format:
     * ['recommended' => [...], 'all_candidates' => [...], 'coverage' => bool, 'shortfall' => int]
     */
    protected function predictAssignments(array $members, string $eventDate, int $eventSize): ?array
    {
        $scored = array_map(function (array $m) {
            $attendance = (float) ($m['attendance_rate']            ?? 0.8);
            $daysSince  = (int)   ($m['days_since_last_assignment'] ?? 30);
            $recent30   = (int)   ($m['assignments_last_30_days']   ?? 0);

            $score = ($attendance * 10)
                   + ($daysSince  / 30)
                   - ($recent30   * 0.5);

            return array_merge($m, [
                'assignment_probability'   => round(min(max($score / 12.0, 0.0), 1.0), 4),
                'fairness_adjusted_score' => round($score, 4),
                'fairness_bias'           => $score > 8 ? 'positive' : ($score < 4 ? 'negative' : 'neutral'),
                'should_assign'           => ($m['is_available'] ?? 1) === 1,
            ]);
        }, $members);

        usort($scored, fn($a, $b) =>
            $b['fairness_adjusted_score'] <=> $a['fairness_adjusted_score']
        );

        $recommended = array_slice($scored, 0, $eventSize);
        $shortfall   = max(0, $eventSize - count($recommended));

        return [
            'recommended'    => $recommended,
            'all_candidates' => $scored,
            'event_size'     => $eventSize,
            'coverage'       => $shortfall === 0,
            'shortfall'      => $shortfall,
        ];
    }

    /**
     * Finalize assignments (human approved)
     */
    public function finalizeAssignments(int $eventId, array $memberIds): array
    {
        $event = Event::findOrFail($eventId);
        
        // Clear existing assignments for this event
        VolunteerAssignment::where('event_id', $eventId)->delete();

        $assigned = [];
        
        // Limit assignments to required_volunteers
        $slotsAvailable = $event->required_volunteers;
        $membersToAssign = array_slice($memberIds, 0, $slotsAvailable);
        
        foreach ($membersToAssign as $memberId) {
            $assignment = VolunteerAssignment::create([
                'event_id' => $eventId,
                'member_id' => $memberId,
                'assigned_by' => auth()->id(),
            ]);

            $assigned[] = $assignment->load('member');
        }

        // Update assigned_volunteers count
        $event->assigned_volunteers = count($assigned);
        $event->save();

        return [
            'success' => true,
            'message' => "Successfully assigned " . count($assigned) . " volunteer(s)",
            'assigned_count' => count($assigned),
            'assignments' => $assigned,
            'event' => $event->fresh()->load('volunteerAssignments.member')
        ];
    }

    /**
     * Get explanation for a specific member's recommendation
     */
    public function explainRecommendation(int $memberId, string $eventDate, int $eventSize): ?array
    {
        $member = Member::findOrFail($memberId);
        
        $features = $member->toMLFeatures($eventDate, 'Morning'); // Default time block

        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->nlpServiceUrl}/explain-assignment", [
                    'member' => $features,
                    'event_date' => $eventDate,
                    'event_size' => $eventSize
                ]);

            return $response->successful() ? $response->json() : null;
        } catch (\Exception $e) {
            Log::error('Explanation request failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Format success response
     */
    protected function successResponse(Event $event, array $recommendations, array $parsed, $membersFeaturesCollection): array
    {
        // Create lookup map: member_id => features
        $featuresMap = $membersFeaturesCollection->keyBy('member_id');
        
        $recommended = collect($recommendations['recommended'])
            ->map(function ($rec) use ($featuresMap) {
                $member = Member::find($rec['member_id']);
                $features = $featuresMap->get($rec['member_id']);
                
                return [
                    'member' => $member,
                    'probability' => $rec['assignment_probability'],
                    'fairness_adjusted_score' => $rec['fairness_adjusted_score'] ?? $rec['assignment_probability'],
                    'fairness_bias' => $rec['fairness_bias'] ?? 'neutral',
                    'should_assign' => $rec['should_assign'],
                    'explanation' => $this->generateExplanation($rec),
                    'features' => $features // Include ML features for SHAP endpoint
                ];
            });

        return [
            'success' => true,
            'event_exists' => true,
            'event' => $event,
            'suggested_members' => $recommended->toArray(),
            'coverage' => $recommendations['coverage'],
            'shortfall' => $recommendations['shortfall'],
            'parsed_request' => $parsed,
            'explanation' => $this->generateOverallExplanation($recommended, $parsed),
        ];
    }

    /**
     * Format event not found response
     */
    protected function eventNotFoundResponse(array $parsed, array $eventResolution): array
    {
        return [
            'success' => false,
            'event_exists' => false,
            'message' => 'No event found for this schedule. Please create the event first.',
            'parsed_request' => $parsed,
            'event_suggestions' => $eventResolution['suggestions'],
            'action' => 'create_event'
        ];
    }

    /**
     * Format error response
     */
    protected function errorResponse(string $message): array
    {
        return [
            'success' => false,
            'message' => $message,
            'error'   => $message,
        ];
    }

    /**
     * Generate human-readable explanation for a recommendation
     */
    protected function generateExplanation(array $recommendation): string
    {
        $reasons = [];

        if ($recommendation['assignment_probability'] > 0.8) {
            $reasons[] = 'high availability and balanced participation';
        } elseif ($recommendation['assignment_probability'] > 0.6) {
            $reasons[] = 'good balance of availability and fairness';
        } else {
            $reasons[] = 'available but may have recent assignments';
        }

        return 'Selected due to ' . implode(', ', $reasons) . '.';
    }

    /**
     * Generate overall explanation for assignment set
     */
    protected function generateOverallExplanation(\Illuminate\Support\Collection $recommended, array $parsed): string
    {
        $count = $recommended->count();
        $needed = $parsed['slots_needed'] ?? $count;

        if ($count < $needed) {
            return "Found {$count} suitable volunteers (needed {$needed}). Some members may be unavailable or recently assigned.";
        }

        return "Balanced assignment considering availability, participation history, and fairness principles.";
    }

    /**
     * Check if NLP service is healthy
     */
    public function checkHealth(): bool
    {
        try {
            $response = Http::timeout(5)->get("{$this->nlpServiceUrl}/health");
            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }
}
