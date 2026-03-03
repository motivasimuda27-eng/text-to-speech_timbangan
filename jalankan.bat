@echo off
title Sistem Antrian TTS
color 0A
cd /d "%~dp0"

echo Menjalankan Edge-TTS backend (port 5000)...
if exist "venv\Scripts\python.exe" (
    set PYTHON=venv\Scripts\python.exe
) else (
    set PYTHON=python
)

REM Jalankan run_windows.py di window terpisah
start "TTS Backend" %PYTHON% run_windows.py

REM Tunggu backend siap
timeout /t 3 /nobreak >nul

echo Menjalankan Web server (port 8080)...
start "" "http://localhost:8080"
%PYTHON% -m http.server 8080