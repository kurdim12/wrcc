@echo off
REM Stop Palm Guard local servers (frees ports 4000, 8001, 5273).
for %%P in (4000 8001 5273) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do taskkill /F /PID %%A >nul 2>&1
)
echo Palm Guard servers stopped.
timeout /t 2 >nul
