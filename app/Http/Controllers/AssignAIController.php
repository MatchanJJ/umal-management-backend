<?php

namespace App\Http\Controllers;

use App\Services\AssignAIService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * AssignAI Controller
 * 
 * Handles agentic NLP-based volunteer assignment requests
 * with human-in-the-loop approval workflow.
 */
class AssignAIController extends Controller
{
    protected AssignAIService $assignAI;

    public function __construct(AssignAIService $assignAI)
    {
        $this->assignAI = $assignAI;
    }

    /**
     * Main AssignAI suggestion endpoint
     * 
     * POST /api/assignai/suggest
     * 
     * Body: {
     *   "prompt": "Need 5 volunteers Friday morning",
     *   "event_id": 12 (optional)
     * }
     */
    public function suggest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => 'required|string|min:5',
            'event_id' => 'nullable|integer|exists:events,id'
        ]);

        $result = $this->assignAI->suggestAssignments(
            $validated['prompt'],
            $validated['event_id'] ?? null
        );

        $statusCode = $result['success'] ? 200 : 400;

        return response()->json($result, $statusCode);
    }

    /**
     * Finalize assignments (human approval)
     * 
     * POST /api/assignai/finalize
     * 
     * Body: {
     *   "event_id": 12,
     *   "member_ids": [3, 7, 9, 10]
     * }
     */
    public function finalize(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_id' => 'required|integer|exists:events,id',
            'member_ids' => 'required|array|min:1',
            'member_ids.*' => 'required|integer|exists:members,id'
        ]);

        $result = $this->assignAI->finalizeAssignments(
            $validated['event_id'],
            $validated['member_ids']
        );

        return response()->json($result);
    }

    /**
     * Get explanation for a specific recommendation
     * 
     * POST /api/assignai/explain
     * 
     * Body: {
     *   "member_id": 3,
     *   "event_date": "2026-02-21",
     *   "event_size": 5
     * }
     */
    public function explain(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'member_id' => 'required|integer|exists:members,id',
            'event_date' => 'required|date',
            'event_size' => 'required|integer|min:1'
        ]);

        $explanation = $this->assignAI->explainRecommendation(
            $validated['member_id'],
            $validated['event_date'],
            $validated['event_size']
        );

        if (!$explanation) {
            return response()->json([
                'error' => 'Failed to get explanation'
            ], 500);
        }

        return response()->json($explanation);
    }

    /**
     * Regenerate suggestions (allow user to request new recommendations)
     * 
     * POST /api/assignai/regenerate
     * 
     * Body: {
     *   "event_id": 12,
     *   "excluded_member_ids": [3, 7] (optional)
     * }
     */
    public function regenerate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_id' => 'required|integer|exists:events,id',
            'excluded_member_ids' => 'nullable|array',
            'excluded_member_ids.*' => 'integer|exists:members,id'
        ]);

        // Get event details and regenerate with exclusions
        $event = \App\Models\Event::findOrFail($validated['event_id']);
        
        // Build prompt from event data
        $prompt = sprintf(
            "Need volunteers for %s %s",
            $event->date,
            \Carbon\Carbon::parse($event->start_time)->hour < 12 ? 'morning' : 'afternoon'
        );

        $result = $this->assignAI->suggestAssignments($prompt, $event->id);

        // Filter out excluded members
        if (isset($validated['excluded_member_ids']) && $result['success']) {
            $excluded = $validated['excluded_member_ids'];
            $result['suggested_members'] = array_filter(
                $result['suggested_members'],
                fn($rec) => !in_array($rec['member']->id, $excluded)
            );
            $result['suggested_members'] = array_values($result['suggested_members']);
        }

        return response()->json($result);
    }

    /**
     * Check NLP service health
     * 
     * GET /api/assignai/health
     */
    public function health(): JsonResponse
    {
        $isHealthy = $this->assignAI->checkHealth();

        return response()->json([
            'nlp_service' => $isHealthy ? 'available' : 'unavailable',
            'assignai_ready' => $isHealthy
        ], $isHealthy ? 200 : 503);
    }

    /**
     * Parse prompt only (for preview/debugging)
     * 
     * POST /api/assignai/parse
     * 
     * Body: {
     *   "prompt": "Need 5 volunteers Friday morning"
     * }
     */
    public function parseOnly(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => 'required|string'
        ]);

        // This would need to be added to AssignAIService as a public method
        // For now, return a simple response
        return response()->json([
            'message' => 'Parse endpoint - feature coming soon',
            'prompt' => $validated['prompt']
        ]);
    }
}
