<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\WhitelistController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\AssignAIController;

Route::get('/', function () {
    return view('welcome');
});

// Authentication routes
Route::get('/login', function () {
    return view('auth.login');
})->name('login');

Route::get('/auth/google', [AuthController::class, 'redirectToGoogle'])->name('auth.google');
Route::get('/auth/google/callback', [AuthController::class, 'handleGoogleCallback'])->name('auth.google.callback');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::get('/not-whitelisted', function () {
    return view('auth.not-whitelisted');
})->name('not-whitelisted');

Route::get('/pending-approval', function () {
    return view('auth.pending-approval');
})->name('pending-approval');

Route::get('/onboarding', function () {
    return view('auth.onboarding');
})->middleware('auth')->name('onboarding');

// Protected routes - require authentication and whitelist
Route::middleware(['auth', 'whitelisted'])->group(function () {
    
    // Dashboard routes
    Route::get('/dashboard', function () {
        $user = auth()->user();
        $role = $user->role->name;
        
        return match($role) {
            'admin' => redirect()->route('admin.dashboard'),
            'adviser' => redirect()->route('adviser.dashboard'),
            default => redirect()->route('member.dashboard'),
        };
    })->name('dashboard');

    // Events - accessible by all authenticated users (view)
    Route::get('/events', [EventController::class, 'index'])->name('events.index');
    
    // Event creation/management - Admin and Adviser only
    Route::middleware(['role:admin,adviser'])->group(function () {
        Route::get('/events/create', [EventController::class, 'create'])->name('events.create');
        Route::post('/events', [EventController::class, 'store'])->name('events.store');
        Route::get('/events/{id}/edit', [EventController::class, 'edit'])->name('events.edit');
        Route::put('/events/{id}', [EventController::class, 'update'])->name('events.update');
        Route::delete('/events/{id}', [EventController::class, 'destroy'])->name('events.destroy');
        
        // AssignAI API Routes
        Route::prefix('api/assignai')->group(function () {
            Route::post('/chat', [AssignAIController::class, 'chat'])->name('assignai.chat');
            Route::post('/suggest', [AssignAIController::class, 'suggest'])->name('assignai.suggest');
            Route::post('/finalize', [AssignAIController::class, 'finalize'])->name('assignai.finalize');
            Route::post('/regenerate', [AssignAIController::class, 'regenerate'])->name('assignai.regenerate');
            Route::post('/explain', [AssignAIController::class, 'explain'])->name('assignai.explain');
            Route::post('/explain-shap', [AssignAIController::class, 'explainShap'])->name('assignai.explain-shap');
            Route::post('/parse', [AssignAIController::class, 'parseOnly'])->name('assignai.parse');
            Route::get('/health', [AssignAIController::class, 'health'])->name('assignai.health');
        });
    });
    
    // Event detail view - accessible by all
    Route::get('/events/{id}', [EventController::class, 'show'])->name('events.show');
    
    // Whitelist management - Admin only
    Route::middleware(['role:admin'])->prefix('admin')->name('admin.')->group(function () {
        Route::get('/dashboard', function () {
            return view('admin.dashboard');
        })->name('dashboard');
        
        Route::get('/fairness-report', function () {
            return view('admin.fairness-report');
        })->name('fairness-report');
        
        Route::get('/whitelist', [WhitelistController::class, 'index'])->name('whitelist.index');
        Route::get('/whitelist/pending', [WhitelistController::class, 'pending'])->name('whitelist.pending');
        Route::post('/whitelist', [WhitelistController::class, 'store'])->name('whitelist.store');
        Route::post('/whitelist/{id}/approve', [WhitelistController::class, 'approve'])->name('whitelist.approve');
        Route::post('/whitelist/{id}/reject', [WhitelistController::class, 'reject'])->name('whitelist.reject');
        Route::delete('/whitelist/{id}', [WhitelistController::class, 'destroy'])->name('whitelist.destroy');
        Route::post('/whitelist/bulk-import', [WhitelistController::class, 'bulkImport'])->name('whitelist.bulk-import');
    });

    // Whitelist management - Adviser
    Route::middleware(['role:adviser'])->prefix('adviser')->name('adviser.')->group(function () {
        Route::get('/dashboard', function () {
            return view('adviser.dashboard');
        })->name('dashboard');
        
        Route::get('/whitelist', [WhitelistController::class, 'index'])->name('whitelist.index');
        Route::get('/whitelist/pending', [WhitelistController::class, 'pending'])->name('whitelist.pending');
        Route::post('/whitelist', [WhitelistController::class, 'store'])->name('whitelist.store');
        Route::post('/whitelist/{id}/approve', [WhitelistController::class, 'approve'])->name('whitelist.approve');
        Route::post('/whitelist/{id}/reject', [WhitelistController::class, 'reject'])->name('whitelist.reject');
        Route::delete('/whitelist/{id}', [WhitelistController::class, 'destroy'])->name('whitelist.destroy');
        Route::post('/whitelist/bulk-import', [WhitelistController::class, 'bulkImport'])->name('whitelist.bulk-import');
    });

    // Member dashboard
    Route::middleware(['role:member'])->prefix('member')->name('member.')->group(function () {
        Route::get('/dashboard', function () {
            return view('member.dashboard');
        })->name('dashboard');
    });
});

