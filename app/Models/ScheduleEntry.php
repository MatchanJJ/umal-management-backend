<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleEntry extends Model
{
    protected $table = 'schedule_entries';
    protected $fillable = ['member_schedule_id', 'day_of_week', 'time_slot_id'];
    public $timestamps = false;

    // Relationships
    public function memberSchedule()
    {
        return $this->belongsTo(MemberSchedule::class);
    }

    public function timeSlot()
    {
        return $this->belongsTo(TimeSlot::class);
    }
}
