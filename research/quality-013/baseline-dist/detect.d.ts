import type { Detection } from './types.js';
/** Content-only heuristic, examining at most 64 Ki UTF-16 code units. No filename guessing. */
export declare function detectFormat(text: string): Detection;
