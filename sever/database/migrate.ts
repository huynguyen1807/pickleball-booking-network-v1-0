import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'pickleball_danang';
const MIGRATION_FILES = [
    'schema.sql',
    '07-match-payment-locking.sql',
    '08-normalize-court-pricing-columns.sql'
];

const masterConfig = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    database: 'master',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function migrate() {
    console.log('🚀 Starting migration...\n');

    try {
        // Step 1: Create database if not exists
        const masterPool = await new sql.ConnectionPool(masterConfig).connect();
        await masterPool.request().query(
            `IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${DB_NAME}')
             CREATE DATABASE [${DB_NAME}]`
        );
        console.log(`✅ Database [${DB_NAME}] ready`);
        await masterPool.close();

        // Step 2: Connect to target database
        const pool = await new sql.ConnectionPool({
            ...masterConfig,
            database: DB_NAME
        }).connect();

        let totalSuccess = 0;
        let totalSkipped = 0;

        for (const fileName of MIGRATION_FILES) {
            const filePath = path.join(__dirname, fileName);
            if (!fs.existsSync(filePath)) {
                console.error(`❌ File ${fileName} not found at:`, filePath);
                process.exit(1);
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const batches = content.split(/\bGO\b/i)
                .map(b => b.trim())
                .filter(b => b.length > 0)
                .filter(b => !b.match(/CREATE\s+DATABASE/i) && !b.match(/^USE\s+/i));

            let fileSuccess = 0;
            let fileSkipped = 0;
            console.log(`\n📄 Running ${fileName} ...`);

            for (const batch of batches) {
                try {
                    await pool.request().query(batch);
                    fileSuccess++;
                } catch (err) {
                    const msg = String(err?.message || 'Unknown error');
                    if (msg.includes('already exists')) {
                        fileSkipped++;
                    } else {
                        console.warn('⚠️  Warning:', msg.substring(0, 120));
                        fileSkipped++;
                    }
                }
            }

            totalSuccess += fileSuccess;
            totalSkipped += fileSkipped;
            console.log(`   ✅ ${fileName}: ${fileSuccess} executed, ${fileSkipped} skipped`);
        }

        console.log(`\n📊 Migration result:`);
        console.log(`   ✅ Executed: ${totalSuccess} batches`);
        console.log(`   ⏭️  Skipped: ${totalSkipped} batches`);
        console.log(`\n🎉 Migration completed successfully!`);

        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
