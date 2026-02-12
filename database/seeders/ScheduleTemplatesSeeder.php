<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ScheduleTemplatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $templates = [
            [
                'code' => 'MSAT1',
                'description' => 'Monday to Wednesday - Face-to-face schedule, Wednesday to Saturday - Async',
            ],
            [
                'code' => 'MSAT2',
                'description' => 'Monday to Wednesday - Async, Wednesday to Saturday - Face-to-face schedule',
            ],
            [
                'code' => 'MSA',
                'description' => 'Monday to Friday - Face-to-face, Saturday - Async',
            ]
        ];

        DB::table('schedule_templates')->insert($templates);
    }
}
