<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TimeSlot extends Model
{
    protected $table = 'time_slots';
    protected $fillable = ['start_time', 'end_time', 'label'];
    public $timestamps = false;

    protected $casts = [
        'start_time' => 'datetime:H:i:s',
        'end_time' => 'datetime:H:i:s',
    ];

    // Relationships
    public function scheduleEntries()
    {
        return $this->hasMany(ScheduleEntry::class);
    }
}
