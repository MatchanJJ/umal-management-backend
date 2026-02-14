<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_id')->nullable()->constrained('organizations')->onDelete('cascade');
            $table->foreignId('role_id')->nullable()->constrained('roles')->onDelete('set null');
            $table->string('student_number', 50)->nullable()->unique();
            $table->string('email', 255)->unique()->nullable(false);
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->smallInteger('year_level')->nullable();
            $table->foreignId('college_id')->nullable()->constrained('colleges')->onDelete('set null');
            $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('set null');
            $table->smallInteger('height')->nullable();
            $table->string('tshirt_size', 5)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('members');
    }
};
