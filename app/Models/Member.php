<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Member extends Model
{
    protected $table = 'members';
    protected $fillable = [
        'student_number', 
        'first_name', 
        'last_name', 
        'email',
        'role', 
        'year_level', 
        'college_id', 
        'course_id',
        'height', 
        'tshirt_size'
    ];

    public $timestamps = true;

    //Relationships
    public function college(){
        return $this->belongsTo(College::class, 'college_id');
    }

    public function course(){
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function schedules(){
        return $this->hasMany(MemberSchedule::class);
    }
    public function availability() {
        return $this->hasMany(MemberAvailability::class);
    }

    public function volunteerAssignments() {
        return $this->hasMany(VolunteerAssignment::class);
    }

}
