const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'pickleball_danang';

// Config without database (to create DB first)
const masterConfig = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '12345',
    database: 'master',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

// Config with target database
const config = {
    ...masterConfig,
    database: DB_NAME,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function initDatabase() {
    try {
        // Step 1: Connect to master and create database if not exists
        const masterPool = await new sql.ConnectionPool(masterConfig).connect();
        const dbCheck = await masterPool.request().query(
            `IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${DB_NAME}')
             CREATE DATABASE [${DB_NAME}]`
        );
        console.log(`✅ Database [${DB_NAME}] ready`);
        await masterPool.close();

        // Step 2: Connect to target database and create tables
        const pool = await new sql.ConnectionPool(config).connect();

        // Read and execute schema.sql (skip CREATE DATABASE and USE statements)
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');

            // Split by GO and execute each batch, skip DB creation/USE commands
            const batches = schema.split(/\bGO\b/i)
                .map(b => b.trim())
                .filter(b => b.length > 0)
                .filter(b => !b.match(/CREATE\s+DATABASE/i) && !b.match(/^USE\s+/i));

            for (const batch of batches) {
                try {
                    await pool.request().query(batch);
                } catch (err) {
                    // Ignore errors for already existing objects
                    if (!err.message.includes('already exists')) {
                        console.warn('⚠️ Schema batch warning:', err.message.substring(0, 100));
                    }
                }
            }
            console.log('✅ All tables initialized');
        }

        console.log('✅ SQL Server connected successfully');
        return pool;
    } catch (err) {
        console.error('❌ SQL Server connection failed:', err.message);
        process.exit(1);
    }
}

const poolPromise = initDatabase();

module.exports = { sql, poolPromise };
