<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Carbon\Carbon;

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

    // ========================================
    // ML Feature Calculation Methods
    // For AssignAI fair assignment prediction
    // ========================================

    /**
     * Get number of assignments in last N days
     */
    public function assignmentsInLastDays(int $days): int
    {
        return $this->volunteerAssignments()
            ->whereHas('event', function ($query) use ($days) {
                $query->where('date', '>=', now()->subDays($days));
            })
            ->count();
    }

    /**
     * Get days since last assignment
     * Returns 999 if never assigned
     */
    public function daysSinceLastAssignment(): int
    {
        $lastAssignment = $this->volunteerAssignments()
            ->join('events', 'events.id', '=', 'volunteer_assignments.event_id')
            ->orderBy('events.date', 'desc')
            ->first();

        if (!$lastAssignment) {
            return 999; // Never assigned
        }

        return now()->diffInDays($lastAssignment->date);
    }

    /**
     * Calculate attendance/completion rate
     * Returns ratio of completed assignments to total assignments
     */
    public function attendanceRate(): float
    {
        $total = $this->volunteerAssignments()->count();

        if ($total === 0) {
            return 0.8; // Default for new members (optimistic)
        }

        $completed = $this->volunteerAssignments()
            ->where('status', 'completed')
            ->count();

        return round($completed / $total, 2);
    }

    /**
     * Check if member is available on specific date/time
     */
    public function isAvailableOn(string $date, string $timeBlock): bool
    {
        $eventDate = \Carbon\Carbon::parse($date);
        $dayOfWeek = $eventDate->format('l'); // Monday, Tuesday, etc.

        // Check member_availability table
        $availability = $this->availability()
            ->where('day_of_week', $dayOfWeek)
            ->where('time_block', $timeBlock)
            ->where('is_available', true)
            ->exists();

        if (!$availability) {
            return false;
        }

        // Check for class conflicts
        return !$this->hasClassConflictOn($eventDate, $timeBlock);
    }

    /**
     * Check if member has class conflict on given date/time
     */
    protected function hasClassConflictOn(\Carbon\Carbon $eventDate, string $timeBlock): bool
    {
        $dayOfWeek = $eventDate->format('l');

        // Get active term for this date
        $term = Term::where('start_date', '<=', $eventDate)
            ->where('end_date', '>=', $eventDate)
            ->first();

        if (!$term) {
            return false; // No active term, no conflict
        }

        // Check if member has any classes during this time
        return $this->schedules()
            ->where('term_id', $term->id)
            ->whereHas('scheduleEntries', function ($query) use ($dayOfWeek, $timeBlock) {
                $query->where('day_of_week', $dayOfWeek);
                
                // Simple time block check
                // Morning: before 12:00, Afternoon: after 12:00
                if (strtolower($timeBlock) === 'morning') {
                    $query->whereHas('timeSlot', function ($q) {
                        $q->whereTime('start_time', '<', '12:00:00');
                    });
                } else {
                    $query->whereHas('timeSlot', function ($q) {
                        $q->whereTime('start_time', '>=', '12:00:00');
                    });
                }
            })
            ->exists();
    }

    /**
     * Prepare ML features for assignment prediction
     * 
     * This is the main method called by AssignAI service
     * Returns array matching the ML model's expected features
     */
    public function toMLFeatures(string $eventDate, string $timeBlock): array
    {
        return [
            'member_id' => (string) $this->id,
            'is_available' => $this->isAvailableOn($eventDate, $timeBlock) ? 1 : 0,
            'assignments_last_7_days' => $this->assignmentsInLastDays(7),
            'assignments_last_30_days' => $this->assignmentsInLastDays(30),
            'days_since_last_assignment' => $this->daysSinceLastAssignment(),
            'attendance_rate' => $this->attendanceRate(),
        ];
    }
}
