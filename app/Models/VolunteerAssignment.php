<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VolunteerAssignment extends Model
{
    protected $table = 'volunteer_assignments';
    protected $fillable = [
        'event_id', 
        'member_id', 
        'assigned_by', 
        'has_class_conflict', 
        'conflict_notes'
    ];
    public $timestamps = true;
    const CREATED_AT = 'assigned_at';
    const UPDATED_AT = null;

    protected $casts = [
        'has_class_conflict' => 'boolean',
    ];

    // Relationships
    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    public function assignedBy()
    {
        return $this->belongsTo(Member::class, 'assigned_by');
    }
}
