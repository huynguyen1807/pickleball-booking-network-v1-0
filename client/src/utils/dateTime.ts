const pad2 = (n: number): string => String(n).padStart(2, '0');

const toLocalYmd = (date: Date): string => {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const MIN_ADVANCE_BOOKING_HOURS = 1;
export const MAX_ADVANCE_BOOKING_DAYS = 30;

export const getTodayYMD = (): string => {
    const now = new Date();
    return toLocalYmd(now);
};

export const getMaxAdvanceDateYMD = (advanceDays = MAX_ADVANCE_BOOKING_DAYS): string => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + advanceDays);
    return toLocalYmd(maxDate);
};

export const getMinimumAdvanceDateTime = (advanceHours = MIN_ADVANCE_BOOKING_HOURS): Date => {
    return new Date(Date.now() + advanceHours * 60 * 60 * 1000);
};

export const combineLocalDateTime = (date: string, time: string): Date => {
    return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
};

export const isAtLeastAdvanceHours = (date: string, time: string, advanceHours = MIN_ADVANCE_BOOKING_HOURS): boolean => {
    if (!date || !time) return false;
    const selected = combineLocalDateTime(date, time);
    if (Number.isNaN(selected.getTime())) return false;
    return selected.getTime() >= getMinimumAdvanceDateTime(advanceHours).getTime();
};

export const getAdvanceValidationMessage = (advanceHours = MIN_ADVANCE_BOOKING_HOURS): string => {
    return `Thời gian bắt đầu phải cách hiện tại ít nhất ${advanceHours} tiếng`;
};

export const isWithinAdvanceDays = (date: string, advanceDays = MAX_ADVANCE_BOOKING_DAYS): boolean => {
    if (!date) return false;

    const selected = new Date(`${date}T00:00:00`);
    if (Number.isNaN(selected.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + advanceDays);

    return selected >= today && selected <= maxDate;
};

export const getAdvanceDayLimitMessage = (advanceDays = MAX_ADVANCE_BOOKING_DAYS): string => {
    return `Chỉ được đặt trong vòng ${advanceDays} ngày tới`;
};

export const generateHalfHourOptions = (startHour = 5, endHour = 23): string[] => {
    const options: string[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            if (hour === endHour && minute === 30) continue;
            options.push(`${pad2(hour)}:${pad2(minute)}`);
        }
    }
    return options;
};

export const formatDateVN = (value: any, fallback = '--'): string => {
    if (!value) return fallback;

    const raw = String(value).trim();
    const ymd = raw.match(/^\d{4}-\d{2}-\d{2}/);
    if (ymd) {
        const d = new Date(ymd[0]);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('vi-VN');
    }

    const parsed = value instanceof Date ? value : new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('vi-VN');

    return fallback;
};

export const formatDateTimeVN = (value: any, fallback = '--'): string => {
    if (!value) return fallback;

    const parsed = value instanceof Date ? value : new Date(String(value).trim());
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    return fallback;
};

export const formatTimeHHmm = (value: any, fallback = '--:--'): string => {
    if (!value) return fallback;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
    }

    const raw = String(value).trim();

    const hhmm = raw.match(/^(\d{1,2}):(\d{2})/);
    if (hhmm) return `${pad2(Number(hhmm[1]))}:${hhmm[2]}`;

    const isoTime = raw.match(/T(\d{2}):(\d{2})/);
    if (isoTime) return `${isoTime[1]}:${isoTime[2]}`;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
    }

    return fallback;
};