import { DEFAULT_LIMITS, ParseAbort, ParseContext } from './context.js';
import { detectFormat } from './detect.js';
import { parseTimed } from './formats/timed.js';
import { parseAss } from './formats/ass.js';
import { parseSami } from './formats/sami.js';
import type { Limits, ParseOptions, ParseResult, SubtitleFormat } from './types.js';

export type * from './types.js';
export { decode } from './decode.js';
export { detectFormat } from './detect.js';
export { DEFAULT_LIMITS } from './context.js';

const formats: readonly SubtitleFormat[] = ['srt', 'vtt', 'sami', 'ass', 'ssa'];

/** Parse a decoded string. Malformed file content returns diagnostics; API misuse throws. */
export function parse(sourceText: string, options: ParseOptions = {}): ParseResult {
  if (typeof sourceText !== 'string') throw new TypeError('parse expects a decoded string. Use decode for bytes.');
  if (options.format !== undefined && !formats.includes(options.format)) throw new TypeError('Unknown subtitle format option.');
  if (options.recoverMissingVttHeader !== undefined && typeof options.recoverMissingVttHeader !== 'boolean') throw new TypeError('recoverMissingVttHeader must be a boolean.');
  const limits: Limits = { ...DEFAULT_LIMITS, ...options.limits };
  for (const key of Object.keys(DEFAULT_LIMITS) as (keyof Limits)[]) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] < 1) throw new RangeError(`${key} must be a positive safe integer.`);
  }
  const fail = (code: string, message: string): ParseResult => ({ format: options.format ?? null, status: 'fatal', cues: [], tracks: [], metadata: [], diagnostics: [{ code, severity: 'fatal', message }], diagnosticsTruncated: false, sourceText });
  if (sourceText.length > limits.maxInputLength) return fail('INPUT_LIMIT', 'Input exceeds maxInputLength (UTF-16 code units).');
  // Preflight before splitting to avoid millions of tiny allocations on newline floods.
  let lineCount = 1;
  let lineLength = 0;
  for (let i = 0; i < sourceText.length; i++) {
    const c = sourceText.charCodeAt(i);
    if (c === 10 || c === 13) {
      if (c === 13 && sourceText.charCodeAt(i + 1) === 10) i++;
      if (++lineCount > limits.maxLines) return fail('LINE_LIMIT', 'Input exceeds maxLines.');
      lineLength = 0;
    } else if (++lineLength > limits.maxLineLength) return fail('LINE_LENGTH_LIMIT', 'Input exceeds maxLineLength.');
  }
  const detection = options.format ? { format: options.format, confidence: 'high' as const } : detectFormat(sourceText);
  const format = options.format ?? detection.format;
  if (!format) return fail(detection.confidence === 'ambiguous' ? 'AMBIGUOUS_FORMAT' : 'UNKNOWN_FORMAT', 'Cannot select a format confidently. Supply an explicit format when known.');
  const ctx = new ParseContext(format, limits);
  if (!options.format && detection.confidence === 'low') ctx.diagnostic('LOW_CONFIDENCE_FORMAT', 'warning', 'Format selected from weak content signals; explicit format is recommended.');
  let normalized = sourceText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (normalized.includes('\0')) {
    ctx.diagnostic('NUL_CHARACTER', 'warning', format === 'vtt' ? 'NUL replaced with U+FFFD per WebVTT; original source retained.' : 'NUL character retained; verify the input encoding.');
    if (format === 'vtt') normalized = normalized.replace(/\0/g, '\uFFFD');
  }
  try {
    const lines = normalized.split('\n');
    if (format === 'ass' || format === 'ssa') parseAss(lines, ctx);
    else if (format === 'sami') parseSami(lines, ctx);
    else parseTimed(lines, ctx, options.format === 'vtt' && options.recoverMissingVttHeader === true);
    return ctx.result(sourceText);
  } catch (error) {
    if (error instanceof ParseAbort) return ctx.result(sourceText, true);
    throw error;
  }
}
