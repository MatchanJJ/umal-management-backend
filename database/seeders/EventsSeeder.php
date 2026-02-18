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
                'date' => Carbon::now()->addDays(7)->toDateString(),
                'time_block' => 'Morning',
                'venue' => 'Main Auditorium',
                'required_volunteers' => 10,
                'assigned_volunteers' => 0,
                'created_by' => 1, // Admin user
                'status' => 'active',
                'created_at' => Carbon::now(),
            ],
            [
                'title' => 'Mid-Year Assessment',
                'description' => 'Mid-year assessment and review session',
                'date' => Carbon::now()->addDays(14)->toDateString(),
                'time_block' => 'Afternoon',
                'venue' => 'Conference Room A',
                'required_volunteers' => 5,
                'assigned_volunteers' => 0,
                'created_by' => 2, // Adviser user
                'status' => 'active',
                'created_at' => Carbon::now(),
            ],
            [
                'title' => 'End of Term Celebration',
                'description' => 'Celebration event for the end of the term',
                'date' => Carbon::now()->addDays(30)->toDateString(),
                'time_block' => 'Morning',
                'venue' => 'Campus Grounds',
                'required_volunteers' => 15,
                'assigned_volunteers' => 0,
                'created_by' => 2, // Adviser user
                'status' => 'draft',
                'created_at' => Carbon::now(),
            ],
        ];

        DB::table('events')->insert($events);
    }
}
