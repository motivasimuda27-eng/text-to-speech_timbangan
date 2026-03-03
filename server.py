"""
server.py — Backend Edge-TTS untuk Sistem Antrian & Pengumuman
Jalankan: python3 server.py
API:
  GET  /voices           → Daftar suara tersedia
  POST /speak            → Generate audio MP3 dari teks
  GET  /health           → Cek status server
"""

import asyncio
import io
import sys

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import edge_tts

app = Flask(__name__)
CORS(app)

# ─── DAFTAR SUARA EDGE-TTS ────────────────────────────────────────────────────
VOICES = [
    # Indonesia
    {"name": "id-ID-GadisNeural",  "lang": "id-ID", "gender": "Perempuan", "label": "Gadis — Indonesia (Perempuan)"},
    {"name": "id-ID-ArdiNeural",   "lang": "id-ID", "gender": "Laki-laki", "label": "Ardi — Indonesia (Laki-laki)"},
    # English
    {"name": "en-US-AriaNeural",   "lang": "en-US", "gender": "Perempuan", "label": "Aria — English US (Perempuan)"},
    {"name": "en-US-GuyNeural",    "lang": "en-US", "gender": "Laki-laki", "label": "Guy — English US (Laki-laki)"},
    {"name": "en-GB-SoniaNeural",  "lang": "en-GB", "gender": "Perempuan", "label": "Sonia — English UK (Perempuan)"},
]

DEFAULT_VOICE   = "id-ID-GadisNeural"
DEFAULT_RATE    = "+0%"
DEFAULT_VOLUME  = "+0%"
DEFAULT_PITCH   = "+0Hz"


async def _generate_audio(text: str, voice: str, rate: str, volume: str, pitch: str) -> bytes:
    """Async: generate MP3 bytes via edge-tts."""
    communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume, pitch=pitch)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({"status": "ok", "engine": "edge-tts"})


@app.get("/voices")
def get_voices():
    return jsonify(VOICES)


@app.post("/speak")
def speak():
    data    = request.get_json(force=True, silent=True) or {}
    text    = (data.get("text") or "").strip()
    voice   = data.get("voice",  DEFAULT_VOICE)
    rate    = data.get("rate",   DEFAULT_RATE)
    volume  = data.get("volume", DEFAULT_VOLUME)
    pitch   = data.get("pitch",  DEFAULT_PITCH)

    if not text:
        return jsonify({"error": "Parameter 'text' kosong"}), 400

    # Validasi format edge-tts (contoh: "+10%", "-5%", "+2Hz")
    try:
        audio_bytes = asyncio.run(_generate_audio(text, voice, rate, volume, pitch))
    except Exception as exc:
        print(f"[edge-tts ERROR] {exc}", file=sys.stderr)
        return jsonify({"error": str(exc)}), 500

    if not audio_bytes:
        return jsonify({"error": "Audio kosong, pastikan teks valid dan jaringan tersedia"}), 500

    return send_file(
        io.BytesIO(audio_bytes),
        mimetype="audio/mpeg",
        as_attachment=False,
        download_name="tts.mp3",
    )


