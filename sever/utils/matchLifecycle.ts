import { sql, poolPromise } from '../config/db';

export const HOST_MIN_ADVANCE_HOURS = 1;
export const HOST_MAX_ADVANCE_DAYS = 30;
export const HOST_PAYMENT_WINDOW_MINUTES = 5;
export const JOIN_PAYMENT_WINDOW_MINUTES = 5;
// Hàm getter để đọc runtime (sau khi dotenv.config() ở index.ts đã chạy)
export const getUnderfilledCancelWindowMinutes = (): number =>
    Number(process.env.MATCH_UNDERFILLED_CANCEL_WINDOW_MINUTES) || 30;
export const MATCH_UNDERFILLED_CANCEL_WINDOW_MINUTES = 30; // fallback tĩnh, dùng hàm trên ở runtime

type DbExecutor = any;

export const FORMAT_RULES: Record<string, { maxPlayers: number; minPlayers: number }> = {
    '1v1': { maxPlayers: 2, minPlayers: 2 },
    '2v2': { maxPlayers: 4, minPlayers: 4 },
    open: { maxPlayers: 4, minPlayers: 2 }
};

const ACTIVE_BOOKING_STATUSES = "'pending','payment_pending','confirmed'";
const ACTIVE_MATCH_STATUSES = "'pending_host_payment','open','full','confirmed','waiting'";
const ACTIVE_PLAYER_STATUSES = "'payment_pending','joined','waitlist'";

type ScheduleConflictOptions = {
    includeBookingConflicts?: boolean;
    includeMatchConflicts?: boolean;
};

const getRequest = (executor?: DbExecutor) => (executor ? executor.request() : poolPromise.then(pool => pool.request()));

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const toLocalDateOnly = (input: any): string => {
    if (input instanceof Date) {
        return `${input.getFullYear()}-${pad2(input.getMonth() + 1)}-${pad2(input.getDate())}`;
    }

    const raw = String(input || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    }

    return raw;
};

export const normalizeTime = (input: any): string => {
    if (!input) return '';

    if (input instanceof Date) {
        if (Number.isNaN(input.getTime())) return '';
        return input.toTimeString().slice(0, 8);
    }

    const raw = String(input).trim();
    if (!raw) return '';

    if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;

    const timeMatch = raw.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
        const hh = timeMatch[1];
        const mm = timeMatch[2];
        const ss = timeMatch[3] || '00';
        return `${hh}:${mm}:${ss}`;
    }

    return '';
};

export const buildDateTime = (dateValue: any, timeValue: any): Date => {
    const dateStr = toLocalDateOnly(dateValue);
    const timeStr = normalizeTime(timeValue);
    return new Date(`${dateStr}T${timeStr}`);
};

export const getHoursUntilStart = (dateValue: any, timeValue: any): number => {
    const startAt = buildDateTime(dateValue, timeValue);
    if (Number.isNaN(startAt.getTime())) return Number.NEGATIVE_INFINITY;
    return (startAt.getTime() - Date.now()) / 3_600_000;
};

export const getFormatConfig = (format: any, requestedMaxPlayers?: any) => {
    const normalizedFormat = String(format || '2v2').trim().toLowerCase();
    const base = FORMAT_RULES[normalizedFormat] || FORMAT_RULES['2v2'];
    const requested = Number(requestedMaxPlayers);
    const maxPlayers = Number.isInteger(requested) && requested > 1
        ? Math.max(base.minPlayers, Math.min(requested, 8))
        : base.maxPlayers;

    return {
        format: normalizedFormat,
        maxPlayers,
        minPlayers: normalizedFormat === 'open' ? Math.min(2, maxPlayers) : Math.min(base.minPlayers, maxPlayers)
    };
};

export const getMatchWindowError = (dateValue: any, startTime: any) => {
    const hoursUntil = getHoursUntilStart(dateValue, startTime);
    if (hoursUntil < HOST_MIN_ADVANCE_HOURS) {
        return `Trận phải bắt đầu sau ít nhất ${HOST_MIN_ADVANCE_HOURS} giờ kể từ hiện tại`;
    }

    if (hoursUntil > HOST_MAX_ADVANCE_DAYS * 24) {
        return `Chỉ được tạo trận trong vòng ${HOST_MAX_ADVANCE_DAYS} ngày tới`;
    }

    return null;
};

export const getCourtAvailabilityConflict = async (
    executor: DbExecutor,
    courtId: number,
    dateValue: any,
    startTime: any,
    endTime: any,
    excludeMatchId?: number | null,
    excludeBookingId?: number | null
) => {
    const request = executor.request();
    request.input('court_id', sql.Int, courtId);
    request.input('slot_date', sql.Date, toLocalDateOnly(dateValue));
    request.input('start_time', sql.NVarChar, normalizeTime(startTime));
    request.input('end_time', sql.NVarChar, normalizeTime(endTime));
    request.input('exclude_match_id', sql.Int, excludeMatchId || null);
    request.input('exclude_booking_id', sql.Int, excludeBookingId || null);

    const result = await request.query(`
        SELECT TOP 1 source, reference_id
        FROM (
            SELECT 'booking' AS source, b.id AS reference_id
            FROM bookings b
            WHERE b.court_id = @court_id
              AND b.booking_date = @slot_date
              AND b.status IN (${ACTIVE_BOOKING_STATUSES})
              AND b.start_time < CAST(@end_time AS TIME)
              AND b.end_time > CAST(@start_time AS TIME)
              AND (@exclude_booking_id IS NULL OR b.id <> @exclude_booking_id)

            UNION ALL

            SELECT 'match' AS source, m.id AS reference_id
            FROM matches m
            WHERE m.court_id = @court_id
              AND m.match_date = @slot_date
              AND m.status IN (${ACTIVE_MATCH_STATUSES})
              AND m.start_time < CAST(@end_time AS TIME)
              AND m.end_time > CAST(@start_time AS TIME)
              AND (@exclude_match_id IS NULL OR m.id <> @exclude_match_id)
        ) conflicts
    `);

    return result.recordset[0] || null;
};

export const getUserScheduleConflict = async (
    executor: DbExecutor,
    userId: number,
    dateValue: any,
    startTime: any,
    endTime: any,
    excludeMatchId?: number | null,
    excludeBookingId?: number | null,
    options?: ScheduleConflictOptions
) => {
    const includeBookingConflicts = options?.includeBookingConflicts !== false;
    const includeMatchConflicts = options?.includeMatchConflicts !== false;
    if (!includeBookingConflicts && !includeMatchConflicts) return null;

    const request = executor.request();
    request.input('user_id', sql.Int, userId);
    request.input('slot_date', sql.Date, toLocalDateOnly(dateValue));
    request.input('start_time', sql.NVarChar, normalizeTime(startTime));
    request.input('end_time', sql.NVarChar, normalizeTime(endTime));
    request.input('exclude_match_id', sql.Int, excludeMatchId || null);
    request.input('exclude_booking_id', sql.Int, excludeBookingId || null);

    const conflictParts: string[] = [];

    if (includeBookingConflicts) {
        conflictParts.push(`
            SELECT
                'booking' AS conflict_type,
                b.id AS reference_id,
                b.booking_date AS event_date,
                CONVERT(NVARCHAR(8), b.start_time, 108) AS start_time,
                CONVERT(NVARCHAR(8), b.end_time, 108) AS end_time
            FROM bookings b
            WHERE b.user_id = @user_id
              AND b.booking_date = @slot_date
              AND b.status IN (${ACTIVE_BOOKING_STATUSES})
              AND b.start_time < CAST(@end_time AS TIME)
              AND b.end_time > CAST(@start_time AS TIME)
              AND (@exclude_booking_id IS NULL OR b.id <> @exclude_booking_id)
        `);
    }

    if (includeMatchConflicts) {
        conflictParts.push(`
            SELECT
                'hosted_match' AS conflict_type,
                m.id AS reference_id,
                m.match_date AS event_date,
                CONVERT(NVARCHAR(8), m.start_time, 108) AS start_time,
                CONVERT(NVARCHAR(8), m.end_time, 108) AS end_time
            FROM matches m
            WHERE m.creator_id = @user_id
              AND m.match_date = @slot_date
              AND m.status IN (${ACTIVE_MATCH_STATUSES})
              AND m.start_time < CAST(@end_time AS TIME)
              AND m.end_time > CAST(@start_time AS TIME)
              AND (@exclude_match_id IS NULL OR m.id <> @exclude_match_id)

            UNION ALL

            SELECT
                'joined_match' AS conflict_type,
                m.id AS reference_id,
                m.match_date AS event_date,
                CONVERT(NVARCHAR(8), m.start_time, 108) AS start_time,
                CONVERT(NVARCHAR(8), m.end_time, 108) AS end_time
            FROM matches m
            JOIN match_players mp ON mp.match_id = m.id
            WHERE mp.user_id = @user_id
              AND mp.status IN (${ACTIVE_PLAYER_STATUSES})
              AND m.match_date = @slot_date
              AND m.status IN (${ACTIVE_MATCH_STATUSES})
              AND m.start_time < CAST(@end_time AS TIME)
              AND m.end_time > CAST(@start_time AS TIME)
              AND (@exclude_match_id IS NULL OR m.id <> @exclude_match_id)
        `);
    }

    const result = await request.query(`
        SELECT TOP 1 *
        FROM (
            ${conflictParts.join('\nUNION ALL\n')}
        ) conflicts
        ORDER BY event_date, start_time
    `);

    return result.recordset[0] || null;
};

export const getScheduleConflictMessage = (conflict: any): string => {
    if (!conflict) return 'Người dùng đã có lịch trùng.';

    const labels: Record<string, string> = {
        booking: 'một booking',
        hosted_match: 'một trận bạn đang tổ chức',
        joined_match: 'một trận bạn đã tham gia'
    };

    return `Bạn đang có ${labels[String(conflict.conflict_type || '')] || 'một lịch khác'} trùng khung giờ ${String(conflict.start_time || '').slice(0, 5)}-${String(conflict.end_time || '').slice(0, 5)}.`;
};

export const syncMatchState = async (matchId: number, executor?: DbExecutor): Promise<void> => {
    const poolOrTx = executor || await poolPromise;
    const summary = await poolOrTx.request()
        .input('match_id', sql.Int, matchId)
        .query(`
            SELECT
                m.id,
                m.status,
                m.max_players,
                SUM(CASE WHEN mp.status IN ('joined', 'payment_pending') THEN 1 ELSE 0 END) AS reserved_players,
                SUM(CASE WHEN mp.status = 'joined' THEN 1 ELSE 0 END) AS joined_players
            FROM matches m
            LEFT JOIN match_players mp ON mp.match_id = m.id
            WHERE m.id = @match_id
            GROUP BY m.id, m.status, m.max_players
        `);

    if (summary.recordset.length === 0) return;

    const row = summary.recordset[0];
    const currentStatus = String(row.status || '').toLowerCase();
    if (['cancelled', 'completed', 'finished', 'expired'].includes(currentStatus)) return;
    if (currentStatus === 'pending_host_payment') {
        await poolOrTx.request()
            .input('match_id', sql.Int, matchId)
            .input('current_players', sql.Int, Number(row.reserved_players) || 0)
            .query('UPDATE matches SET current_players = @current_players WHERE id = @match_id');
        return;
    }

    const reservedPlayers = Number(row.reserved_players) || 0;
    const nextStatus = reservedPlayers >= Number(row.max_players || 0) ? 'full' : 'open';

    await poolOrTx.request()
        .input('match_id', sql.Int, matchId)
        .input('current_players', sql.Int, reservedPlayers)
        .input('status', sql.NVarChar, nextStatus)
        .query(`
            UPDATE matches
            SET current_players = @current_players,
                status = @status
            WHERE id = @match_id
              AND status NOT IN ('cancelled', 'completed', 'finished', 'expired', 'pending_host_payment')
        `);
};

export const getMinimumPlayers = (format: any, maxPlayers: any, minPlayers: any) => {
    const config = getFormatConfig(format, maxPlayers);
    const requestedMinPlayers = Number(minPlayers);
    if (Number.isInteger(requestedMinPlayers) && requestedMinPlayers >= 2) {
        return Math.min(config.maxPlayers, requestedMinPlayers);
    }
    return config.minPlayers;
};

export const isMatchStarted = (dateValue: any, startTime: any): boolean => {
    const startAt = buildDateTime(dateValue, startTime);
    return !Number.isNaN(startAt.getTime()) && startAt.getTime() <= Date.now();
};

export const isMatchFinished = (dateValue: any, endTime: any): boolean => {
    const endAt = buildDateTime(dateValue, endTime);
    return !Number.isNaN(endAt.getTime()) && endAt.getTime() <= Date.now();
};