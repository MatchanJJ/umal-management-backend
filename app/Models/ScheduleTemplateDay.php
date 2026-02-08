<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleTemplateDay extends Model
{
    protected $table = 'schedule_template_days';
    protected $fillable = ['schedule_template_id', 'day_of_week', 'mode'];
    public $timestamps = false;

    // Relationships
    public function scheduleTemplate()
    {
        return $this->belongsTo(ScheduleTemplate::class);
    }
}
