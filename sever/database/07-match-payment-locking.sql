IF OBJECT_ID('dbo.matches', 'U') IS NULL
   OR OBJECT_ID('dbo.bookings', 'U') IS NULL
   OR OBJECT_ID('dbo.payments', 'U') IS NULL
   OR OBJECT_ID('dbo.match_players', 'U') IS NULL
BEGIN
    RAISERROR('Required tables for migration 07 are missing. Run schema.sql first in the target database.', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('matches') AND name = 'booking_id')
    ALTER TABLE matches ADD booking_id INT NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('matches') AND name = 'min_players')
    ALTER TABLE matches ADD min_players INT NOT NULL CONSTRAINT DF_matches_min_players_v2 DEFAULT(2);
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_key_columns fkc
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fkc.parent_object_id = OBJECT_ID('dbo.matches')
      AND c.name = 'booking_id'
)
    ALTER TABLE matches ADD CONSTRAINT FK_matches_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('payments') AND name = 'refunded_amount')
    ALTER TABLE payments ADD refunded_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_payments_refunded_amount_v2 DEFAULT(0);
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('payments') AND name = 'payment_context')
    ALTER TABLE payments ADD payment_context NVARCHAR(50) NOT NULL CONSTRAINT DF_payments_payment_context_v2 DEFAULT('booking');
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('payments') AND name = 'payment_link_id')
    ALTER TABLE payments ADD payment_link_id NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('payments') AND name = 'order_code')
    ALTER TABLE payments ADD order_code BIGINT NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('payments') AND name = 'expires_at')
    ALTER TABLE payments ADD expires_at DATETIMEOFFSET NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('bookings') AND name = 'payment_method')
    ALTER TABLE bookings ADD payment_method NVARCHAR(50) NULL;
GO

DECLARE @constraintName NVARCHAR(200);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Booking_Status' AND parent_object_id = OBJECT_ID('bookings'))
    ALTER TABLE bookings DROP CONSTRAINT CHK_Booking_Status;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_bookings_status_v2' AND parent_object_id = OBJECT_ID('bookings'))
    ALTER TABLE bookings DROP CONSTRAINT CK_bookings_status_v2;

WHILE 1 = 1
BEGIN
        SET @constraintName = NULL;
        SELECT TOP 1 @constraintName = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('bookings')
            AND cc.definition LIKE '%[[]status[]]%';

        IF @constraintName IS NULL BREAK;
        EXEC('ALTER TABLE bookings DROP CONSTRAINT [' + @constraintName + ']');
END
GO

ALTER TABLE bookings
ADD CONSTRAINT CK_bookings_status_v2
CHECK (status IN ('pending','payment_pending','confirmed','cancelled','completed','expired','transferred'));
GO

DECLARE @constraintName NVARCHAR(200);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_matches_status_v3' AND parent_object_id = OBJECT_ID('matches'))
    ALTER TABLE matches DROP CONSTRAINT CK_matches_status_v3;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_matches_status_v2' AND parent_object_id = OBJECT_ID('matches'))
    ALTER TABLE matches DROP CONSTRAINT CK_matches_status_v2;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_matches_status' AND parent_object_id = OBJECT_ID('matches'))
    ALTER TABLE matches DROP CONSTRAINT CK_matches_status;

WHILE 1 = 1
BEGIN
        SET @constraintName = NULL;
        SELECT TOP 1 @constraintName = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('matches')
            AND cc.definition LIKE '%[[]status[]]%';

        IF @constraintName IS NULL BREAK;
        EXEC('ALTER TABLE matches DROP CONSTRAINT [' + @constraintName + ']');
END
GO

ALTER TABLE matches
ADD CONSTRAINT CK_matches_status_v3
CHECK (status IN ('waiting','pending_host_payment','open','full','confirmed','completed','finished','cancelled','expired'));
GO

DECLARE @constraintName NVARCHAR(200);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_match_players_payment_status_v3' AND parent_object_id = OBJECT_ID('match_players'))
    ALTER TABLE match_players DROP CONSTRAINT CK_match_players_payment_status_v3;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_match_players_payment_status_v2' AND parent_object_id = OBJECT_ID('match_players'))
    ALTER TABLE match_players DROP CONSTRAINT CK_match_players_payment_status_v2;

WHILE 1 = 1
BEGIN
        SET @constraintName = NULL;
        SELECT TOP 1 @constraintName = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('match_players')
            AND (
                cc.parent_column_id = COLUMNPROPERTY(OBJECT_ID('match_players'), 'payment_status', 'ColumnId')
                OR cc.definition LIKE '%[[]payment_status[]]%'
                OR cc.definition LIKE '%payment_status%'
            );

        IF @constraintName IS NULL BREAK;
        EXEC('ALTER TABLE match_players DROP CONSTRAINT [' + @constraintName + ']');
END
GO

ALTER TABLE match_players
ADD CONSTRAINT CK_match_players_payment_status_v3
CHECK (payment_status IN ('pending','paid','failed','expired','cancelled','refunded','partial_refunded'));
GO

DECLARE @constraintName NVARCHAR(200);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_match_players_status' AND parent_object_id = OBJECT_ID('match_players'))
    ALTER TABLE match_players DROP CONSTRAINT CK_match_players_status;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_match_players_status_v3' AND parent_object_id = OBJECT_ID('match_players'))
    ALTER TABLE match_players DROP CONSTRAINT CK_match_players_status_v3;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_match_players_status_v2' AND parent_object_id = OBJECT_ID('match_players'))
    ALTER TABLE match_players DROP CONSTRAINT CK_match_players_status_v2;

WHILE 1 = 1
BEGIN
        SET @constraintName = NULL;
        SELECT TOP 1 @constraintName = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('match_players')
            AND cc.definition LIKE '%[[]status[]]%'
            AND cc.definition NOT LIKE '%[[]payment_status[]]%';

        IF @constraintName IS NULL BREAK;
        EXEC('ALTER TABLE match_players DROP CONSTRAINT [' + @constraintName + ']');
END
GO

ALTER TABLE match_players
ADD CONSTRAINT CK_match_players_status_v3
CHECK (status IN ('payment_pending','joined','waitlist','left','expired'));
GO

DECLARE @constraintName NVARCHAR(200);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_payments_status_v3' AND parent_object_id = OBJECT_ID('payments'))
    ALTER TABLE payments DROP CONSTRAINT CK_payments_status_v3;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_payments_status_v2' AND parent_object_id = OBJECT_ID('payments'))
    ALTER TABLE payments DROP CONSTRAINT CK_payments_status_v2;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_payments_status' AND parent_object_id = OBJECT_ID('payments'))
    ALTER TABLE payments DROP CONSTRAINT CK_payments_status;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Payment_Status' AND parent_object_id = OBJECT_ID('payments'))
    ALTER TABLE payments DROP CONSTRAINT CHK_Payment_Status;

WHILE 1 = 1
BEGIN
        SET @constraintName = NULL;
        SELECT TOP 1 @constraintName = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('payments')
            AND cc.definition LIKE '%[[]status[]]%';

        IF @constraintName IS NULL BREAK;
        EXEC('ALTER TABLE payments DROP CONSTRAINT [' + @constraintName + ']');
END
GO

ALTER TABLE payments
ADD CONSTRAINT CK_payments_status_v3
CHECK (status IN ('pending','completed','failed','refunded','partial_refunded','refund_pending','cancelled','expired'));
GO