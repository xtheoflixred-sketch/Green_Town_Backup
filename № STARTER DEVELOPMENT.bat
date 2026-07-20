@echo off
cd /d "C:\logins\User\Files\User Files\Green Town"

start cmd /k "npm run wds"
start cmd /k "npm run ts-watch"
start cmd /k "gulp test"
start cmd /k "gulp dev"
