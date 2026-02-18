<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Not Whitelisted - UMAL Management System</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
            <div class="text-center">
                <svg class="mx-auto h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
                    Access Not Approved
                </h2>
                <p class="mt-2 text-sm text-gray-600">
                    You don't have permission to access this system
                </p>
            </div>

            <div class="bg-white shadow overflow-hidden sm:rounded-lg">
                <div class="px-4 py-5 sm:p-6">
                    <div class="text-center">
                        <p class="text-sm text-gray-600 mb-4">
                            Your email address is not in our whitelist or has been rejected.
                        </p>
                        
                        <p class="text-sm text-gray-600 mb-4">
                            Please contact an administrator or adviser to request access:
                        </p>
                        
                        <ul class="text-sm text-gray-700 space-y-1">
                            <li>• Admin: admin@university.edu.ph</li>
                            <li>• Adviser: adviser@university.edu.ph</li>
                        </ul>
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
