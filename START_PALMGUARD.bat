@echo off
REM ============================================================
REM  Palm Guard - one-click local launcher (Windows)
REM  Opens 3 windows (backend + ML scorer + dashboard) and the browser.
REM  Close any window to stop that server, or run STOP_PALMGUARD.bat.
REM ============================================================
cd /d "%~dp0"
echo Starting Palm Guard...

start "Palm Guard - Backend"   cmd /k "cd /d %~dp0backend && npm start"
start "Palm Guard - ML scorer" cmd /k "cd /d %~dp0ml && C:\pg_uv\Scripts\python.exe -m uvicorn serve.app:app --host 127.0.0.1 --port 8001"
start "Palm Guard - Dashboard" cmd /k "cd /d %~dp0frontend && npm run dev -- --port 5273 --host"

echo Waiting for the dashboard to come up...
timeout /t 7 >nul
start "" "http://localhost:5273"
echo.
echo Palm Guard is running:
echo   Dashboard : http://localhost:5273
echo   Backend   : http://localhost:4000
echo   ML scorer : http://localhost:8001/health
echo.
echo (The "POST /score 200 OK" lines in the ML window are the live demo
echo  data flowing - that is the system WORKING, not an error.)
