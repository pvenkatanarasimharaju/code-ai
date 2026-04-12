@echo off
setlocal
REM Kill processes listening on given ports (default: 3000 Express, 4200 Angular).
REM Usage:   kill-ports.bat
REM          kill-ports.bat 3000 5173

set "PORTS=%*"
if "%PORTS%"=="" set "PORTS=3000 4200"

echo Stopping listeners on: %PORTS%
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kill-ports.ps1" %PORTS%
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo Script exited with code %ERR%
  exit /b %ERR%
)
echo Done.
exit /b 0
