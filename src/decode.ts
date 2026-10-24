import type { DecodeOptions, DecodeResult, Diagnostic } from './types.js';

// Intrinsic getters inspect internal typed-array slots across realms. Object#toString
// and an object's public byteLength can both be overridden by callers.
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayName = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
// WHATWG windows-1252 index entries 0..31 (bytes 0x80..0x9f).
// Some Node/ICU versions incorrectly return Latin-1 controls for these bytes.
// A conforming decoder's five literal C1 controls map to themselves here.
const WINDOWS_1252_C1 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';

/** Explicit byte decoding, independent of subtitle format and file/network I/O. */
export function decode(bytes: Uint8Array, options: DecodeOptions = {}): DecodeResult {
  if (!ArrayBuffer.isView(bytes) || typedArrayName.call(bytes) !== 'Uint8Array') throw new TypeError('decode expects Uint8Array.');
  const maxBytes = options.maxBytes ?? 16 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('maxBytes must be a positive safe integer.');
  if (options.fatal !== undefined && typeof options.fatal !== 'boolean') throw new TypeError('fatal must be boolean.');
  const diagnostics: Diagnostic[] = [];
  const fail = (code: string, message: string, encoding: string | null = null, bom: DecodeResult['bom'] = null): DecodeResult =>
    ({ text: null, encoding, bom, diagnostics: [...diagnostics, { code, severity: 'fatal', message }] });
  if (typedArrayByteLength.call(bytes) > maxBytes) return fail('BYTE_LIMIT', 'Byte input exceeds maxBytes.');
  // UTF-32 must not be mistaken for UTF-16LE, and is unsupported by TextDecoder.
  if ((bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0) ||
    (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff)) return fail('UNSUPPORTED_BOM', 'UTF-32 input is unsupported.');
  const bom: DecodeResult['bom'] = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 'utf-8'
    : bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : null;
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(options.encoding ?? bom ?? 'utf-8', { fatal: true }); }
  catch { return fail('UNSUPPORTED_ENCODING', 'Encoding label is unsupported by this runtime.', null, bom); }
  const encoding = decoder.encoding;
  if (bom && encoding !== bom) return fail('ENCODING_BOM_CONFLICT', 'Explicit encoding conflicts with the byte order mark.', encoding, bom);
  try {
    let text = decoder.decode(bytes);
    if (encoding === 'windows-1252') text = text.replace(/[\u0080-\u009f]/g, char => WINDOWS_1252_C1[char.charCodeAt(0) - 0x80]!);
    return { text, encoding, bom, diagnostics };
  }
  catch {
    if (options.fatal !== false) return fail('INVALID_ENCODING', 'Bytes are invalid for the selected encoding. Choose the correct encoding explicitly.', encoding, bom);
    diagnostics.push({ code: 'DECODE_REPLACEMENT', severity: 'warning', message: 'Invalid byte sequences were replaced with U+FFFD at explicit caller request.' });
    return { text: new TextDecoder(encoding).decode(bytes), encoding, bom, diagnostics };
  }
}
