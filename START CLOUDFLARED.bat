@echo off
cd /d "%~dp0"

set "CLOUDFLARED=%USERPROFILE%\Downloads\cloudflared.exe"
if exist "%CLOUDFLARED%" goto run

where cloudflared.exe >nul 2>nul
if not errorlevel 1 (
    set "CLOUDFLARED=cloudflared.exe"
    goto run
)

echo Cloudflared.exe not found.
echo Put cloudflared.exe in %USERPROFILE%\Downloads or add it to PATH.
pause
exit /b 1

:run
start "Cloudflared tunnel" cmd /k ""%CLOUDFLARED%" tunnel --url http://127.0.0.1:80"
