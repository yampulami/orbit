@echo off
cd /d "%~dp0web"
if not exist node_modules\.bin\vite.cmd call npm.cmd install
call npm.cmd run dev -- --open
