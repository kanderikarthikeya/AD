@echo off
title Motion Capture Studio
cd /d "%~dp0"
echo ========================================================
echo    Starting Motion Capture Studio Demo Server...
echo ========================================================
python run_server.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python was not found in PATH or failed to start.
    echo Attempting direct browser launch via default browser...
    start "" index.html
)
pause
