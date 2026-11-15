@echo off
chcp 65001 >nul
cd /d "%~dp0\FitApp"
echo Starting TanYar Offline App (Zero-API Local Vision Model)...
node server.js
pause
