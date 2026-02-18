@extends('layouts.app')

@section('title', 'Complete Your Profile')

@section('content')
<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="bg-white shadow overflow-hidden sm:rounded-lg">
        <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
                Complete Your Profile
            </h3>
            <div class="mt-2 max-w-xl text-sm text-gray-500">
                <p>Please complete your profile information to get started.</p>
            </div>
            <form class="mt-5 space-y-6" action="/onboarding" method="POST">
                @csrf
                <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                    <div>
                        <label for="student_number" class="block text-sm font-medium text-gray-700">Student Number</label>
                        <input type="text" name="student_number" id="student_number" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" required>
                    </div>
                    
                    <div>
                        <label for="year_level" class="block text-sm font-medium text-gray-700">Year Level</label>
                        <select name="year_level" id="year_level" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                            <option value="5">5th Year</option>
                        </select>
                    </div>
                    
                    <div>
                        <label for="height" class="block text-sm font-medium text-gray-700">Height (cm)</label>
                        <input type="number" name="height" id="height" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    </div>
                    
                    <div>
                        <label for="tshirt_size" class="block text-sm font-medium text-gray-700">T-Shirt Size</label>
                        <select name="tshirt_size" id="tshirt_size" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <option value="XS">XS</option>
                            <option value="S">S</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                            <option value="XXL">XXL</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex justify-end">
                    <a href="{{ route('dashboard') }}" class="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Skip for now
                    </a>
                    <button type="submit" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Save Profile
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection
