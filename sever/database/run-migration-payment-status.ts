import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { poolPromise } from '../config/db';

dotenv.config();

async function runMigration() {
    console.log('🚀 Running payment status constraint migration...\n');

    try {
        const pool = await poolPromise;

        const migratePath = path.join(__dirname, '03-payment-status-constraint.sql');
        if (!fs.existsSync(migratePath)) {
            console.error('❌ File not found at:', migratePath);
            process.exit(1);
        }

        const schema = fs.readFileSync(migratePath, 'utf8');
        const batches = schema.split(/\bGO\b/i)
            .map(b => b.trim())
            .filter(b => b.length > 0);

        for (const batch of batches) {
            await pool.request().query(batch);
        }

        console.log('\n🎉 Migration 03 completed successfully!');
        process.exit(0);
    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
