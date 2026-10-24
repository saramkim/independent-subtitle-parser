import type { ParseContext } from '../context.js';
/** Parse ASS v4+ and SSA v4 data without executing tags, effects, fonts or commands. */
export declare function parseAss(lines: string[], ctx: ParseContext): void;
