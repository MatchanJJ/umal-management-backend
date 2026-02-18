<?php

namespace App\Http\Controllers;

use App\Services\AssignAIService;
use App\Services\AssignAIChatService;
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
    protected AssignAIChatService $chatService;

    public function __construct(AssignAIService $assignAI, AssignAIChatService $chatService)
    {
        $this->assignAI    = $assignAI;
        $this->chatService = $chatService;
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

        // 200 for success or event-not-found (informational, frontend handles it);
        // 422 for genuine processing failures.
        if ($result['success'] || isset($result['event_exists'])) {
            return response()->json($result, 200);
        }

        return response()->json($result, 422);
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
     * Multi-turn assignment chat
     *
     * POST /api/assignai/chat
     *
     * Body: {
     *   "event_id": 12,
     *   "message": "females only, no class conflicts",
     *   "conversation_history": [{"role":"user","content":"..."}, ...]
     * }
     */
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_id'             => 'required|integer|exists:events,id',
            'message'              => 'required|string|min:1',
            'conversation_history' => 'nullable|array',
        ]);

        $event   = \App\Models\Event::findOrFail($validated['event_id']);
        $history = $validated['conversation_history'] ?? [];

        $result = $this->chatService->chat($event, $validated['message'], $history);

        // Always return 200 — errors surface as chat bubbles on the frontend
        return response()->json($result, 200);
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

    /**
     * Get SHAP-based explanation for a member's assignment recommendation
     * 
     * POST /api/assignai/explain-shap
     * 
     * Body: {
     *   "member_id": "123",
     *   "is_available": 1,
     *   "assignments_last_7_days": 0,
     *   "assignments_last_30_days": 2,
     *   "days_since_last_assignment": 15,
     *   "attendance_rate": 0.95,
     *   "event_date": "2026-02-21",
     *   "event_size": 3
     * }
     */
    public function explainShap(Request $request): JsonResponse
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'member_id' => 'required|string',
            'is_available' => 'required|integer|in:0,1',
            'has_class_conflict' => 'nullable|integer|in:0,1',
            'assignments_last_7_days' => 'required|integer|min:0',
            'assignments_last_30_days' => 'required|integer|min:0',
            'days_since_last_assignment' => 'required|integer|min:0',
            'attendance_rate' => 'required|numeric|min:0|max:1',
            'event_date' => 'required|date',
            'event_size' => 'required|integer|min:1'
        ]);

        if ($validator->fails()) {
            \Illuminate\Support\Facades\Log::error('explainShap validation failed', [
                'errors' => $validator->errors()->toArray(),
                'input' => $request->all(),
            ]);
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();

        // Normalize event_date to Y-m-d regardless of how the model serialized it
        $eventDate = \Carbon\Carbon::parse($validated['event_date'])->toDateString();

        try {
            $nlpServiceUrl = config('services.nlp.url', 'http://localhost:8001');
            
            // NLP service expects member fields flat in body, event_date/event_size as query params
            $response = \Illuminate\Support\Facades\Http::timeout(30)
                ->post("{$nlpServiceUrl}/explain-shap?event_date={$eventDate}&event_size={$validated['event_size']}", [
                    'member_id' => $validated['member_id'],
                    'is_available' => $validated['is_available'],
                    'has_class_conflict' => $validated['has_class_conflict'] ?? 0,
                    'assignments_last_7_days' => $validated['assignments_last_7_days'],
                    'assignments_last_30_days' => $validated['assignments_last_30_days'],
                    'days_since_last_assignment' => $validated['days_since_last_assignment'],
                    'attendance_rate' => $validated['attendance_rate'],
                ]);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json([
                'error' => 'SHAP explanation service unavailable',
                'details' => $response->body()
            ], 503);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch SHAP explanation',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
