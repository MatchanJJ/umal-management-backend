<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class MemberWhitelistSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $whitelists = [
            // Pre-approved admin
            [
                'email' => 'admin@university.edu.ph',
                'approved_by' => null,
                'approved_role' => 'admin',
                'status' => 'approved',
                'created_at' => Carbon::now(),
            ],
            
            // Pre-approved adviser
            [
                'email' => 'adviser@university.edu.ph',
                'approved_by' => null,
                'approved_role' => 'adviser',
                'status' => 'approved',
                'created_at' => Carbon::now(),
            ],
            
            // Sample pending applications
            [
                'email' => 'juan.delacruz@university.edu.ph',
                'approved_by' => null,
                'approved_role' => 'member',
                'status' => 'pending',
                'created_at' => Carbon::now(),
            ],
            [
                'email' => 'maria.santos@university.edu.ph',
                'approved_by' => null,
                'approved_role' => 'member',
                'status' => 'pending',
                'created_at' => Carbon::now(),
            ],
        ];

        DB::table('member_whitelists')->insert($whitelists);
    }
}
