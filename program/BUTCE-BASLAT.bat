@echo off
chcp 65001 >nul
title Ucret Hesaplama - Sunucu (kapatmayin)
cd /d "%~dp0"

echo.
echo   ============================================
echo      UCRET HESAPLAMA
echo   ============================================
echo.
echo   Sunucu baslatiliyor, tarayici birazdan acilacak...
echo.
echo   ONEMLI: Bu siyah pencereyi KAPATMAYIN.
echo   Kapatirsaniz sisteme erisemezsiniz.
echo   Isiniz bitince bu pencereyi kapatarak sunucuyu durdurabilirsiniz.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sunucuyu-Baslat.ps1"

echo.
echo   Sunucu durdu.
echo.
pause
