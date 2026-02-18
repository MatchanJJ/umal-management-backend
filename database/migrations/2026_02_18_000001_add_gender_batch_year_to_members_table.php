<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            // M = Male, F = Female
            $table->enum('gender', ['M', 'F'])->nullable()->after('tshirt_size');
            // Academic year of intake, e.g. 2025 = AY 2025-2026
            // "New member" = batch_year matches current school year (Aug-Jul cycle)
            $table->unsignedSmallInteger('batch_year')->nullable()->after('gender');
        });
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->dropColumn(['gender', 'batch_year']);
        });
    }
};
