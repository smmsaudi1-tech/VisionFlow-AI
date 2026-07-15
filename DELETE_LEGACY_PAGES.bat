@echo off
echo ===================================================
echo   VisionFlow AI - Delete Legacy Folders
echo ===================================================
echo.

echo Deleting legacy frontend pages (analyze and dashboard)...
rd /s /q "frontend\app\analyze" 2>nul
rd /s /q "frontend\app\dashboard" 2>nul

echo.
echo [SUCCESS] Legacy folders deleted!
echo.
pause
