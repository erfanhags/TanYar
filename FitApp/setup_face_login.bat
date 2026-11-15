@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "FACE_RUNTIME=%~dp0..\face-runtime"
if not exist "%FACE_RUNTIME%\Scripts\python.exe" (
  py -3.11 -m venv "%FACE_RUNTIME%"
  if errorlevel 1 goto failed
)
"%FACE_RUNTIME%\Scripts\python.exe" -m pip install -r requirements-face.txt
if errorlevel 1 (
  "%FACE_RUNTIME%\Scripts\python.exe" -m pip install --index-url https://pypi.tuna.tsinghua.edu.cn/simple -r requirements-face.txt
  if errorlevel 1 goto failed
)
"%FACE_RUNTIME%\Scripts\python.exe" setup_face_models.py
if errorlevel 1 goto failed
echo Face login is ready. Start or restart start_app.bat.
pause
exit /b 0
:failed
echo Setup failed. Check the error above and try again.
pause
exit /b 1
