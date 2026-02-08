<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    protected $table = 'events';
    protected $fillable = ['title', 'description', 'created_by', 'status'];
    public $timestamps = true;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    // Relationships
    public function creator()
    {
        return $this->belongsTo(Member::class, 'created_by');
    }

    public function eventSchedules()
    {
        return $this->hasMany(EventSchedule::class);
    }

    public function volunteerAssignments()
    {
        return $this->hasMany(VolunteerAssignment::class);
    }
}
