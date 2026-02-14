<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class EventsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $events = [
            [
                'title' => 'Freshman Orientation',
                'description' => 'Welcome event for incoming freshmen students',
                'created_by' => 1, // Admin user
                'status' => 'active',
                'created_at' => Carbon::now(),
            ],
            [
                'title' => 'Mid-Year Assessment',
                'description' => 'Mid-year assessment and review session',
                'created_by' => 2, // Adviser user
                'status' => 'active',
                'created_at' => Carbon::now(),
            ],
            [
                'title' => 'End of Term Celebration',
                'description' => 'Celebration event for the end of the term',
                'created_by' => 2, // Adviser user
                'status' => 'draft',
                'created_at' => Carbon::now(),
            ],
        ];

        DB::table('events')->insert($events);
    }
}
