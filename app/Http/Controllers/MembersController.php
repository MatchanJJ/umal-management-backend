<?php

namespace App\Http\Controllers;

use App\Models\Member;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MembersController extends Controller
{
    public function index(Request $request)
    {
        $search   = $request->input('search', '');
        $college  = $request->input('college');
        $gender   = $request->input('gender');
        $yearLevel= $request->input('year_level');

        $query = Member::with(['college', 'course'])
            ->whereHas('role', fn($q) => $q->where('name', 'member'));

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where(DB::raw("CONCAT(first_name,' ',last_name)"), 'like', "%{$search}%")
                  ->orWhere('student_number', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($college) {
            $query->where('college_id', $college);
        }

        if ($gender) {
            $query->where('gender', $gender);
        }

        if ($yearLevel) {
            $query->where('year_level', $yearLevel);
        }

        $members = $query->orderBy('last_name')->orderBy('first_name')->paginate(20)->withQueryString();

        // ── Today's conflict status for each member ───────────────────────────
        $today     = Carbon::today();
        $dayOfWeek = $today->format('l'); // e.g. "Thursday"

        // Find active term
        $term = DB::table('terms')
            ->where('start_date', '<=', $today->toDateString())
            ->where('end_date', '>=', $today->toDateString())
            ->first();

        // ── Availability for today per member ─────────────────────────────────
        $memberAvailability = [];

        $termId = $term?->id;
        if ($termId) {
            $rows = DB::table('member_availability')
                ->where('term_id', $termId)
                ->where('day_of_week', $dayOfWeek)
                ->whereIn('member_id', $members->pluck('id'))
                ->get(['member_id', 'time_block', 'is_available']);

            foreach ($rows as $row) {
                $memberAvailability[$row->member_id][strtolower($row->time_block)] = (bool) $row->is_available;
            }
        }

        // ── Filter lists for dropdowns ────────────────────────────────────────
        $colleges = DB::table('colleges')->orderBy('name')->get();

        return view('members.index', compact(
            'members',
            'memberAvailability',
            'colleges',
            'search',
            'college',
            'gender',
            'yearLevel',
            'today',
            'dayOfWeek',
        ));
    }
}
