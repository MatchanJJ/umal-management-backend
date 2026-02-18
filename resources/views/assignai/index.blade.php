@extends('layouts.app')

@section('title', 'AssignAI - Intelligent Volunteer Assignment')

@section('content')
<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-8">
        <div class="flex items-center mb-4">
            <div class="flex-shrink-0 mr-4">
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 shadow-lg">
                    <svg class="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                </div>
            </div>
            <div>
                <h1 class="text-3xl font-bold text-gray-900">🤖 AssignAI</h1>
                <p class="mt-1 text-sm text-gray-600">Intelligent volunteer assignment powered by machine learning</p>
            </div>
        </div>
    </div>

    <!-- Main Card -->
    <div class="bg-white shadow-lg rounded-lg overflow-hidden">
        <!-- Info Banner -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-4">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <div class="ml-3 flex-1">
                    <h3 class="text-sm font-medium text-blue-900">How it works</h3>
                    <div class="mt-2 text-xs text-blue-800">
                        <p>Simply describe your volunteer needs in natural language, and AssignAI will:</p>
                        <ul class="list-disc list-inside mt-2 space-y-1">
                            <li>Find or suggest the matching event</li>
                            <li>Analyze member availability and workload</li>
                            <li>Recommend the most suitable volunteers based on fairness principles</li>
                            <li>Provide explanations for each recommendation</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <!-- Input Section -->
        <div class="px-6 py-8">
            <div x-data="assignAIPage()" class="space-y-6">
                <!-- Prompt Input -->
                <div>
                    <label for="prompt" class="block text-sm font-semibold text-gray-900 mb-3">
                        📝 Describe your volunteer needs
                    </label>
                    <div class="relative">
                        <textarea 
                            x-model="prompt"
                            id="prompt" 
                            rows="5" 
                            class="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-base px-4 py-3 transition-all"
                            placeholder="Example: Need 5 volunteers for Friday morning campus tour&#10;Example: Assign 3 people for tomorrow afternoon event&#10;Example: Looking for volunteers next Monday morning"
                            @keydown.ctrl.enter="getRecommendations()"
                            :disabled="loading"></textarea>
                        <div class="absolute bottom-3 right-3 flex items-center gap-2">
                            <span class="text-xs text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-200">
                                Ctrl + Enter
                            </span>
                        </div>
                    </div>
                    <p class="mt-3 text-xs text-gray-600 flex items-start gap-2">
                        <svg class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                        </svg>
                        <span>Include the day (Friday, tomorrow), time (morning, afternoon), and number of volunteers needed</span>
                    </p>
                </div>

                <!-- Action Button -->
                <div class="flex items-center gap-3">
                    <button 
                        @click="getRecommendations()"
                        :disabled="!prompt.trim() || loading"
                        class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl shadow-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                        <template x-if="!loading">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                        </template>
                        <template x-if="loading">
                            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </template>
                        <span x-show="!loading">Analyze with AI</span>
                        <span x-show="loading">Analyzing...</span>
                    </button>
                    
                    <button 
                        x-show="showResults"
                        @click="clearResults()"
                        class="inline-flex items-center justify-center gap-2 px-6 py-4 text-base font-medium rounded-xl border-2 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500/20 transition-all">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        <span>Clear</span>
                    </button>
                </div>

                <!-- Results Section -->
                <div x-show="showResults" x-cloak class="mt-8 border-t border-gray-200 pt-6">
                    <!-- Event Not Found -->
                    <div x-show="!eventExists && parsedRequest" class="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg class="h-6 w-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <div class="ml-3 flex-1">
                                <h3 class="text-sm font-medium text-yellow-800">No Event Found</h3>
                                <div class="mt-2 text-sm text-yellow-700">
                                    <p>No event exists for <strong x-text="parsedRequest?.day"></strong> <strong x-text="parsedRequest?.time_block"></strong>.</p>
                                    <p class="mt-2">Would you like to create one?</p>
                                    
                                    <div class="mt-4 bg-white rounded-lg p-4 border border-yellow-200">
                                        <h4 class="text-sm font-medium text-gray-900 mb-2">Suggested Event Details:</h4>
                                        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                            <dt class="text-gray-600">Date:</dt>
                                            <dd class="text-gray-900 font-medium" x-text="eventSuggestion?.date"></dd>
                                            <dt class="text-gray-600">Time:</dt>
                                            <dd class="text-gray-900 font-medium">
                                                <span x-text="eventSuggestion?.start_time"></span> - <span x-text="eventSuggestion?.end_time"></span>
                                            </dd>
                                            <dt class="text-gray-600">Volunteers:</dt>
                                            <dd class="text-gray-900 font-medium" x-text="eventSuggestion?.volunteer_count"></dd>
                                        </dl>
                                    </div>

                                    <div class="mt-4">
                                        <a href="{{ route('events.create') }}" 
                                           class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500">
                                            ➕ Create Event
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Success with Recommendations -->
                    <div x-show="eventExists && recommendations.length > 0">
                        <div class="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
                            <div class="flex">
                                <div class="flex-shrink-0">
                                    <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                    </svg>
                                </div>
                                <div class="ml-3">
                                    <h3 class="text-sm font-medium text-green-800">Event Found!</h3>
                                    <div class="mt-2 text-sm text-green-700">
                                        <p><strong x-text="eventData?.title"></strong></p>
                                        <p class="text-xs mt-1" x-text="formatEventDateTime(eventData)"></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Recommendations -->
                        <div class="space-y-4">
                            <div class="flex items-center justify-between mb-6">
                                <h4 class="text-xl font-bold text-gray-900">
                                    ✨ Recommended Members 
                                    <span class="text-gray-500 font-medium text-base ml-2">(<span x-text="recommendations.length"></span> suggestions)</span>
                                </h4>
                                <button @click="selectAll()" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <span x-text="allSelected() ? 'Deselect All' : 'Select All'"></span>
                                </button>
                            </div>

                            <template x-for="(rec, index) in recommendations" :key="rec.member.id">
                                <div class="group relative border-2 rounded-xl p-5 transition-all duration-200 cursor-pointer hover:shadow-xl"
                                     :class="rec.selected ? 'bg-blue-50 border-blue-400 ring-4 ring-blue-100 shadow-lg' : 'bg-white border-gray-200 hover:border-blue-300'"
                                     @click="rec.selected = !rec.selected">
                                    <div class="flex items-start gap-4">
                                        <div class="flex-shrink-0 pt-1">
                                            <input type="checkbox" 
                                                   :id="'standalone-member-' + rec.member.id"
                                                   x-model="rec.selected"
                                                   @click.stop
                                                   class="h-6 w-6 text-blue-600 focus:ring-2 focus:ring-blue-500 border-2 border-gray-300 rounded-lg transition-all">
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-start justify-between gap-3 mb-2">
                                                <div>
                                                    <label :for="'standalone-member-' + rec.member.id" class="text-lg font-semibold text-gray-900 cursor-pointer group-hover:text-blue-600 transition-colors">
                                                        <span x-text="rec.member.first_name + ' ' + rec.member.last_name"></span>
                                                    </label>
                                                    <p class="text-sm text-gray-600 mt-1" x-text="rec.member.email"></p>
                                                </div>
                                                <div class="flex-shrink-0">
                                                    <span class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold shadow-sm"
                                                          :class="{
                                                              'bg-gradient-to-r from-green-500 to-emerald-500 text-white': rec.probability >= 0.7,
                                                              'bg-gradient-to-r from-yellow-400 to-orange-400 text-white': rec.probability >= 0.5 && rec.probability < 0.7,
                                                              'bg-gradient-to-r from-gray-400 to-gray-500 text-white': rec.probability < 0.5
                                                          }">
                                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                                        </svg>
                                                        <span x-text="Math.round(rec.probability * 100) + '%'"></span>
                                                    </span>
                                                </div>
                                            </div>
                                            <p class="text-sm text-gray-700 leading-relaxed mb-4 bg-gray-50 rounded-lg p-3 border border-gray-100" x-text="rec.explanation"></p>
                                            
                                            <!-- Feature badges -->
                                            <div class="flex flex-wrap gap-2">
                                                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border-2 border-gray-200 px-3 py-1.5 rounded-lg">
                                                    <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path>
                                                    </svg>
                                                    <span x-text="rec.features?.assignments_last_7_days || 0"></span> in 7 days
                                                </span>
                                                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border-2 border-gray-200 px-3 py-1.5 rounded-lg">
                                                    <svg class="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                                                    </svg>
                                                    Last: <span x-text="formatDaysSince(rec.features?.days_since_last_assignment)"></span>
                                                </span>
                                                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border-2 border-gray-200 px-3 py-1.5 rounded-lg">
                                                    <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                                    </svg>
                                                    <span x-text="Math.round((rec.features?.attendance_rate || 0.8) * 100) + '%'"></span> attendance
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            <!-- Finalize Actions -->
                            <div class="flex flex-col sm:flex-row gap-3 pt-6 border-t-2 border-gray-200 mt-8">
                                <button @click="finalizeAssignments()"
                                        :disabled="!hasSelectedMembers() || finalizing"
                                        class="flex-1 inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl shadow-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-4 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                                    <template x-if="!finalizing">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                    </template>
                                    <template x-if="finalizing">
                                        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </template>
                                    <span x-show="!finalizing">Confirm & Assign Selected Members</span>
                                    <span x-show="finalizing">Processing...</span>
                                    <span x-show="!finalizing" x-text="'(' + recommendations.filter(r => r.selected).length + ')'" class="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-sm"></span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Example Prompts -->
    <div class="mt-8 bg-white shadow rounded-lg p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">💡 Example Prompts</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button @click="prompt = 'Need 5 volunteers for Friday morning campus tour'" 
                    class="text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm text-gray-700 transition-colors">
                "Need 5 volunteers for Friday morning campus tour"
            </button>
            <button @click="prompt = 'Assign 3 people for tomorrow afternoon event'" 
                    class="text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm text-gray-700 transition-colors">
                "Assign 3 people for tomorrow afternoon event"
            </button>
            <button @click="prompt = 'Looking for volunteers next Monday morning'" 
                    class="text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm text-gray-700 transition-colors">
                "Looking for volunteers next Monday morning"
            </button>
            <button @click="prompt = 'Need 4 volunteers Wednesday afternoon'" 
                    class="text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm text-gray-700 transition-colors">
                "Need 4 volunteers Wednesday afternoon"
            </button>
        </div>
    </div>
</div>

<script>
function assignAIPage() {
    return {
        prompt: '',
        loading: false,
        finalizing: false,
        showResults: false,
        eventExists: false,
        eventData: null,
        parsedRequest: null,
        eventSuggestion: null,
        recommendations: [],

        async getRecommendations() {
            if (!this.prompt.trim()) return;

            this.loading = true;
            this.showResults = false;

            try {
                const response = await fetch('/api/assignai/suggest', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: this.prompt
                    })
                });

                const result = await response.json();
                this.showResults = true;

                if (result.event_exists) {
                    this.eventExists = true;
                    this.eventData = result.event;
                    this.recommendations = result.suggested_members.map(rec => ({
                        ...rec,
                        selected: true
                    }));
                } else {
                    this.eventExists = false;
                    this.parsedRequest = result.parsed_request;
                    this.eventSuggestion = result.event_suggestions;
                }
            } catch (err) {
                console.error('Error:', err);
                alert('Failed to get recommendations: ' + err.message);
            } finally {
                this.loading = false;
            }
        },

        async finalizeAssignments() {
            const selectedIds = this.recommendations
                .filter(rec => rec.selected)
                .map(rec => rec.member.id);

            if (selectedIds.length === 0) {
                alert('Please select at least one member to assign');
                return;
            }

            if (!confirm(`Assign ${selectedIds.length} volunteer(s) to this event?`)) {
                return;
            }

            this.finalizing = true;

            try {
                const response = await fetch('/api/assignai/finalize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        event_id: this.eventData.id,
                        member_ids: selectedIds
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert(`✅ Successfully assigned ${result.assigned_count} volunteer(s)!`);
                    window.location.href = '/events/' + this.eventData.id;
                } else {
                    throw new Error(result.message || 'Failed to finalize');
                }
            } catch (err) {
                console.error('Error:', err);
                alert('Failed to finalize assignments: ' + err.message);
            } finally {
                this.finalizing = false;
            }
        },

        selectAll() {
            const allSelected = this.allSelected();
            this.recommendations.forEach(rec => rec.selected = !allSelected);
        },

        allSelected() {
            return this.recommendations.every(rec => rec.selected);
        },

        hasSelectedMembers() {
            return this.recommendations.some(rec => rec.selected);
        },

        clearResults() {
            this.showResults = false;
            this.eventExists = false;
            this.eventData = null;
            this.recommendations = [];
            this.parsedRequest = null;
            this.eventSuggestion = null;
        },

        formatEventDateTime(event) {
            if (!event) return '';
            return `${event.date || ''} • ${event.time_block || ''}`;
        }
    };
}
</script>
@endsection
