@extends('layouts.app')

@section('title', $event->title)

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-6">
        <div class="flex justify-between items-start">
            <div class="flex-1">
                <div class="flex items-center space-x-3 mb-2">
                    <h1 class="text-2xl font-bold text-gray-900">{{ $event->title }}</h1>
                    <span class="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium
                        @if($event->status === 'draft') bg-gray-100 text-gray-800
                        @elseif($event->status === 'scheduled') bg-blue-100 text-blue-800
                        @elseif($event->status === 'ongoing') bg-green-100 text-green-800
                        @elseif($event->status === 'completed') bg-purple-100 text-purple-800
                        @elseif($event->status === 'cancelled') bg-red-100 text-red-800
                        @endif">
                        {{ ucfirst($event->status) }}
                    </span>
                </div>
                <p class="text-sm text-gray-600">
                    Created by {{ $event->creator->first_name }} {{ $event->creator->last_name }}
                    ({{ $event->creator->role->name }}) on {{ $event->created_at->format('F j, Y') }}
                </p>
            </div>
            <div class="flex space-x-3">
                @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
                <button type="button" 
                        x-data
                        @click="console.log('🔵 Button clicked, dispatching event for ID: {{ $event->id }}'); $dispatch('open-assignai', { eventId: {{ $event->id }} })"
                        class="cursor-pointer inline-flex items-center gap-2 px-6 py-3 border-2 border-blue-600 shadow-xl text-base font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    Get AI Recommendations
                </button>
                @endif
                @if(auth()->user()->id === $event->created_by || auth()->user()->role->name === 'admin')
                <a href="{{ route('events.edit', $event->id) }}"
                   class="inline-flex items-center px-5 py-3 border-2 border-gray-300 shadow-sm text-base font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500/20 transition-all">
                    Edit
                </a>
                @endif
                <a href="{{ route('events.index') }}"
                   class="inline-flex items-center px-5 py-3 border-2 border-gray-300 shadow-sm text-base font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500/20 transition-all">
                    Back to Events
                </a>
            </div>
        </div>
    </div>

    <!-- Event Details -->
    <div class="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Event Details</h3>
        </div>
        <div class="border-t border-gray-200">
            <dl>
                <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt class="text-sm font-medium text-gray-500">Date</dt>
                    <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {{ \Carbon\Carbon::parse($event->date)->format('l, F j, Y') }}
                    </dd>
                </div>
                <div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt class="text-sm font-medium text-gray-500">Time</dt>
                    <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {{ $event->time_block }}
                    </dd>
                </div>
                @if($event->venue)
                <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt class="text-sm font-medium text-gray-500">Venue</dt>
                    <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {{ $event->venue }}
                    </dd>
                </div>
                @endif
                <div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt class="text-sm font-medium text-gray-500">Volunteers Needed</dt>
                    <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <span class="font-medium">{{ $event->assigned_volunteers }}</span>
                        /
                        <span class="text-gray-500">{{ $event->required_volunteers }}</span>
                        @if($event->isFullyStaffed())
                        <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Fully Staffed
                        </span>
                        @else
                        <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Need {{ $event->getShortfall() }} more
                        </span>
                        @endif
                    </dd>
                </div>
                @if($event->description)
                <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt class="text-sm font-medium text-gray-500">Description</dt>
                    <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {{ $event->description }}
                    </dd>
                </div>
                @endif
            </dl>
        </div>
    </div>

    <!-- Assigned Volunteers -->
    <div class="bg-white shadow overflow-hidden sm:rounded-lg">
        <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Assigned Volunteers</h3>
            <p class="mt-1 text-sm text-gray-600">{{ $event->volunteerAssignments->count() }} volunteer(s) assigned</p>
        </div>
        <div class="border-t border-gray-200">
            @if($event->volunteerAssignments->isNotEmpty())
            <ul class="divide-y divide-gray-200">
                @foreach($event->volunteerAssignments as $assignment)
                <li class="px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span class="text-blue-600 font-medium text-sm">
                                        {{ substr($assignment->member->first_name, 0, 1) }}{{ substr($assignment->member->last_name, 0, 1) }}
                                    </span>
                                </div>
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900">
                                    {{ $assignment->member->first_name }} {{ $assignment->member->last_name }}
                                </div>
                                <div class="text-sm text-gray-500">
                                    {{ $assignment->member->email }}
                                </div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-500">
                            Assigned {{ $assignment->assigned_at->diffForHumans() }}
                        </div>
                    </div>
                </li>
                @endforeach
            </ul>
            @else
            <div class="px-4 py-8 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <p class="mt-4 text-sm text-gray-500">No volunteers assigned yet</p>
                @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
                <p class="mt-2">
                    <button @click="$dispatch('open-assignai', { eventId: {{ $event->id }} })"
                            class="text-blue-600 hover:text-blue-800 font-medium">
                        Use AssignAI to get recommendations
                    </button>
                </p>
                @endif
            </div>
            @endif
        </div>
    </div>
</div>

<!-- Include AssignAI Modal -->
@if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
    @include('components.assignai-modal')
@endif
@endsection
