<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemberSchedule extends Model
{
    protected $table = 'member_schedules';
    protected $fillable = ['member_id', 'term_id', 'schedule_template_id'];
    public $timestamps = false;

    // Relationships
    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    public function term()
    {
        return $this->belongsTo(Term::class);
    }

    public function scheduleTemplate()
    {
        return $this->belongsTo(ScheduleTemplate::class);
    }

    public function scheduleEntries()
    {
        return $this->hasMany(ScheduleEntry::class);
    }
}
