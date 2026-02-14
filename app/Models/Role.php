<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    protected $table = 'roles';
    protected $fillable = ['name'];
    public $timestamps = true;

    // Relationships
    public function members()
    {
        return $this->hasMany(Member::class, 'role_id');
    }
}
