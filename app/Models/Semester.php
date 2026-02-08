<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Semester extends Model
{
    protected $table = 'semesters';
    protected $fillable = ['name', 'is_active'];
    public $timestamps = false;

    protected $casts = [
        'is_active' => 'boolean',
    ];

    // Relationships
    public function terms()
    {
        return $this->hasMany(Term::class);
    }
}
