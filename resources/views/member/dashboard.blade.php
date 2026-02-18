@extends('layouts.app')

@section('title', 'Member Dashboard')

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Member Dashboard</h1>
        <p class="mt-1 text-sm text-gray-600">Welcome back, {{ auth()->user()->first_name }}!</p>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-8">
        <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="text-sm font-medium text-gray-500 truncate">View Events</dt>
                            <dd class="mt-1">
                                <a href="{{ route('events.index') }}" class="text-sm text-blue-600 hover:text-blue-800">
                                    See all events →
                                </a>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="text-sm font-medium text-gray-500 truncate">Update Profile</dt>
                            <dd class="mt-1">
                                <a href="{{ route('onboarding') }}" class="text-sm text-blue-600 hover:text-blue-800">
                                    Complete your profile →
                                </a>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- My Assignments -->
    <div class="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">My Volunteer Assignments</h3>
            <p class="mt-1 text-sm text-gray-500">Events you're assigned to volunteer for</p>
        </div>
        <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
            <p class="text-sm text-gray-500">No assignments yet. Check the <a href="{{ route('events.index') }}" class="text-blue-600 hover:text-blue-800">events page</a> for opportunities.</p>
        </div>
    </div>

    <!-- Upcoming Events -->
    <div class="bg-white shadow overflow-hidden sm:rounded-lg">
        <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Upcoming Events</h3>
        </div>
        <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
            <p class="text-sm text-gray-500">Check the <a href="{{ route('events.index') }}" class="text-blue-600 hover:text-blue-800">events page</a> to see what's coming up.</p>
        </div>
    </div>
</div>
@endsection
