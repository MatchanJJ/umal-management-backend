@extends('layouts.app')

@section('title', $event->title)

@section('content')
<div
    x-data="{
        ...assignAIChat({{ $event->id }}, {{ $event->required_volunteers }}),
        ...volunteerManagement()
    }"
    @keydown.escape.window="panelOpen = false; memberModalOpen = false"
    class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

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
                        @click="panelOpen = !panelOpen"
                        class="cursor-pointer inline-flex items-center gap-2 px-6 py-3 border-2 border-blue-600 shadow-xl text-base font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    <span x-text="panelOpen ? 'Close AssignAI' : 'AssignAI Chat'"></span>
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
        <div class="px-4 py-5 sm:px-6 flex justify-between items-start">
            <div>
                <h3 class="text-lg leading-6 font-medium text-gray-900">Assigned Volunteers</h3>
                <p class="mt-1 text-sm text-gray-600">{{ $event->volunteerAssignments->count() }} volunteer(s) assigned</p>
            </div>
            @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
            <button @click="openMemberModal()"
                    type="button"
                    class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Add Volunteer
            </button>
            @endif
        </div>
        <div class="border-t border-gray-200">
            @if($event->volunteerAssignments->isNotEmpty())
            <ul class="divide-y divide-gray-200">
                @foreach($event->volunteerAssignments as $assignment)
                <li class="px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center flex-1">
                            <div class="flex-shrink-0">
                                <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span class="text-blue-600 font-medium text-sm">
                                        {{ substr($assignment->member->first_name, 0, 1) }}{{ substr($assignment->member->last_name, 0, 1) }}
                                    </span>
                                </div>
                            </div>
                            <div class="ml-4 flex-1">
                                <div class="text-sm font-medium text-gray-900">
                                    {{ $assignment->member->first_name }} {{ $assignment->member->last_name }}
                                </div>
                                <div class="text-sm text-gray-500">
                                    {{ $assignment->member->email }}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="text-sm text-gray-500">
                                Assigned {{ $assignment->assigned_at->diffForHumans() }}
                            </div>
                            @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
                            <button @click="removeVolunteer({{ $assignment->member->id }}, '{{ $assignment->member->first_name }} {{ $assignment->member->last_name }}')"
                                    type="button"
                                    title="Remove volunteer"
                                    class="inline-flex items-center p-1.5 border border-transparent rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                            @endif
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
                    <button @click="panelOpen = true"
                            class="text-blue-600 hover:text-blue-800 font-medium">
                        Use AssignAI Chat to get recommendations
                    </button>
                </p>
                @endif
            </div>
            @endif
        </div>
    </div>

    {{-- ─── Right Slide-in Chat Panel ──────────────────────────────────────────── --}}
    @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))

    {{-- Backdrop (semi-transparent overlay) --}}
    <div x-show="panelOpen"
         x-transition:enter="transition-opacity ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-30"
         x-transition:leave="transition-opacity ease-in duration-150"
         x-transition:leave-start="opacity-30"
         x-transition:leave-end="opacity-0"
         @click="panelOpen = false"
         class="fixed inset-0 bg-black/30 z-30"
         x-cloak></div>

    {{-- Panel --}}
    <div x-show="panelOpen"
         x-transition:enter="transition ease-out duration-250 transform"
         x-transition:enter-start="translate-x-full"
         x-transition:enter-end="translate-x-0"
         x-transition:leave="transition ease-in duration-200 transform"
         x-transition:leave-start="translate-x-0"
         x-transition:leave-end="translate-x-full"
         class="fixed top-0 right-0 h-full w-[420px] max-w-full bg-white shadow-2xl z-40 flex flex-col"
         x-cloak>

        {{-- Panel Header --}}
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
            <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <span class="font-semibold text-white text-sm">AssignAI Chat</span>
                <span class="text-xs text-blue-200">· {{ $event->title }}</span>
            </div>
            <div class="flex items-center gap-2">
                <button @click="clearChat()" title="New conversation"
                        class="text-blue-200 hover:text-white transition-colors p-1 rounded">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                </button>
                <button @click="panelOpen = false"
                        class="text-blue-200 hover:text-white transition-colors p-1 rounded">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>

        {{-- Current Constraints Badge --}}
        <div x-show="hasConstraints()" class="px-4 py-2 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-1" x-cloak>
            <template x-if="mergedConstraints.gender_filter === 'M'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    ♂ Male only
                    <button @click="clearConstraint('gender_filter')" class="hover:text-blue-900 ml-0.5">×</button>
                </span>
            </template>
            <template x-if="mergedConstraints.gender_filter === 'F'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                    ♀ Female only
                    <button @click="clearConstraint('gender_filter')" class="hover:text-pink-900 ml-0.5">×</button>
                </span>
            </template>
            <template x-if="mergedConstraints.gender_filter === 'split'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    ⚧ Gender split
                    <button @click="clearConstraint('gender_filter')" class="hover:text-purple-900 ml-0.5">×</button>
                </span>
            </template>
            <template x-if="mergedConstraints.new_old_filter === 'new'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    ✨ New members
                    <button @click="clearConstraint('new_old_filter')" class="hover:text-green-900 ml-0.5">×</button>
                </span>
            </template>
            <template x-if="mergedConstraints.new_old_filter === 'old'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    🎖 Veterans
                    <button @click="clearConstraint('new_old_filter')" class="hover:text-amber-900 ml-0.5">×</button>
                </span>
            </template>
            <template x-if="mergedConstraints.conflict_ok === false">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    🚫 No class conflict
                    <button @click="clearConstraint('conflict_ok')" class="hover:text-red-900 ml-0.5">×</button>
                </span>
            </template>
            <template x-if="mergedConstraints.college_filter">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    🏫 <span x-text="mergedConstraints.college_filter"></span>
                    <button @click="clearConstraint('college_filter')" class="hover:text-indigo-900 ml-0.5">×</button>
                </span>
            </template>
        </div>

        {{-- Messages --}}
        <div id="chat-messages"
             class="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">

            {{-- Welcome message --}}
            <template x-if="messages.length === 0">
                <div class="flex flex-col items-center justify-center h-full text-center py-8">
                    <div class="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                        <svg class="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                        </svg>
                    </div>
                    <p class="text-sm font-semibold text-gray-700">Hi! I'm AssignAI.</p>
                    <p class="text-xs text-gray-500 mt-1 max-w-xs">
                        Tell me your preferences and I'll find the best volunteers for
                        <strong>{{ $event->title }}</strong>.
                    </p>
                    <div class="mt-4 space-y-1 text-left w-full max-w-xs">
                        <p class="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Try asking:</p>
                        <button @click="input = 'Recommend the best available volunteers'; sendMessage()"
                                class="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 transition-colors">
                            Recommend the best available volunteers
                        </button>
                        <button @click="input = 'Female members only, no class conflicts'; sendMessage()"
                                class="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 transition-colors">
                            Female members only, no class conflicts
                        </button>
                        <button @click="input = 'Freshies from CCS only'; sendMessage()"
                                class="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 transition-colors">
                            Freshies from CCS only
                        </button>
                        <button @click="input = 'Gender split, veterans first'; sendMessage()"
                                class="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 transition-colors">
                            Gender split, veterans first
                        </button>
                    </div>
                </div>
            </template>

            {{-- Chat bubbles --}}
            <template x-for="(msg, index) in messages" :key="index">
                <div :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
                    {{-- AI avatar --}}
                    <template x-if="msg.role === 'assistant'">
                        <div class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center mr-2 mt-0.5">
                            <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5zm-7 16a7 7 0 0114 0H5z"/>
                            </svg>
                        </div>
                    </template>

                    <div :class="msg.role === 'user'
                        ? 'max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm'
                        : 'max-w-[88%] bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm'">

                        <p x-text="msg.content" class="leading-relaxed"></p>

                        {{-- Recommendation cards --}}
                        <template x-if="msg.role === 'assistant' && msg.recommendations && msg.recommendations.length > 0">
                            <div class="mt-3 space-y-2">
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Top recommendations
                                </p>
                                <template x-for="(rec, ri) in msg.recommendations" :key="ri">
                                    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                                        <div class="flex items-center gap-2">
                                            <input type="checkbox"
                                                   :id="'rec-' + index + '-' + ri"
                                                   :checked="selectedMembers[rec.member_id] !== false"
                                                   @change="toggleMember(rec.member_id, $event.target.checked)"
                                                   class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-1.5">
                                                    <p class="text-sm font-semibold text-gray-900 truncate"
                                                       x-text="rec.full_name || rec.member_id"></p>
                                                    <template x-if="rec.gender_label === 'M'">
                                                        <span class="text-xs text-blue-500">?</span>
                                                    </template>
                                                    <template x-if="rec.gender_label === 'F'">
                                                        <span class="text-xs text-pink-500">?</span>
                                                    </template>
                                                    <template x-if="rec.is_new_member == 1">
                                                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">New</span>
                                                    </template>
                                                </div>
                                                <div class="flex items-center gap-2 mt-0.5">
                                                    <span class="text-xs text-gray-500" x-text="rec.college || ''"></span>
                                                    <span class="text-xs text-gray-400">·</span>
                                                    <span class="text-xs text-gray-500"
                                                          x-text="Math.round((rec.attendance_rate || 0) * 100) + '% attendance'"></span>
                                                </div>
                                            </div>
                                            <div class="text-right flex-shrink-0">
                                                <div class="text-xs font-bold"
                                                     :class="(rec.assignment_probability || 0) >= 0.7 ? 'text-green-600' : (rec.assignment_probability || 0) >= 0.4 ? 'text-amber-600' : 'text-gray-500'"
                                                     x-text="Math.round((rec.assignment_probability || 0) * 100) + '%'">
                                                </div>
                                                <div class="text-xs text-gray-400">score</div>
                                            </div>
                                        </div>
                                        <template x-if="rec.has_class_conflict == 1">
                                            <p class="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                                </svg>
                                                Has class this time block
                                            </p>
                                        </template>
                                    </div>
                                </template>

                                {{-- Assign Selected button --}}
                                <div class="pt-1">
                                    <button @click="finalizeFromMessage(msg.recommendations)"
                                            :disabled="finalizing || selectedCount() === 0"
                                            class="w-full py-2 px-4 rounded-xl text-sm font-semibold transition-all
                                                   bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                                                   flex items-center justify-center gap-2">
                                        <template x-if="finalizing">
                                            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                        </template>
                                        <span x-text="finalizing ? 'Assigning…' : 'Assign ' + selectedCountForMessage(msg.recommendations) + ' selected'"></span>
                                    </button>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </template>

            {{-- Typing indicator --}}
            <template x-if="loading">
                <div class="flex justify-start">
                    <div class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                        <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5zm-7 16a7 7 0 0114 0H5z"/>
                        </svg>
                    </div>
                    <div class="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div class="flex gap-1 items-center">
                            <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay:0s"></span>
                            <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay:0.15s"></span>
                            <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay:0.3s"></span>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        {{-- Input bar --}}
        <div class="border-t border-gray-200 px-3 py-3 bg-white">
            <form @submit.prevent="sendMessage()" class="flex items-end gap-2">
                <textarea
                    x-model="input"
                    @keydown.enter.prevent="if (!$event.shiftKey) sendMessage()"
                    :disabled="loading"
                    rows="1"
                    placeholder="Describe your requirements… (Enter to send, Shift+Enter for new line)"
                    class="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-gray-400 disabled:opacity-50 max-h-32 overflow-y-auto"
                    style="min-height:40px;"
                    @input="autoResize($el)"></textarea>
                <button type="submit"
                        :disabled="loading || !input.trim()"
                        class="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                               flex items-center justify-center transition-colors">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                    </svg>
                </button>
            </form>
            <p class="text-xs text-gray-400 mt-1.5 text-center">
                AssignAI uses AI — always review before confirming.
            </p>
        </div>
    </div>

    {{-- ─── Alpine.js Component Logic ──────────────────────────────────────── --}}
{{--     <script>
    function assignAIChat(eventId, eventSize) {
        return {
            eventId,
            eventSize,
            panelOpen: false,
            messages: [],
            history: [],           // [{role, content}] sent to backend
            input: '',
            loading: false,
            finalizing: false,
            mergedConstraints: {
                groups: [],
                global: { conflict_ok: null, priority_rules: [] },
            },
            selectedMembers: {},   // member_id → boolean            showOverrideModal: false,            showOverrideModal: false,
            showOverflowModal: false,
            confirmationData: null,
            overflowSelectedMembers: {}            showOverflowModal: false,
            confirmationData: null,
            overflowSelectedMembers: {}
            csrfToken() {
                return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
            },

            async sendMessage() {
                const text = this.input.trim();
                if (!text || this.loading) return;

                this.input = '';
                this.loading = true;

                // Add user bubble
                this.messages.push({ role: 'user', content: text });
                this.history.push({ role: 'user', content: text });
                this.$nextTick(() => this.scrollToBottom());

                try {
                    const res = await fetch('/api/assignai/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken(),
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            event_id: this.eventId,
                            message: text,
                            conversation_history: this.history.slice(0, -1), // exclude current message
                            previous_merged_constraints: this.mergedConstraints, // O(1) merge � NLP skips re-parsing history
                        }),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        throw new Error(data.message || 'Request failed');
                    }

                    this.mergedConstraints = data.merged_constraints ?? this.mergedConstraints;

                    // Auto-assign if user confirmed ("yes", "go ahead", "sige", etc.)
                    if (data.is_confirming) {
                        const lastRecs = [...this.messages]
                            .reverse()
                            .find(m => m.role === 'assistant' && m.recommendations && m.recommendations.length > 0)
                            ?.recommendations ?? [];

                        if (lastRecs.length > 0) {
                            this.messages.push({
                                role: 'assistant',
                                content: data.reply,
                                recommendations: [],
                            });
                            this.history.push({ role: 'assistant', content: data.reply });
                            this.$nextTick(() => this.scrollToBottom());
                            await this.finalizeFromMessage(lastRecs);
                            return;
                        }
                    }

                    const recs = data.recommendations ?? [];
                    // Pre-select all recommendations
                    recs.forEach(r => {
                        if (this.selectedMembers[r.member_id] === undefined) {
                            this.selectedMembers[r.member_id] = true;
                        }
                    });

                    const aiMsg = {
                        role: 'assistant',
                        content: data.reply ?? 'Here are my recommendations:',
                        recommendations: recs,
                    };
                    this.messages.push(aiMsg);
                    this.history.push({ role: 'assistant', content: aiMsg.content });

                } catch (err) {
                    this.messages.push({
                        role: 'assistant',
                        content: 'Sorry, something went wrong: ' + (err.message || 'Unknown error'),
                        recommendations: [],
                    });
                } finally {
                    this.loading = false;
                    this.$nextTick(() => this.scrollToBottom());
                }
            },

            toggleMember(memberId, checked) {
                this.selectedMembers[memberId] = checked;
            },

            selectedCount() {
                return Object.values(this.selectedMembers).filter(Boolean).length;
            },

            selectedCountForMessage(recommendations) {
                if (!recommendations || !Array.isArray(recommendations)) return 0;
                return recommendations.filter(r => this.selectedMembers[r.member_id] !== false).length;
            },

            async finalizeFromMessage(recommendations, confirmed = false) {
                const selectedIds = recommendations
                    .filter(r => this.selectedMembers[r.member_id] !== false)
                    .map(r => r.member_id)
                    .filter(id => !!id);

                if (selectedIds.length === 0) {
                    this.showAlert('Please select at least one volunteer to assign.', 'Notice');
                    return;
                }

                this.finalizing = true;
                try {
                    const res = await fetch('/api/assignai/finalize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken(),
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            event_id: this.eventId,
                            member_ids: selectedIds.map(Number),
                            confirmed: confirmed
                        }),
                    });

                    const data = await res.json();

                    if (data.success) {
                        const action = data.action === 'appended' ? 'added' : 'assigned';
                        this.messages.push({
                            role: 'assistant',
                            content: `✅ Successfully ${action} ${data.assigned_count} volunteer(s)! Refreshing page…`,
                            recommendations: [],
                        });
                        this.$nextTick(() => this.scrollToBottom());
                        setTimeout(() => location.reload(), 1200);
                    } else if (data.requires_confirmation) {
                        // Handle confirmation scenarios
                        this.handleConfirmationRequired(data, recommendations);
                    } else {
                        throw new Error(data.message || 'Finalize failed');
                    }
                } catch (err) {
                    this.messages.push({
                        role: 'assistant',
                        content: '❌ Could not finalize: ' + (err.message || 'Unknown error'),
                        recommendations: [],
                    });
                    this.$nextTick(() => this.scrollToBottom());
                } finally {
                    this.finalizing = false;
                }
            },
            handleConfirmationRequired(data, recommendations) {
                this.confirmationData = { ...data, recommendations };
                
                if (data.confirmation_type === 'override') {
                    this.showOverrideModal = true;
                } else if (data.confirmation_type === 'overflow') {
                    // Initialize all members as selected for overflow modal
                    this.overflowSelectedMembers = {};
                    data.suggested_member_ids.forEach(memberId => {
                        this.overflowSelectedMembers[memberId] = true;
                    });
                    this.showOverflowModal = true;
                }
            },

            async confirmOverride() {
                this.showOverrideModal = false;
                await this.finalizeFromMessage(this.confirmationData.recommendations, true);
                this.confirmationData = null;
            },

            cancelOverride() {
                this.showOverrideModal = false;
                this.messages.push({
                    role: 'assistant',
                    content: '� Assignment cancelled. Existing volunteers remain unchanged.',
                    recommendations: [],
                });
                this.$nextTick(() => this.scrollToBottom());
                this.confirmationData = null;
            },

            getOverflowSelectedCount() {
                return Object.values(this.overflowSelectedMembers).filter(Boolean).length;
            },

            async confirmOverflow() {
                const selectedIds = this.confirmationData.suggested_member_ids
                    .filter(memberId => this.overflowSelectedMembers[memberId]);
                
                const availableSlots = this.confirmationData.available_slots;
                
                if (selectedIds.length === 0) {
                    this.showAlert('Please select at least one volunteer.', 'Notice');
                    return;
                }
                
                if (selectedIds.length > availableSlots) {
                    this.showAlert(`You can only select ${availableSlots} volunteer(s). Currently selected: ${selectedIds.length}`, 'Notice');
                    return;
                }
                
                this.showOverflowModal = false;
                
                // Create a modified recommendations array with only selected members
                const modifiedRecommendations = this.confirmationData.recommendations
                    .filter(rec => selectedIds.includes(rec.member_id));
                
                await this.finalizeFromMessage(modifiedRecommendations, false);
                this.confirmationData = null;
                this.overflowSelectedMembers = {};
            },

            cancelOverflow() {
                this.showOverflowModal = false;
                this.messages.push({
                    role: 'assistant',
                    content: '� Assignment cancelled.',
                    recommendations: [],
                });
                this.$nextTick(() => this.scrollToBottom());
                this.confirmationData = null;
                this.overflowSelectedMembers = {};
            },
            hasConstraints() {
                const c = this.mergedConstraints;
                return c.gender_filter !== null ||
                       c.new_old_filter !== null ||
                       c.conflict_ok !== null ||
                       c.college_filter !== null ||
                       (c.priority_rules && c.priority_rules.length > 0);
            },

            clearConstraint(key) {
                if (key === 'priority_rules') {
                    this.mergedConstraints.priority_rules = [];
                } else {
                    this.mergedConstraints[key] = null;
                }
            },

            clearChat() {
                this.messages = [];
                this.history = [];
                this.selectedMembers = {};
                this.mergedConstraints = {
                    gender_filter: null,
                    new_old_filter: null,
                    conflict_ok: null,
                    college_filter: null,
                    priority_rules: [],
                };
            },

            scrollToBottom() {
                const el = document.getElementById('chat-messages');
                if (el) el.scrollTop = el.scrollHeight;
            },

            autoResize(el) {
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 128) + 'px';
            },
        };
    }
    </script> --}}{{-- Duplicate script removed - see after @endif --}}

    {{-- Override Confirmation Modal --}}
    <div x-show="showOverrideModal"
         x-cloak
         class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="background-color: rgba(0, 0, 0, 0.5);">
        <div @click.away="cancelOverride()"
             class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all"
             x-show="showOverrideModal"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             x-transition:leave="transition ease-in duration-150"
             x-transition:leave-start="opacity-100 scale-100"
             x-transition:leave-end="opacity-0 scale-95">
            
            <div class="flex items-start gap-3 mb-4">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900">Override Existing Volunteers?</h3>
                    <p class="mt-1 text-sm text-gray-600" x-text="confirmationData?.message"></p>
                </div>
            </div>
            
            <template x-if="confirmationData?.current_assignments">
                <div class="mb-4 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                    <p class="text-xs font-semibold text-gray-700 mb-2">Currently assigned:</p>
                    <div class="space-y-1">
                        <template x-for="assignment in confirmationData.current_assignments" :key="assignment.id">
                            <div class="flex items-center gap-2 text-sm text-gray-700">
                                <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                                </svg>
                                <span x-text="assignment.member ? (assignment.member.first_name + ' ' + assignment.member.last_name) : 'Unknown'"></span>
                            </div>
                        </template>
                    </div>
                </div>
            </template>
            
            {{-- Error Message --}}
            <div x-show="overrideError" 
                 x-cloak
                 class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-sm text-red-600" x-text="overrideError"></p>
            </div>
            
            <div class="flex gap-3 justify-end">
                <button @click="cancelOverride()"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button @click="confirmOverride()"
                        :disabled="finalizing"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <span x-show="!finalizing">Yes, Replace Volunteers</span>
                    <span x-show="finalizing">Replacing...</span>
                </button>
            </div>
        </div>
    </div>

    {{-- Overflow Selection Modal --}}
    <div x-show="showOverflowModal"
         x-cloak
         @click="cancelOverflow()"
         class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="background-color: rgba(0, 0, 0, 0.5);">
        <div @click.stop
             class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all"
             x-show="showOverflowModal"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             x-transition:leave="transition ease-in duration-150"
             x-transition:leave-start="opacity-100 scale-100"
             x-transition:leave-end="opacity-0 scale-95">
            
            <div class="flex items-start gap-3 mb-4">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900">Select Volunteers to Assign</h3>
                    <p class="mt-1 text-sm text-gray-600" x-text="confirmationData?.message"></p>
                    <p class="mt-2 text-xs font-medium text-blue-600">
                        <span x-text="getOverflowSelectedCount()"></span> of <span x-text="confirmationData?.available_slots"></span> slots selected
                    </p>
                </div>
            </div>
            
            <div class="mb-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <template x-if="confirmationData?.recommendations && confirmationData.recommendations.length > 0">
                    <div class="divide-y divide-gray-200">
                        <template x-for="rec in confirmationData.recommendations" :key="rec.member_id">
                            <label class="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                                <input type="checkbox"
                                       :checked="overflowSelectedMembers[rec.member_id]"
                                       @change="overflowSelectedMembers[rec.member_id] = $event.target.checked"
                                       class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center justify-between">
                                        <span class="text-sm font-medium text-gray-900" x-text="rec.full_name || rec.name || 'Member #' + rec.member_id"></span>
                                        <span class="text-xs font-bold"
                                              :class="(rec.assignment_probability || 0) >= 0.7 ? 'text-green-600' : (rec.assignment_probability || 0) >= 0.4 ? 'text-amber-600' : 'text-gray-500'"
                                              x-text="Math.round((rec.assignment_probability || 0) * 100) + '%'"></span>
                                    </div>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <span class="text-xs text-gray-500" x-text="rec.college || ''"></span>
                                        <template x-if="rec.has_class_conflict == 1">
                                            <span class="text-xs text-amber-600">⚠ Class conflict</span>
                                        </template>
                                    </div>
                                </div>
                            </label>
                        </template>
                    </div>
                </template>
                <template x-if="!confirmationData?.recommendations || confirmationData.recommendations.length === 0">
                    <div class="p-4 text-center text-gray-500 text-sm">
                        No recommendations available
                    </div>
                </template>
            </div>
            
            {{-- Error Message --}}
            <div x-show="overflowError" 
                 x-cloak
                 class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-sm text-red-600" x-text="overflowError"></p>
            </div>
            
            <div class="flex gap-3 justify-end">
                <button @click="cancelOverflow()"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button @click="confirmOverflow()"
                        :disabled="finalizing || getOverflowSelectedCount() === 0"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    <span x-show="!finalizing">Assign Selected</span>
                    <span x-show="finalizing">Assigning...</span>
                </button>
            </div>
        </div>
    </div>

    {{-- Member Selection Modal for Manual Assignment --}}
    <div x-show="memberModalOpen"
         x-cloak
         class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="background-color: rgba(0, 0, 0, 0.5);">
        <div @click="memberModalOpen = false" class="fixed inset-0 -z-10" aria-hidden="true"></div>

        <div x-show="memberModalOpen"
             @click.stop
             x-transition:enter="ease-out duration-300"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             x-transition:leave="ease-in duration-200"
             x-transition:leave-start="opacity-100 scale-100"
             x-transition:leave-end="opacity-0 scale-95"
             class="bg-white rounded-lg shadow-xl transform transition-all w-full max-w-md relative z-10">
                
                <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">Add Volunteer</h3>
                        <button @click="memberModalOpen = false" class="text-gray-400 hover:text-gray-500">
                            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <!-- Search Input -->
                    <div class="mb-4">
                        <input 
                            type="text"
                            x-model="memberSearch"
                            @input="searchMembers()"
                            placeholder="Search by name, email, or student number..."
                            class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md">
                    </div>

                    <!-- Loading State -->
                    <div x-show="loadingMembers" class="text-center py-8">
                        <svg class="animate-spin h-8 w-8 mx-auto text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <p class="mt-2 text-sm text-gray-500">Loading members...</p>
                    </div>

                    <!-- Members List -->
                    <div x-show="!loadingMembers" class="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                        <template x-if="filteredMembers.length === 0">
                            <div class="text-center py-8 text-gray-500">
                                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                                <p class="mt-2 text-sm">No available members found</p>
                            </div>
                        </template>
                        
                        <ul class="divide-y divide-gray-200">
                            <template x-for="member in filteredMembers" :key="member.id">
                                <li class="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                                    @click="selectMemberToAdd(member)">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center min-w-0 flex-1">
                                            <div class="flex-shrink-0">
                                                <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <span class="text-blue-600 font-medium text-sm" x-text="member.first_name.charAt(0) + member.last_name.charAt(0)"></span>
                                                </div>
                                            </div>
                                            <div class="ml-3 min-w-0 flex-1">
                                                <p class="text-sm font-medium text-gray-900 truncate">
                                                    <span x-text="member.first_name + ' ' + member.last_name"></span>
                                                </p>
                                                <p class="text-sm text-gray-500 truncate" x-text="member.email"></p>
                                                <p class="text-xs text-gray-400" x-text="member.student_number"></p>
                                            </div>
                                        </div>
                                        <div class="ml-3 flex-shrink-0">
                                            <button 
                                                type="button"
                                                class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none">
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            </template>
                        </ul>
                    </div>
                </div>

                <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button @click="memberModalOpen = false"
                            type="button"
                            class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm">
                        Close
                    </button>
                </div>
        </div>
    </div>



    @endif

    {{-- �"��"��"� Alpine.js Component Logic �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"� --}}
    <script>
    function assignAIChat(eventId, eventSize) {
        return {
            eventId,
            eventSize,
            panelOpen: false,
            messages: [],
            history: [],           // [{role, content}] sent to backend
            input: '',
            loading: false,
            finalizing: false,
            mergedConstraints: {
                groups: [],
                global: { conflict_ok: null, priority_rules: [] },
            },
            selectedMembers: {},   // member_id ? boolean
            showOverrideModal: false,
            showOverflowModal: false,
            confirmationData: null,
            overflowSelectedMembers: {},
            overflowError: '',
            overrideError: '',
            showAlertModal: false,
            alertMessage: '',
            alertTitle: '',

            showAlert(message, title = 'Notice') {
                this.alertTitle = title;
                this.alertMessage = message;
                this.showAlertModal = true;
            },

            closeAlertModal() {
                this.showAlertModal = false;
                this.alertMessage = '';
                this.alertTitle = '';
            },

            csrfToken() {
                return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
            },

            async sendMessage() {
                const text = this.input.trim();
                if (!text || this.loading) return;

                this.input = '';
                this.loading = true;

                // Add user bubble
                this.messages.push({ role: 'user', content: text });
                this.history.push({ role: 'user', content: text });
                this.$nextTick(() => this.scrollToBottom());

                try {
                    const res = await fetch('/api/assignai/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken(),
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            event_id: this.eventId,
                            message: text,
                            conversation_history: this.history.slice(0, -1), // exclude current message
                            previous_merged_constraints: this.mergedConstraints, // O(1) merge � NLP skips re-parsing history
                        }),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        throw new Error(data.message || 'Request failed');
                    }

                    this.mergedConstraints = data.merged_constraints ?? this.mergedConstraints;

                    // Auto-assign if user confirmed ("yes", "go ahead", "sige", etc.)
                    if (data.is_confirming) {
                        const lastRecs = [...this.messages]
                            .reverse()
                            .find(m => m.role === 'assistant' && m.recommendations && m.recommendations.length > 0)
                            ?.recommendations ?? [];

                        if (lastRecs.length > 0) {
                            this.messages.push({
                                role: 'assistant',
                                content: data.reply,
                                recommendations: [],
                            });
                            this.history.push({ role: 'assistant', content: data.reply });
                            this.$nextTick(() => this.scrollToBottom());
                            await this.finalizeFromMessage(lastRecs);
                            return;
                        }
                    }

                    // Build message with recommendations (if any)
                    this.messages.push({
                        role: 'assistant',
                        content: data.reply,
                        recommendations: data.recommendations ?? [],
                    });

                    this.history.push({
                        role: 'assistant',
                        content: data.reply,
                    });

                    // Initialize all as selected
                    if (data.recommendations && Array.isArray(data.recommendations)) {
                        data.recommendations.forEach(rec => {
                            if (this.selectedMembers[rec.member_id] === undefined) {
                                this.selectedMembers[rec.member_id] = true;
                            }
                        });
                    }

                    this.$nextTick(() => this.scrollToBottom());

                } catch (err) {
                    this.messages.push({
                        role: 'assistant',
                        content: '� Error: ' + (err.message || 'Network or server error'),
                        recommendations: [],
                    });
                    this.$nextTick(() => this.scrollToBottom());
                } finally {
                    this.loading = false;
                }
            },

            toggleMember(memberId, checked) {
                this.selectedMembers[memberId] = checked;
            },

            selectedCount() {
                return Object.values(this.selectedMembers).filter(Boolean).length;
            },

            selectedCountForMessage(recommendations) {
                if (!recommendations || !Array.isArray(recommendations)) return 0;
                return recommendations.filter(r => this.selectedMembers[r.member_id] !== false).length;
            },

            async finalizeFromMessage(recommendations, confirmed = false) {
                const selectedIds = recommendations
                    .filter(r => this.selectedMembers[r.member_id] !== false)
                    .map(r => r.member_id)
                    .filter(id => !!id);

                if (selectedIds.length === 0) {
                    this.showAlert('Please select at least one volunteer to assign.', 'Notice');
                    return;
                }

                this.finalizing = true;
                try {
                    const res = await fetch('/api/assignai/finalize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken(),
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            event_id: this.eventId,
                            member_ids: selectedIds.map(Number),
                            confirmed: confirmed
                        }),
                    });

                    const data = await res.json();

                    if (data.success) {
                        const action = data.action === 'appended' ? 'added' : 'assigned';
                        this.messages.push({
                            role: 'assistant',
                            content: `✅ Successfully ${action} ${data.assigned_count} volunteer(s)! Refreshing page…`,
                            recommendations: [],
                        });
                        this.$nextTick(() => this.scrollToBottom());
                        setTimeout(() => location.reload(), 1200);
                    } else if (data.requires_confirmation) {
                        // Handle confirmation scenarios
                        this.handleConfirmationRequired(data, recommendations);
                    } else {
                        throw new Error(data.message || 'Finalize failed');
                    }
                } catch (err) {
                    this.messages.push({
                        role: 'assistant',
                        content: '� Could not finalize: ' + (err.message || 'Unknown error'),
                        recommendations: [],
                    });
                    this.$nextTick(() => this.scrollToBottom());
                } finally {
                    this.finalizing = false;
                }
            },

            handleConfirmationRequired(data, recommendations) {
                this.confirmationData = { ...data, recommendations };
                
                if (data.confirmation_type === 'override') {
                    this.showOverrideModal = true;
                } else if (data.confirmation_type === 'overflow') {
                    // Initialize all members as selected for overflow modal
                    this.overflowSelectedMembers = {};
                    data.suggested_member_ids.forEach(memberId => {
                        this.overflowSelectedMembers[memberId] = true;
                    });
                    this.showOverflowModal = true;
                }
            },

            async confirmOverride() {
                this.overrideError = '';
                this.finalizing = true;
                
                try {
                    const memberIds = this.confirmationData.recommendations.map(r => r.member_id);
                    
                    const res = await fetch('/api/assignai/finalize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken(),
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            event_id: this.eventId,
                            member_ids: memberIds,
                            confirmed: true
                        }),
                    });

                    const data = await res.json();

                    if (data.success) {
                        this.showOverrideModal = false;
                        this.messages.push({
                            role: 'assistant',
                            content: `✅ Successfully replaced volunteers! ${data.assigned_count} volunteer(s) assigned. Refreshing page…`,
                            recommendations: [],
                        });
                        this.$nextTick(() => this.scrollToBottom());
                        setTimeout(() => location.reload(), 1200);
                    } else {
                        this.overrideError = data.message || 'Assignment failed';
                    }
                } catch (err) {
                    this.overrideError = err.message || 'Network error occurred';
                } finally {
                    this.finalizing = false;
                }
            },

            cancelOverride() {
                this.showOverrideModal = false;
                this.overrideError = '';
                this.messages.push({
                    role: 'assistant',
                    content: '� Assignment cancelled. Existing volunteers remain unchanged.',
                    recommendations: [],
                });
                this.$nextTick(() => this.scrollToBottom());
                this.confirmationData = null;
            },

            getOverflowSelectedCount() {
                return Object.values(this.overflowSelectedMembers).filter(Boolean).length;
            },

            async confirmOverflow() {
                const selectedIds = this.confirmationData.suggested_member_ids
                    .filter(memberId => this.overflowSelectedMembers[memberId]);
                
                const availableSlots = this.confirmationData.available_slots;
                
                if (selectedIds.length === 0) {
                    this.overflowError = 'Please select at least one volunteer.';
                    return;
                }
                
                if (selectedIds.length > availableSlots) {
                    this.overflowError = `You can only select ${availableSlots} volunteer(s). Currently selected: ${selectedIds.length}`;
                    return;
                }
                
                this.overflowError = '';
                this.finalizing = true;
                
                try {
                    const res = await fetch('/api/assignai/finalize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken(),
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            event_id: this.eventId,
                            member_ids: selectedIds,
                            confirmed: false
                        }),
                    });

                    const data = await res.json();

                    if (data.success) {
                        this.showOverflowModal = false;
                        const action = data.action === 'appended' ? 'added' : 'assigned';
                        this.messages.push({
                            role: 'assistant',
                            content: `✅ Successfully ${action} ${data.assigned_count} volunteer(s)! Refreshing page…`,
                            recommendations: [],
                        });
                        this.$nextTick(() => this.scrollToBottom());
                        setTimeout(() => location.reload(), 1200);
                    } else {
                        this.overflowError = data.message || 'Assignment failed';
                    }
                } catch (err) {
                    this.overflowError = err.message || 'Network error occurred';
                } finally {
                    this.finalizing = false;
                }
            },

            cancelOverflow() {
                this.showOverflowModal = false;
                this.overflowError = '';
                this.messages.push({
                    role: 'assistant',
                    content: '� Assignment cancelled.',
                    recommendations: [],
                });
                this.$nextTick(() => this.scrollToBottom());
                this.confirmationData = null;
                this.overflowSelectedMembers = {};
            },

            hasConstraints() {
                const c = this.mergedConstraints;
                return c.gender_filter !== null ||
                       c.new_old_filter !== null ||
                       c.conflict_ok !== null ||
                       c.college_filter !== null ||
                       (c.priority_rules && c.priority_rules.length > 0);
            },

            clearConstraint(key) {
                if (key === 'priority_rules') {
                    this.mergedConstraints.priority_rules = [];
                } else {
                    this.mergedConstraints[key] = null;
                }
            },

            clearChat() {
                this.messages = [];
                this.history = [];
                this.selectedMembers = {};
                this.mergedConstraints = {
                    gender_filter: null,
                    new_old_filter: null,
                    conflict_ok: null,
                    college_filter: null,
                    priority_rules: [],
                };
            },

            scrollToBottom() {
                const el = document.getElementById('chat-messages');
                if (el) el.scrollTop = el.scrollHeight;
            },

            autoResize(el) {
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 128) + 'px';
            },
        };
    }

    function volunteerManagement() {
        return {
            memberModalOpen: false,
            availableMembers: [],
            filteredMembers: [],
            memberSearch: '',
            loadingMembers: false,
            addingVolunteer: false,
            removingVolunteer: false,
            showAlertModal: false,
            alertMessage: '',
            alertTitle: '',
            showConfirmModal: false,
            confirmMessage: '',
            confirmCallback: null,
            showFullyStaffedModal: false,
            
            showAlert(message, title = 'Notice') {
                this.alertTitle = title;
                this.alertMessage = message;
                this.showAlertModal = true;
            },

            closeAlertModal() {
                this.showAlertModal = false;
                this.alertMessage = '';
                this.alertTitle = '';
            },

            showConfirm(message, callback) {
                this.confirmMessage = message;
                this.confirmCallback = callback;
                this.showConfirmModal = true;
            },

            closeConfirmModal() {
                this.showConfirmModal = false;
                this.confirmMessage = '';
                this.confirmCallback = null;
            },

            async confirmAction() {
                if (this.confirmCallback) {
                    await this.confirmCallback();
                }
                this.closeConfirmModal();
            },
            
            csrfToken() {
                return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
            },

            async openMemberModal() {
                // Check if event is fully staffed
                const currentAssigned = {{ $event->assigned_volunteers }};
                const required = {{ $event->required_volunteers }};
                
                if (currentAssigned >= required) {
                    this.showFullyStaffedModal = true;
                    return;
                }
                
                this.memberModalOpen = true;
                this.memberSearch = '';
                await this.fetchAvailableMembers();
            },

            async fetchAvailableMembers() {
                this.loadingMembers = true;
                try {
                    const response = await fetch(`/events/{{ $event->id }}/available-members`, {
                        headers: {
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken()
                        }
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        this.availableMembers = data.members;
                        this.filteredMembers = data.members;
                    } else {
                        this.showAlert('Failed to load members', 'Error');
                    }
                } catch (error) {
                    console.error('Error fetching members:', error);
                    this.showAlert('Failed to load members', 'Error');
                } finally {
                    this.loadingMembers = false;
                }
            },

            searchMembers() {
                const search = this.memberSearch.toLowerCase().trim();
                if (!search) {
                    this.filteredMembers = this.availableMembers;
                    return;
                }
                
                this.filteredMembers = this.availableMembers.filter(member => {
                    const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
                    const email = member.email.toLowerCase();
                    const studentNumber = member.student_number?.toLowerCase() || '';
                    return fullName.includes(search) || email.includes(search) || studentNumber.includes(search);
                });
            },

            async selectMemberToAdd(member) {
                await this.addVolunteerToEvent(member.id);
            },

            async addVolunteerToEvent(memberId) {
                if (this.addingVolunteer) return;
                
                this.addingVolunteer = true;
                try {
                    const response = await fetch(`/events/{{ $event->id }}/volunteers`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': this.csrfToken()
                        },
                        body: JSON.stringify({ 
                            member_id: memberId
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Success - reload the page to show updated volunteer list
                        window.location.reload();
                    } else {
                        this.showAlert(data.message || 'Failed to add volunteer', 'Error');
                        this.addingVolunteer = false;
                    }
                } catch (error) {
                    console.error('Error adding volunteer:', error);
                    this.showAlert('Failed to add volunteer', 'Error');
                    this.addingVolunteer = false;
                }
            },

            async removeVolunteer(memberId, memberName) {
                if (this.removingVolunteer) return;
                
                this.showConfirm(
                    `Are you sure you want to remove ${memberName} from this event?`,
                    async () => {
                        this.removingVolunteer = true;
                        try {
                            const response = await fetch(`/events/{{ $event->id }}/volunteers/${memberId}`, {
                                method: 'DELETE',
                                headers: {
                                    'Accept': 'application/json',
                                    'X-CSRF-TOKEN': this.csrfToken()
                                }
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                                // Success - reload the page to show updated volunteer list
                                window.location.reload();
                            } else {
                                this.showAlert(data.message || 'Failed to remove volunteer', 'Error');
                            }
                        } catch (error) {
                            console.error('Error removing volunteer:', error);
                            this.showAlert('Failed to remove volunteer', 'Error');
                        } finally {
                            this.removingVolunteer = false;
                        }
                    }
                );
            }
        };
    }
    </script>

    {{-- Alert Modal --}}
    <div x-show="showAlertModal"
         x-cloak
         @click="closeAlertModal()"
         class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="background-color: rgba(0, 0, 0, 0.5);">
        <div @click.stop
             class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all"
             x-show="showAlertModal"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             x-transition:leave="transition ease-in duration-150"
             x-transition:leave-start="opacity-100 scale-100"
             x-transition:leave-end="opacity-0 scale-95">
            
            <div class="flex items-start gap-3 mb-4">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900" x-text="alertTitle"></h3>
                    <p class="mt-2 text-sm text-gray-600" x-text="alertMessage"></p>
                </div>
            </div>
            
            <div class="flex justify-end">
                <button @click="closeAlertModal()"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    OK
                </button>
            </div>
        </div>
    </div>

    {{-- Confirm Modal --}}
    <div x-show="showConfirmModal"
         x-cloak
         @click="closeConfirmModal()"
         class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="background-color: rgba(0, 0, 0, 0.5);">
        <div @click.stop
             class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all"
             x-show="showConfirmModal"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             x-transition:leave="transition ease-in duration-150"
             x-transition:leave-start="opacity-100 scale-100"
             x-transition:leave-end="opacity-0 scale-95">
            
            <div class="flex items-start gap-3 mb-4">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900">Confirm Action</h3>
                    <p class="mt-2 text-sm text-gray-600" x-text="confirmMessage"></p>
                </div>
            </div>
            
            <div class="flex gap-3 justify-end">
                <button @click="closeConfirmModal()"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button @click="confirmAction()"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Confirm
                </button>
            </div>
        </div>
    </div>

    {{-- Fully Staffed Modal --}}
    <div x-show="showFullyStaffedModal"
         x-cloak
         @click="showFullyStaffedModal = false"
         class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="background-color: rgba(0, 0, 0, 0.5);">
        <div @click.stop
             class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all"
             x-show="showFullyStaffedModal"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             x-transition:leave="transition ease-in duration-150"
             x-transition:leave-start="opacity-100 scale-100"
             x-transition:leave-end="opacity-0 scale-95">
            
            <div class="flex items-start gap-3 mb-4">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900">Event Fully Staffed</h3>
                    <p class="mt-2 text-sm text-gray-600">
                        This event has reached its volunteer capacity ({{ $event->assigned_volunteers }}/{{ $event->required_volunteers }} volunteers).
                        Please remove an existing volunteer first if you want to add a new one.
                    </p>
                </div>
            </div>
            
            <div class="flex justify-end">
                <button @click="showFullyStaffedModal = false"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    OK
                </button>
            </div>
        </div>
    </div>

</div>
@endsection

