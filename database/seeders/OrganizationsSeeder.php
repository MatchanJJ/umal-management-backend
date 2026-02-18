<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Organization;

class OrganizationsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Organization::firstOrCreate(
            ['name' => 'University of Mindanao Ambassadors League'],
            ['description' => 'A university organization that promotes leadership and community service among students.']
        );

        $this->command->info('Organizations seeded successfully!');
    }
}
