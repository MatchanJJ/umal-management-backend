@extends('layouts.app')

@section('title', $event->title)

@section('content')
<div
    x-data="assignAIChat({{ $event->id }}, {{ $event->required_volunteers }})"
    @keydown.escape.window="panelOpen = false"
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

    {{-- â”€â”€â”€ Right Slide-in Chat Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ --}}
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
                <span class="text-xs text-blue-200">Â· {{ $event->title }}</span>
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
                    â™‚ Male only
                    <button @click="clearConstraint('gender_filter')" class="hover:text-blue-900 ml-0.5">Ã—</button>
                </span>
            </template>
            <template x-if="mergedConstraints.gender_filter === 'F'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                    â™€ Female only
                    <button @click="clearConstraint('gender_filter')" class="hover:text-pink-900 ml-0.5">Ã—</button>
                </span>
            </template>
            <template x-if="mergedConstraints.gender_filter === 'split'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    âš§ Gender split
                    <button @click="clearConstraint('gender_filter')" class="hover:text-purple-900 ml-0.5">Ã—</button>
                </span>
            </template>
            <template x-if="mergedConstraints.new_old_filter === 'new'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    âœ¨ New members
                    <button @click="clearConstraint('new_old_filter')" class="hover:text-green-900 ml-0.5">Ã—</button>
                </span>
            </template>
            <template x-if="mergedConstraints.new_old_filter === 'old'">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    ðŸŽ– Veterans
                    <button @click="clearConstraint('new_old_filter')" class="hover:text-amber-900 ml-0.5">Ã—</button>
                </span>
            </template>
            <template x-if="mergedConstraints.conflict_ok === false">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    ðŸš« No class conflict
                    <button @click="clearConstraint('conflict_ok')" class="hover:text-red-900 ml-0.5">Ã—</button>
                </span>
            </template>
            <template x-if="mergedConstraints.college_filter">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    ðŸ« <span x-text="mergedConstraints.college_filter"></span>
                    <button @click="clearConstraint('college_filter')" class="hover:text-indigo-900 ml-0.5">Ã—</button>
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
                                                        <span class="text-xs text-blue-500">♂</span>
                                                    </template>
                                                    <template x-if="rec.gender_label === 'F'">
                                                        <span class="text-xs text-pink-500">♀</span>
                                                    </template>
                                                    <template x-if="rec.is_new_member == 1">
                                                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">New</span>
                                                    </template>
                                                </div>
                                                <div class="flex items-center gap-2 mt-0.5">
                                                    <span class="text-xs text-gray-500" x-text="rec.college || ''"></span>
                                                    <span class="text-xs text-gray-400">Â·</span>
                                                    <span class="text-xs text-gray-500"
                                                          x-text="Math.round((rec.attendance_rate || 0) * 100) + '% attendance'"></span>
                                                </div>
                                            </div>
                                            <div class="text-right flex-shrink-0">
                                                <div class="text-xs font-bold"
                                                     :class="(rec.fairness_adjusted_score || 0) >= 0.7 ? 'text-green-600' : (rec.fairness_adjusted_score || 0) >= 0.4 ? 'text-amber-600' : 'text-gray-500'"
                                                     x-text="Math.round((rec.fairness_adjusted_score || 0) * 100) + '%'">
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
                                        <span x-text="finalizing ? 'Assigningâ€¦' : 'Assign ' + selectedCount() + ' selected'"></span>
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
                    placeholder="Describe your requirementsâ€¦ (Enter to send, Shift+Enter for new line)"
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
                AssignAI uses AI â€” always review before confirming.
            </p>
        </div>
    </div>

    {{-- â”€â”€â”€ Alpine.js Component Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ --}}
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
                gender_filter: null,
                new_old_filter: null,
                conflict_ok: null,
                college_filter: null,
                priority_rules: [],
            },
            selectedMembers: {},   // member_id â†’ boolean

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

            async finalizeFromMessage(recommendations) {
                const selectedIds = recommendations
                    .filter(r => this.selectedMembers[r.member_id] !== false)
                    .map(r => r.member_id)
                    .filter(id => !!id);

                if (selectedIds.length === 0) {
                    alert('Please select at least one volunteer to assign.');
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
                        }),
                    });

                    const data = await res.json();

                    if (data.success) {
                        this.messages.push({
                            role: 'assistant',
                            content: `âœ… Successfully assigned ${data.assigned_count} volunteer(s)! Refreshing pageâ€¦`,
                            recommendations: [],
                        });
                        this.$nextTick(() => this.scrollToBottom());
                        setTimeout(() => location.reload(), 1200);
                    } else {
                        throw new Error(data.message || 'Finalize failed');
                    }
                } catch (err) {
                    this.messages.push({
                        role: 'assistant',
                        content: 'âŒ Could not finalize: ' + (err.message || 'Unknown error'),
                        recommendations: [],
                    });
                    this.$nextTick(() => this.scrollToBottom());
                } finally {
                    this.finalizing = false;
                }
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
    </script>
    @endif

</div>
@endsection

