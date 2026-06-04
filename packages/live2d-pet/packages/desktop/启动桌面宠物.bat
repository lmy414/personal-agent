@echo off
chcp 65001 >nul
cd /d "%~dp0"

set ELECTRON=..\..\node_modules\electron\dist\electron.exe

echo ========================================
echo   Live2D 桌面宠物
echo ========================================
echo.
echo 检查 Electron: %ELECTRON%

if not exist "%ELECTRON%" (
    echo [错误] 找不到 Electron: %ELECTRON%
    echo 请先运行: npm install
    pause
    exit /b 1
)

echo [OK] Electron 已找到
echo.

REM 清除 ELECTRON_RUN_AS_NODE（系统环境变量会阻止 Electron 正常启动）
set ELECTRON_RUN_AS_NODE=

echo 正在启动...（日志写入 app.log）
echo.

REM 同时输出到控制台和日志文件
"%ELECTRON%" . >app.log 2>&1

echo 退出代码: %ERRORLEVEL%
echo.
echo 如果窗口一闪而过，请查看 app.log
pause
