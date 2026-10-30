@echo off
title Khoi dong Du An Cong Tac Hoc Thuat (2 Cong)
echo ==============================================================
echo   DANG KHOI DONG BACKEND API (3001) VA FRONTEND WEB (3000)...
echo ==============================================================

start "Backend API - Port 3001" cmd /k "cd /d %~dp0 && npm run dev:api"
start "Frontend Web - Port 3000" cmd /k "cd /d %~dp0 && npm run dev:web"

echo.
echo [x] Backend API dang chay tai:   http://localhost:3001
echo     - Tai lieu Swagger API:      http://localhost:3001/docs
echo [x] Frontend Web dang chay tai:  http://localhost:3000
echo.
