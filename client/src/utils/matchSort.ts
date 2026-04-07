export const toMatchTimestamp = (match: any): number => {
    const rawDate = String(match?.match_date || match?.date || '').trim();
    const rawTime = String(match?.start_time || '').trim();

    const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/);
    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;

    // yyyy-mm-dd or yyyy-mm-ddTHH:mm:ss
    const isoMatch = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]);
        const day = Number(isoMatch[3]);
        const ts = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
        return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
    }

    // d/m/yyyy or dd/mm/yyyy
    const dmyMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
        const day = Number(dmyMatch[1]);
        const month = Number(dmyMatch[2]);
        const year = Number(dmyMatch[3]);
        const ts = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
        return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
    }

    const fallback = new Date(rawDate);
    const fallbackTs = fallback.getTime();
    return Number.isNaN(fallbackTs) ? Number.NEGATIVE_INFINITY : fallbackTs;
};

export const sortMatchesNewestFirst = <T extends { id?: number }>(matches: T[]): T[] => {
    return [...matches].sort((a: any, b: any) => {
        const diff = toMatchTimestamp(b) - toMatchTimestamp(a);
        if (diff !== 0) return diff;
        return Number(b?.id || 0) - Number(a?.id || 0);
    });
};
