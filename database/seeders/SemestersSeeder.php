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
            ['name' => 'First Semester', 'is_active' => false],
            ['name' => 'Second Semester', 'is_active' => false],
            ['name' => 'Summer', 'is_active' => false],
        ];

        DB::table('semesters')->insert($semesters);
    }
}
