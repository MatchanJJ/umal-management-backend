<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TimeSlot;

class TimeSlotsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $timeSlots = [
            // Morning slots
            ['start_time' => '07:00:00', 'end_time' => '08:00:00', 'label' => '7:00 AM - 8:00 AM'],
            ['start_time' => '08:00:00', 'end_time' => '09:00:00', 'label' => '8:00 AM - 9:00 AM'],
            ['start_time' => '08:00:00', 'end_time' => '10:00:00', 'label' => '8:00 AM - 10:00 AM'],
            ['start_time' => '09:00:00', 'end_time' => '10:00:00', 'label' => '9:00 AM - 10:00 AM'],
            ['start_time' => '10:00:00', 'end_time' => '11:00:00', 'label' => '10:00 AM - 11:00 AM'],
            ['start_time' => '10:00:00', 'end_time' => '12:00:00', 'label' => '10:00 AM - 12:00 PM'],
            ['start_time' => '11:00:00', 'end_time' => '12:00:00', 'label' => '11:00 AM - 12:00 PM'],
            
            // Afternoon slots
            ['start_time' => '12:30:00', 'end_time' => '13:30:00', 'label' => '12:30 PM - 1:30 PM'],
            ['start_time' => '13:30:00', 'end_time' => '14:30:00', 'label' => '1:30 PM - 2:30 PM'],
            ['start_time' => '13:30:00', 'end_time' => '15:30:00', 'label' => '1:30 PM - 3:30 PM'],
            ['start_time' => '14:30:00', 'end_time' => '15:30:00', 'label' => '2:30 PM - 3:30 PM'],
            ['start_time' => '15:30:00', 'end_time' => '16:30:00', 'label' => '3:30 PM - 4:30 PM'],
            ['start_time' => '15:30:00', 'end_time' => '17:30:00', 'label' => '3:30 PM - 5:30 PM'],
            ['start_time' => '16:30:00', 'end_time' => '17:30:00', 'label' => '4:30 PM - 5:30 PM'],
            
            // Evening slots
            ['start_time' => '17:30:00', 'end_time' => '18:30:00', 'label' => '5:30 PM - 6:30 PM'],
            ['start_time' => '17:30:00', 'end_time' => '19:30:00', 'label' => '5:30 PM - 7:30 PM'],
            ['start_time' => '18:30:00', 'end_time' => '19:30:00', 'label' => '6:30 PM - 7:30 PM'],
            ['start_time' => '19:30:00', 'end_time' => '20:30:00', 'label' => '7:30 PM - 8:30 PM'],
            ['start_time' => '19:30:00', 'end_time' => '21:30:00', 'label' => '7:30 PM - 9:30 PM'],
            ['start_time' => '20:30:00', 'end_time' => '21:30:00', 'label' => '8:30 PM - 9:30 PM'],
        ];

        foreach ($timeSlots as $slot) {
            TimeSlot::firstOrCreate(
                [
                    'start_time' => $slot['start_time'],
                    'end_time' => $slot['end_time']
                ],
                ['label' => $slot['label']]
            );
        }

        $this->command->info('Time slots seeded successfully!');
    }
}
