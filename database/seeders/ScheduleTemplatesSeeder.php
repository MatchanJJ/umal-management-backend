<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ScheduleTemplate;

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

        foreach ($templates as $template) {
            ScheduleTemplate::firstOrCreate(
                ['code' => $template['code']],
                ['description' => $template['description']]
            );
        }

        $this->command->info('Schedule templates seeded successfully!');
    }
}
