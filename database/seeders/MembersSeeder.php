<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class MembersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $members = [
            // Demo Admin User (external entity - no student data)
            [
                'student_number' => null,
                'first_name' => 'Admin',
                'last_name' => 'User',
                'email' => 'admin@university.edu.ph',
                'role' => 'admin',
                'year_level' => null,
                'college_id' => null, 
                'course_id' => null, 
                'height' => null,
                'tshirt_size' => null,
                'created_at' => Carbon::now(),
            ],
            
            // Demo Adviser User (faculty member - oversees events & participates in shifts)
            [
                'student_number' => null,
                'first_name' => 'Maria',
                'last_name' => 'Rodriguez',
                'email' => 'adviser@university.edu.ph',
                'role' => 'adviser',
                'year_level' => null,
                'college_id' => null, 
                'course_id' => null, 
                'height' => 165, // Optional: for uniform/shirt ordering if needed
                'tshirt_size' => 'M', // Optional: for uniform/shirt ordering if needed
                'created_at' => Carbon::now(),
            ],
            
            // Sample Members
            [
                'student_number' => '2021-00123',
                'first_name' => 'Juan',
                'last_name' => 'Dela Cruz',
                'email' => 'juan.delacruz@university.edu.ph',
                'role' => 'member',
                'year_level' => '3',
                'college_id' => 1, 
                'course_id' => 1, 
                'height' => 175,
                'tshirt_size' => 'L',
                'created_at' => Carbon::now(),
            ],
            [
                'student_number' => '2022-00456',
                'first_name' => 'Maria',
                'last_name' => 'Santos',
                'email' => 'maria.santos@university.edu.ph',
                'role' => 'member',
                'year_level' => '2',
                'college_id' => 2, 
                'course_id' => 5, 
                'height' => 160,
                'tshirt_size' => 'S',
                'created_at' => Carbon::now(),
            ],
            [
                'student_number' => '2021-00789',
                'first_name' => 'Pedro',
                'last_name' => 'Reyes',
                'email' => 'pedro.reyes@university.edu.ph',
                'role' => 'member',
                'year_level' => '3',
                'college_id' => 3, 
                'course_id' => 9, 
                'height' => 180,
                'tshirt_size' => 'XL',
                'created_at' => Carbon::now(),
            ],
        ];

        DB::table('members')->insert($members);
    }
}
