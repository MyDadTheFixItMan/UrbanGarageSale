@echo off
REM UrbanGarageSale Live Testing Startup Script
REM This script sets up and starts the application for live testing

echo.
echo ======================================
echo  UrbanGarageSale Live Testing Setup
echo ======================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Step 1: Checking environment files...

REM Check if .env exists
if not exist ".env" (
    echo Creating .env from .env.example...
    copy .env.example .env >nul
    echo IMPORTANT: Edit .env and add your STRIPE_SECRET_KEY
)

REM Check if web-app/.env.local exists
if not exist "web-app\.env.local" (
    echo Creating web-app/.env.local from web-app/.env.example...
    copy web-app\.env.example web-app\.env.local >nul
    echo IMPORTANT: Edit web-app/.env.local and add your VITE_STRIPE_PUBLIC_KEY
)

echo.
echo Step 2: Installing dependencies...
echo.

REM Install root dependencies
call npm install

REM Install web-app dependencies
cd web-app
call npm install
cd ..

echo.
echo Step 3: Configuration Summary
echo.
echo 1. Edit .env file with your Stripe Secret Key (STRIPE_SECRET_KEY)
echo 2. Edit web-app/.env.local with your Stripe Public Key (VITE_STRIPE_PUBLIC_KEY)
echo 3. Run: npm run dev:api (in one terminal)
echo 4. Run: npm run dev:web (in another terminal)
echo.
echo For Stripe test cards, use:
echo   Card: 4242 4242 4242 4242
echo   Date: Any future date (MM/YY)
echo   CVC:  Any 3 digits
echo.
echo ======================================
echo Setup complete!
echo ======================================
echo.
pause
