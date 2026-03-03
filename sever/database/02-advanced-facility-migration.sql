-- =============================================
-- Migration Script: Advanced Facilities and Courts
-- Adds new columns for advanced facility management
-- =============================================

-- 1. ADD COLUMNS TO FACILITIES TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='facilities' AND COLUMN_NAME='phone')
BEGIN
    ALTER TABLE facilities ADD phone NVARCHAR(20);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='facilities' AND COLUMN_NAME='open_time')
BEGIN
    ALTER TABLE facilities ADD open_time TIME;
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='facilities' AND COLUMN_NAME='close_time')
BEGIN
    ALTER TABLE facilities ADD close_time TIME;
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='facilities' AND COLUMN_NAME='avatar')
BEGIN
    ALTER TABLE facilities ADD avatar NVARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='facilities' AND COLUMN_NAME='cover_image')
BEGIN
    ALTER TABLE facilities ADD cover_image NVARCHAR(500);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='facilities' AND COLUMN_NAME='gallery')
BEGIN
    ALTER TABLE facilities ADD gallery NVARCHAR(MAX); -- JSON array
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='facilities' AND COLUMN_NAME='amenities')
BEGIN
    ALTER TABLE facilities ADD amenities NVARCHAR(MAX); -- JSON array
END
GO

-- 2. ADD COLUMNS TO COURTS TABLE
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='court_type')
BEGIN
    ALTER TABLE courts ADD court_type NVARCHAR(50) DEFAULT 'outdoor';
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='surface_type')
BEGIN
    ALTER TABLE courts ADD surface_type NVARCHAR(50) DEFAULT 'hard';
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='status')
BEGIN
    ALTER TABLE courts ADD status NVARCHAR(20) DEFAULT 'active';
END
GO

-- Base price replaces price_per_hour logically, but we can reuse price_per_hour column and just add the advanced pricing columns
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='peak_start_time')
BEGIN
    ALTER TABLE courts ADD peak_start_time TIME;
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='peak_end_time')
BEGIN
    ALTER TABLE courts ADD peak_end_time TIME;
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='peak_price')
BEGIN
    ALTER TABLE courts ADD peak_price DECIMAL(12,2);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='weekend_price')
BEGIN
    ALTER TABLE courts ADD weekend_price DECIMAL(12,2);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='courts' AND COLUMN_NAME='slot_step_minutes')
BEGIN
    ALTER TABLE courts ADD slot_step_minutes INT DEFAULT 30;
END
GO

-- Drop old single 'image' column from facilities if we now have cover_image and avatar
-- However, we can preserve 'image' to avoid breaking existing frontend code that relies on f.image until refactored
-- We will just use 'image' as 'cover_image' alias where needed.

