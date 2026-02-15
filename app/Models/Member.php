<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Member extends Authenticatable
{
    use Notifiable;

    protected $table = 'members';
    protected $fillable = [
        'org_id',
        'role_id',
        'student_number', 
        'first_name', 
        'last_name', 
        'email',
        'password',
        'google_id',
        'email_verified_at',
        'year_level', 
        'college_id', 
        'course_id',
        'height', 
        'tshirt_size'
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public $timestamps = true;

    // Relationships
    public function organization()
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function college()
    {
        return $this->belongsTo(College::class, 'college_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function schedules()
    {
        return $this->hasMany(MemberSchedule::class);
    }
    
    public function availability()
    {
        return $this->hasMany(MemberAvailability::class);
    }

    public function volunteerAssignments()
    {
        return $this->hasMany(VolunteerAssignment::class);
    }

    public function createdEvents()
    {
        return $this->hasMany(Event::class, 'created_by');
    }

    public function assignedVolunteers()
    {
        return $this->hasMany(VolunteerAssignment::class, 'assigned_by');
    }

    // Scopes
    public function scopeStudents($query)
    {
        return $query->whereHas('role', function ($q) {
            $q->where('name', 'member');
        });
    }

    public function scopeAdvisers($query)
    {
        return $query->whereHas('role', function ($q) {
            $q->where('name', 'adviser');
        });
    }

    public function scopeAdmins($query)
    {
        return $query->whereHas('role', function ($q) {
            $q->where('name', 'admin');
        });
    }

    // Helper methods
    public function isStudent()
    {
        return $this->role && $this->role->name === 'member';
    }

    public function isAdviser()
    {
        return $this->role && $this->role->name === 'adviser';
    }

    public function isAdmin()
    {
        return $this->role && $this->role->name === 'admin';
    }

    public function getRoleName()
    {
        return $this->role ? $this->role->name : null;
    }

    public function getFullNameAttribute() {
        return "{$this->first_name} {$this->last_name}";
    }
}
