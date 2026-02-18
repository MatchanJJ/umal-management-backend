<?php

namespace App\Http\Controllers;

use App\Models\Member;
use App\Models\MemberWhitelist;
use App\Models\Organization;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Exception;

class AuthController extends Controller
{
    /**
     * Redirect to Google OAuth
     */
    public function redirectToGoogle()
    {
        return Socialite::driver('google')
            ->scopes(['email', 'profile'])
            ->redirect();
    }

    /**
     * Handle Google OAuth callback
     */
    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->user();
            
            // Validate university email
            try {
                MemberWhitelist::validateUniversityEmail($googleUser->getEmail());
            } catch (\Illuminate\Validation\ValidationException $e) {
                return redirect()->route('login')
                    ->with('error', 'Only university email addresses are allowed.');
            }

            // Check if member already exists
            $member = Member::where('email', $googleUser->getEmail())->first();

            if ($member) {
                // Update Google ID if not set
                if (!$member->google_id) {
                    $member->update([
                        'google_id' => $googleUser->getId(),
                        'email_verified_at' => now(),
                    ]);
                }

                Auth::guard('web')->login($member);
                return redirect()->intended('/dashboard');
            }

            // Check whitelist status
            $whitelist = MemberWhitelist::where('email', $googleUser->getEmail())->first();

            if (!$whitelist) {
                // Create pending whitelist entry for new users
                MemberWhitelist::create([
                    'email' => $googleUser->getEmail(),
                    'approved_role' => 'member', // Default to member
                    'status' => 'pending',
                ]);

                return redirect()->route('pending-approval')
                    ->with('email', $googleUser->getEmail());
            }

            if ($whitelist->status === 'pending') {
                return redirect()->route('pending-approval')
                    ->with('email', $googleUser->getEmail());
            }

            if ($whitelist->status === 'rejected') {
                return redirect()->route('login')
                    ->with('error', 'Your access request has been rejected. Please contact an administrator.');
            }

            // Approved - create new member account
            if ($whitelist->status === 'approved') {
                $member = $this->createMemberFromGoogle($googleUser, $whitelist);
                Auth::guard('web')->login($member);
                
                return redirect()->route('onboarding')
                    ->with('welcome', 'Welcome! Please complete your profile.');
            }

            return redirect()->route('login')
                ->with('error', 'Unable to process your login. Please try again.');

        } catch (Exception $e) {
            return redirect()->route('login')
                ->with('error', 'Authentication failed: ' . $e->getMessage());
        }
    }

    /**
     * Create a new member from Google OAuth data
     */
    protected function createMemberFromGoogle($googleUser, $whitelist)
    {
        // Get default organization (first one or create one)
        $organization = Organization::first();
        if (!$organization) {
            $organization = Organization::create([
                'name' => 'Default Organization',
                'description' => 'Auto-created organization',
            ]);
        }

        // Get role based on whitelist
        $role = Role::where('name', $whitelist->approved_role)->first();
        if (!$role) {
            $role = Role::create(['name' => $whitelist->approved_role]);
        }

        // Parse name from Google
        $nameParts = explode(' ', $googleUser->getName(), 2);
        $firstName = $nameParts[0];
        $lastName = $nameParts[1] ?? '';

        return Member::create([
            'org_id' => $organization->id,
            'role_id' => $role->id,
            'google_id' => $googleUser->getId(),
            'email' => $googleUser->getEmail(),
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email_verified_at' => now(),
        ]);
    }

    /**
     * Logout
     */
    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')
            ->with('success', 'You have been logged out successfully.');
    }
}
