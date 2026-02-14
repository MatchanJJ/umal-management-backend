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
        Schema::create('member_whitelist', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255)->unique()->nullable(false);
            $table->integer('approved_by')->nullable();
            $table->string('approved_role', 20)->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('member_whitelist');
    }
};
