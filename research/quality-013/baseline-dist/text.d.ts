import type { ParseContext } from './context.js';
import type { Field } from './types.js';
/** Decode exactly once. Unknown/malformed references are kept verbatim. */
export declare function decodeEntities(text: string, mode: 'html' | 'vtt' | 'attribute', unknown?: (raw: string) => void): string;
/** A reading projection, not a renderer or HTML sanitizer. Markup remains in rawText. */
export declare function projectText(raw: string, mode: 'srt' | 'vtt', ctx: ParseContext, line: number, start: number, end: number): {
    text: string;
    fields: Field[];
};
