@echo off
echo === Kill HANES dev servers (port 3002, 3003) ===
echo.

echo [1/2] Killing port 3002 (frontend)...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') DO (
    echo   - PID %%P
    taskkill /F /PID %%P >nul 2>&1
)

echo [2/2] Killing port 3003 (backend)...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :3003 ^| findstr LISTENING') DO (
    echo   - PID %%P
    taskkill /F /PID %%P >nul 2>&1
)

echo.
echo === Done! Ports 3002, 3003 cleared ===
pause
