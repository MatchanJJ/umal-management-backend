<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CoursesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $courses = [
            // College of Accounting Education (ID: 1)
            ['college_id' => 1, 'name' => 'Bachelor of Science in Accountancy'],
            ['college_id' => 1, 'name' => 'Bachelor of Science in Accounting Information Systems'],
            ['college_id' => 1, 'name' => 'Bachelor of Science in Management Accounting'],
            
            // College of Architecture and Fine Arts Education (ID: 2)
            ['college_id' => 2, 'name' => 'Bachelor of Science in Architecture'],
            ['college_id' => 2, 'name' => 'Bachelor of Science in Fine Arts and Design Major in Painting'],
            ['college_id' => 2, 'name' => 'Bachelor of Science in Interior Design'],
            
            // College of Art and Sciences Education (ID: 3)
            ['college_id' => 3, 'name' => 'Bachelor of Arts in Communication'],
            ['college_id' => 3, 'name' => 'Bachelor of Arts in English Language'],
            ['college_id' => 3, 'name' => 'Bachelor of Arts in Political Science'],
            ['college_id' => 3, 'name' => 'Bachelor of Science in Agroforestry'],
            ['college_id' => 3, 'name' => 'Bachelor of Science in Biology with Specializations in Ecology'],
            ['college_id' => 3, 'name' => 'Bachelor of Science in Environmental Science'],
            ['college_id' => 3, 'name' => 'Bachelor of Science in Forestry'],
            ['college_id' => 3, 'name' => 'Bachelor of Science in Psychology'],
            ['college_id' => 3, 'name' => 'Bachelor of Science in Social Work'],

            // College of Business Administration Education (ID: 4)
            ['college_id' => 4, 'name' => 'Bachelor of Science in Business Administration Major in Business Economics'],
            ['college_id' => 4, 'name' => 'Bachelor of Science in Business Administration Major in Financial Management'],
            ['college_id' => 4, 'name' => 'Bachelor of Science in Business Administration Major in Human Resource Management'],
            ['college_id' => 4, 'name' => 'Bachelor of Science in Business Administration Major in Marketing Management'],
            ['college_id' => 4, 'name' => 'Bachelor of Science in Customs Administration'],
            ['college_id' => 4, 'name' => 'Bachelor of Science in Entrepreneurship'],
            ['college_id' => 4, 'name' => 'Bachelor of Science in Legal Management'],
            ['college_id' => 4, 'name' => 'Bachelor of Science in Real Estate Management'],

            // College of Computing Education (ID: 5)
            ['college_id' => 5, 'name' => 'Bachelor of Science in Computer Science'],
            ['college_id' => 5, 'name' => 'Bachelor of Science in Entertainment and Multimedia Computing Major in Digital Animation'],
            ['college_id' => 5, 'name' => 'Bachelor of Science in Entertainment and Multimedia Computing Major in Game Development'],
            ['college_id' => 5, 'name' => 'Bachelor of Science in Information Technology'],
            ['college_id' => 5, 'name' => 'Bachelor of Science in Information Science'],
            ['college_id' => 5, 'name' => 'Bachelor of Science in Multimedia Arts'],

            // College of Criminal Justice Education (ID: 6)
            ['college_id' => 6, 'name' => 'Bachelor of Science in Criminology'],
            
            // College of Engineering Education (ID: 7)
            ['college_id' => 7, 'name' => 'Bachelor of Science in Chemical Engineering'],
            ['college_id' => 7, 'name' => 'Bachelor of Science in Civil Engineering Major in Geotechnical'],
            ['college_id' => 7, 'name' => 'Bachelor of Science in Civil Engineering Major in Structural'],
            ['college_id' => 7, 'name' => 'Bachelor of Science in Civil Engineering Major in Transportation'],
            ['college_id' => 7, 'name' => 'Bachelor of Science in Computer Engineering'],
            ['college_id' => 7, 'name' => 'Bachelor of Science in Electrical Engineering'], 
            ['college_id' => 7, 'name' => 'Bachelor of Science in Electronics Engineering'],
            ['college_id' => 7, 'name' => 'Bachelor of Science in Material Engineering'],
            ['college_id' => 7, 'name' => 'Bachelor of Science in Mechanical Engineering'],

            // College of Hospitality Education (ID: 8)
            ['college_id' => 8, 'name' => 'Bachelor of Science in Hospitality Management'],
            ['college_id' => 8, 'name' => 'Bachelor of Science in Tourism Management'],

            // College of Health and Sciences Education (ID: 9)
            ['college_id' => 9, 'name' => 'Bachelor of Science in Medical Technology'],
            ['college_id' => 9, 'name' => 'Bachelor of Science in Nursing'],
            ['college_id' => 9, 'name' => 'Bachelor of Science in Nutrition and Dietetics'],
            ['college_id' => 9, 'name' => 'Bachelor of Science in Pharmacy'],

            // College of Teacher Education (ID: 10)
            ['college_id' => 10, 'name' => 'Bachelor of Elementary Education'], 
            ['college_id' => 10, 'name' => 'Bachelor of Physical Education'], 
            ['college_id' => 10, 'name' => 'Bachelor of Secondary Education Major in English'],
            ['college_id' => 10, 'name' => 'Bachelor of Secondary Education Major in Filipino'],
            ['college_id' => 10, 'name' => 'Bachelor of Secondary Education Major in Mathematics'],
            ['college_id' => 10, 'name' => 'Bachelor of Secondary Education Major in Science'],
            ['college_id' => 10, 'name' => 'Bachelor of Secondary Education Major in Social Studies'],
            ['college_id' => 10, 'name' => 'Bachelor of Special Needs Education Major in Elementary School Teaching'],
        ];

        DB::table('courses')->insert($courses);
    }
}
