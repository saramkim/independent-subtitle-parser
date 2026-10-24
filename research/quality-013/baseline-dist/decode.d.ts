import type { DecodeOptions, DecodeResult } from './types.js';
/** Explicit byte decoding, independent of subtitle format and file/network I/O. */
export declare function decode(bytes: Uint8Array, options?: DecodeOptions): DecodeResult;
