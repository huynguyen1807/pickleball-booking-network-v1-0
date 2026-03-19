-- =============================================
-- MIGRATION 03: Payment Status Constraint Update
-- Adds 'cancelled' and 'expired' to payments.status
-- Also ensures transaction_id column exists
-- Run: npm run migrate:payment-status
-- =============================================

USE pickleball_danang;
GO

-- ─────────────────────────────────────────────
-- 1. Add transaction_id column (idempotent)
-- ─────────────────────────────────────────────
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('payments') AND name = 'transaction_id'
)
BEGIN
    ALTER TABLE payments ADD transaction_id NVARCHAR(100) NULL;
    PRINT '✅ Column transaction_id added';
END
ELSE
    PRINT '⏭  transaction_id already exists';
GO

-- Unique index on transaction_id (idempotent)
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_payments_transaction_id' AND object_id = OBJECT_ID('payments')
)
BEGIN
    CREATE UNIQUE INDEX IX_payments_transaction_id
        ON payments(transaction_id)
        WHERE transaction_id IS NOT NULL;
    PRINT '✅ Unique index IX_payments_transaction_id created';
END
ELSE
    PRINT '⏭  Index IX_payments_transaction_id already exists';
GO

-- ─────────────────────────────────────────────
-- 2. Drop old payments.status CHECK constraint
--    (was: pending/completed/failed/refunded)
--    (new: + cancelled + expired)
-- ─────────────────────────────────────────────
DECLARE @constraintName NVARCHAR(200);

SELECT @constraintName = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('payments')
    AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('payments'), 'status', 'ColumnId');

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE payments DROP CONSTRAINT [' + @constraintName + ']');
    PRINT '✅ Old constraint dropped: ' + @constraintName;
END
ELSE
    PRINT '⏭  No existing payments.status constraint found';
GO

-- ─────────────────────────────────────────────
-- 3. Add updated constraint with all statuses
-- ─────────────────────────────────────────────
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('payments')
      AND name = 'CK_payments_status'
)
BEGIN
    ALTER TABLE payments ADD CONSTRAINT CK_payments_status
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled', 'expired'));
    PRINT '✅ New CK_payments_status constraint added';
END
ELSE
    PRINT '⏭  CK_payments_status already exists';
GO

-- ─────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────
SELECT name, definition
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('payments');
GO
