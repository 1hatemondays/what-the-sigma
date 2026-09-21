@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Khong tim thay Node.js. Hay cai Node.js 20 tro len va chay lai.
  pause
  exit /b 1
)
echo.
echo ========================================
echo   DAU AN HO CHI MINH - WEBGAME LOP HOC
echo ========================================
echo.
echo Mo http://localhost:3000 tren may nay.
echo Dia chi Wi-Fi cho laptop cac nhom hien ben duoi.
echo Mat khau nguoi dan se duoc hien ben duoi.
echo Giu cua so nay mo trong suot tran dau.
echo Nhan Ctrl+C de dung may chu.
echo.
node server.js
pause
