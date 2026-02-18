@extends('layouts.app')

@section('title', 'Events')

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Events</h1>
            <p class="mt-1 text-sm text-gray-600">View and manage organization events</p>
        </div>
        @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
        <a href="{{ route('events.create') }}" 
           class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create Event
        </a>
        @endif
    </div>

    <!-- Filter Options -->
    <div class="bg-white shadow sm:rounded-lg mb-6">
        <div class="px-4 py-5 sm:p-6">
            <form method="GET" action="{{ route('events.index') }}" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                    <label for="status" class="block text-sm font-medium text-gray-700">Status</label>
                    <select name="status" id="status" 
                            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        <option value="">All Statuses</option>
                        <option value="draft" {{ request('status') == 'draft' ? 'selected' : '' }}>Draft</option>
                        <option value="scheduled" {{ request('status') == 'scheduled' ? 'selected' : '' }}>Scheduled</option>
                        <option value="ongoing" {{ request('status') == 'ongoing' ? 'selected' : '' }}>Ongoing</option>
                        <option value="completed" {{ request('status') == 'completed' ? 'selected' : '' }}>Completed</option>
                        <option value="cancelled" {{ request('status') == 'cancelled' ? 'selected' : '' }}>Cancelled</option>
                    </select>
                </div>
                <div class="flex items-end">
                    <button type="submit" 
                            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Apply Filters
                    </button>
                    @if(request()->hasAny(['status']))
                    <a href="{{ route('events.index') }}" 
                       class="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Clear
                    </a>
                    @endif
                </div>
            </form>
        </div>
    </div>

    <!-- Events List -->
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
        @if($events->isEmpty())
        <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No events</h3>
            <p class="mt-1 text-sm text-gray-500">Get started by creating a new event.</p>
            @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
            <div class="mt-6">
                <a href="{{ route('events.create') }}" 
                   class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Create Event
                </a>
            </div>
            @endif
        </div>
        @else
        <ul class="divide-y divide-gray-200">
            @foreach($events as $event)
            <li>
                <a href="{{ route('events.show', $event->id) }}" class="block hover:bg-gray-50">
                    <div class="px-4 py-4 sm:px-6">
                        <div class="flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-blue-600 truncate">
                                    {{ $event->title }}
                                </p>
                                <div class="mt-2 flex items-center text-sm text-gray-500">
                                    <svg class="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                    <span class="truncate">
                                        Created by {{ $event->creator->first_name }} {{ $event->creator->last_name }}
                                        ({{ $event->creator->role->name }})
                                    </span>
                                </div>
                                @if($event->description)
                                <p class="mt-2 text-sm text-gray-600 line-clamp-2">
                                    {{ $event->description }}
                                </p>
                                @endif
                            </div>
                            <div class="ml-5 flex-shrink-0 flex items-center space-x-3">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                    @if($event->status === 'draft') bg-gray-100 text-gray-800
                                    @elseif($event->status === 'scheduled') bg-blue-100 text-blue-800
                                    @elseif($event->status === 'ongoing') bg-green-100 text-green-800
                                    @elseif($event->status === 'completed') bg-purple-100 text-purple-800
                                    @elseif($event->status === 'cancelled') bg-red-100 text-red-800
                                    @endif">
                                    {{ ucfirst($event->status) }}
                                </span>
                                @if($event->date)
                                <div class="text-sm text-gray-500 flex items-center">
                                    <svg class="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                    {{ \Carbon\Carbon::parse($event->date)->format('M j, Y') }} - {{ $event->time_block }}
                                </div>
                                @endif
                                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
                </a>
            </li>
            @endforeach
        </ul>

        <!-- Pagination -->
        <div class="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            {{ $events->links() }}
        </div>
        @endif
    </div>
</div>
@endsection
