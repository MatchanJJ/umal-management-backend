<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Member;
use App\Models\MemberAvailability;

class MembersSeeder extends Seeder
{
    public function run(): void
    {
        // ── Course ID lookup helper (uses first course per college) ──────────
        $courseFor = function (int $collegeId): int {
            return DB::table('courses')
                ->where('college_id', $collegeId)
                ->orderBy('id')
                ->value('id') ?? 1;
        };

        // ── Admin & Adviser ──────────────────────────────────────────────────
        $staff = [
            [
                'org_id' => 1, 'role_id' => 1,
                'student_number' => null,
                'first_name' => 'Mark', 'last_name' => 'Palma',
                'email' => 'm.palma.546616@umindanao.edu.ph',
                'year_level' => null, 'college_id' => null, 'course_id' => null,
                'height' => null, 'tshirt_size' => null,
                'gender' => 'M', 'batch_year' => null,
            ],
            [
                'org_id' => 1, 'role_id' => 2,
                'student_number' => null,
                'first_name' => 'Maria', 'last_name' => 'Rodriguez',
                'email' => 'adviser@umindanao.edu.ph',
                'year_level' => null, 'college_id' => null, 'course_id' => null,
                'height' => 165, 'tshirt_size' => 'M',
                'gender' => 'F', 'batch_year' => null,
            ],
        ];

        foreach ($staff as $data) {
            Member::updateOrCreate(['email' => $data['email']], $data);
        }

        // ── 38 Synthetic Members ─────────────────────────────────────────────
        // Spread across all 10 colleges, alternating gender, varied year/batch/height
        $synthetic = [
            // College 1 — CAE (Accounting)
            ['college_id'=>1,'sn'=>'2025-10001','fn'=>'Marco',   'ln'=>'Alcantara',    'yr'=>1,'g'=>'M','by'=>2025,'h'=>172,'ts'=>'M'],
            ['college_id'=>1,'sn'=>'2024-10002','fn'=>'Lea',     'ln'=>'Bautista',     'yr'=>2,'g'=>'F','by'=>2024,'h'=>161,'ts'=>'S'],
            ['college_id'=>1,'sn'=>'2023-10003','fn'=>'Rafael',  'ln'=>'Cordero',      'yr'=>3,'g'=>'M','by'=>2023,'h'=>175,'ts'=>'L'],
            ['college_id'=>1,'sn'=>'2022-10004','fn'=>'Tanya',   'ln'=>'Diaz',         'yr'=>4,'g'=>'F','by'=>2022,'h'=>158,'ts'=>'XS'],

            // College 2 — CAFE (Architecture & Fine Arts)
            ['college_id'=>2,'sn'=>'2024-20005','fn'=>'Ivan',    'ln'=>'Espinosa',     'yr'=>2,'g'=>'M','by'=>2024,'h'=>178,'ts'=>'L'],
            ['college_id'=>2,'sn'=>'2025-20006','fn'=>'Bianca',  'ln'=>'Ferrer',       'yr'=>1,'g'=>'F','by'=>2025,'h'=>163,'ts'=>'S'],
            ['college_id'=>2,'sn'=>'2023-20007','fn'=>'Ryan',    'ln'=>'Gabriel',      'yr'=>3,'g'=>'M','by'=>2023,'h'=>170,'ts'=>'M'],
            ['college_id'=>2,'sn'=>'2022-20008','fn'=>'Claire',  'ln'=>'Hernandez',    'yr'=>4,'g'=>'F','by'=>2022,'h'=>155,'ts'=>'XS'],

            // College 3 — CASE (Arts & Sciences)
            ['college_id'=>3,'sn'=>'2024-30009','fn'=>'Aaron',   'ln'=>'Ilagan',       'yr'=>2,'g'=>'M','by'=>2024,'h'=>168,'ts'=>'M'],
            ['college_id'=>3,'sn'=>'2025-30010','fn'=>'Fatima',  'ln'=>'Jacinto',      'yr'=>1,'g'=>'F','by'=>2025,'h'=>160,'ts'=>'S'],
            ['college_id'=>3,'sn'=>'2023-30011','fn'=>'Joel',    'ln'=>'Ko',           'yr'=>3,'g'=>'M','by'=>2023,'h'=>173,'ts'=>'L'],
            ['college_id'=>3,'sn'=>'2022-30012','fn'=>'Maya',    'ln'=>'Lopez',        'yr'=>4,'g'=>'F','by'=>2022,'h'=>157,'ts'=>'XS'],

            // College 4 — CBAE (Business Admin)
            ['college_id'=>4,'sn'=>'2025-40013','fn'=>'Brent',   'ln'=>'Mallari',      'yr'=>1,'g'=>'M','by'=>2025,'h'=>181,'ts'=>'XL'],
            ['college_id'=>4,'sn'=>'2024-40014','fn'=>'Kristine','ln'=>'Nava',         'yr'=>2,'g'=>'F','by'=>2024,'h'=>162,'ts'=>'M'],
            ['college_id'=>4,'sn'=>'2023-40015','fn'=>'Darwin',  'ln'=>'Ocampo',       'yr'=>3,'g'=>'M','by'=>2023,'h'=>174,'ts'=>'L'],
            ['college_id'=>4,'sn'=>'2022-40016','fn'=>'Lisa',    'ln'=>'Padilla',      'yr'=>4,'g'=>'F','by'=>2022,'h'=>159,'ts'=>'S'],

            // College 5 — CCE (Computing)
            ['college_id'=>5,'sn'=>'2024-50017','fn'=>'Gian',    'ln'=>'Quirino',      'yr'=>2,'g'=>'M','by'=>2024,'h'=>172,'ts'=>'M'],
            ['college_id'=>5,'sn'=>'2025-50018','fn'=>'Aileen',  'ln'=>'Ramos',        'yr'=>1,'g'=>'F','by'=>2025,'h'=>163,'ts'=>'S'],
            ['college_id'=>5,'sn'=>'2023-50019','fn'=>'Nathan',  'ln'=>'Santos',       'yr'=>3,'g'=>'M','by'=>2023,'h'=>177,'ts'=>'L'],
            ['college_id'=>5,'sn'=>'2022-50020','fn'=>'Patricia','ln'=>'Torres',       'yr'=>4,'g'=>'F','by'=>2022,'h'=>160,'ts'=>'M'],

            // College 6 — CCJE (Criminal Justice)
            ['college_id'=>6,'sn'=>'2024-60021','fn'=>'Noel',    'ln'=>'Urbano',       'yr'=>2,'g'=>'M','by'=>2024,'h'=>169,'ts'=>'M'],
            ['college_id'=>6,'sn'=>'2023-60022','fn'=>'Glenda',  'ln'=>'Valdez',       'yr'=>3,'g'=>'F','by'=>2023,'h'=>158,'ts'=>'S'],
            ['college_id'=>6,'sn'=>'2022-60023','fn'=>'Ramon',   'ln'=>'Villafuerte',  'yr'=>4,'g'=>'M','by'=>2022,'h'=>180,'ts'=>'XL'],

            // College 7 — CEE (Engineering)
            ['college_id'=>7,'sn'=>'2025-70024','fn'=>'Andrei',  'ln'=>'Webster',      'yr'=>1,'g'=>'M','by'=>2025,'h'=>185,'ts'=>'XXL'],
            ['college_id'=>7,'sn'=>'2024-70025','fn'=>'Carla',   'ln'=>'Ximenes',      'yr'=>2,'g'=>'F','by'=>2024,'h'=>165,'ts'=>'M'],
            ['college_id'=>7,'sn'=>'2023-70026','fn'=>'Hernan',  'ln'=>'Yap',          'yr'=>3,'g'=>'M','by'=>2023,'h'=>176,'ts'=>'L'],
            ['college_id'=>7,'sn'=>'2022-70027','fn'=>'Rae',     'ln'=>'Zamora',       'yr'=>4,'g'=>'F','by'=>2022,'h'=>162,'ts'=>'M'],

            // College 8 — CHE (Hospitality)
            ['college_id'=>8,'sn'=>'2025-80028','fn'=>'Paolo',   'ln'=>'Abad',         'yr'=>1,'g'=>'M','by'=>2025,'h'=>174,'ts'=>'L'],
            ['college_id'=>8,'sn'=>'2024-80029','fn'=>'Maria',   'ln'=>'Bello',        'yr'=>2,'g'=>'F','by'=>2024,'h'=>161,'ts'=>'S'],
            ['college_id'=>8,'sn'=>'2023-80030','fn'=>'Kevin',   'ln'=>'Castro',       'yr'=>3,'g'=>'M','by'=>2023,'h'=>171,'ts'=>'M'],
            ['college_id'=>8,'sn'=>'2022-80031','fn'=>'Theresa', 'ln'=>'Delos Santos', 'yr'=>4,'g'=>'F','by'=>2022,'h'=>157,'ts'=>'XS'],

            // College 9 — CHSE (Health Sciences)
            ['college_id'=>9,'sn'=>'2024-90032','fn'=>'Renato',  'ln'=>'Evangelista',  'yr'=>2,'g'=>'M','by'=>2024,'h'=>173,'ts'=>'M'],
            ['college_id'=>9,'sn'=>'2025-90033','fn'=>'Elena',   'ln'=>'Fuentes',      'yr'=>1,'g'=>'F','by'=>2025,'h'=>164,'ts'=>'M'],
            ['college_id'=>9,'sn'=>'2023-90034','fn'=>'Dante',   'ln'=>'Garcia',       'yr'=>3,'g'=>'M','by'=>2023,'h'=>178,'ts'=>'L'],
            ['college_id'=>9,'sn'=>'2022-90035','fn'=>'Francis', 'ln'=>'Hipolito',     'yr'=>4,'g'=>'M','by'=>2022,'h'=>170,'ts'=>'L'],

            // College 10 — CTE (Teacher Education)
            ['college_id'=>10,'sn'=>'2024-00036','fn'=>'Grace',  'ln'=>'Ibarra',       'yr'=>2,'g'=>'F','by'=>2024,'h'=>160,'ts'=>'S'],
            ['college_id'=>10,'sn'=>'2023-00037','fn'=>'Wilson', 'ln'=>'Jacinto',      'yr'=>3,'g'=>'M','by'=>2023,'h'=>174,'ts'=>'L'],
            ['college_id'=>10,'sn'=>'2022-00038','fn'=>'Liza',   'ln'=>'Ko',           'yr'=>4,'g'=>'F','by'=>2022,'h'=>156,'ts'=>'XS'],
        ];

        foreach ($synthetic as $row) {
            $email = strtolower($row['fn'] . '.' . str_replace(' ', '', $row['ln']))
                . '@umindanao.edu.ph';

            Member::updateOrCreate(['email' => $email], [
                'org_id'         => 1,
                'role_id'        => 3,
                'student_number' => $row['sn'],
                'first_name'     => $row['fn'],
                'last_name'      => $row['ln'],
                'email'          => $email,
                'year_level'     => $row['yr'],
                'college_id'     => $row['college_id'],
                'course_id'      => $courseFor($row['college_id']),
                'height'         => $row['h'],
                'tshirt_size'    => $row['ts'],
                'gender'         => $row['g'],
                'batch_year'     => $row['by'],
            ]);
        }

        $this->command->info('✅ Admin, adviser, and 38 synthetic member accounts seeded!');

        $this->seedAvailabilities();
    }

    private function seedAvailabilities(): void
    {
        $termId = DB::table('terms')
            ->where('start_date', '2026-01-10')
            ->value('id') ?? 3;

        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

        // Availability patterns matching the 5 schedule patterns in MemberSchedulesSeeder.
        // true = available (no class), false = unavailable (has class).
        // Pattern A: Mon–Fri all morning classes  → Morning unavail, Afternoon avail all week
        // Pattern B: Mon–Fri all afternoon classes → Morning avail, Afternoon unavail all week
        // Pattern C: MWF morning + TTh afternoon  → MWF morning unavail, TTh afternoon unavail
        // Pattern D: Mon–Wed morning, Thu–Fri aff → Mon/Tue/Wed morning unavail, Thu/Fri afternoon unavail
        // Pattern E: Light (Mon/Wed morn, Tue/Thu aff, Fri free)
        $patterns = [
            // A — always morning classes
            'A' => [
                'Monday'    => ['Morning' => false, 'Afternoon' => true],
                'Tuesday'   => ['Morning' => false, 'Afternoon' => true],
                'Wednesday' => ['Morning' => false, 'Afternoon' => true],
                'Thursday'  => ['Morning' => false, 'Afternoon' => true],
                'Friday'    => ['Morning' => false, 'Afternoon' => true],
            ],
            // B — always afternoon classes
            'B' => [
                'Monday'    => ['Morning' => true,  'Afternoon' => false],
                'Tuesday'   => ['Morning' => true,  'Afternoon' => false],
                'Wednesday' => ['Morning' => true,  'Afternoon' => false],
                'Thursday'  => ['Morning' => true,  'Afternoon' => false],
                'Friday'    => ['Morning' => true,  'Afternoon' => false],
            ],
            // C — MWF morning, TTh afternoon
            'C' => [
                'Monday'    => ['Morning' => false, 'Afternoon' => true],
                'Tuesday'   => ['Morning' => true,  'Afternoon' => false],
                'Wednesday' => ['Morning' => false, 'Afternoon' => true],
                'Thursday'  => ['Morning' => true,  'Afternoon' => false],
                'Friday'    => ['Morning' => false, 'Afternoon' => true],
            ],
            // D — Mon/Tue/Wed morning, Thu/Fri afternoon
            'D' => [
                'Monday'    => ['Morning' => false, 'Afternoon' => true],
                'Tuesday'   => ['Morning' => false, 'Afternoon' => true],
                'Wednesday' => ['Morning' => false, 'Afternoon' => true],
                'Thursday'  => ['Morning' => true,  'Afternoon' => false],
                'Friday'    => ['Morning' => true,  'Afternoon' => false],
            ],
            // E — light; Mon/Wed morning, Tue/Thu afternoon, Friday free
            'E' => [
                'Monday'    => ['Morning' => false, 'Afternoon' => true],
                'Tuesday'   => ['Morning' => true,  'Afternoon' => false],
                'Wednesday' => ['Morning' => false, 'Afternoon' => true],
                'Thursday'  => ['Morning' => true,  'Afternoon' => false],
                'Friday'    => ['Morning' => true,  'Afternoon' => true],
            ],
        ];

        $patternKeys = array_keys($patterns);
        $members     = Member::whereHas('role', fn($q) => $q->where('name', 'member'))
                             ->orderBy('id')
                             ->get();

        foreach ($members as $index => $member) {
            $patternKey = $patternKeys[$index % count($patternKeys)];
            $pattern    = $patterns[$patternKey];

            foreach ($days as $day) {
                foreach (['Morning', 'Afternoon'] as $block) {
                    MemberAvailability::updateOrCreate([
                        'member_id'   => $member->id,
                        'term_id'     => $termId,
                        'day_of_week' => $day,
                        'time_block'  => $block,
                    ], [
                        'is_available' => $pattern[$day][$block],
                    ]);
                }
            }
        }

        $this->command->info('✅ Member availability seeded with diverse patterns (A–E cycling across members).');
    }
}