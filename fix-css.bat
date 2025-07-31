@echo off
echo Copying styles.css from parent directory...
copy "..\styles.css" "."
echo Adding and committing changes...
git add .
git commit -m "Fix: Add missing styles.css file"
git push origin main
echo.
echo CSS file added and pushed to GitHub!
echo Netlify will auto-deploy in 1-2 minutes.
pause