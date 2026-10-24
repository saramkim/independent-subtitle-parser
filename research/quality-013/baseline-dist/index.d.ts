import type { ParseOptions, ParseResult } from './types.js';
export type * from './types.js';
export { decode } from './decode.js';
export { detectFormat } from './detect.js';
export { DEFAULT_LIMITS } from './context.js';
/** Parse a decoded string. Malformed file content returns diagnostics; API misuse throws. */
export declare function parse(sourceText: string, options?: ParseOptions): ParseResult;
