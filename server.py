import os
import sys
import subprocess

# List of required libraries
REQUIRED_LIBRARIES = ["mutagen"]

def check_and_install_libraries():
    """Check if required libraries are installed, and prompt to install if missing."""
    for library in REQUIRED_LIBRARIES:
        try:
            __import__(library)
        except ImportError:
            print(f"The library '{library}' is not installed.")
            choice = input(f"Do you want to install '{library}'? (Y/n): ").strip().lower()
            if choice == "y" or choice == "":
                subprocess.check_call([sys.executable, "-m", "pip", "install", library])
            else:
                print(f"Cannot proceed without installing '{library}'. Exiting.")
                sys.exit(1)

# Check and install libraries before starting the server
check_and_install_libraries()

# Import libraries after ensuring they are installed
import http.server
import socketserver
import mimetypes
import json
from mutagen.mp3 import MP3

PORT = 8000

MP3_DIR = os.getcwd()
print(f"MP3_DIR is set to: {MP3_DIR}")

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        """Serve files from the app directory or parent directory for .mp3 files."""
        path = super().translate_path(path)
        rel_path = os.path.relpath(path, os.getcwd())

        # Serve .mp3 files from the parent directory
        if rel_path.endswith(".mp3"):
            return os.path.join(MP3_DIR, os.path.basename(rel_path))

        # Serve other files (e.g., index.html, style.css, script.js) from the app directory
        return os.path.join(os.getcwd(), "app", rel_path)

    def do_GET(self):
        if self.path == '/list':  # Handle the /list endpoint
            print("Handling /list request")
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(self.generate_file_metadata().encode("utf-8"))
        else:
            super().do_GET()

    def guess_type(self, path):
        """Ensure correct MIME type for .mp3 and .m4a files."""
        mime_type, _ = mimetypes.guess_type(path)
        if path.endswith(".mp3"):
            return "audio/mpeg"
        elif path.endswith(".m4a"):
            return "audio/mp4"
        return mime_type or "application/octet-stream"

    def generate_file_metadata(self):
        """Generate metadata for all .mp3 and .m4a files in the directory."""
        try:
            file_list = os.listdir(MP3_DIR)
        except OSError as e:
            print(f"Error accessing directory: {e}") 
            return json.dumps({"error": "Cannot access directory"})

        metadata = []
        for name in file_list:
            # Include both .mp3 and .m4a files
            if (name.endswith(".mp3") or name.endswith(".m4a")) and os.path.isfile(os.path.join(MP3_DIR, name)):
                file_path = os.path.join(MP3_DIR, name)
                try:
                    audio = MP3(file_path)  # Mutagen can handle .m4a files as well
                    metadata.append({
                        "name": name,
                        "duration": audio.info.length,  # Duration in seconds
                        "bitrate": audio.info.bitrate,  # Bitrate in bps
                        "size": os.path.getsize(file_path),  # File size in bytes
                    })
                except Exception as e:
                    print(f"Error reading metadata for {name}: {e}")  # Debugging log
                    metadata.append({
                        "name": name,
                        "error": f"Could not read metadata: {str(e)}"
                    })

        print(f"Detected audio files: {metadata}")  # Debugging log
        return json.dumps(metadata)

httpd = socketserver.TCPServer(("", PORT), CustomHandler)
print(f"Serving at port {PORT}")
httpd.serve_forever()
