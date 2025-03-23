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

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/list':  # Handle the /list endpoint
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(self.generate_file_metadata().encode("utf-8"))
        else:
            super().do_GET()

    def guess_type(self, path):
        """Ensure correct MIME type for .mp3 files."""
        mime_type, _ = mimetypes.guess_type(path)
        if path.endswith(".mp3"):
            return "audio/mpeg"
        return mime_type or "application/octet-stream"

    def generate_file_metadata(self):
        """Generate metadata for all .mp3 files in the directory."""
        try:
            file_list = os.listdir(os.getcwd())
        except OSError:
            return json.dumps({"error": "Cannot access directory"})

        metadata = []
        for name in file_list:
            if name.endswith(".mp3") and os.path.isfile(name):
                file_path = os.path.join(os.getcwd(), name)
                try:
                    audio = MP3(file_path)
                    metadata.append({
                        "name": name,
                        "duration": audio.info.length,  # Duration in seconds
                        "bitrate": audio.info.bitrate,  # Bitrate in bps
                        "size": os.path.getsize(file_path),  # File size in bytes
                    })
                except Exception as e:
                    metadata.append({
                        "name": name,
                        "error": f"Could not read metadata: {str(e)}"
                    })

        return json.dumps(metadata)

httpd = socketserver.TCPServer(("", PORT), CustomHandler)
print(f"Serving at port {PORT}")
httpd.serve_forever()