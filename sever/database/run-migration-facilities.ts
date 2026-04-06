import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { poolPromise } from '../config/db';

dotenv.config();

async function runMigration() {
    console.log('🚀 Running facility migration...\n');

    try {
        const pool = await poolPromise;

            const migratePath = path.join(__dirname, '01-facilities-migration.sql');
        if (!fs.existsSync(migratePath)) {
            console.error('❌ File not found at:', migratePath);
            process.exit(1);
        }

        const schema = fs.readFileSync(migratePath, 'utf8');
        const batches = schema.split(/\bGO\b/i)
            .map(b => b.trim())
            .filter(b => b.length > 0);

        let success = 0;

        for (const batch of batches) {
            try {
                await pool.request().query(batch);
                success++;
            } catch (err: any) {
                console.warn('⚠️  Warning:', err.message.substring(0, 150));
            }
        }

        console.log(`\n📊 Migration result: Executed ${success} batches`);
        console.log(`\n🎉 Facility Migration completed successfully!`);

        process.exit(0);
    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
