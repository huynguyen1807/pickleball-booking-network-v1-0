# Script to convert CommonJS to ES6 modules

$serverPath = "E:\Pickaball\pickleball-booking-network-v1.0\sever"

# Convert all route files
Get-ChildItem -Path "$serverPath\routes" -Filter "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # Convert router import
    $content = $content -replace "const router = require\('express'\)\.Router\(\);", "import { Router } from 'express';`nconst router = Router();"
    
    # Convert auth import
    $content = $content -replace "const auth = require\('\.\./middleware/auth'\);", "import auth from '../middleware/auth';"
    
    # Convert role import
    $content = $content -replace "const role = require\('\.\./middleware/role'\);", "import role from '../middleware/role';"
    
    # Convert controller imports (complex - need to handle individual functions)
    $content = $content -replace "const \{ ([^\}]+) \} = require\('\.\./controllers/([^']+)'\);", "import { `$1 } from '../controllers/`$2';"
    
    # Convert module.exports
    $content = $content -replace "module\.exports = router;", "export default router;"
    
    Set-Content -Path $_.FullName -Value $content
    Write-Host "Converted: $($_.Name)"
}

Write-Host "`nRoute files converted!"
