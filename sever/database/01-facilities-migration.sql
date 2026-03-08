-- Create facilities table if not exists
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='facilities' AND xtype='U')
BEGIN
    CREATE TABLE facilities (
        id INT IDENTITY(1,1) PRIMARY KEY,
        owner_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        name NVARCHAR(200) NOT NULL,
        address NVARCHAR(500) NOT NULL,
        description NVARCHAR(MAX),
        image NVARCHAR(500),
        is_active BIT DEFAULT 1,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END
GO

-- If facility_id does not exist in courts, add it
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'courts' AND COLUMN_NAME = 'facility_id'
)
BEGIN
    ALTER TABLE courts ADD facility_id INT;
END
GO

-- Migrate data: For each owner who has courts, create one default facility if it doesn't exist
INSERT INTO facilities (owner_id, name, address, description, is_active)
SELECT DISTINCT owner_id, N'Cơ sở Pickleball ' + u.full_name, c.address, c.description, 1
FROM courts c
JOIN users u ON c.owner_id = u.id
WHERE NOT EXISTS (
    SELECT 1 FROM facilities f WHERE f.owner_id = c.owner_id
);
GO

-- Update courts facility_id
UPDATE courts
SET facility_id = f.id
FROM courts c
JOIN facilities f ON c.owner_id = f.owner_id
WHERE c.facility_id IS NULL;
GO

-- Now make facility_id NOT NULL and add foreign key
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='facility_id' AND IS_NULLABLE='YES')
BEGIN
    ALTER TABLE courts ALTER COLUMN facility_id INT NOT NULL;
    ALTER TABLE courts ADD CONSTRAINT FK_courts_facilities FOREIGN KEY (facility_id) REFERENCES facilities(id);
END
GO

-- We can drop owner_id, address, and description from courts, but we need to drop foreign key constraint on owner_id first.
DECLARE @fkName NVARCHAR(200);
SELECT @fkName = name 
FROM sys.foreign_keys 
WHERE parent_object_id = OBJECT_ID('courts') 
AND parent_column_id IN (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('courts') AND name = 'owner_id');

IF @fkName IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX) = 'ALTER TABLE courts DROP CONSTRAINT ' + @fkName;
    EXEC sp_executesql @sql;
END
GO

-- Finally drop owner_id, address, description
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='owner_id')
BEGIN
    ALTER TABLE courts DROP COLUMN owner_id;
END
GO

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='address')
BEGIN
    ALTER TABLE courts DROP COLUMN address;
END
GO

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='description')
BEGIN
    ALTER TABLE courts DROP COLUMN description;
END
GO
