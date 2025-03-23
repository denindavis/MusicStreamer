import os
import sys
import subprocess
import venv

# Configuration
VENV_DIR = "venv"  # Name of the virtual environment directory
REQUIRED_LIBRARIES = ["mutagen"]  # List of required libraries
SERVER_SCRIPT = "server.py"  # Name of the server script

def create_virtual_environment():
    """Create a virtual environment if it doesn't exist."""
    if not os.path.exists(VENV_DIR):
        print("Creating virtual environment...")
        venv.create(VENV_DIR, with_pip=True)
        print("Virtual environment created.")

def install_libraries():
    """Install required libraries in the virtual environment."""
    pip_executable = os.path.join(VENV_DIR, "bin", "pip")
    for library in REQUIRED_LIBRARIES:
        try:
            subprocess.check_call([pip_executable, "install", library])
        except subprocess.CalledProcessError as e:
            print(f"Failed to install {library}: {e}")
            sys.exit(1)

def run_server():
    """Run the server script within the virtual environment."""
    python_executable = os.path.join(VENV_DIR, "bin", "python")
    server_script_path = os.path.join(os.getcwd(), SERVER_SCRIPT)
    try:
        subprocess.check_call([python_executable, server_script_path])
    except subprocess.CalledProcessError as e:
        print(f"Failed to run the server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_virtual_environment()
    install_libraries()
    run_server()