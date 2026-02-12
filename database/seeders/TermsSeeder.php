<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TermsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $terms = [
            // First Semester (semester_id: 1)
            [
                'semester_id' => 1,
                'name' => '1st Term',
                'start_date' => '2025-08-15',
                'end_date' => '2025-10-10',
            ],
            [
                'semester_id' => 1,
                'name' => '2nd Term',
                'start_date' => '2025-10-11',
                'end_date' => '2025-12-21',
            ],
            // Second Semester (semester_id: 2)
            [
                'semester_id' => 2,
                'name' => '1st Term',
                'start_date' => '2026-01-10',
                'end_date' => '2026-03-15',
            ],
            [
                'semester_id' => 2,
                'name' => '2nd Term',
                'start_date' => '2026-03-16',
                'end_date' => '2026-05-17',
            ],
            
            // Summer (semester_id: 3)
            [
                'semester_id' => 3,
                'name' => 'Summer Term',
                'start_date' => '2026-06-01',
                'end_date' => '2026-07-31',
            ],
        ];

        DB::table('terms')->insert($terms);
    }
}
