@echo off
cd /d "%~dp0"

start cmd /k "npm run wds"
start cmd /k "npm run ts-watch"
start cmd /k "gulp test"
start cmd /k "gulp dev"
