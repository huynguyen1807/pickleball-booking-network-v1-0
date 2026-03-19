-- ============================================================
-- 04-seed-court-slots.sql
-- Tự động sinh các slot 30 phút cho tất cả sân active
-- trong khoảng từ hôm nay đến 30 ngày tới
-- Chạy lại nhiều lần vẫn an toàn (idempotent)
-- ============================================================

DECLARE @startDate DATE = CAST(GETDATE() AS DATE)
DECLARE @endDate   DATE = DATEADD(DAY, 30, @startDate)
DECLARE @slotStep  INT  = 30  -- phút

-- Xóa slot cũ hơn 7 ngày (quá khứ) để DB không phình to
DELETE FROM court_slots WHERE slot_date < DATEADD(DAY, -7, @startDate)
GO

DECLARE @startDate DATE = CAST(GETDATE() AS DATE)
DECLARE @endDate   DATE = DATEADD(DAY, 30, @startDate)
DECLARE @slotStep  INT  = 30

DECLARE @courtId    INT
DECLARE @openTime   VARCHAR(10)
DECLARE @closeTime  VARCHAR(10)
DECLARE @currentDate DATE
DECLARE @slotStart  TIME
DECLARE @slotEnd    TIME

-- Cursor duyệt qua tất cả facility có thông tin giờ
DECLARE court_cursor CURSOR FOR
    SELECT c.id,
           ISNULL(f.open_time, '06:00')  AS open_time,
           ISNULL(f.close_time, '22:00') AS close_time
    FROM courts c
    JOIN facilities f ON c.facility_id = f.id
    WHERE c.is_active = 1

OPEN court_cursor
FETCH NEXT FROM court_cursor INTO @courtId, @openTime, @closeTime

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @currentDate = @startDate

    WHILE @currentDate <= @endDate
    BEGIN
        SET @slotStart = CAST(@openTime AS TIME)

        WHILE @slotStart < CAST(@closeTime AS TIME)
        BEGIN
            SET @slotEnd = DATEADD(MINUTE, @slotStep, CAST(@slotStart AS DATETIME))

            -- Chỉ insert nếu chưa tồn tại (idempotent)
            IF NOT EXISTS (
                SELECT 1 FROM court_slots
                WHERE court_id  = @courtId
                  AND slot_date = @currentDate
                  AND start_time = @slotStart
            )
            BEGIN
                INSERT INTO court_slots (court_id, slot_date, start_time, end_time, is_available)
                VALUES (@courtId, @currentDate, @slotStart, @slotEnd, 1)
            END

            SET @slotStart = CAST(@slotEnd AS TIME)
        END

        SET @currentDate = DATEADD(DAY, 1, @currentDate)
    END

    FETCH NEXT FROM court_cursor INTO @courtId, @openTime, @closeTime
END

CLOSE court_cursor
DEALLOCATE court_cursor

-- Đánh dấu lại các slot đã có booking confirmed/pending
UPDATE cs
SET cs.is_available = 0
FROM court_slots cs
JOIN bookings b
    ON  b.court_id     = cs.court_id
    AND b.booking_date = cs.slot_date
    AND b.start_time  <= cs.start_time
    AND b.end_time    >= cs.end_time
    AND b.status IN ('confirmed', 'pending')
GO

PRINT 'Seed court_slots hoàn thành!'
GO
