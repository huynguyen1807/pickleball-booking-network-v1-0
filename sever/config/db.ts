import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'pickleball_danang';

const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    database: DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config).connect()
    .then(pool => {
        console.log('✅ SQL Server connected successfully');
        return pool;
    })
    .catch(err => {
        console.error('❌ SQL Server connection failed:', err.message);
        process.exit(1);
    });

export { sql, poolPromise };
