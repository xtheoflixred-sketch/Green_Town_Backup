@echo off
cd /d "%~dp0"
start cmd /k "npx gulp sprites && npx gulp changelog"