-- =============================================
-- ADD TRANSACTION_ID COLUMN TO PAYMENTS TABLE
-- =============================================

USE pickleball_danang;
GO

-- Check if column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('payments') 
    AND name = 'transaction_id'
)
BEGIN
    ALTER TABLE payments
    ADD transaction_id NVARCHAR(100) NULL;
    
    PRINT 'Column transaction_id added successfully';
END
ELSE
BEGIN
    PRINT 'Column transaction_id already exists';
END
GO

-- Add unique constraint if not exists
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_payments_transaction_id' 
    AND object_id = OBJECT_ID('payments')
)
BEGIN
    CREATE UNIQUE INDEX IX_payments_transaction_id 
    ON payments(transaction_id) 
    WHERE transaction_id IS NOT NULL;
    
    PRINT 'Unique index IX_payments_transaction_id created successfully';
END
ELSE
BEGIN
    PRINT 'Index IX_payments_transaction_id already exists';
END
GO

-- Verify
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'transaction_id';
GO

PRINT 'Migration completed successfully!';
