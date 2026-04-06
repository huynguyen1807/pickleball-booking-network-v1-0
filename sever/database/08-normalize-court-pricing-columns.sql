IF OBJECT_ID('dbo.courts', 'U') IS NULL
BEGIN
    RAISERROR('Table courts not found in current database. Run schema.sql first in the target database.', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='courts' AND COLUMN_NAME='peak_price'
)
BEGIN
    ALTER TABLE courts ADD peak_price DECIMAL(12,2) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='courts' AND COLUMN_NAME='weekend_price'
)
BEGIN
    ALTER TABLE courts ADD weekend_price DECIMAL(12,2) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='courts' AND COLUMN_NAME='min_booking_minutes'
)
BEGIN
    ALTER TABLE courts ADD min_booking_minutes INT NULL;
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sub_courts' AND COLUMN_NAME='peak_price'
    )
    BEGIN
        ALTER TABLE sub_courts ADD peak_price DECIMAL(12,2) NULL;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sub_courts' AND COLUMN_NAME='weekend_price'
    )
    BEGIN
        ALTER TABLE sub_courts ADD weekend_price DECIMAL(12,2) NULL;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sub_courts' AND COLUMN_NAME='min_booking_minutes'
    )
    BEGIN
        ALTER TABLE sub_courts ADD min_booking_minutes INT NULL;
    END
END
GO

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='courts' AND COLUMN_NAME='peak_price_per_hour'
)
BEGIN
    UPDATE courts
    SET peak_price = COALESCE(peak_price, peak_price_per_hour, 0)
    WHERE peak_price IS NULL;
END
ELSE
BEGIN
    UPDATE courts
    SET peak_price = COALESCE(peak_price, 0)
    WHERE peak_price IS NULL;
END
GO

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='courts' AND COLUMN_NAME='weekend_price_per_hour'
)
BEGIN
    UPDATE courts
    SET weekend_price = COALESCE(weekend_price, weekend_price_per_hour, 0)
    WHERE weekend_price IS NULL;
END
ELSE
BEGIN
    UPDATE courts
    SET weekend_price = COALESCE(weekend_price, 0)
    WHERE weekend_price IS NULL;
END
GO

UPDATE courts
SET min_booking_minutes = COALESCE(min_booking_minutes, 30)
WHERE min_booking_minutes IS NULL;
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sub_courts' AND COLUMN_NAME='peak_price_per_hour'
    )
    BEGIN
        UPDATE sub_courts
        SET peak_price = COALESCE(peak_price, peak_price_per_hour, 0)
        WHERE peak_price IS NULL;
    END
    ELSE
    BEGIN
        UPDATE sub_courts
        SET peak_price = COALESCE(peak_price, 0)
        WHERE peak_price IS NULL;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sub_courts' AND COLUMN_NAME='weekend_price_per_hour'
    )
    BEGIN
        UPDATE sub_courts
        SET weekend_price = COALESCE(weekend_price, weekend_price_per_hour, 0)
        WHERE weekend_price IS NULL;
    END
    ELSE
    BEGIN
        UPDATE sub_courts
        SET weekend_price = COALESCE(weekend_price, 0)
        WHERE weekend_price IS NULL;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    UPDATE sub_courts
    SET min_booking_minutes = COALESCE(min_booking_minutes, 30)
    WHERE min_booking_minutes IS NULL;
END
GO

ALTER TABLE courts ALTER COLUMN peak_price DECIMAL(12,2) NOT NULL;
GO
ALTER TABLE courts ALTER COLUMN weekend_price DECIMAL(12,2) NOT NULL;
GO
ALTER TABLE courts ALTER COLUMN min_booking_minutes INT NOT NULL;
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    ALTER TABLE sub_courts ALTER COLUMN peak_price DECIMAL(12,2) NOT NULL;
END
GO
IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    ALTER TABLE sub_courts ALTER COLUMN weekend_price DECIMAL(12,2) NOT NULL;
END
GO
IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    ALTER TABLE sub_courts ALTER COLUMN min_booking_minutes INT NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.courts') AND c.name = 'peak_price'
)
BEGIN
    ALTER TABLE courts ADD CONSTRAINT DF_courts_peak_price DEFAULT 0 FOR peak_price;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.courts') AND c.name = 'weekend_price'
)
BEGIN
    ALTER TABLE courts ADD CONSTRAINT DF_courts_weekend_price DEFAULT 0 FOR weekend_price;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.courts') AND c.name = 'min_booking_minutes'
)
BEGIN
    ALTER TABLE courts ADD CONSTRAINT DF_courts_min_booking_minutes DEFAULT 30 FOR min_booking_minutes;
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.sub_courts') AND c.name = 'peak_price'
    )
    BEGIN
        ALTER TABLE sub_courts ADD CONSTRAINT DF_sub_courts_peak_price DEFAULT 0 FOR peak_price;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.sub_courts') AND c.name = 'weekend_price'
    )
    BEGIN
        ALTER TABLE sub_courts ADD CONSTRAINT DF_sub_courts_weekend_price DEFAULT 0 FOR weekend_price;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.sub_courts') AND c.name = 'min_booking_minutes'
    )
    BEGIN
        ALTER TABLE sub_courts ADD CONSTRAINT DF_sub_courts_min_booking_minutes DEFAULT 30 FOR min_booking_minutes;
    END
END
GO

DECLARE @constraintName SYSNAME;

WHILE 1 = 1
BEGIN
        SELECT TOP 1 @constraintName = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.courts')
            AND c.name IN ('peak_price_per_hour', 'weekend_price_per_hour');

        IF @constraintName IS NULL
                BREAK;

        EXEC('ALTER TABLE courts DROP CONSTRAINT [' + @constraintName + ']');
        SET @constraintName = NULL;
END
GO

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='courts' AND COLUMN_NAME='peak_price_per_hour'
)
BEGIN
    ALTER TABLE courts DROP COLUMN peak_price_per_hour;
END
GO

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='courts' AND COLUMN_NAME='weekend_price_per_hour'
)
BEGIN
    ALTER TABLE courts DROP COLUMN weekend_price_per_hour;
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    DECLARE @subConstraintName SYSNAME;

    WHILE 1 = 1
    BEGIN
        SELECT TOP 1 @subConstraintName = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.sub_courts')
          AND c.name IN ('peak_price_per_hour', 'weekend_price_per_hour');

        IF @subConstraintName IS NULL
            BREAK;

        EXEC('ALTER TABLE sub_courts DROP CONSTRAINT [' + @subConstraintName + ']');
        SET @subConstraintName = NULL;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sub_courts' AND COLUMN_NAME='peak_price_per_hour'
    )
    BEGIN
        ALTER TABLE sub_courts DROP COLUMN peak_price_per_hour;
    END
END
GO

IF OBJECT_ID('dbo.sub_courts', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='sub_courts' AND COLUMN_NAME='weekend_price_per_hour'
    )
    BEGIN
        ALTER TABLE sub_courts DROP COLUMN weekend_price_per_hour;
    END
END
GO
