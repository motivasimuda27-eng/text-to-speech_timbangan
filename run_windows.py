"""
run_windows.py — Jalankan Edge-TTS server di Windows
Menggunakan Waitress (production WSGI server)
"""
from server import app
from waitress import serve

if __name__ == "__main__":
    print("=" * 55)
    print("  Edge-TTS Server (Windows - Waitress)")
    print("  Berjalan di : http://localhost:5000")
    print("  Tekan Ctrl+C untuk menghentikan")
    print("=" * 55)
    serve(app, host="0.0.0.0", port=5000, threads=4)
