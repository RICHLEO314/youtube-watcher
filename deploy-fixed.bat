@echo off
echo Please enter your GitHub username:
set /p username="GitHub Username: "
git remote add origin https://github.com/%username%/youtube-downloader.git
git push -u origin main
echo.
echo Upload complete!
echo Now go to netlify.com to deploy your site.
pause