@echo off
REM Yard Stock — double-click this to take a full backup of the live data.
REM It only reads from Supabase; it never writes anything back.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup.ps1"
echo.
pause
