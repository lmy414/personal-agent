@echo off
cd /d "%~dp0"
where electron >nul 2>nul || (
  echo [ERROR] electron not found in PATH.
  echo Run: npm install -g electron
  pause
  exit /b 1
)
electron .
if errorlevel 1 pause
