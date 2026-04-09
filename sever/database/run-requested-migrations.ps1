$ErrorActionPreference = "Continue"
$server = "localhost,1433"
$user = "sa"
$pass = "123456"
$db = "pickleball_danang"
$logPath = "database\migration-run-20260402.log"
if (Test-Path $logPath) { Remove-Item $logPath -Force }

function Run-SqlFile([string]$file, [string]$databaseName) {
  "===== $file =====" | Tee-Object -FilePath $logPath -Append
  $output = sqlcmd -S $server -U $user -P $pass -d $databaseName -i ("database\" + $file) 2>&1
  if ($output) { $output | Tee-Object -FilePath $logPath -Append }
  "exit code: $LASTEXITCODE" | Tee-Object -FilePath $logPath -Append
}

"=== STEP 0: schema.sql ===" | Tee-Object -FilePath $logPath -Append
Run-SqlFile -file "schema.sql" -databaseName "master"

"=== STEP 1: ordered sql files ===" | Tee-Object -FilePath $logPath -Append
$files = @(
  "01-facilities-migration.sql",
  "02-advanced-facility-migration.sql",
  "03-add-owner-license.sql",
  "03-chat-dm-migration.sql",
  "03-payment-status-constraint.sql",
  "add-transaction-id.sql",
  "04-match-advanced-migration.sql",
  "04-seed-court-slots.sql",
  "05-matchmaking-wallet-migration.sql",
  "05-sync-fixing.sql",
  "06-add-reports-table.sql",
  "07-match-payment-locking.sql",
  "08-normalize-court-pricing-columns.sql"
)
foreach ($f in $files) { Run-SqlFile -file $f -databaseName $db }

"=== STEP 2: npm run migrate ===" | Tee-Object -FilePath $logPath -Append
$npmOutput = npm run migrate 2>&1
if ($npmOutput) { $npmOutput | Tee-Object -FilePath $logPath -Append }
"npm run migrate exit code: $LASTEXITCODE" | Tee-Object -FilePath $logPath -Append

"=== STEP 3: final sql files ===" | Tee-Object -FilePath $logPath -Append
Run-SqlFile -file "07-booking-policy-logs.sql" -databaseName $db
Run-SqlFile -file "08-booking-transfers.sql" -databaseName $db

"DONE. Log file: $logPath" | Tee-Object -FilePath $logPath -Append
