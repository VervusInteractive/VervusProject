@echo off
set DATABASE_URL=local-db-shim
set PAYMENTS_REQUIRED=false
set CLIENT_URL=http://192.168.0.104:5173
set CORS_ORIGINS=http://192.168.0.104:5173,http://localhost:5173,http://127.0.0.1:5173
cd /d "F:\Egamea Projects\VervusProject\Server"
npm.cmd run dev
