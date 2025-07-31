@echo off 
git init 
git add . 
git commit -m "YouTube Downloader Netlify" 
git branch -M main 
echo Replace YOUR_USERNAME: 
git remote add origin https://github.com/YOUR_USERNAME/youtube-downloader.git 
git push -u origin main 
