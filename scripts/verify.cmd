@echo off
setlocal
cd /d "%~dp0.."

echo ==^> cwd: %CD%

if not exist "node_modules\.bin\tsc.cmd" (
  echo [1/3] node_modules missing or incomplete, running npm install...
  call npm install
  if errorlevel 1 (
    echo [FAIL] npm install failed
    exit /b 1
  )
) else (
  echo [1/3] dependencies present, skip install
)

echo [2/3] typecheck...
call npm run typecheck
if errorlevel 1 (
  echo [FAIL] typecheck failed
  exit /b 1
)

echo [3/3] tests...
call npm test
if errorlevel 1 (
  echo [FAIL] tests failed
  exit /b 1
)

echo ALL OK
endlocal
