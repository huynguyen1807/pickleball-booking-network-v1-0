const pad2 = (n: number): string => String(n).padStart(2, '0');

export const getTodayYMD = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
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