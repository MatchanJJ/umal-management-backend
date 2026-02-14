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
            // Step 1: Organizations and Roles (new foundational tables)
            OrganizationsSeeder::class,
            RolesSeeder::class,
            
            // Step 2: Independent tables (no foreign keys)
            CollegesSeeder::class,
            SemestersSeeder::class,
            ScheduleTemplatesSeeder::class,
            TimeSlotsSeeder::class,
            
            // Step 3: Tables with foreign keys to Step 2
            CoursesSeeder::class,
            TermsSeeder::class,
            ScheduleTemplateDaysSeeder::class,
            
            // Step 4: Member whitelist (before members)
            MemberWhitelistSeeder::class,
            
            // Step 5: Members (depends on organizations, roles, colleges & courses)
            MembersSeeder::class,
            
            // Step 6: Events (depends on members for created_by)
            EventsSeeder::class,
        ]);
    }
}
