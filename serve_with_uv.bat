@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PORT=8000"
if not "%~1"=="" (
    set "PORT=%~1"
)

pushd "%SCRIPT_DIR%" >nul

where uv >nul 2>nul
if errorlevel 1 (
    echo [ERROR] uv command not found. Install uv from https://docs.astral.sh/uv/
    popd >nul
    exit /b 1
)

echo Starting uv-managed Python HTTP server on port %PORT%.
echo Serving directory: %SCRIPT_DIR%

uv run python -m http.server %PORT%

popd >nul
endlocal
