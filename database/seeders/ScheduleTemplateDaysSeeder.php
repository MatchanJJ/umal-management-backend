<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ScheduleTemplateDaysSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $templateDays = [
            // MSAT1 - Monday to Wednesday (face-to-face), Thursday to Saturday (async)
            ['schedule_template_id' => 1, 'day_of_week' => 'Monday', 'mode' => 'f2f'],
            ['schedule_template_id' => 1, 'day_of_week' => 'Tuesday', 'mode' => 'f2f'],
            ['schedule_template_id' => 1, 'day_of_week' => 'Wednesday', 'mode' => 'f2f'],
            ['schedule_template_id' => 1, 'day_of_week' => 'Thursday', 'mode' => 'async'],
            ['schedule_template_id' => 1, 'day_of_week' => 'Friday', 'mode' => 'async'],
            ['schedule_template_id' => 1, 'day_of_week' => 'Saturday', 'mode' => 'async'],
            
            // MSAT2 - Monday to Wednesday (async), Thursday to Saturday (face-to-face)
            ['schedule_template_id' => 2, 'day_of_week' => 'Monday', 'mode' => 'async'],
            ['schedule_template_id' => 2, 'day_of_week' => 'Tuesday', 'mode' => 'async'],
            ['schedule_template_id' => 2, 'day_of_week' => 'Wednesday', 'mode' => 'async'],
            ['schedule_template_id' => 2, 'day_of_week' => 'Thursday', 'mode' => 'f2f'],
            ['schedule_template_id' => 2, 'day_of_week' => 'Friday', 'mode' => 'f2f'],
            ['schedule_template_id' => 2, 'day_of_week' => 'Saturday', 'mode' => 'f2f'],
            
            // MSA - Monday to Friday (face-to-face), Saturday (async)
            ['schedule_template_id' => 3, 'day_of_week' => 'Monday', 'mode' => 'f2f'],
            ['schedule_template_id' => 3, 'day_of_week' => 'Tuesday', 'mode' => 'f2f'],
            ['schedule_template_id' => 3, 'day_of_week' => 'Wednesday', 'mode' => 'f2f'],
            ['schedule_template_id' => 3, 'day_of_week' => 'Thursday', 'mode' => 'f2f'],
            ['schedule_template_id' => 3, 'day_of_week' => 'Friday', 'mode' => 'f2f'],
            ['schedule_template_id' => 3, 'day_of_week' => 'Saturday', 'mode' => 'async'],
        ];

        DB::table('schedule_template_days')->insert($templateDays);
    }
}
