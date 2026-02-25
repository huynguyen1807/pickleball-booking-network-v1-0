# Script to convert Controllers to ES6 modules

$serverPath = "E:\Pickaball\pickleball-booking-network-v1.0\sever"

# Convert all controller files
Get-ChildItem -Path "$serverPath\controllers" -Filter "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # Convert require statements
    $content = $content -replace "const bcrypt = require\('bcryptjs'\);", "import bcrypt from 'bcryptjs';"
    $content = $content -replace "const jwt = require\('jsonwebtoken'\);", "import jwt from 'jsonwebtoken';"
    $content = $content -replace "const nodemailer = require\('nodemailer'\);", "import nodemailer from 'nodemailer';"
    $content = $content -replace "const \{ sql, poolPromise \} = require\('\.\./config/db'\);", "import { sql, poolPromise } from '../config/db';"
    $content = $content -replace "require\('dotenv'\)\.config\(\);", "import dotenv from 'dotenv';`ndotenv.config();"
    
    # Convert exports.functionName to export const functionName
    $content = $content -replace "exports\.([a-zA-Z0-9_]+)\s*=\s*async\s*\(", "export const `$1 = async ("
    $content = $content -replace "exports\.([a-zA-Z0-9_]+)\s*=\s*\(", "export const `$1 = ("
    
    Set-Content -Path $_.FullName -Value $content
    Write-Host "Converted: $($_.Name)"
}

Write-Host "`nController files converted!"
