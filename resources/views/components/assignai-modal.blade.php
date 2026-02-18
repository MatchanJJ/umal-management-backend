<!-- AssignAI Modal Component -->
<div id="assignai-modal" 
     x-data="assignAIModal"
     x-show="open" 
     x-cloak
     class="fixed inset-0 z-50 overflow-y-auto"
     @open-assignai.window="console.log('🔴 Event received:', $event.detail); openModal($event.detail.eventId)"
     @keydown.escape.window="open = false"
     style="display: none;">
    
    <!-- Overlay -->
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
         @click="open = false">
    </div>

    <!-- Modal Panel -->
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div class="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-visible shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border-4 border-blue-500"
             @click.stop>
            
            <!-- Debug Badge -->
            <div class="absolute -top-3 -right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                MODAL VISIBLE ✓
            </div>
            
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 border-b-4 border-blue-700">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="bg-white/20 backdrop-blur-sm rounded-xl p-2">
                            <svg class="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl leading-6 font-bold text-white">
                                🤖 AssignAI Recommendations
                            </h3>
                            <p class="text-xs text-blue-100 mt-0.5">Intelligent volunteer matching</p>
                        </div>
                    </div>
                    <button @click="open = false" class="text-white hover:bg-white/20 rounded-lg p-2 transition-all">
                        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="px-6 py-5">
                <!-- Loading State -->
                <div x-show="loading" class="text-center py-12">
                    <svg class="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-gray-600 text-sm">Analyzing member availability and generating recommendations...</p>
                </div>

                <!-- Error State -->
                <div x-show="error && !loading" class="mb-4">
                    <div class="bg-red-50 border-l-4 border-red-400 p-4">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm text-red-700" x-text="error"></p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Event Info -->
                <div x-show="eventData && !loading" class="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <div class="ml-3 flex-1">
                            <p class="text-sm font-medium text-blue-800" x-text="eventData?.title || 'Event'"></p>
                            <p class="mt-1 text-xs text-blue-700" x-show="eventData?.date">
                                <span x-text="eventData?.date"></span> 
                                <span x-text="eventData?.time_block ? ' • ' + eventData.time_block : ''"></span>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Recommendations List -->
                <div x-show="recommendations.length > 0 && !loading" class="space-y-4">
                    <!-- Slot Counter -->
                    <div class="mb-4 p-4 rounded-lg" 
                         :class="overLimit() ? 'bg-red-50 border-2 border-red-400' : 'bg-green-50 border-2 border-green-400'">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium" :class="overLimit() ? 'text-red-800' : 'text-green-800'">
                                    <span x-show="!overLimit()">✓</span>
                                    <span x-show="overLimit()">⚠️</span>
                                    Selected: <strong x-text="selectedCount()"></strong> / 
                                    <strong x-text="eventData?.required_volunteers || 0"></strong> slots needed
                                </p>
                                <p x-show="overLimit()" class="text-xs text-red-700 mt-1">
                                    ⚠️ You've selected too many volunteers. Only <strong x-text="eventData?.required_volunteers"></strong> will be assigned.
                                </p>
                                <p x-show="!overLimit() && slotsRemaining() > 0" class="text-xs text-green-700 mt-1">
                                    Still need <strong x-text="slotsRemaining()"></strong> more
                                </p>
                                <p x-show="!overLimit() && slotsRemaining() === 0" class="text-xs text-green-700 mt-1">
                                    ✓ All slots filled
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between mb-6">
                        <h4 class="text-lg font-bold text-gray-900">
                            ✨ Recommended Members 
                            <span class="text-gray-500 font-medium text-sm ml-2">(<span x-text="recommendations.length"></span> found)</span>
                        </h4>
                        <button @click="selectAll()" class="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span x-text="allSelected() ? 'Deselect All' : 'Select All'"></span>
                        </button>
                    </div>

                    <template x-for="(rec, index) in recommendations" :key="rec.member.id">
                        <div class="group relative border-2 rounded-xl p-4 transition-all duration-200 cursor-pointer"
                             :class="rec.selected ? 'bg-blue-50 border-blue-400 ring-4 ring-blue-100 shadow-md' : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'"
                             @click="rec.selected = !rec.selected">
                            <div class="flex items-start gap-3">
                                <div class="flex-shrink-0 pt-0.5">
                                    <input type="checkbox" 
                                           :id="'member-' + rec.member.id"
                                           x-model="rec.selected"
                                           @click.stop
                                           class="h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500 border-2 border-gray-300 rounded transition-all">
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-start justify-between gap-2 mb-2">
                                        <div class="flex-1">
                                            <label :for="'member-' + rec.member.id" class="font-semibold text-gray-900 cursor-pointer group-hover:text-blue-600 transition-colors">
                                                <span x-text="rec.member.first_name + ' ' + rec.member.last_name"></span>
                                            </label>
                                            <p class="text-xs text-gray-600 mt-0.5" x-text="rec.member.email"></p>
                                        </div>
                                        <span class="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
                                              :class="{
                                                  'bg-gradient-to-r from-green-500 to-emerald-500 text-white': rec.probability >= 0.7,
                                                  'bg-gradient-to-r from-yellow-400 to-orange-400 text-white': rec.probability >= 0.5 && rec.probability < 0.7,
                                                  'bg-gradient-to-r from-gray-400 to-gray-500 text-white': rec.probability < 0.5
                                              }">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                            </svg>
                                            <span x-text="Math.round(rec.probability * 100) + '%'"></span>
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-700 mb-3 bg-gray-50 rounded-lg p-2 border border-gray-100" x-text="rec.explanation"></p>
                                    
                                    <!-- Feature Details -->
                                    <div class="flex flex-wrap gap-2">
                                        <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md">
                                            <svg class="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path>
                                            </svg>
                                            <span x-text="rec.features?.assignments_last_7_days || 0"></span> in 7d
                                        </span>
                                        <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md">
                                            <svg class="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                                            </svg>
                                            Last: <span x-text="formatDaysSince(rec.features?.days_since_last_assignment)"></span>
                                        </span>
                                        <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md">
                                            <svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                            </svg>
                                            <span x-text="Math.round((rec.features?.attendance_rate || 0.8) * 100) + '%'"></span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Empty State -->
                <div x-show="recommendations.length === 0 && !loading && !error" class="text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    <p class="mt-4 text-sm text-gray-500">No recommendations available</p>
                </div>
            </div>

            <!-- Footer Actions -->
            <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-5 border-t-2 border-gray-200" x-show="recommendations.length > 0 && !loading">
                <div class="flex flex-col-reverse sm:flex-row gap-3">
                    <button @click="open = false" 
                            class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl border-2 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500/20 transition-all">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        Cancel
                    </button>
                    <button @click="regenerateRecommendations()" 
                            class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl border-2 border-blue-200 text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Regenerate
                    </button>
                    <button @click="finalizeAssignments()" 
                            :disabled="!hasSelectedMembers()"
                            class="flex-1 inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold rounded-xl shadow-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-4 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span x-show="!overLimit()">Confirm & Assign</span>
                        <span x-show="overLimit()">Assign First <span x-text="eventData?.required_volunteers"></span></span>
                        <span x-show="hasSelectedMembers()" x-text="'(' + selectedCount() + ')'" class="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-sm font-bold"></span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
