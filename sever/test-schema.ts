import { poolPromise } from './config/db';

async function main() {
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'booking_transfers'");
    console.log("COLUMNS: " + res.recordset.map(r => r.COLUMN_NAME).join(', '));
    process.exit(0);
}
main();
