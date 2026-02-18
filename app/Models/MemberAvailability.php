<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemberAvailability extends Model
{
    protected $table = 'member_availability';
    protected $fillable = ['member_id', 'term_id', 'day_of_week', 'time_block', 'is_available'];
    public $timestamps = false;

    // Relationships
    public function member()
    {
        return $this->belongsTo(Member::class);
    }

    public function term()
    {
        return $this->belongsTo(Term::class);
    }
}
