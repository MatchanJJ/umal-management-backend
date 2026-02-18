<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    protected $table = 'events';
    protected $fillable = [
        'title', 
        'description', 
        'date', 
        'time_block', 
        'venue', 
        'required_volunteers',
        'assigned_volunteers',
        'created_by', 
        'status'
    ];
    public $timestamps = true;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $casts = [
        'date' => 'date',
    ];

    // Relationships
    public function creator()
    {
        return $this->belongsTo(Member::class, 'created_by');
    }

    public function volunteerAssignments()
    {
        return $this->hasMany(VolunteerAssignment::class);
    }

    // Helper methods
    public function isMorning()
    {
        return $this->time_block === 'Morning';
    }

    public function isAfternoon()
    {
        return $this->time_block === 'Afternoon';
    }

    public function isFullyStaffed()
    {
        return $this->assigned_volunteers >= $this->required_volunteers;
    }

    public function needsMoreVolunteers()
    {
        return $this->assigned_volunteers < $this->required_volunteers;
    }

    public function getShortfall()
    {
        return max(0, $this->required_volunteers - $this->assigned_volunteers);
    }
}
