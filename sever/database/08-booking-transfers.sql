-- =============================================
-- MIGRATION 08: Enhanced Transfer Booking
-- Creates the booking_transfers table and indexes
-- =============================================

USE pickleball_danang;
GO

-- 0. Drop old-schema booking_transfers if it was created by an earlier version of 07-booking-policy-logs.sql
--    (old schema had from_user_id/to_user_id/transfer_time but no status/sender_id/receiver_id)
IF OBJECT_ID('dbo.booking_transfers', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('booking_transfers') AND name = 'status')
BEGIN
    DROP TABLE booking_transfers;
    PRINT '✅ Old booking_transfers table removed for schema upgrade';
END
GO

-- 1. Create booking_transfers table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='booking_transfers' AND xtype='U')
BEGIN
    CREATE TABLE booking_transfers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        booking_id INT NOT NULL FOREIGN KEY REFERENCES bookings(id) ON DELETE CASCADE,
        sender_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        receiver_id INT NOT NULL FOREIGN KEY REFERENCES users(id),

        status NVARCHAR(20) DEFAULT 'pending'
            CHECK (status IN ('pending','accepted','rejected','cancelled','expired')),

        expires_at DATETIMEOFFSET NOT NULL,
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
    PRINT '✅ Table booking_transfers created';
END
ELSE
BEGIN
    PRINT '⏭  Table booking_transfers already exists';
END
GO

-- 2. Create Unique Index for Pending Transfers
-- Ensures only 1 pending transfer per booking
-- Filtered indexes require QUOTED_IDENTIFIER ON
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'unique_pending_transfer' AND object_id = OBJECT_ID('booking_transfers')
)
BEGIN
    CREATE UNIQUE INDEX unique_pending_transfer
    ON booking_transfers(booking_id)
    WHERE status = 'pending';
    PRINT '✅ Unique index unique_pending_transfer created';
END
ELSE
BEGIN
    PRINT '⏭  Index unique_pending_transfer already exists';
END
GO

-- 3. Additional Performance Indexes
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'idx_transfer_receiver' AND object_id = OBJECT_ID('booking_transfers')
)
BEGIN
    CREATE INDEX idx_transfer_receiver ON booking_transfers(receiver_id);
    PRINT '✅ Index idx_transfer_receiver created';
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'idx_transfer_booking' AND object_id = OBJECT_ID('booking_transfers')
)
BEGIN
    CREATE INDEX idx_transfer_booking ON booking_transfers(booking_id);
    PRINT '✅ Index idx_transfer_booking created';
END
GO

-- 4. Update bookings table if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('bookings') AND name = 'is_transferred')
BEGIN
    ALTER TABLE bookings ADD is_transferred BIT DEFAULT 0;
    PRINT '✅ Column is_transferred added to bookings';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('bookings') AND name = 'transferred_from_user_id')
BEGIN
    ALTER TABLE bookings ADD transferred_from_user_id INT NULL FOREIGN KEY REFERENCES users(id);
    PRINT '✅ Column transferred_from_user_id added to bookings';
END
GO

PRINT '=============================================';
PRINT 'Migration 08 (booking_transfers) completed!';
PRINT '=============================================';
GO
