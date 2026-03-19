-- =================================================================================
-- 05-sync-fixing.sql
-- Mục đích: Đồng bộ Booking & Slots qua Trigger và sửa lỗi Check Constraint Status
-- Lưu ý: Không can thiệp vào mã nguồn Node.js của phần Payment.
-- =================================================================================

USE pickleball_danang;
GO

-- 1. Cập nhật Check Constraint cho Payments để cho phép các trạng thái bạn bè dùng (như 'expired')
-- Tìm tên constraint thực tế (nếu không khớp pattern mặc định)
DECLARE @ConstraintName NVARCHAR(200);
SELECT TOP 1 @ConstraintName = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('payments') AND definition LIKE '%status%';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE payments DROP CONSTRAINT ' + @ConstraintName);
END

ALTER TABLE payments ADD CONSTRAINT CK_payments_status 
CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled', 'expired'));
GO

-- 2. Đảm bảo Bookings cũng có đủ status cần thiết
DECLARE @BkConstraintName NVARCHAR(200);
SELECT TOP 1 @BkConstraintName = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('bookings') AND definition LIKE '%status%';

IF @BkConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE bookings DROP CONSTRAINT ' + @BkConstraintName);
END

ALTER TABLE bookings ADD CONSTRAINT CK_bookings_status 
CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'expired'));
GO

-- 3. Tạo Trigger để tự động giải phóng Slot khi Booking bị Hủy hoặc Hết hạn
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'tr_Bookings_SyncSlots')
    DROP TRIGGER tr_Bookings_SyncSlots;
GO

CREATE TRIGGER tr_Bookings_SyncSlots
ON bookings
AFTER UPDATE, INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Nếu trạng thái chuyển sang 'cancelled' hoặc 'expired' -> Trả slot về is_available = 1
    IF EXISTS (SELECT 1 FROM inserted i WHERE i.status IN ('cancelled', 'expired'))
    BEGIN
        UPDATE cs
        SET cs.is_available = 1
        FROM court_slots cs
        INNER JOIN inserted i ON cs.court_id = i.court_id AND cs.slot_date = i.booking_date
        WHERE cs.start_time >= i.start_time 
          AND cs.end_time   <= i.end_time
          AND i.status IN ('cancelled', 'expired');
    END

    -- Nếu booking mới được tạo ở trạng thái 'pending' hoặc 'confirmed' -> Đánh dấu slot is_available = 0
    -- (Dành cho trường hợp code INSERT không chủ động update slot)
    IF EXISTS (SELECT 1 FROM inserted i WHERE i.status IN ('pending', 'confirmed'))
    BEGIN
        UPDATE cs
        SET cs.is_available = 0
        FROM court_slots cs
        INNER JOIN inserted i ON cs.court_id = i.court_id AND cs.slot_date = i.booking_date
        WHERE cs.start_time >= i.start_time 
          AND cs.end_time   <= i.end_time
          AND i.status IN ('pending', 'confirmed');
    END
END
GO

-- 4. Dọn dẹp dữ liệu kẹt hiện tại
-- Giải phóng slot cho các booking đã bị hủy hoặc hết hạn từ trước
UPDATE cs
SET cs.is_available = 1
FROM court_slots cs
INNER JOIN bookings b ON cs.court_id = b.court_id AND cs.slot_date = b.booking_date
WHERE b.status IN ('cancelled', 'expired')
  AND cs.is_available = 0
  AND cs.start_time >= b.start_time 
  AND cs.end_time   <= b.end_time;

-- Đảm bảo các booking confirmed/pending hiện tại đã chiếm slot
UPDATE cs
SET cs.is_available = 0
FROM court_slots cs
INNER JOIN bookings b ON cs.court_id = b.court_id AND cs.slot_date = b.booking_date
WHERE b.status IN ('confirmed', 'pending')
  AND cs.is_available = 1
  AND cs.start_time >= b.start_time 
  AND cs.end_time   <= b.end_time;
GO

PRINT 'Database Sync Trigger and Constraints updated successfully!';
GO
