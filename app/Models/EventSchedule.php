<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EventSchedule extends Model
{
    protected $table = 'event_schedules';
    protected $fillable = ['event_id', 'term_id', 'day_of_week', 'half_day'];
    public $timestamps = false;

    // Relationships
    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function term()
    {
        return $this->belongsTo(Term::class);
    }
}
