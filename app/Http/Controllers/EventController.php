<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EventController extends Controller
{
    /**
     * Display a listing of events
     */
    public function index(Request $request)
    {
        $query = Event::with(['creator.role']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by creator
        if ($request->has('creator_id')) {
            $query->where('created_by', $request->creator_id);
        }

        // Filter by date
        if ($request->has('date')) {
            $query->whereDate('date', $request->date);
        }

        // Filter by time block
        if ($request->has('time_block')) {
            $query->where('time_block', $request->time_block);
        }

        $events = $query->orderBy('date', 'desc')->paginate(20);

        if ($request->expectsJson()) {
            return response()->json($events);
        }

        return view('events.index', compact('events'));
    }

    /**
     * Show the form for creating a new event
     */
    public function create()
    {
        $timeBlocks = ['Morning', 'Afternoon'];
        return view('events.create', compact('timeBlocks'));
    }

    /**
     * Store a newly created event
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'date' => 'required|date',
            'time_block' => 'required|in:Morning,Afternoon',
            'venue' => 'nullable|string|max:255',
            'required_volunteers' => 'required|integer|min:1',
            'status' => 'required|in:draft,scheduled,ongoing,completed,cancelled',
        ]);

        try {
            // Create the event with integrated schedule
            $event = Event::create([
                'title' => $validated['title'],
                'description' => $validated['description'],
                'date' => $validated['date'],
                'time_block' => $validated['time_block'],
                'venue' => $validated['venue'] ?? null,
                'required_volunteers' => $validated['required_volunteers'],
                'assigned_volunteers' => 0,
                'created_by' => auth()->id(),
                'status' => $validated['status'],
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Event created successfully.',
                    'event' => $event
                ], 201);
            }

            return redirect()->route('events.show', $event->id)
                ->with('success', 'Event created successfully.');

        } catch (\Exception $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Failed to create event: ' . $e->getMessage()
                ], 500);
            }

            return back()->withInput()
                ->with('error', 'Failed to create event: ' . $e->getMessage());
        }
    }

    /**
     * Display the specified event
     */
    public function show($id)
    {
        $event = Event::with([
            'creator.role',
            'volunteerAssignments.member'
        ])->findOrFail($id);

        return view('events.show', compact('event'));
    }

    /**
     * Show the form for editing the specified event
     */
    public function edit($id)
    {
        $event = Event::findOrFail($id);
        $timeBlocks = ['Morning', 'Afternoon'];

        // Check permission - only creator or admin can edit
        $user = auth()->user();
        if ($event->created_by !== $user->id && $user->role->name !== 'admin') {
            abort(403, 'You are not authorized to edit this event.');
        }

        return view('events.edit', compact('event', 'timeBlocks'));
    }

    /**
     * Update the specified event
     */
    public function update(Request $request, $id)
    {
        $event = Event::findOrFail($id);

        // Check permission
        $user = auth()->user();
        if ($event->created_by !== $user->id && $user->role->name !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'date' => 'required|date',
            'time_block' => 'required|in:Morning,Afternoon',
            'venue' => 'nullable|string|max:255',
            'required_volunteers' => 'required|integer|min:1',
            'status' => 'required|in:draft,scheduled,ongoing,completed,cancelled',
        ]);

        try {
            // Update event
            $event->update([
                'title' => $validated['title'],
                'description' => $validated['description'],
                'date' => $validated['date'],
                'time_block' => $validated['time_block'],
                'venue' => $validated['venue'] ?? null,
                'required_volunteers' => $validated['required_volunteers'],
                'status' => $validated['status'],
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Event updated successfully.',
                    'event' => $event->fresh()
                ]);
            }

            return redirect()->route('events.show', $event->id)
                ->with('success', 'Event updated successfully.');

        } catch (\Exception $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Failed to update event: ' . $e->getMessage()
                ], 500);
            }

            return back()->withInput()
                ->with('error', 'Failed to update event: ' . $e->getMessage());
        }
    }

    /**
     * Remove the specified event
     */
    public function destroy($id)
    {
        $event = Event::findOrFail($id);

        // Check permission - only creator or admin can delete
        $user = auth()->user();
        if ($event->created_by !== $user->id && $user->role->name !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        DB::beginTransaction();
        try {
            // Delete related assignments
            $event->volunteerAssignments()->delete();
            $event->delete();

            DB::commit();

            return response()->json([
                'message' => 'Event deleted successfully.'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Failed to delete event: ' . $e->getMessage()
            ], 500);
        }
    }
}
