const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'vercel.json');
const targetPath = path.join(__dirname, '..', 'dist', 'vercel.json');

if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log('Copied vercel.json to dist');
}