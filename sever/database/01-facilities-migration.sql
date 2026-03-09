-- Always run migration in the project database
IF DB_ID('pickleball_danang') IS NULL
BEGIN
    RAISERROR('Database pickleball_danang does not exist. Run schema.sql first.', 16, 1);
    RETURN;
END
GO
 
USE pickleball_danang;
GO
 
-- Preconditions for old schema -> new schema migration
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    RAISERROR('Table users not found in pickleball_danang. Run schema.sql first.', 16, 1);
    RETURN;
END
GO
 
IF OBJECT_ID('dbo.courts', 'U') IS NULL
BEGIN
    RAISERROR('Table courts not found in pickleball_danang. Run schema.sql first.', 16, 1);
    RETURN;
END
GO
 
-- Create facilities table if not exists
IF OBJECT_ID('dbo.facilities', 'U') IS NULL
BEGIN
    CREATE TABLE facilities (
        id INT IDENTITY(1,1) PRIMARY KEY,
        owner_id INT NOT NULL,
        name NVARCHAR(200) NOT NULL,
        address NVARCHAR(500) NOT NULL,
        description NVARCHAR(MAX),
        image NVARCHAR(500),
        is_active BIT DEFAULT 1,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_facilities_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
END
GO
 
-- If facility_id does not exist in courts, add it
IF COL_LENGTH('dbo.courts', 'facility_id') IS NULL
BEGIN
    ALTER TABLE courts ADD facility_id INT NULL;
END
GO
 
-- Migrate only when old columns still exist
IF COL_LENGTH('dbo.courts', 'owner_id') IS NOT NULL
   AND COL_LENGTH('dbo.courts', 'address') IS NOT NULL
   AND COL_LENGTH('dbo.courts', 'description') IS NOT NULL
BEGIN
    DECLARE @migrateSql NVARCHAR(MAX) = N'
        INSERT INTO facilities (owner_id, name, address, description, is_active)
        SELECT DISTINCT c.owner_id, N''Co so Pickleball '' + u.full_name, c.address, c.description, 1
        FROM courts c
        JOIN users u ON c.owner_id = u.id
        WHERE NOT EXISTS (
            SELECT 1 FROM facilities f WHERE f.owner_id = c.owner_id
        );
 
        UPDATE c
        SET c.facility_id = f.id
        FROM courts c
        JOIN facilities f ON c.owner_id = f.owner_id
        WHERE c.facility_id IS NULL;
    ';
 
    EXEC sp_executesql @migrateSql;
END
GO
 
-- Add FK if missing
IF COL_LENGTH('dbo.courts', 'facility_id') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_courts_facilities'
         AND parent_object_id = OBJECT_ID('dbo.courts')
   )
BEGIN
    ALTER TABLE courts ADD CONSTRAINT FK_courts_facilities
        FOREIGN KEY (facility_id) REFERENCES facilities(id);
END
GO
 
-- Make facility_id NOT NULL only after data backfill
IF COL_LENGTH('dbo.courts', 'facility_id') IS NOT NULL
   AND EXISTS (SELECT 1 FROM courts WHERE facility_id IS NULL)
BEGIN
    RAISERROR('courts.facility_id still has NULL values. Data backfill incomplete.', 16, 1);
    RETURN;
END
GO
 
IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'courts'
      AND COLUMN_NAME = 'facility_id'
      AND IS_NULLABLE = 'YES'
)
BEGIN
    ALTER TABLE courts ALTER COLUMN facility_id INT NOT NULL;
END
GO
 
-- Drop FK(s) that reference courts.owner_id (old schema)
DECLARE @dropSql NVARCHAR(MAX) = N'';
 
SELECT @dropSql = @dropSql +
    N'ALTER TABLE [dbo].[courts] DROP CONSTRAINT [' + fk.name + N'];' + CHAR(10)
FROM sys.foreign_key_columns fkc
JOIN sys.foreign_keys fk
    ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns c
    ON c.object_id = fkc.parent_object_id
   AND c.column_id = fkc.parent_column_id
WHERE fkc.parent_object_id = OBJECT_ID('dbo.courts')
  AND c.name = 'owner_id';
 
IF LEN(@dropSql) > 0
BEGIN
    EXEC sp_executesql @dropSql;
END
GO
 
-- Finally drop old columns if they still exist
IF COL_LENGTH('dbo.courts', 'owner_id') IS NOT NULL
BEGIN
    ALTER TABLE courts DROP COLUMN owner_id;
END
GO
 
IF COL_LENGTH('dbo.courts', 'address') IS NOT NULL
BEGIN
    ALTER TABLE courts DROP COLUMN address;
END
GO
 
IF COL_LENGTH('dbo.courts', 'description') IS NOT NULL
BEGIN
    ALTER TABLE courts DROP COLUMN description;
END
GO
 