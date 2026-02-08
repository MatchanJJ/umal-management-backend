<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected $table = 'courses';
    protected $fillable = ['college_id', 'name'];
    public $timestamps = false;

    // Relationships
    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function members()
    {
        return $this->hasMany(Member::class);
    }
}
