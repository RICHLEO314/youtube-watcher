@echo off
echo Uploading to GitHub for user: RICHLEO314
echo Repository name: youtube-watcher
git remote add origin https://github.com/RICHLEO314/youtube-watcher.git
git push -u origin main
echo.
echo Upload complete!
echo Repository: https://github.com/RICHLEO314/youtube-watcher
echo Now go to netlify.com to deploy your site.
pause