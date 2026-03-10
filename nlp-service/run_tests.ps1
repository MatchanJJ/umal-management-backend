# NLP Service Test Runner
# Simplifies running comprehensive test suites with various options

param(
    [ValidateSet('all', 'functional', 'performance', 'quality')]
    [string]$Suite = 'all',
    
    [switch]$Quick,
    [switch]$Performance,
    [switch]$GenerateReport,
    [switch]$Verbose,
    [switch]$Coverage,
    [switch]$Visualize
)

# Colors for output
$colors = @{
    success = 'Green'
    warning = 'Yellow'
    error   = 'Red'
    info    = 'Cyan'
    header  = 'White'
}

function Write-Header {
    param([string]$text)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor $colors.header
    Write-Host $text -ForegroundColor $colors.header
    Write-Host ("=" * 70) -ForegroundColor $colors.header
    Write-Host ""
}

function Write-Status {
    param(
        [string]$text,
        [ValidateSet('success', 'warning', 'error', 'info')]
        [string]$status = 'info'
    )
    $color = $colors[$status]
    Write-Host "• $text" -ForegroundColor $color
}

# Verify environment
Write-Header "NLP Service Test Runner"

# Check if pytest is installed
if (Get-Command pytest -ErrorAction SilentlyContinue) {
    $pytest_version = pytest --version 2>$null
    Write-Status "pytest found: $pytest_version" 'success'
} else {
    Write-Status "pytest not found. Installing..." 'warning'
    pip install pytest psutil -q
    Write-Status "pytest installed" 'success'
}

# Navigate to project root
$project_root = Split-Path -Parent $PSScriptRoot
$nlp_service_path = Join-Path $project_root "nlp-service"

Set-Location $project_root

Write-Status "Project root: $project_root" 'info'
Write-Status "NLP service path: $nlp_service_path" 'info'

# Build pytest command
$pytest_args = @("nlp-service/tests/", "-v")

if ($Verbose) {
    $pytest_args += "-vv"
}

if ($Coverage) {
    $pytest_args += "--cov=nlp-service", "--cov-report=html"
}

# Suite selection
switch ($Suite) {
    'functional' {
        Write-Status "Running functional tests only" 'info'
        $pytest_args += "nlp-service/tests/test_semantic_parser_functional.py"
    }
    'performance' {
        Write-Status "Running performance tests" 'info'
        $pytest_args += "nlp-service/tests/test_semantic_parser_performance.py", "--performance"
    }
    'quality' {
        Write-Status "Running quality tests only" 'info'
        $pytest_args += "nlp-service/tests/test_semantic_parser_quality.py"
    }
    default {
        if ($Quick) {
            Write-Status "Running quick tests (skipping performance)" 'info'
            $pytest_args += "--quick"
        } elseif ($Performance) {
            Write-Status "Running full test suite with performance benchmarks" 'info'
            $pytest_args += "--performance"
        } else {
            Write-Status "Running all tests" 'info'
        }
    }
}

# Run pytest
$start_time = Get-Date
try {
    & pytest @pytest_args
    $exit_code = $LASTEXITCODE
} catch {
    Write-Status "Error running tests: $_" 'error'
    exit 1
}
$end_time = Get-Date
$duration = $end_time - $start_time

Write-Host ""
Write-Header "Test Execution Completed"

if ($exit_code -eq 0) {
    Write-Status "Tests passed" 'success'
} else {
    Write-Status ("Some tests failed (exit code: $exit_code)") 'warning'
}

Write-Status ("Duration: $($duration.TotalSeconds.ToString('F2')) seconds") 'info'

# Generate reports
if ($GenerateReport) {
    Write-Host ""
    Write-Status "Generating test reports..." 'info'
    
    try {
        $reportScript = Join-Path $nlp_service_path "tests" "test_reports.py"
        & python $reportScript
        Write-Status "Reports generated successfully" 'success'
        
        $report_html = Join-Path $nlp_service_path "tests" "test_report.html"
        if (Test-Path $report_html) {
            Write-Status "Opening HTML report..." 'info'
            Start-Process $report_html
        }
    } catch {
        Write-Status ("Failed to generate reports: $_") 'warning'
    }
}

# Generate visualizations
if ($Visualize) {
    Write-Host ""
    Write-Status "Generating multi-turn conversation visualizations..." 'info'
    
    try {
        $visualizeScript = Join-Path $nlp_service_path "tests" "visualize_multiturn.py"
        & python $visualizeScript
        Write-Status "Visualizations generated successfully" 'success'
        
        $overview_chart = Join-Path $nlp_service_path "tests" "multiturn_overview.png"
        if (Test-Path $overview_chart) {
            Write-Status "Opening overview chart..." 'info'
            Start-Process $overview_chart
        }
    } catch {
        Write-Status ("Failed to generate visualizations: $_") 'warning'
    }
}

exit $exit_code
