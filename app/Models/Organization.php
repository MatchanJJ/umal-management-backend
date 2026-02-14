<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    protected $table = 'organizations';
    protected $fillable = ['name', 'description'];
    public $timestamps = true;

    // Relationships
    public function members()
    {
        return $this->hasMany(Member::class, 'org_id');
    }
}
