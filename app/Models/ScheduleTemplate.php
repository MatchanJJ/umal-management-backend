<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleTemplate extends Model
{
    protected $table = 'schedule_templates';
    protected $fillable = ['code', 'description'];
    public $timestamps = false;

    // Relationships
    public function scheduleTemplateDays()
    {
        return $this->hasMany(ScheduleTemplateDay::class);
    }

    public function memberSchedules()
    {
        return $this->hasMany(MemberSchedule::class);
    }
}
