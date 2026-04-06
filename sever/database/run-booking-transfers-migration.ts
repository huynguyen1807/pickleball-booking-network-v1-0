import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const DB_NAME = process.env.DB_NAME || 'pickleball_danang';

const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    database: DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function migrate() {
    console.log('🚀 Starting booking transfers migration...\n');
    try {
        const pool = await new sql.ConnectionPool(config).connect();
        const migratePath = path.join(__dirname, '08-booking-transfers.sql');
        const schema = fs.readFileSync(migratePath, 'utf8');
        const batches = schema.split(/\bGO\b/i).map(b => b.trim()).filter(b => b.length > 0);

        for (const batch of batches) {
            try {
                await pool.request().query(batch);
                console.log('✅ Batch executed successfully');
            } catch (err) {
                console.warn('⚠️  Warning/Error:', err.message.substring(0, 150));
            }
        }
        await pool.close();
        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}
migrate();
