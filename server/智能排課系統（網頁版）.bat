@echo off
chcp 65001 >nul
echo =================================
echo   智能排課系統 - 網頁版服務器
echo =================================
echo.

cd /d "%~dp0"

echo [1/2] 檢查依賴...
if not exist "node_modules" (
    echo 未找到依賴，正在安裝...
    call npm install
    if errorlevel 1 (
        echo.
        echo ❌ 安裝失敗！請確保已安裝 Node.js
        echo 下載地址: https://nodejs.org/
        pause
        exit /b 1
    )
)

echo.
echo [2/2] 啟動服務器...
echo.
call npm start

pause
