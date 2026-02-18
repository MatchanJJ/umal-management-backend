<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pending Approval - UMAL Management System</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
            <div class="text-center">
                <svg class="mx-auto h-16 w-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
                    Approval Pending
                </h2>
                <p class="mt-2 text-sm text-gray-600">
                    Your access request is awaiting approval
                </p>
            </div>

            <div class="bg-white shadow overflow-hidden sm:rounded-lg">
                <div class="px-4 py-5 sm:p-6">
                    <div class="text-center">
                        @if(session('email'))
                        <p class="text-sm text-gray-700 mb-4">
                            Email: <span class="font-semibold">{{ session('email') }}</span>
                        </p>
                        @endif
                        
                        <p class="text-sm text-gray-600 mb-4">
                            An administrator or adviser will review your request shortly. You will receive an email notification once your account has been approved.
                        </p>
                        
                        <p class="text-xs text-gray-500">
                            This usually takes 1-2 business days.
                        </p>
                    </div>
                </div>
            </div>

            <div class="text-center">
                <a href="{{ route('login') }}" class="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Back to login
                </a>
            </div>
        </div>
    </div>
</body>
</html>
