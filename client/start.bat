@echo off
rem Starts Zenith Echo locally and opens it in your browser. Nothing is uploaded anywhere.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies, one moment...
  call npm install --no-audit --no-fund
)
call npm run dev -- --open
