@echo off
title Sistem Antrian TTS
color 0A
cd /d "%~dp0"

echo Menjalankan Edge-TTS backend (port 5000)...
if exist "venv\Scripts\python.exe" (
    set PYTHON=venv\Scripts\python.exe
) else (
    set PYTHON=pythonw.exe
)

REM Jalankan run_windows.py di background tanpa window
start "" /B %PYTHON% run_windows.py >nul 2>&1

REM Tunggu backend siap
timeout /t 3 /nobreak >nul

echo Menjalankan Web server (port 7000) di background...
REM Jalankan HTTP server di background tanpa window
start "" /B %PYTHON% -m http.server 7000 >nul 2>&1

echo Sistem berjalan di background. Akses di http://localhost:7000
echo Untuk menghentikan, gunakan Task Manager (Ctrl+Shift+Esc) dan cari python.exe
timeout /t 2 /nobreak >nul
exit