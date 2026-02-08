<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class College extends Model
{
    protected $table = 'colleges';
    protected $fillable = ['name'];
    public $timestamps = false;

    // Relationships
    public function members(){
        return $this->hasMany(Member::class);
    }
    public function courses(){
        return $this->hasMany(Course::class);
    }
}
