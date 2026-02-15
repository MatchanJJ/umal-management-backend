<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\WhitelistController;

Route::get('/', function () {
    return view('welcome');
});

// Authentication routes (placeholder - will be implemented with Google OAuth)
Route::get('/login', function () {
    return view('auth.login');
})->name('login');

Route::get('/not-whitelisted', function () {
    return view('auth.not-whitelisted');
})->name('not-whitelisted');

Route::get('/pending-approval', function () {
    return view('auth.pending-approval');
})->name('pending-approval');

// Protected routes - require authentication and whitelist
Route::middleware(['auth', 'whitelisted'])->group(function () {
    
    // Whitelist management - Admin only
    Route::middleware(['role:admin'])->prefix('admin')->name('admin.')->group(function () {
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

