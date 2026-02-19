<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'UMAL Management System')</title>
    
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    
    <!-- Alpine.js -->
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    
    <style>
        [x-cloak] { display: none !important; }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    @auth
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex">
                    <div class="flex-shrink-0 flex items-center">
                        <a href="{{ route('dashboard') }}" class="text-xl font-bold text-blue-600">
                            UMAL Management
                        </a>
                    </div>
                    <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                        <a href="{{ route('dashboard') }}" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Dashboard
                        </a>
                        @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
                        <a href="{{ route('events.create') }}" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Create Event
                        </a>
                        @endif
                        <a href="{{ route('events.index') }}" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Events
                        </a>
                        @if(auth()->user()->role && in_array(auth()->user()->role->name, ['admin', 'adviser']))
                        @php
                            $membersRoute = auth()->user()->role->name === 'admin'
                                ? route('admin.members.index')
                                : route('adviser.members.index');
                        @endphp
                        <a href="{{ $membersRoute }}" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Members
                        </a>
                        @endif
                    </div>
                </div>
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <span class="text-sm text-gray-700 mr-4">
                            {{ auth()->user()->first_name }} {{ auth()->user()->last_name }}
                            <span class="text-xs text-gray-500">({{ auth()->user()->role->name ?? 'member' }})</span>
                        </span>
                    </div>
                    <form method="POST" action="{{ route('logout') }}" class="inline">
                        @csrf
                        <button type="submit" class="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Logout
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </nav>
    @endauth

    <!-- Flash Messages -->
    @if(session('success'))
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div class="bg-green-50 border-l-4 border-green-400 p-4">
            <p class="text-sm text-green-700">{{ session('success') }}</p>
        </div>
    </div>
    @endif

    @if(session('error'))
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div class="bg-red-50 border-l-4 border-red-400 p-4">
            <p class="text-sm text-red-700">{{ session('error') }}</p>
        </div>
    </div>
    @endif

    @if(session('welcome'))
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div class="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p class="text-sm text-blue-700">{{ session('welcome') }}</p>
        </div>
    </div>
    @endif

    <!-- Main Content -->
    <main class="py-10">
        @yield('content')
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-auto">
        <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <p class="text-center text-sm text-gray-500">
                &copy; {{ date('Y') }} UMAL Management System. All rights reserved.
            </p>
        </div>
    </footer>
</body>
</html>
