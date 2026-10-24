/** Strict W3C WebVTT timestamp grammar, integer milliseconds. */
export declare function vttTime(value: string): number | null;
/** WebVTT section 6.3 recovery permits single-digit hours, unlike authoring syntax. */
export declare function recoveredVttTime(value: string): number | null;
export declare function srtTime(value: string): number | null;
