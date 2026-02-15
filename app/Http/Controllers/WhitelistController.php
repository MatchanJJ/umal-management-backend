<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\MemberWhitelist;
use Illuminate\Validation\ValidationException;

class WhitelistController extends Controller
{
    /**
     * Display a listing of whitelist entries.
     */
    public function index(Request $request)
    {
        $query = MemberWhitelist::with('approver');

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by role
        if ($request->has('role')) {
            $query->byRole($request->role);
        }

        // Get whitelist entries
        $whitelists = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($whitelists);
    }

    /**
     * Get pending whitelist requests.
     */
    public function pending()
    {
        $pending = MemberWhitelist::pending()
            ->with('approver')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($pending);
    }

    /**
     * Store a new whitelist entry.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|unique:member_whitelist,email',
            'approved_role' => 'required|in:admin,adviser,member',
        ]);

        // Validate university email
        try {
            MemberWhitelist::validateUniversityEmail($validated['email']);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        // Check user permission - admin can whitelist advisers/members, adviser can whitelist members
        $user = auth()->user();
        $userRole = $user->role?->name;

        if ($userRole === 'adviser' && $validated['approved_role'] !== 'member') {
            return response()->json(['error' => 'Advisers can only whitelist members.'], 403);
        }

        $whitelist = MemberWhitelist::create([
            'email' => $validated['email'],
            'approved_role' => $validated['approved_role'],
            'status' => 'pending',
            'approved_by' => null,
        ]);

        return response()->json([
            'message' => 'Email added to whitelist.',
            'whitelist' => $whitelist
        ], 201);
    }

    /**
     * Approve a whitelist entry.
     */
    public function approve($id)
    {
        $whitelist = MemberWhitelist::findOrFail($id);

        // Check permission
        $user = auth()->user();
        $userRole = $user->role?->name;

        if ($userRole === 'adviser' && $whitelist->approved_role !== 'member') {
            return response()->json(['error' => 'Advisers can only approve members.'], 403);
        }

        $whitelist->approve($user->id);

        return response()->json([
            'message' => 'Whitelist entry approved.',
            'whitelist' => $whitelist->fresh()
        ]);
    }

    /**
     * Reject a whitelist entry.
     */
    public function reject($id)
    {
        $whitelist = MemberWhitelist::findOrFail($id);

        // Check permission
        $user = auth()->user();
        $userRole = $user->role?->name;

        if ($userRole === 'adviser' && $whitelist->approved_role !== 'member') {
            return response()->json(['error' => 'Advisers can only reject member requests.'], 403);
        }

        $whitelist->reject($user->id);

        return response()->json([
            'message' => 'Whitelist entry rejected.',
            'whitelist' => $whitelist->fresh()
        ]);
    }

    /**
     * Remove a whitelist entry.
     */
    public function destroy($id)
    {
        $whitelist = MemberWhitelist::findOrFail($id);

        // Check permission
        $user = auth()->user();
        $userRole = $user->role?->name;

        if ($userRole === 'adviser' && $whitelist->approved_role !== 'member') {
            return response()->json(['error' => 'Advisers can only remove member entries.'], 403);
        }

        $whitelist->delete();

        return response()->json([
            'message' => 'Whitelist entry removed.'
        ]);
    }

    /**
     * Bulk import emails (for advisers adding multiple members).
     */
    public function bulkImport(Request $request)
    {
        $validated = $request->validate([
            'emails' => 'required|array|min:1',
            'emails.*' => 'required|email',
            'approved_role' => 'required|in:member', // Bulk import only for members
        ]);

        $user = auth()->user();
        $results = [
            'success' => [],
            'failed' => [],
        ];

        foreach ($validated['emails'] as $email) {
            try {
                // Validate university email
                MemberWhitelist::validateUniversityEmail($email);

                // Check if already exists
                if (MemberWhitelist::where('email', $email)->exists()) {
                    $results['failed'][] = [
                        'email' => $email,
                        'reason' => 'Already in whitelist'
                    ];
                    continue;
                }

                MemberWhitelist::create([
                    'email' => $email,
                    'approved_role' => $validated['approved_role'],
                    'status' => 'pending',
                    'approved_by' => null,
                ]);

                $results['success'][] = $email;
            } catch (\Exception $e) {
                $results['failed'][] = [
                    'email' => $email,
                    'reason' => $e->getMessage()
                ];
            }
        }

        return response()->json([
            'message' => 'Bulk import completed.',
            'results' => $results
        ]);
    }
}

