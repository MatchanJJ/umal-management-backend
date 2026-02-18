@extends('layouts.app')

@section('title', 'Fairness Report - AssignAI')

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" x-data="fairnessReport()">
    <!-- Header -->
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">⚖️ Workload Fairness Report</h1>
        <p class="mt-2 text-sm text-gray-600">Measures how evenly event assignments are distributed across all members</p>
    </div>

    <!-- Loading State -->
    <div x-show="loading" class="text-center py-12">
        <svg class="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Analyzing assignment fairness...</p>
    </div>

    <!-- Error State -->
    <div x-show="error && !loading" class="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded">
        <p class="text-sm text-red-700" x-text="error"></p>
    </div>

    <!-- Main Content -->
    <div x-show="!loading && data && !error" class="space-y-6">

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <!-- Status Card -->
            <div class="bg-white shadow rounded-lg p-5 col-span-2 sm:col-span-1">
                <p class="text-sm font-medium text-gray-500">Fairness Status</p>
                <p class="mt-1 text-2xl font-bold"
                   :class="{
                       'text-green-600': data.fairness_status === 'FAIR',
                       'text-yellow-600': data.fairness_status === 'WARNING',
                       'text-red-600': data.fairness_status === 'BIASED'
                   }"
                   x-text="data.fairness_status || '—'"></p>
            </div>
            <!-- Total Members -->
            <div class="bg-white shadow rounded-lg p-5">
                <p class="text-sm font-medium text-gray-500">Total Members</p>
                <p class="mt-1 text-2xl font-bold text-gray-900" x-text="data.total_members ?? '—'"></p>
            </div>
            <!-- Active Members -->
            <div class="bg-white shadow rounded-lg p-5">
                <p class="text-sm font-medium text-gray-500">Active (Assigned)</p>
                <p class="mt-1 text-2xl font-bold text-blue-600" x-text="data.active_members ?? '—'"></p>
            </div>
            <!-- Never Assigned -->
            <div class="bg-white shadow rounded-lg p-5">
                <p class="text-sm font-medium text-gray-500">Never Assigned</p>
                <p class="mt-1 text-2xl font-bold text-red-600" x-text="data.never_assigned?.length ?? '—'"></p>
            </div>
        </div>

        <!-- Equity Metrics -->
        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4">📐 Equity Metrics</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Assignments</p>
                    <p class="mt-1 text-xl font-bold text-gray-900" x-text="data.mean_assignments ?? '—'"></p>
                    <p class="text-xs text-gray-400">per member</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Gini Coefficient</p>
                    <p class="mt-1 text-xl font-bold"
                       :class="(data.gini_coefficient ?? 1) < 0.30 ? 'text-green-600' : (data.gini_coefficient ?? 1) < 0.50 ? 'text-yellow-600' : 'text-red-600'"
                       x-text="data.gini_coefficient ?? '—'"></p>
                    <p class="text-xs text-gray-400">0 = equal, 1 = unequal</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Std Deviation</p>
                    <p class="mt-1 text-xl font-bold text-gray-900" x-text="data.std_assignments ?? '—'"></p>
                    <p class="text-xs text-gray-400">assignments</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Coeff. of Variation</p>
                    <p class="mt-1 text-xl font-bold"
                       :class="(data.coefficient_of_variation ?? 1) < 0.50 ? 'text-green-600' : (data.coefficient_of_variation ?? 1) < 1.00 ? 'text-yellow-600' : 'text-red-600'"
                       x-text="data.coefficient_of_variation ?? '—'"></p>
                    <p class="text-xs text-gray-400">lower is fairer</p>
                </div>
            </div>
        </div>

        <!-- Over-assigned Alert -->
        <div x-show="data.over_assigned?.length" class="bg-orange-50 border border-orange-200 rounded-lg p-5">
            <h2 class="text-base font-bold text-orange-900 mb-3">🔥 Over-Assigned Members</h2>
            <p class="text-xs text-orange-700 mb-3">These members carry a disproportionately high number of assignments (more than 1.5 standard deviations above average).</p>
            <div class="flex flex-wrap gap-2">
                <template x-for="m in data.over_assigned || []" :key="m.name">
                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                        <span x-text="m.name"></span>
                        <span class="bg-orange-200 rounded-full px-1.5 py-0.5 font-bold" x-text="m.count + 'x'"></span>
                    </span>
                </template>
            </div>
        </div>

        <!-- Never-assigned Alert -->
        <div x-show="data.never_assigned?.length" class="bg-red-50 border border-red-200 rounded-lg p-5">
            <h2 class="text-base font-bold text-red-900 mb-3">🚫 Never-Assigned Members</h2>
            <p class="text-xs text-red-700 mb-3">These members have not received any assignments in the analysis window. Consider including them in upcoming events.</p>
            <div class="flex flex-wrap gap-2">
                <template x-for="name in data.never_assigned || []" :key="name">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300" x-text="name"></span>
                </template>
            </div>
        </div>

        <!-- Member Distribution Bar Chart -->
        <div class="bg-white shadow rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-bold text-gray-900">👥 Assignments Per Member</h2>
                <span class="text-xs text-gray-400">Last <span x-text="data.days_analyzed"></span> days</span>
            </div>
            <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
                <template x-for="m in data.member_distribution || []" :key="m.name">
                    <div class="flex items-center gap-2">
                        <div class="w-32 text-xs font-medium text-gray-700 truncate shrink-0" x-text="m.name"></div>
                        <div class="flex-1 bg-gray-100 rounded-full h-5 relative">
                            <div class="h-5 rounded-full transition-all duration-500"
                                 :class="m.count === 0
                                     ? 'bg-red-200'
                                     : (data.over_assigned?.some(o => o.name === m.name)
                                         ? 'bg-orange-400'
                                         : 'bg-blue-400')"
                                 :style="'width: ' + barWidth(m.count) + '%'"></div>
                        </div>
                        <div class="w-6 text-right text-xs font-bold shrink-0"
                             :class="m.count === 0 ? 'text-red-600' : 'text-gray-700'"
                             x-text="m.count"></div>
                    </div>
                </template>
            </div>
            <!-- Legend -->
            <div class="flex gap-4 mt-4 text-xs text-gray-500">
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-blue-400 inline-block"></span> Normal</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-orange-400 inline-block"></span> Over-assigned</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-red-200 inline-block"></span> Never assigned</span>
            </div>
        </div>

        <!-- Recommendation -->
        <div class="rounded-lg p-5 border"
             :class="{
                 'bg-green-50 border-green-200': data.fairness_status === 'FAIR',
                 'bg-yellow-50 border-yellow-200': data.fairness_status === 'WARNING',
                 'bg-red-50 border-red-200': data.fairness_status === 'BIASED'
             }"
             x-show="data.recommendation">
            <h3 class="text-sm font-bold mb-1"
                :class="{
                    'text-green-800': data.fairness_status === 'FAIR',
                    'text-yellow-800': data.fairness_status === 'WARNING',
                    'text-red-800': data.fairness_status === 'BIASED'
                }">💡 Recommendation</h3>
            <p class="text-sm"
               :class="{
                   'text-green-700': data.fairness_status === 'FAIR',
                   'text-yellow-700': data.fairness_status === 'WARNING',
                   'text-red-700': data.fairness_status === 'BIASED'
               }"
               x-text="data.recommendation"></p>
        </div>

        <!-- Retrain model -->
        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-sm font-bold text-indigo-900">🔧 Phase 3 — Retrain with Fairness Constraints</h3>
                    <p class="text-xs text-indigo-700 mt-1">Re-trains the RandomForest model using real assignment history. Under-assigned members receive higher sample weights so future recommendations actively correct imbalances.</p>
                    <p x-show="retrainResult" class="text-xs mt-2 font-semibold"
                       :class="retrainResult?.success ? 'text-green-700' : 'text-red-700'"
                       x-text="retrainResult?.success ? '✅ ' + retrainResult.message + ' ROC-AUC: ' + retrainResult.metadata?.roc_auc : '❌ ' + retrainResult?.detail"></p>
                </div>
                <button @click="retrain()"
                        :disabled="retraining"
                        class="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                        :class="retraining ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'">
                    <svg x-show="retraining" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span x-text="retraining ? 'Training…' : 'Retrain Model'"></span>
                </button>
            </div>
        </div>

        <!-- Days control -->
        <div class="flex justify-end gap-2">
            <button @click="loadReport(30)"  class="text-xs font-medium px-3 py-1.5 rounded-md border" :class="days === 30  ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'">30 days</button>
            <button @click="loadReport(90)"  class="text-xs font-medium px-3 py-1.5 rounded-md border" :class="days === 90  ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'">90 days</button>
            <button @click="loadReport(180)" class="text-xs font-medium px-3 py-1.5 rounded-md border" :class="days === 180 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'">180 days</button>
            <button @click="loadReport(365)" class="text-xs font-medium px-3 py-1.5 rounded-md border" :class="days === 365 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'">1 year</button>
        </div>
    </div>
</div>

<script>
function fairnessReport() {
    return {
        loading: true,
        error: null,
        data: null,
        days: 90,
        maxCount: 1,
        retraining: false,
        retrainResult: null,

        init() {
            this.loadReport(this.days);
        },

        async loadReport(days) {
            days = days || this.days;
            this.days = days;
            this.loading = true;
            this.error = null;

            try {
                const nlpServiceUrl = '{{ config("services.nlp.url") }}';
                const response = await fetch(`${nlpServiceUrl}/fairness-report?days=${days}`);

                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load fairness report`);

                this.data = await response.json();

                if (!this.data.success) {
                    this.error = this.data.message || 'No data available for this period.';
                    this.data = null;
                    return;
                }

                // Compute max for bar chart scaling
                const dist = this.data.member_distribution || [];
                this.maxCount = dist.length > 0 ? Math.max(...dist.map(m => m.count), 1) : 1;

            } catch (err) {
                console.error('Fairness report error:', err);
                this.error = err.message || 'Failed to load fairness report. Make sure the NLP service is running on port 8001.';
            } finally {
                this.loading = false;
            }
        },

        barWidth(count) {
            if (this.maxCount === 0) return 0;
            return Math.max((count / this.maxCount) * 100, count === 0 ? 3 : 0);
        },

        async retrain() {
            this.retraining = true;
            this.retrainResult = null;
            try {
                const nlpServiceUrl = '{{ config("services.nlp.url") }}';
                const res = await fetch(`${nlpServiceUrl}/retrain?days=${this.days}`, { method: 'POST' });
                this.retrainResult = await res.json();
                if (this.retrainResult.success) {
                    // Reload fairness data so the new metric is reflected
                    setTimeout(() => this.loadReport(this.days), 800);
                }
            } catch (err) {
                this.retrainResult = { success: false, detail: err.message || 'Network error' };
            } finally {
                this.retraining = false;
            }
        }
    };
}
</script>
@endsection
