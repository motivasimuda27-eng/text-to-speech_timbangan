"""
run_linux.py — Jalankan Edge-TTS server di Linux
Menggunakan Flask development server
"""
from server import app

if __name__ == "__main__":
    print("=" * 55)
    print("  Edge-TTS Server (Linux)")
    print("  Berjalan di : http://localhost:5000")
    print("  Tekan Ctrl+C untuk menghentikan")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5000, debug=False)
