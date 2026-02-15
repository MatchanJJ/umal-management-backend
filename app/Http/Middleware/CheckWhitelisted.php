<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\MemberWhitelist;

class CheckWhitelisted
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = auth()->user();
        
        if (!$user) {
            return redirect()->route('login');
        }

        // Check if user email is in whitelist with approved status
        $whitelist = MemberWhitelist::where('email', $user->email)
            ->where('status', 'approved')
            ->first();

        if (!$whitelist) {
            // Check if pending
            $pending = MemberWhitelist::where('email', $user->email)
                ->where('status', 'pending')
                ->first();

            if ($pending) {
                return redirect()->route('pending-approval');
            }

            // Not whitelisted at all
            return redirect()->route('not-whitelisted');
        }

        return $next($request);
    }
}

