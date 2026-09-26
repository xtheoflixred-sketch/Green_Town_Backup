@echo off
cd /d "%~dp0"
set "NODE_ENV=production"
start "Green Town server" cmd /k "npm start"
