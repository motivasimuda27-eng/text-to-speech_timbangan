@echo off
title Sistem Antrian TTS - Server Lokal
color 0A
echo.
echo  ============================================
echo   Sistem Antrian ^& Pengumuman - TTS
echo   Menjalankan server lokal...
echo  ============================================
echo.

REM Pindah ke folder script ini berada
cd /d "%~dp0"

REM Cek apakah Python tersedia
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo  [OK] Python ditemukan. Menggunakan Python HTTP server...
    echo.
    echo  Akses aplikasi di: http://localhost:8080
    echo  Tekan Ctrl+C untuk menghentikan server.
    echo.
    start "" "http://localhost:8080"
    python -m http.server 8080
    goto :end
)

REM Cek Python3
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo  [OK] Python3 ditemukan.
    echo.
    echo  Akses aplikasi di: http://localhost:8080
    echo  Tekan Ctrl+C untuk menghentikan server.
    echo.
    start "" "http://localhost:8080"
    python3 -m http.server 8080
    goto :end
)

REM Cek Node.js / npx
npx --version >nul 2>&1
if %errorlevel% == 0 (
    echo  [OK] Node.js ditemukan. Menggunakan npx serve...
    echo.
    echo  Akses aplikasi di: http://localhost:8080
    echo  Tekan Ctrl+C untuk menghentikan server.
    echo.
    start "" "http://localhost:8080"
    npx -y serve -p 8080 .
    goto :end
)

REM Tidak ada yang tersedia
echo  [ERROR] Python atau Node.js tidak ditemukan!
echo.
echo  Silakan install salah satu:
echo  - Python: https://www.python.org/downloads/
echo  - Node.js: https://nodejs.org/
echo.
echo  Atau buka index.html langsung di Chrome/Edge
echo  (untuk Firefox, server lokal diperlukan)
echo.
pause

:end
