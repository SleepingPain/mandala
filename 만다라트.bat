@echo off
chcp 65001 >nul
title 만다라트
cd /d "%~dp0"
echo 만다라트를 시작합니다...
npm run dev
