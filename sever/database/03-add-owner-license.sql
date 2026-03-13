-- Add business license URL and verification flag to users
IF EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'business_license_url')
        ALTER TABLE users ADD business_license_url NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'is_verified')
        ALTER TABLE users ADD is_verified BIT DEFAULT 0;
END
GO
