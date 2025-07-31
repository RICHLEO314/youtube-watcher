@echo off
echo Uploading to GitHub for user: RICHLEO314
git remote add origin https://github.com/RICHLEO314/youtube-downloader.git
git push -u origin main
echo.
echo Upload complete!
echo Repository: https://github.com/RICHLEO314/youtube-downloader
echo Now go to netlify.com to deploy your site.
pause