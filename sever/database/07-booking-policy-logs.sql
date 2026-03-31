-- =============================================
-- Migration: Booking Policy Logs & Status Updates
-- =============================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='booking_cancellations' AND xtype='U')
CREATE TABLE booking_cancellations (
  id INT IDENTITY(1,1) PRIMARY KEY,
  booking_id INT NOT NULL FOREIGN KEY REFERENCES bookings(id),
  cancel_time DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
  refund_percent INT DEFAULT 0,
  refund_amount DECIMAL(12,2) DEFAULT 0
);
GO

-- Update Check Constraint for bookings.status
WHILE EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('bookings') AND name LIKE '%status%')
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT TOP 1 @ConstraintName = name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('bookings') AND name LIKE '%status%';
    EXEC('ALTER TABLE bookings DROP CONSTRAINT ' + @ConstraintName);
END
GO

-- Add back if not exists explicitly or we just leave it without constraint to run.
-- It's safer to just drop and add again.
ALTER TABLE bookings
ADD CONSTRAINT CHK_Booking_Status 
CHECK (status IN ('pending','payment_pending','confirmed','cancelled','completed','expired','transferred'));
GO

-- Update Check Constraint for payments.status
WHILE EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('payments') AND name LIKE '%status%')
BEGIN
    DECLARE @ConstraintName2 NVARCHAR(200);
    SELECT TOP 1 @ConstraintName2 = name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('payments') AND name LIKE '%status%';
    EXEC('ALTER TABLE payments DROP CONSTRAINT ' + @ConstraintName2);
END
GO
ALTER TABLE payments
ADD CONSTRAINT CHK_Payment_Status 
CHECK (status IN ('pending','completed','failed','refunded','partial_refunded','refund_pending','cancelled','expired'));
GO

