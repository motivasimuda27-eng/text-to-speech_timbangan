#!/usr/bin/env bash
# jalankan.sh — Jalankan server edge-tts + web server lokal
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=================================================="
echo "  Sistem Antrian & Pengumuman — Edge-TTS"
echo "=================================================="

# Tentukan Python: gunakan venv jika ada, fallback ke python3
if [ -f "$DIR/venv/bin/python" ]; then
    PYTHON="$DIR/venv/bin/python"
    echo ">> Menggunakan venv: $PYTHON"
else
    PYTHON="$(command -v python3)"
    echo ">> Menggunakan sistem python3: $PYTHON"
fi

# Cek dependensi
if ! "$PYTHON" -c "import flask, flask_cors, edge_tts" 2>/dev/null; then
    echo "ERROR: Dependensi belum terinstall."
    echo "Jalankan dulu:"
    echo "  python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Kill proses lama di port 5000 dan 8080 jika ada
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

# Jalankan edge-tts backend di background
echo ">> Menjalankan Edge-TTS server (port 5000)..."
"$PYTHON" run_linux.py &
SERVER_PID=$!
echo "   PID server: $SERVER_PID"

# Tunggu server siap
sleep 2

# Jalankan web server di background
echo ">> Menjalankan Web server (port 8080)..."
"$PYTHON" -m http.server 8080 &
WEB_PID=$!
echo "   PID web: $WEB_PID"

sleep 1

echo ""
echo "Aplikasi berjalan!"
echo "   Buka di browser: http://localhost:8080"
echo ""
echo "   Tekan Ctrl+C untuk menghentikan semua server."
echo "=================================================="

# Buka browser (jika xdg-open tersedia)
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:8080" 2>/dev/null &
fi

# Tunggu hingga Ctrl+C
trap "echo ''; echo 'Menghentikan server...'; kill $SERVER_PID $WEB_PID 2>/dev/null; exit 0" INT TERM
wait
