@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Raktárkezelő - helyi tesztszerver
set "RAKTAR_ARCH=win-x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "RAKTAR_ARCH=win-arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "RAKTAR_ARCH=win-arm64"
set "RAKTAR_NODE=%~dp0..\runtime\%RAKTAR_ARCH%\node.exe"
if not exist "%RAKTAR_NODE%" (
  echo Nem található a csomaghoz tartozó futtatóprogram.
  echo A teljes ZIP tartalmát bontsd ki egy mappába, és onnan indítsd az Inditas.cmd fájlt.
  echo.
  pause
  exit /b 1
)
"%RAKTAR_NODE%" "%~dp0start-local.mjs"
if errorlevel 1 (
  echo.
  echo A kiszolgáló nem indult el. A fenti hibaüzenet segít a javításban.
  pause
  exit /b 1
)
exit /b 0
