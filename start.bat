@echo off
title Dev Environment Launcher

echo Starting Prisma Studio...
start "Prisma Studio" cmd /k "npx dotenv -e .env -- npx prisma studio"

echo Starting Node server with nodemon...
start "Node Server" cmd /k "nodemon server.js"

echo Both services launched successfully.
pause
