<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Term extends Model
{
    protected $table = 'terms';
    protected $fillable = ['semester_id', 'name', 'start_date', 'end_date'];
    public $timestamps = false;

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    // Relationships
    public function semester()
    {
        return $this->belongsTo(Semester::class);
    }

    public function memberSchedules()
    {
        return $this->hasMany(MemberSchedule::class);
    }

    public function memberAvailabilities()
    {
        return $this->hasMany(MemberAvailability::class);
    }
}
