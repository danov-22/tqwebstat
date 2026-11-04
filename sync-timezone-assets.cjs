const fs=require('fs');
fs.writeFileSync('timezone.html','<style>\n'+fs.readFileSync('timezone.css','utf8')+'\n</style>\n<script>\n'+fs.readFileSync('timezone.js','utf8')+'\n</script>\n');
