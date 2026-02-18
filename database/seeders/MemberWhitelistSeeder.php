<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\MemberWhitelist;

class MemberWhitelistSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $whitelists = [
            // Pre-approved admin
            [
                'email' => 'm.palma.546616@umindanao.edu.ph',
                'approved_by' => null,
                'approved_role' => 'admin',
                'status' => 'approved',
            ],
            
            // Pre-approved adviser
            [
                'email' => 'adviser@umindanao.edu.ph',
                'approved_by' => null,
                'approved_role' => 'adviser',
                'status' => 'approved',
            ],
            
            // Sample pending applications
            [
                'email' => 'juan.delacruz@umindanao.edu.ph',
                'approved_by' => null,
                'approved_role' => 'member',
                'status' => 'pending',
            ],
            [
                'email' => 'maria.santos@umindanao.edu.ph',
                'approved_by' => null,
                'approved_role' => 'member',
                'status' => 'pending',
            ],
        ];

        foreach ($whitelists as $whitelist) {
            MemberWhitelist::firstOrCreate(
                ['email' => $whitelist['email']],
                [
                    'approved_by' => $whitelist['approved_by'],
                    'approved_role' => $whitelist['approved_role'],
                    'status' => $whitelist['status'],
                ]
            );
        }

        $this->command->info('Member whitelist seeded successfully!');
    }
}
