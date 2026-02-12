<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemberWhitelist extends Model
{
    protected $table = 'member_whitelists';

    protected $fillable = [
        'email',
        'approved_by',
        'approved_role',
        'status',
        'notes',
        'approved_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'created_at'  => 'datetime',
    ];

    public $timestamps = false;
}
