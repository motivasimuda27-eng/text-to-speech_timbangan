@echo off
title Sistem Antrian TTS - Wings Corp
color 0A
cd /d "%~dp0"

echo ==================================================
echo   Sistem Panggil Antrian ^& Pengumuman Timbangan
echo ==================================================
echo.

REM Cek Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python tidak ditemukan. Install Python 3.12+ dulu.
    pause
    exit /b 1
)

REM Buat venv jika belum ada
if not exist "venv\Scripts\python.exe" (
    echo [INFO] Membuat virtual environment...
    python -m venv venv
)

REM Install/update dependensi
echo [INFO] Menginstall dependensi...
venv\Scripts\python.exe -m pip install -q -r requirements.txt

REM Cek requests (untuk fetch_antrian)
venv\Scripts\python.exe -c "import requests" 2>nul
if errorlevel 1 (
    echo [INFO] Menginstall requests...
    venv\Scripts\python.exe -m pip install -q requests
)

echo.
echo [INFO] Menjalankan Edge-TTS server (port 5000)...
start "" /B venv\Scripts\python.exe run_windows.py >nul 2>&1

REM Tunggu backend siap
timeout /t 3 /nobreak >nul

echo [INFO] Menjalankan Web server (port 7000)...
start "" /B venv\Scripts\python.exe -m http.server 7000 >nul 2>&1

echo.
echo ==================================================
echo   ✅ Sistem berjalan!
echo   📍 http://localhost:7000
echo ==================================================
echo.
start http://localhost:7000
timeout /t 3 /nobreak >nul
exit
