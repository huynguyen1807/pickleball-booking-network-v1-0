USE pickleball_danang;
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'owner_debt_balance'
)
BEGIN
    ALTER TABLE users
    ADD owner_debt_balance DECIMAL(12,2) NOT NULL CONSTRAINT DF_users_owner_debt_balance DEFAULT(0);

    PRINT 'Added users.owner_debt_balance';
END
ELSE
BEGIN
    PRINT 'users.owner_debt_balance already exists';
END
GO

IF OBJECT_ID('payment_refund_reversals', 'U') IS NULL
BEGIN
    CREATE TABLE payment_refund_reversals (
        id INT IDENTITY(1,1) PRIMARY KEY,
        payment_id INT NOT NULL,
        booking_id INT NULL,
        match_id INT NULL,
        owner_id INT NULL,
        refund_amount DECIMAL(12,2) NOT NULL,
        admin_reversal DECIMAL(12,2) NOT NULL,
        owner_reversal DECIMAL(12,2) NOT NULL,
        owner_payout_state NVARCHAR(20) NOT NULL DEFAULT 'not_paid_out'
            CHECK (owner_payout_state IN ('not_paid_out', 'paid_out')),
        note NVARCHAR(255) NULL,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT UQ_payment_refund_reversals_payment UNIQUE (payment_id),
        CONSTRAINT FK_payment_refund_reversals_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
        CONSTRAINT FK_payment_refund_reversals_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
        CONSTRAINT FK_payment_refund_reversals_match FOREIGN KEY (match_id) REFERENCES matches(id),
        CONSTRAINT FK_payment_refund_reversals_owner FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    PRINT 'Created payment_refund_reversals';
END
ELSE
BEGIN
    PRINT 'payment_refund_reversals already exists';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_payment_refund_reversals_owner_created'
      AND object_id = OBJECT_ID('payment_refund_reversals')
)
BEGIN
    CREATE INDEX IX_payment_refund_reversals_owner_created
    ON payment_refund_reversals(owner_id, created_at DESC);

    PRINT 'Created IX_payment_refund_reversals_owner_created';
END
ELSE
BEGIN
    PRINT 'IX_payment_refund_reversals_owner_created already exists';
END
GO
