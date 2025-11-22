@echo off
REM Frontend Build and Deployment Script for Hostinger
REM Run this from the frontend directory

echo === Email Validator Frontend Deployment ===
echo.

REM Step 1: Check if we're in the frontend directory
if not exist "package.json" (
    echo ERROR: package.json not found. Please run this from the frontend directory.
    exit /b 1
)

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    exit /b 1
)

echo.
echo Step 2: Building production bundle...
echo IMPORTANT: Make sure you have created .env.production with:
echo   VITE_API_BASE=https://api.yourdomain.com
echo.
pause

call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)

echo.
echo === Build Complete! ===
echo.
echo Production files are in: frontend\dist\
echo.
echo Next steps to deploy to Hostinger:
echo.
echo 1. Login to your Hostinger control panel
echo 2. Open File Manager
echo 3. Navigate to public_html directory
echo 4. Delete all existing files in public_html (backup first!)
echo 5. Upload ALL files from frontend\dist\ to public_html\
echo 6. Create .htaccess file with SPA routing configuration (see deployment_plan.md)
echo 7. Enable SSL in Hostinger (usually free with Let's Encrypt)
echo 8. Test your site at https://yourdomain.com
echo.
echo Alternatively, use FTP:
echo - Host: ftp.yourdomain.com (or IP from Hostinger)
echo - Username: your-ftp-username
echo - Password: your-ftp-password
echo - Upload all files from dist\ to public_html\
echo.

pause
