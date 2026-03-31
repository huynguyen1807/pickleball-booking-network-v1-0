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

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='booking_transfers' AND xtype='U')
CREATE TABLE booking_transfers (
  id INT IDENTITY(1,1) PRIMARY KEY,
  booking_id INT NOT NULL FOREIGN KEY REFERENCES bookings(id),
  from_user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  to_user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  transfer_time DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- Update Check Constraint for bookings.status
DECLARE @SQL VARCHAR(MAX)='';
SELECT @SQL = 'ALTER TABLE bookings DROP CONSTRAINT ' + name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('bookings') AND definition LIKE '%pending%confirmed%cancelled%completed%';

IF LEN(@SQL) > 0 EXEC(@SQL);
GO
-- Add back if not exists explicitly or we just leave it without constraint to run.
-- It's safer to just drop and add again.
ALTER TABLE bookings
ADD CONSTRAINT CHK_Booking_Status 
CHECK (status IN ('pending','confirmed','cancelled','completed','transferred'));
GO

-- Update Check Constraint for payments.status
DECLARE @SQL2 VARCHAR(MAX)='';
SELECT @SQL2 = 'ALTER TABLE payments DROP CONSTRAINT ' + name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('payments') AND definition LIKE '%pending%completed%failed%refunded%cancelled%expired%';

IF LEN(@SQL2) > 0 EXEC(@SQL2);
GO
ALTER TABLE payments
ADD CONSTRAINT CHK_Payment_Status 
CHECK (status IN ('pending','completed','failed','refunded','refund_pending','cancelled','expired'));
GO
