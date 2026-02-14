<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SemestersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $semesters = [
            ['name' => 'First Semester', 'year' => 2025],
            ['name' => 'Second Semester', 'year' => 2025],
            ['name' => 'Summer', 'year' => 2026],
            ['name' => 'First Semester', 'year' => 2026],
        ];

        DB::table('semesters')->insert($semesters);
    }
}
