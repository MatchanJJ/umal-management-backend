<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Member;
use App\Models\MemberWhitelist;
use Illuminate\Http\Request;

class AdminDashboardController extends Controller
{
    public function index()
    {
        $totalEvents = Event::count();
        $activeMembers = Member::count();
        $pendingApprovals = MemberWhitelist::where('status', 'pending')->count();

        return view('admin.dashboard', compact('totalEvents', 'activeMembers', 'pendingApprovals'));
    }
}
