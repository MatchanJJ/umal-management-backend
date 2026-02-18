<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class MemberWhitelist extends Model
{
    protected $table = 'member_whitelist';

    protected $fillable = [
        'email',
        'approved_by',
        'approved_role',
        'status',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public $timestamps = false;

    // Relationships
    public function approver()
    {
        return $this->belongsTo(Member::class, 'approved_by');
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    public function scopeByRole($query, $role)
    {
        return $query->where('approved_role', $role);
    }

    // Helper methods
    public function approve($approverId = null)
    {
        $this->update([
            'status' => 'approved',
            'approved_by' => $approverId ?? auth()->id(),
        ]);
    }

    public function reject($approverId = null)
    {
        $this->update([
            'status' => 'rejected',
            'approved_by' => $approverId ?? auth()->id(),
        ]);
    }

    public static function isApproved($email)
    {
        return self::where('email', $email)
            ->where('status', 'approved')
            ->exists();
    }

    public static function isPending($email)
    {
        return self::where('email', $email)
            ->where('status', 'pending')
            ->exists();
    }

    // Validation
    public static function validateUniversityEmail($email)
    {
        // Validate university email domain - adjust domain as needed
        $allowedDomains = ['university.edu.ph', 'uc-bcf.edu.ph', 'umindanao.edu.ph']; // Add your university domains
        
        $domain = substr(strrchr($email, "@"), 1);
        
        if (!in_array($domain, $allowedDomains)) {
            throw ValidationException::withMessages([
                'email' => 'Email must be a valid university email address.'
            ]);
        }
        
        return true;
    }
}

