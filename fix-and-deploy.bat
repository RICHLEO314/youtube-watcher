@echo off
echo Fixing Git remote and uploading...
echo Removing old remote...
git remote remove origin
echo Adding correct remote for RICHLEO314/youtube-watcher...
git remote add origin https://github.com/RICHLEO314/youtube-watcher.git
echo Pushing to GitHub...
git push -u origin main
echo.
echo Upload complete!
echo Repository: https://github.com/RICHLEO314/youtube-watcher
echo Now go to netlify.com to deploy your site.
pause