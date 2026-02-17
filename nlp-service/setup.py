"""
Quick Setup Script for AssignAI NLP Service
Automates the setup and testing process.
"""

import subprocess
import sys
import os


def run_command(command, description):
    """Run a command and print status."""
    print(f"\n{'='*60}")
    print(f"⚙️  {description}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            capture_output=False,
            text=True
        )
        print(f"✅ {description} - SUCCESS")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} - FAILED")
        print(f"Error: {e}")
        return False


def check_dataset():
    """Check if dataset exists."""
    dataset_path = '../assignai_training_dataset.csv'
    if not os.path.exists(dataset_path):
        print(f"\n⚠️  WARNING: Dataset not found at {dataset_path}")
        print("Please generate the dataset first using generate_dataset.py")
        return False
    print(f"✅ Dataset found: {dataset_path}")
    return True


def main():
    print("""
    ╔════════════════════════════════════════════════════════╗
    ║        AssignAI NLP Service - Quick Setup              ║
    ║                                                        ║
    ║  This script will:                                     ║
    ║  1. Check for dataset                                  ║
    ║  2. Install dependencies                               ║
    ║  3. Build embedding index                              ║
    ║  4. Test the parser                                    ║
    ║  5. Instructions to start the service                  ║
    ╚════════════════════════════════════════════════════════╝
    """)
    
    # Step 1: Check dataset
    if not check_dataset():
        print("\n❌ Setup cannot continue without dataset.")
        sys.exit(1)
    
    # Step 2: Install dependencies
    if not run_command(
        "python -m pip install -r requirements.txt",
        "Installing dependencies"
    ):
        sys.exit(1)
    
    # Step 3: Build index
    if not run_command(
        "python train_index.py",
        "Building embedding index"
    ):
        sys.exit(1)
    
    # Step 4: Test parser
    if not run_command(
        "python parser.py",
        "Testing parser"
    ):
        print("⚠️  Testing had issues, but you can still try starting the service.")
    
    # Final instructions
    print(f"\n{'='*60}")
    print("🎉 Setup Complete!")
    print(f"{'='*60}")
    print("\n📋 Next Steps:")
    print("\n1. Start the service:")
    print("   uvicorn main:app --reload")
    print("\n2. Open API documentation:")
    print("   http://localhost:8000/docs")
    print("\n3. Test the API:")
    print('   curl -X POST "http://localhost:8000/parse-request" \\')
    print('     -H "Content-Type: application/json" \\')
    print('     -d \'{"text": "Need 5 students Friday morning for campus tour"}\'')
    print(f"\n{'='*60}\n")


if __name__ == '__main__':
    main()
