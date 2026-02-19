@extends('layouts.app')

@section('title', 'Members')

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

    {{-- Header --}}
    <div class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Members</h1>
            <p class="mt-1 text-sm text-gray-500">
                {{ $members->total() }} member{{ $members->total() !== 1 ? 's' : '' }} found
                &mdash; Today is <span class="font-medium">{{ $today->format('l, F j, Y') }}</span>
            </p>
        </div>
    </div>

    {{-- Filters --}}
    <form method="GET" class="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {{-- Search --}}
            <div class="lg:col-span-1">
                <label class="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <input
                    type="text" name="search" value="{{ $search }}"
                    placeholder="Name, student no., email…"
                    class="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                >
            </div>

            {{-- College --}}
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">College</label>
                <select name="college" class="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border">
                    <option value="">All colleges</option>
                    @foreach($colleges as $col)
                        <option value="{{ $col->id }}" {{ (string)$college === (string)$col->id ? 'selected' : '' }}>
                            {{ $col->name }}
                        </option>
                    @endforeach
                </select>
            </div>

            {{-- Gender --}}
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                <select name="gender" class="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border">
                    <option value="">All genders</option>
                    <option value="M" {{ $gender === 'M' ? 'selected' : '' }}>Male</option>
                    <option value="F" {{ $gender === 'F' ? 'selected' : '' }}>Female</option>
                </select>
            </div>

            {{-- Year Level --}}
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Year Level</label>
                <select name="year_level" class="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border">
                    <option value="">All years</option>
                    @foreach([1,2,3,4] as $yr)
                        <option value="{{ $yr }}" {{ (string)$yearLevel === (string)$yr ? 'selected' : '' }}>
                            {{ $yr }}{{ match($yr){1=>'st',2=>'nd',3=>'rd',default=>'th'} }} Year
                        </option>
                    @endforeach
                </select>
            </div>
        </div>

        <div class="mt-3 flex items-center gap-2">
            <button type="submit"
                class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Filter
            </button>
            @if($search || $college || $gender || $yearLevel)
                <a href="{{ request()->url() }}"
                    class="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50">
                    Clear
                </a>
            @endif
        </div>
    </form>

    {{-- Availability legend --}}
    <div class="mb-4 flex flex-wrap gap-3 text-xs text-gray-600">
        <span class="font-medium">Today's availability:</span>
        <span class="inline-flex items-center gap-1">
            <span class="inline-block w-3 h-3 rounded-full bg-green-500"></span> Available
        </span>
        <span class="inline-flex items-center gap-1">
            <span class="inline-block w-3 h-3 rounded-full bg-gray-300"></span> Unavailable
        </span>
    </div>

    {{-- Table --}}
    <div class="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student #</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">College / Course</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Yr / Gender</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Ht / Shirt</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Availability ({{ $dayOfWeek }})</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    @forelse($members as $member)
                        @php
                            $avail = $memberAvailability[$member->id] ?? [];
                            $morningAvail   = $avail['morning']   ?? false;
                            $afternoonAvail = $avail['afternoon'] ?? false;
                        @endphp
                        <tr class="hover:bg-gray-50 transition-colors">

                            {{-- Name + email --}}
                            <td class="px-4 py-3">
                                <div class="font-medium text-gray-900">
                                    {{ $member->first_name }} {{ $member->last_name }}
                                </div>
                                <div class="text-xs text-gray-400">{{ $member->email }}</div>
                            </td>

                            {{-- Student # --}}
                            <td class="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {{ $member->student_number ?? '—' }}
                            </td>

                            {{-- College / Course --}}
                            <td class="px-4 py-3">
                                @if($member->college)
                                    <div class="text-gray-800">{{ $member->college->name }}</div>
                                @else
                                    <span class="text-gray-400">—</span>
                                @endif
                                @if($member->course)
                                    <div class="text-xs text-gray-400 truncate max-w-xs">{{ $member->course->name }}</div>
                                @endif
                            </td>

                            {{-- Year / Gender --}}
                            <td class="px-4 py-3 text-center whitespace-nowrap">
                                <span class="text-gray-700">
                                    {{ $member->year_level ? $member->year_level . 'Y' : '—' }}
                                </span>
                                <span class="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                                    {{ $member->gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700' }}">
                                    {{ $member->gender === 'M' ? 'M' : ($member->gender === 'F' ? 'F' : '?') }}
                                </span>
                            </td>

                            {{-- Batch year --}}
                            <td class="px-4 py-3 text-center text-gray-600">
                                @if($member->batch_year)
                                    {{ $member->batch_year }}
                                    @if($member->isNewMember())
                                        <span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">new</span>
                                    @endif
                                @else
                                    —
                                @endif
                            </td>

                            {{-- Height / T-shirt --}}
                            <td class="px-4 py-3 text-center whitespace-nowrap text-gray-600">
                                {{ $member->height ? $member->height . ' cm' : '—' }}
                                @if($member->tshirt_size)
                                    <span class="ml-1 text-xs text-gray-400">/ {{ $member->tshirt_size }}</span>
                                @endif
                            </td>

                            {{-- Today's availability --}}
                            <td class="px-4 py-3 text-center">
                                <div class="flex flex-col items-center gap-1">
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                                        {{ $morningAvail ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400' }}">
                                        Morning
                                        @if($morningAvail)
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                                        @else
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                        @endif
                                    </span>
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                                        {{ $afternoonAvail ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400' }}">
                                        Afternoon
                                        @if($afternoonAvail)
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                                        @else
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                        @endif
                                    </span>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="px-4 py-12 text-center text-gray-500">
                                No members found matching your filters.
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    {{-- Pagination --}}
    @if($members->hasPages())
        <div class="mt-4">
            {{ $members->links() }}
        </div>
    @endif

</div>
@endsection
