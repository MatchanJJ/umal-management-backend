<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CollegesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $colleges = [
            ['name' => 'College of Accounting Education'],
            ['name' => 'College of Architecture and Fine Arts Education'],
            ['name' => 'College of Art and Sciences Education'],
            ['name' => 'College of Business Administration Education'],
            ['name' => 'College of Computing Education'],
            ['name' => 'College of Criminal Justice Education'],
            ['name' => 'College of Engineering Education'],
            ['name' => 'College of Hospitality Education'],
            ['name' => 'College of Health and Sciences Education'],
            ['name' => 'College of Teacher Education'],
        ];

        DB::table('colleges')->insert($colleges);
    }
}
