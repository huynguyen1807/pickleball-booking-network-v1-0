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
    .then(async pool => {
        console.log('✅ SQL Server connected successfully');

        // Auto-migration for posts.image column
        try {
            await pool.request().query(`
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='posts' AND COLUMN_NAME='image' AND DATA_TYPE='nvarchar' AND CHARACTER_MAXIMUM_LENGTH=500)
                BEGIN
                    ALTER TABLE posts ALTER COLUMN image NVARCHAR(MAX);
                    PRINT 'Migrated posts.image to NVARCHAR(MAX)';
                END
            `);

            // Auto-migration for upgrade_requests.business_license_url column
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='upgrade_requests' AND COLUMN_NAME='business_license_url')
                BEGIN
                    ALTER TABLE upgrade_requests ADD business_license_url NVARCHAR(MAX);
                    PRINT 'Added business_license_url to upgrade_requests';
                END
            `);

            // Auto-migration for login lockout columns
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'failed_login_count')
                BEGIN
                    ALTER TABLE users ADD failed_login_count INT DEFAULT 0;
                    PRINT 'Added failed_login_count to users';
                END
            `);
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'locked_until')
                BEGIN
                    ALTER TABLE users ADD locked_until DATETIMEOFFSET NULL;
                    PRINT 'Added locked_until to users';
                END
            `);

            // Auto-migration: Update users.status CHECK constraint to include 'banned'
            await pool.request().query(`
                DECLARE @constraintName NVARCHAR(200);
                SELECT @constraintName = dc.name
                FROM sys.check_constraints dc
                JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                WHERE c.object_id = OBJECT_ID('users') AND c.name = 'status';

                IF @constraintName IS NOT NULL
                BEGIN
                    DECLARE @sql NVARCHAR(MAX) = 'ALTER TABLE users DROP CONSTRAINT ' + @constraintName;
                    EXEC sp_executesql @sql;
                    ALTER TABLE users ADD CONSTRAINT CK_users_status CHECK (status IN ('active','pending','rejected','banned'));
                    PRINT 'Updated users.status constraint to include banned';
                END
            `);
        } catch (e) {
            console.error('Migration failed:', e);
        }

        return pool;
    })
    .catch(err => {
        console.error('❌ SQL Server connection failed:', err.message);
        process.exit(1);
    });

export { sql, poolPromise };
