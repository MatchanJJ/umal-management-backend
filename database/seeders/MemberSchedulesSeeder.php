<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Member;

/**
 * Seeds realistic class schedules (4-6 hrs/day) for all member-role accounts.
 *
 * Five rotation patterns (member index % 5):
 *  A — Morning heavy  : Mon–Fri 4 morning classes  → always morning conflict
 *  B — Afternoon heavy: Mon–Fri 4 afternoon classes → always afternoon conflict
 *  C — MWF morning / TTh afternoon                 → mixed-day conflicts
 *  D — Mon–Wed morning, Thu–Fri afternoon           → split-week conflicts
 *  E — Light (2-hr blocks): Mon/Wed morning, Tue/Thu afternoon, Fri free
 */
class MemberSchedulesSeeder extends Seeder
{
    public function run(): void
    {
        // ── Reference data ───────────────────────────────────────────────────
        $termId = DB::table('terms')
            ->where('start_date', '2026-01-10')
            ->value('id');

        if (!$termId) {
            $this->command->warn('⚠️  Term for 2026-01-10 not found. Run TermsSeeder first.');
            return;
        }

        $templateId = DB::table('schedule_templates')
            ->where('code', 'MSAT1')
            ->value('id');

        if (!$templateId) {
            $this->command->warn('⚠️  Schedule template MSAT1 not found. Run ScheduleTemplatesSeeder first.');
            return;
        }

        // Non-overlapping morning time slots: 7-8, 8-9, 9-10, 10-11
        $morningSlots = DB::table('time_slots')
            ->whereIn(DB::raw("CAST(start_time AS CHAR(8))"), ['07:00:00', '08:00:00', '09:00:00', '10:00:00'])
            ->whereIn(DB::raw("CAST(end_time AS CHAR(8))"),   ['08:00:00', '09:00:00', '10:00:00', '11:00:00'])
            ->orderBy('start_time')
            ->pluck('id')
            ->values()
            ->toArray();

        // Non-overlapping afternoon time slots: 12:30-13:30, 13:30-14:30, 14:30-15:30, 15:30-16:30
        $afternoonSlots = DB::table('time_slots')
            ->whereIn(DB::raw("CAST(start_time AS CHAR(8))"), ['12:30:00', '13:30:00', '14:30:00', '15:30:00'])
            ->whereIn(DB::raw("CAST(end_time AS CHAR(8))"),   ['13:30:00', '14:30:00', '15:30:00', '16:30:00'])
            ->orderBy('start_time')
            ->pluck('id')
            ->values()
            ->toArray();

        // Fallback: grab any morning/afternoon slots if exact times not found
        if (count($morningSlots) < 4) {
            $morningSlots = DB::table('time_slots')
                ->whereTime('start_time', '<', '12:00:00')
                ->orderBy('start_time')
                ->limit(4)
                ->pluck('id')
                ->toArray();
        }

        if (count($afternoonSlots) < 4) {
            $afternoonSlots = DB::table('time_slots')
                ->whereTime('start_time', '>=', '12:00:00')
                ->whereTime('start_time', '<', '18:00:00')
                ->orderBy('start_time')
                ->limit(4)
                ->pluck('id')
                ->toArray();
        }

        if (empty($morningSlots) || empty($afternoonSlots)) {
            $this->command->warn('⚠️  Could not find time slots. Run TimeSlotsSeeder first.');
            return;
        }

        // ── Pattern definitions ──────────────────────────────────────────────
        // Each entry: [ 'day' => [slot_id, ...] ]
        // 5 patterns, cycled by member index % 5
        $weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

        $buildPattern = function (string $name, array $morning, array $afternoon) use ($weekdays): array {
            $schedule = [];
            foreach ($weekdays as $day) {
                $slots = match ($name) {
                    'A' => $morning,                                         // Mon-Fri all morning
                    'B' => $afternoon,                                       // Mon-Fri all afternoon
                    'C' => in_array($day, ['Monday','Wednesday','Friday'])   // MWF morning, TTh afternoon
                                ? $morning : $afternoon,
                    'D' => in_array($day, ['Monday','Tuesday','Wednesday'])  // Mon-Wed morning, Thu-Fri afternoon
                                ? $morning : $afternoon,
                    'E' => match($day) {                                     // Light: Mon/Wed morning, Tue/Thu afternoon, Fri free
                        'Monday','Wednesday'           => array_slice($morning,   0, 2),
                        'Tuesday','Thursday'           => array_slice($afternoon, 0, 2),
                        default                        => [],                // Friday free
                    },
                };
                if (!empty($slots)) {
                    $schedule[$day] = $slots;
                }
            }
            return $schedule;
        };

        $patterns = [
            'A' => $buildPattern('A', $morningSlots,   $afternoonSlots),
            'B' => $buildPattern('B', $morningSlots,   $afternoonSlots),
            'C' => $buildPattern('C', $morningSlots,   $afternoonSlots),
            'D' => $buildPattern('D', $morningSlots,   $afternoonSlots),
            'E' => $buildPattern('E', $morningSlots,   $afternoonSlots),
        ];
        $patternKeys = ['A', 'B', 'C', 'D', 'E'];

        // ── Assign schedules ─────────────────────────────────────────────────
        $members = Member::whereHas('role', fn($q) => $q->where('name', 'member'))
            ->orderBy('id')
            ->get();

        $entries = [];
        $inserted = 0;

        foreach ($members as $index => $member) {
            // Skip if already has a schedule for this term
            $existing = DB::table('member_schedules')
                ->where('member_id', $member->id)
                ->where('term_id', $termId)
                ->exists();

            if ($existing) {
                continue;
            }

            $patternName = $patternKeys[$index % 5];
            $daySlots    = $patterns[$patternName];

            // Create member_schedule row
            $memberScheduleId = DB::table('member_schedules')->insertGetId([
                'member_id'            => $member->id,
                'term_id'              => $termId,
                'schedule_template_id' => $templateId,
            ]);

            // Create schedule_entry rows
            foreach ($daySlots as $day => $slotIds) {
                foreach ($slotIds as $slotId) {
                    $entries[] = [
                        'member_schedule_id' => $memberScheduleId,
                        'day_of_week'        => $day,
                        'time_slot_id'       => $slotId,
                    ];
                }
            }

            $inserted++;

            // Flush in chunks to avoid large inserts
            if (count($entries) >= 200) {
                DB::table('schedule_entries')->insert($entries);
                $entries = [];
            }
        }

        if (!empty($entries)) {
            DB::table('schedule_entries')->insert($entries);
        }

        $this->command->info("✅ Class schedules seeded for {$inserted} members (patterns A-E, 4-6 hrs/day).");
        $this->command->info("   Pattern breakdown: A=morning-heavy, B=afternoon-heavy, C=MWF-morn/TTh-aft, D=split-week, E=light");
    }
}
