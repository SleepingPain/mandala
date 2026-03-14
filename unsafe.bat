@echo off
chcp 65001 >nul
title Claude Code (Unsafe Mode)
cd /d "%~dp0"
echo [WARNING] 모든 권한 확인을 건너뜁니다. 안전한 환경에서만 사용하세요.
claude --dangerously-skip-permissions
