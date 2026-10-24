/** Strict W3C WebVTT timestamp grammar, integer milliseconds. */
export function vttTime(value) {
    const m = /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/.exec(value);
    if (!m || Number(m[2]) > 59 || Number(m[3]) > 59)
        return null;
    const t = Number(m[1] ?? 0) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1_000 + Number(m[4]);
    return Number.isSafeInteger(t) ? t : null;
}
/** WebVTT section 6.3 recovery permits single-digit hours, unlike authoring syntax. */
export function recoveredVttTime(value) {
    const match = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/.exec(value);
    if (!match || Number(match[2]) > 59 || Number(match[3]) > 59)
        return null;
    const time = Number(match[1] ?? 0) * 3_600_000 + Number(match[2]) * 60_000 + Number(match[3]) * 1_000 + Number(match[4]);
    return Number.isSafeInteger(time) ? time : null;
}
export function srtTime(value) {
    const m = /^(\d+):(\d{2}):(\d{2})[,.](\d{3})$/.exec(value);
    if (!m || Number(m[2]) > 59 || Number(m[3]) > 59)
        return null;
    const t = Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1_000 + Number(m[4]);
    return Number.isSafeInteger(t) ? t : null;
}
