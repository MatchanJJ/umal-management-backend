<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed reference data in order (respecting foreign key constraints)
        $this->call([
            // Step 1: Independent tables (no foreign keys)
            CollegesSeeder::class,
            SemestersSeeder::class,
            ScheduleTemplatesSeeder::class,
            TimeSlotsSeeder::class,
            
            // Step 2: Tables with foreign keys to Step 1
            CoursesSeeder::class,
            TermsSeeder::class,
            ScheduleTemplateDaysSeeder::class,
            
            // Step 3: Member whitelist (before members)
            MemberWhitelistSeeder::class,
            
            // Step 4: Members (depends on colleges & courses)
            MembersSeeder::class,
        ]);
    }
}
