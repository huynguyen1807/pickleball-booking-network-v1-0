USE pickleball_danang;
GO

IF OBJECT_ID('users', 'U') IS NULL
BEGIN
    RAISERROR('Table users does not exist.', 16, 1);
    RETURN;
END
GO

IF OBJECT_ID('payments', 'U') IS NULL
BEGIN
    RAISERROR('Table payments does not exist.', 16, 1);
    RETURN;
END
GO

-- 1) Add users.balance for internal wallet refund
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'balance'
)
BEGIN
    ALTER TABLE users
    ADD balance DECIMAL(12,2) NOT NULL CONSTRAINT DF_users_balance DEFAULT(0);
    PRINT 'Added users.balance';
END
ELSE
BEGIN
    PRINT 'users.balance already exists';
END
GO

-- 2) Wallet transaction ledger table
IF OBJECT_ID('wallet_transactions', 'U') IS NULL
BEGIN
    CREATE TABLE wallet_transactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        payment_id INT NULL FOREIGN KEY REFERENCES payments(id),
        amount DECIMAL(12,2) NOT NULL,
        type NVARCHAR(20) NOT NULL CHECK (type IN ('refund','withdrawal','adjustment')),
        description NVARCHAR(255),
        reference_type NVARCHAR(50),
        reference_id INT,
        status NVARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
        created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );

    PRINT 'Created wallet_transactions';
END
ELSE
BEGIN
    PRINT 'wallet_transactions already exists';
END
GO

-- 3) Helpful index
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_wallet_transactions_user_created'
      AND object_id = OBJECT_ID('wallet_transactions')
)
BEGIN
    CREATE INDEX IX_wallet_transactions_user_created
    ON wallet_transactions(user_id, created_at DESC);

    PRINT 'Created IX_wallet_transactions_user_created';
END
ELSE
BEGIN
    PRINT 'IX_wallet_transactions_user_created already exists';
END
GO
