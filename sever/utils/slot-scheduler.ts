import cron from 'node-cron';
import { poolPromise, sql } from '../config/db';

export const generateSlotsFor30thDay = async () => {
    console.log('[Scheduler] Đang chạy tác vụ tự động sinh slot cho ngày thứ 30...');
    try {
        const pool = await poolPromise;
            // Generate slots for the 30th day from today
            await pool.request().query(`
                DECLARE @targetDate DATE = DATEADD(DAY, 30, CAST(GETDATE() AS DATE));
                DECLARE @slotStep  INT  = 30;

                DECLARE @courtId    INT;
                DECLARE @openTime   VARCHAR(10);
                DECLARE @closeTime  VARCHAR(10);
                DECLARE @slotStart  TIME;
                DECLARE @slotEnd    TIME;

                DECLARE court_cursor CURSOR FOR
                    SELECT c.id,
                           ISNULL(f.open_time, '06:00')  AS open_time,
                           ISNULL(f.close_time, '22:00') AS close_time
                    FROM courts c
                    JOIN facilities f ON c.facility_id = f.id
                    WHERE c.is_active = 1;

                OPEN court_cursor;
                FETCH NEXT FROM court_cursor INTO @courtId, @openTime, @closeTime;

                WHILE @@FETCH_STATUS = 0
                BEGIN
                    SET @slotStart = CAST(@openTime AS TIME);

                    WHILE @slotStart < CAST(@closeTime AS TIME)
                    BEGIN
                        SET @slotEnd = DATEADD(MINUTE, @slotStep, CAST(@slotStart AS DATETIME));

                        -- Chỉ insert nếu chưa tồn tại
                        IF NOT EXISTS (
                            SELECT 1 FROM court_slots
                            WHERE court_id  = @courtId
                              AND slot_date = @targetDate
                              AND start_time = @slotStart
                        )
                        BEGIN
                            INSERT INTO court_slots (court_id, slot_date, start_time, end_time, is_available)
                            VALUES (@courtId, @targetDate, @slotStart, @slotEnd, 1);
                        END

                        SET @slotStart = CAST(@slotEnd AS TIME);
                    END

                    FETCH NEXT FROM court_cursor INTO @courtId, @openTime, @closeTime;
                END

                CLOSE court_cursor;
                DEALLOCATE court_cursor;
                
                -- Đánh dấu lại các slot đã có booking nếu có
                UPDATE cs
                SET cs.is_available = 0
                FROM court_slots cs
                JOIN bookings b
                    ON  b.court_id     = cs.court_id
                    AND b.booking_date = cs.slot_date
                    AND b.start_time  <= cs.start_time
                    AND b.end_time    >= cs.end_time
                    AND b.status IN ('confirmed', 'pending')
                WHERE cs.slot_date = @targetDate;
            `);
            
            // Xóa slot cũ hơn 7 ngày
            await pool.request().query(`
                DELETE FROM court_slots WHERE slot_date < DATEADD(DAY, -7, CAST(GETDATE() AS DATE))
            `);

            console.log(`[Scheduler] Đã hoàn thành sinh slot cho ngày ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`);
        } catch (error) {
            console.error('[Scheduler] Lỗi khi sinh slot:', error);
        }
};

export const initSlotScheduler = () => {
    // Chạy lúc 00:01 mỗi ngày
    cron.schedule('1 0 * * *', generateSlotsFor30thDay);

    console.log('[Scheduler] Đã khởi tạo tác vụ sinh slot tự động (00:01 hàng ngày)');
};
