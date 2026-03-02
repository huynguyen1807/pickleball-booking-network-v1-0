import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'pickleball_danang';

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

        // Step 3: Read and execute migrate.sql
        const migratePath = path.join(__dirname, 'schema.sql');
        if (!fs.existsSync(migratePath)) {
            console.error('❌ File migrate.sql not found at:', migratePath);
            process.exit(1);
        }

        const schema = fs.readFileSync(migratePath, 'utf8');
        const batches = schema.split(/\bGO\b/i)
            .map(b => b.trim())
            .filter(b => b.length > 0)
            .filter(b => !b.match(/CREATE\s+DATABASE/i) && !b.match(/^USE\s+/i));

        let success = 0;
        let skipped = 0;

        for (const batch of batches) {
            try {
                await pool.request().query(batch);
                success++;
            } catch (err) {
                if (err.message.includes('already exists')) {
                    skipped++;
                } else {
                    console.warn('⚠️  Warning:', err.message.substring(0, 120));
                    skipped++;
                }
            }
        }

        console.log(`\n📊 Migration result:`);
        console.log(`   ✅ Executed: ${success} batches`);
        console.log(`   ⏭️  Skipped: ${skipped} batches`);
        console.log(`\n🎉 Migration completed successfully!`);

        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
