<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Member;
use App\Models\MemberAvailability;

class MembersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Admin and adviser accounts
        $members = [
            // Demo Admin User
            [
                'org_id' => 1,
                'role_id' => 1, // admin
                'student_number' => null,
                'first_name' => 'Mark',
                'last_name' => 'Palma',
                'email' => 'm.palma.546616@umindanao.edu.ph',
                'year_level' => null,
                'college_id' => null, 
                'course_id' => null, 
                'height' => null,
                'tshirt_size' => null,
            ],
            
            // Demo Adviser User
            [
                'org_id' => 1,
                'role_id' => 2, // adviser
                'student_number' => null,
                'first_name' => 'Maria',
                'last_name' => 'Rodriguez',
                'email' => 'adviser@umindanao.edu.ph',
                'year_level' => null,
                'college_id' => null, 
                'course_id' => null, 
                'height' => 165,
                'tshirt_size' => 'M',
            ],
            
            // 10 Synthetic Members with varied profiles
            [
                'org_id' => 1,
                'role_id' => 3, // member
                'student_number' => '2021-00001',
                'first_name' => 'John',
                'last_name' => 'Santos',
                'email' => 'john.santos@umindanao.edu.ph',
                'year_level' => 3,
                'college_id' => 5, // Computing
                'course_id' => 18, // Computer Science
                'height' => 170,
                'tshirt_size' => 'L',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2021-00002',
                'first_name' => 'Ana',
                'last_name' => 'Cruz',
                'email' => 'ana.cruz@umindanao.edu.ph',
                'year_level' => 2,
                'college_id' => 5, // Computing
                'course_id' => 18, // Computer Science
                'height' => 160,
                'tshirt_size' => 'M',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2022-00003',
                'first_name' => 'Michael',
                'last_name' => 'Reyes',
                'email' => 'michael.reyes@umindanao.edu.ph',
                'year_level' => 2,
                'college_id' => 4, // Business Admin
                'course_id' => 11, // Marketing Management
                'height' => 175,
                'tshirt_size' => 'XL',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2022-00004',
                'first_name' => 'Sofia',
                'last_name' => 'Garcia',
                'email' => 'sofia.garcia@umindanao.edu.ph',
                'year_level' => 1,
                'college_id' => 3, // Arts and Sciences
                'course_id' => 6, // Psychology
                'height' => 158,
                'tshirt_size' => 'S',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2020-00005',
                'first_name' => 'Carlos',
                'last_name' => 'Mendoza',
                'email' => 'carlos.mendoza@umindanao.edu.ph',
                'year_level' => 4,
                'college_id' => 7, // Engineering
                'course_id' => 23, // Civil Engineering
                'height' => 180,
                'tshirt_size' => 'XL',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2021-00006',
                'first_name' => 'Isabella',
                'last_name' => 'Torres',
                'email' => 'isabella.torres@umindanao.edu.ph',
                'year_level' => 3,
                'college_id' => 10, // Teacher Education
                'course_id' => 34, // Elementary Education
                'height' => 162,
                'tshirt_size' => 'M',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2022-00007',
                'first_name' => 'David',
                'last_name' => 'Ramos',
                'email' => 'david.ramos@umindanao.edu.ph',
                'year_level' => 2,
                'college_id' => 6, // Criminal Justice
                'course_id' => 21, // Criminology
                'height' => 172,
                'tshirt_size' => 'L',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2021-00008',
                'first_name' => 'Emma',
                'last_name' => 'Flores',
                'email' => 'emma.flores@umindanao.edu.ph',
                'year_level' => 3,
                'college_id' => 1, // Accounting
                'course_id' => 1, // Accountancy
                'height' => 165,
                'tshirt_size' => 'M',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2020-00009',
                'first_name' => 'James',
                'last_name' => 'Villanueva',
                'email' => 'james.villanueva@umindanao.edu.ph',
                'year_level' => 4,
                'college_id' => 5, // Computing
                'course_id' => 19, // Game Development
                'height' => 168,
                'tshirt_size' => 'L',
            ],
            [
                'org_id' => 1,
                'role_id' => 3,
                'student_number' => '2022-00010',
                'first_name' => 'Olivia',
                'last_name' => 'De Leon',
                'email' => 'olivia.deleon@umindanao.edu.ph',
                'year_level' => 1,
                'college_id' => 8, // Hospitality
                'course_id' => 27, // Hospitality Management
                'height' => 163,
                'tshirt_size' => 'S',
            ],
        ];

        foreach ($members as $memberData) {
            Member::updateOrCreate(
                ['email' => $memberData['email']],
                $memberData
            );
        }

        $this->command->info('✅ Admin, adviser, and 10 synthetic member accounts seeded!');
        
        // Seed availabilities for the 10 synthetic members (member IDs 3-12)
        $this->seedMemberAvailabilities();
    }

    /**
     * Seed diverse availability patterns for members
     */
    private function seedMemberAvailabilities(): void
    {
        $termId = 1; // Current term
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        $timeBlocks = ['Morning', 'Afternoon'];

        // Different availability patterns for each member
        $availabilityPatterns = [
            // Member 3 (John Santos) - Available most days, mornings only
            3 => [
                ['Monday', 'Morning', true],
                ['Monday', 'Afternoon', false],
                ['Tuesday', 'Morning', true],
                ['Tuesday', 'Afternoon', false],
                ['Wednesday', 'Morning', true],
                ['Wednesday', 'Afternoon', false],
                ['Thursday', 'Morning', true],
                ['Thursday', 'Afternoon', false],
                ['Friday', 'Morning', true],
                ['Friday', 'Afternoon', false],
            ],
            
            // Member 4 (Ana Cruz) - Available afternoons only
            4 => [
                ['Monday', 'Morning', false],
                ['Monday', 'Afternoon', true],
                ['Tuesday', 'Morning', false],
                ['Tuesday', 'Afternoon', true],
                ['Wednesday', 'Morning', false],
                ['Wednesday', 'Afternoon', true],
                ['Thursday', 'Morning', false],
                ['Thursday', 'Afternoon', true],
                ['Friday', 'Morning', false],
                ['Friday', 'Afternoon', true],
            ],
            
            // Member 5 (Michael Reyes) - Fully available all days
            5 => [
                ['Monday', 'Morning', true],
                ['Monday', 'Afternoon', true],
                ['Tuesday', 'Morning', true],
                ['Tuesday', 'Afternoon', true],
                ['Wednesday', 'Morning', true],
                ['Wednesday', 'Afternoon', true],
                ['Thursday', 'Morning', true],
                ['Thursday', 'Afternoon', true],
                ['Friday', 'Morning', true],
                ['Friday', 'Afternoon', true],
            ],
            
            // Member 6 (Sofia Garcia) - Available Mon/Wed/Fri mornings
            6 => [
                ['Monday', 'Morning', true],
                ['Monday', 'Afternoon', false],
                ['Tuesday', 'Morning', false],
                ['Tuesday', 'Afternoon', false],
                ['Wednesday', 'Morning', true],
                ['Wednesday', 'Afternoon', false],
                ['Thursday', 'Morning', false],
                ['Thursday', 'Afternoon', false],
                ['Friday', 'Morning', true],
                ['Friday', 'Afternoon', false],
            ],
            
            // Member 7 (Carlos Mendoza) - Available Tue/Thu afternoons
            7 => [
                ['Monday', 'Morning', false],
                ['Monday', 'Afternoon', false],
                ['Tuesday', 'Morning', false],
                ['Tuesday', 'Afternoon', true],
                ['Wednesday', 'Morning', false],
                ['Wednesday', 'Afternoon', false],
                ['Thursday', 'Morning', false],
                ['Thursday', 'Afternoon', true],
                ['Friday', 'Morning', false],
                ['Friday', 'Afternoon', false],
            ],
            
            // Member 8 (Isabella Torres) - Available Wed/Thu/Fri all day
            8 => [
                ['Monday', 'Morning', false],
                ['Monday', 'Afternoon', false],
                ['Tuesday', 'Morning', false],
                ['Tuesday', 'Afternoon', false],
                ['Wednesday', 'Morning', true],
                ['Wednesday', 'Afternoon', true],
                ['Thursday', 'Morning', true],
                ['Thursday', 'Afternoon', true],
                ['Friday', 'Morning', true],
                ['Friday', 'Afternoon', true],
            ],
            
            // Member 9 (David Ramos) - Available Mon/Tue all day
            9 => [
                ['Monday', 'Morning', true],
                ['Monday', 'Afternoon', true],
                ['Tuesday', 'Morning', true],
                ['Tuesday', 'Afternoon', true],
                ['Wednesday', 'Morning', false],
                ['Wednesday', 'Afternoon', false],
                ['Thursday', 'Morning', false],
                ['Thursday', 'Afternoon', false],
                ['Friday', 'Morning', false],
                ['Friday', 'Afternoon', false],
            ],
            
            // Member 10 (Emma Flores) - Available mornings except Tuesday
            10 => [
                ['Monday', 'Morning', true],
                ['Monday', 'Afternoon', false],
                ['Tuesday', 'Morning', false],
                ['Tuesday', 'Afternoon', false],
                ['Wednesday', 'Morning', true],
                ['Wednesday', 'Afternoon', false],
                ['Thursday', 'Morning', true],
                ['Thursday', 'Afternoon', false],
                ['Friday', 'Morning', true],
                ['Friday', 'Afternoon', false],
            ],
            
            // Member 11 (James Villanueva) - Very limited (Friday afternoons only)
            11 => [
                ['Monday', 'Morning', false],
                ['Monday', 'Afternoon', false],
                ['Tuesday', 'Morning', false],
                ['Tuesday', 'Afternoon', false],
                ['Wednesday', 'Morning', false],
                ['Wednesday', 'Afternoon', false],
                ['Thursday', 'Morning', false],
                ['Thursday', 'Afternoon', false],
                ['Friday', 'Morning', false],
                ['Friday', 'Afternoon', true],
            ],
            
            // Member 12 (Olivia De Leon) - Flexible (available most times except Mon/Tue mornings)
            12 => [
                ['Monday', 'Morning', false],
                ['Monday', 'Afternoon', true],
                ['Tuesday', 'Morning', false],
                ['Tuesday', 'Afternoon', true],
                ['Wednesday', 'Morning', true],
                ['Wednesday', 'Afternoon', true],
                ['Thursday', 'Morning', true],
                ['Thursday', 'Afternoon', true],
                ['Friday', 'Morning', true],
                ['Friday', 'Afternoon', true],
            ],
        ];

        foreach ($availabilityPatterns as $memberId => $patterns) {
            foreach ($patterns as [$day, $timeBlock, $isAvailable]) {
                MemberAvailability::create([
                    'member_id' => $memberId,
                    'term_id' => $termId,
                    'day_of_week' => $day,
                    'time_block' => $timeBlock,
                    'is_available' => $isAvailable,
                ]);
            }
        }

        $this->command->info('✅ Member availabilities seeded with diverse patterns!');
    }
}
