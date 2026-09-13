@echo off
cd /d "%~dp0"
start "Green Town sprite generator" cmd /k "npx gulp sprites && npx gulp changelog"
