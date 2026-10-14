@echo off
setlocal
cd /d "%~dp0"
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
if not exist .env copy .env.example .env
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 goto fail
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm is required to build the existing React user interface.
  echo Install Node.js LTS, then run this script again.
  pause
  exit /b 1
)
if not exist node_modules npm install
if errorlevel 1 goto fail
call npm run build
if errorlevel 1 goto fail
python run_flask.py
goto end
:fail
echo Startup failed. Review the error above.
pause
exit /b 1
:end
endlocal
