import type { ParseContext } from '../context.js';
import type { Field } from '../types.js';

const ASS_EVENTS = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
const SSA_EVENTS = ['Marked', ...ASS_EVENTS.slice(1)];
const ASS_STYLES = ['Name', 'Fontname', 'Fontsize', 'PrimaryColour', 'SecondaryColour', 'OutlineColour', 'BackColour', 'Bold', 'Italic', 'Underline', 'StrikeOut', 'ScaleX', 'ScaleY', 'Spacing', 'Angle', 'BorderStyle', 'Outline', 'Shadow', 'Alignment', 'MarginL', 'MarginR', 'MarginV', 'Encoding'];
const SSA_STYLES = ['Name', 'Fontname', 'Fontsize', 'PrimaryColour', 'SecondaryColour', 'TertiaryColour', 'BackColour', 'Bold', 'Italic', 'BorderStyle', 'Outline', 'Shadow', 'Alignment', 'MarginL', 'MarginR', 'MarginV', 'AlphaLevel', 'Encoding'];

/** Split only the first n - 1 commas: the final ASS Text field owns the remainder. */
function splitFields(value: string, names: readonly string[]): Field[] | null {
  const result: Field[] = [];
  let from = 0;
  for (let i = 0; i < names.length - 1; i++) {
    const comma = value.indexOf(',', from);
    if (comma < 0) return null;
    result.push({ name: names[i]!, value: value.slice(from, comma) });
    from = comma + 1;
  }
  result.push({ name: names[names.length - 1]!, value: value.slice(from) });
  return result;
}

function valueOf(fields: Field[], name: string): string {
  return fields.find(field => field.name.toLowerCase() === name)?.value ?? '';
}

function eventFormatValid(names: string[]): boolean {
  const lower = names.map(name => name.toLowerCase());
  return names.every(Boolean) && lower.at(-1) === 'text' &&
    ['start', 'end', 'text'].every(name => lower.filter(field => field === name).length === 1);
}

function timestamp(value: string, ctx: ParseContext, line: number): number | null {
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = ((hours * 60 + minutes) * 60 + seconds) * 1000 + Number(match[4]) * 10;
  if (minutes > 60 || seconds > 60 || !Number.isSafeInteger(millis)) return null;
  // The libass authoring guide permits 60 in minute/second components. Keep the
  // value, but flag normalization because most conventional clocks use 00-59.
  if (minutes === 60 || seconds === 60) {
    ctx.diagnostic('ASS_TIME_NORMALIZED', 'warning', 'A minute or second component of 60 was normalized arithmetically; original fields are retained.', line);
  }
  if (hours > 595) {
    ctx.diagnostic('ASS_EXTENDED_HOURS', 'warning', 'Time exceeds the libass authoring guide range of 595 hours; exact safe milliseconds are retained.', line);
  }
  return millis;
}

interface TextState { wrap: number; drawing: boolean }

/** Only plain-text-relevant, top-level tags are interpreted; no rendering occurs. */
function applyTextOverrides(block: string, state: TextState, initialWrap: number, scriptWrap: number,
  ctx: ParseContext, line: number): void {
  let depth = 0;
  for (let i = 0; i < block.length; i++) {
    const char = block[i];
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === '\\' && depth === 0) {
      const tag = block[i + 1];
      if (tag === 'r') {
        if (state.wrap !== initialWrap || state.drawing) {
          ctx.diagnostic('ASS_RESET_APPROXIMATION', 'warning', 'This extraction profile resets wrap/drawing state for a top-level r tag and may differ from libass; original rawText is retained.', line);
        }
        state.wrap = initialWrap;
        state.drawing = false;
      } else if (tag === 'q' || tag === 'p') {
        let end = i + 2;
        while (end < block.length && block.charCodeAt(end) >= 48 && block.charCodeAt(end) <= 57) end++;
        if (end === i + 2) {
          // A bare tag restores its default. Do not mistake \pbo, \pos or an
          // unrecognized argument for an omitted parameter.
          while (end < block.length && (block[end] === ' ' || block[end] === '\t')) end++;
          if (end === block.length || block[end] === '\\') {
            if (tag === 'p') state.drawing = false;
            else state.wrap = scriptWrap;
          }
          continue;
        }
        if (end < block.length && block[end] !== '\\' && block[end] !== ' ' && block[end] !== '\t') continue;
        const value = Number(block.slice(i + 2, end));
        if (tag === 'q' && value <= 3) state.wrap = value;
        else if (tag === 'p') state.drawing = value > 0;
        i = end - 1;
      }
    }
  }
}

function plainText(raw: string, initialWrap: number, scriptWrap: number, ctx: ParseContext, line: number): string {
  // Ordinary dialogue needs no per-character interpreter or intermediate array.
  if (!raw.includes('{') && !raw.includes('\\')) return raw;
  const state: TextState = { wrap: initialWrap, drawing: false };
  const parts: string[] = [];
  let escapedBraces = false;
  let run = 0;
  let i = 0;
  while (i < raw.length) {
    const char = raw[i];
    if (char === '\\' && (raw[i + 1] === '{' || raw[i + 1] === '}')) {
      if (!escapedBraces) {
        ctx.diagnostic('ASS_LIBASS_ESCAPED_BRACES', 'info', 'Escaped braces use the libass literal-curly-bracket extension; other ASS renderers may interpret them differently. Original rawText is retained.', line);
        escapedBraces = true;
      }
      if (!state.drawing) parts.push(raw.slice(run, i), raw[i + 1]!);
      i += 2;
      run = i;
      continue;
    }
    if (char === '{') {
      if (!state.drawing) parts.push(raw.slice(run, i));
      const end = raw.indexOf('}', i + 1);
      if (end < 0) {
        ctx.diagnostic('ASS_UNCLOSED_OVERRIDE', 'warning', 'Unclosed override block remains raw; its remainder is literal text unless already in drawing mode.', line);
        if (!state.drawing) parts.push(raw.slice(i));
        return parts.join('');
      }
      applyTextOverrides(raw.slice(i + 1, end), state, initialWrap, scriptWrap, ctx, line);
      i = end + 1;
      run = i;
      continue;
    }
    if (char === '\\' && (raw[i + 1] === 'N' || raw[i + 1] === 'n' || raw[i + 1] === 'h')) {
      if (!state.drawing) {
        parts.push(raw.slice(run, i));
        const escaped = raw[i + 1];
        parts.push(escaped === 'h' ? '\u00a0' : escaped === 'N' || state.wrap === 2 ? '\n' : ' ');
      }
      i += 2;
      run = i;
      continue;
    }
    i++;
  }
  if (!state.drawing) parts.push(raw.slice(run));
  return parts.join('');
}

/** Parse ASS v4+ and SSA v4 data without executing tags, effects, fonts or commands. */
export function parseAss(lines: string[], ctx: ParseContext): void {
  ctx.tracks.push({ id: 'default' });
  ctx.diagnostic('ASS_RENDERING_UNSUPPORTED', 'info', 'Plain text is a projection; ASS styling, positioning, karaoke, effects and drawing are retained as raw data but not rendered.');
  let section = '';
  let eventFormat: string[] | null = null;
  let eventUsable = true;
  let styleFormat: string[] | null = null;
  let wrapStyle = 0;
  let isSsa = ctx.format === 'ssa';
  let knownVersion = true;

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    const line = index + 1;
    const source = { line, endLine: line };
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const header = /^\[([^\]]+)\]$/.exec(trimmed);
    if (header) {
      section = header[1]!.toLowerCase();
      if (section === 'events') { eventFormat = null; eventUsable = true; }
      if (section === 'v4 styles' || section === 'v4+ styles') styleFormat = null;
      ctx.metadata.push({ kind: 'ass-section', raw, source });
      continue;
    }
    if (trimmed.startsWith(';')) {
      ctx.metadata.push({ kind: 'ass-source-comment', raw, source });
      continue;
    }
    const colon = raw.indexOf(':');
    const key = colon < 0 ? '' : raw.slice(0, colon).trim();
    const lowerKey = key.toLowerCase();
    const value = colon < 0 ? raw : raw.slice(colon + 1).replace(/^[ \t]/, '');

    if (section === 'script info') {
      ctx.metadata.push({ kind: 'ass-script-info', raw, source, ...(key ? { fields: [{ name: key, value }] } : {}) });
      if (lowerKey === 'scripttype') {
        const version = value.trim().toLowerCase();
        knownVersion = version === 'v4.00' || version === 'v4.00+';
        if (version === 'v4.00') isSsa = true;
        else if (version === 'v4.00+') isSsa = false;
        else ctx.diagnostic('ASS_SCRIPT_VERSION', 'warning', 'Unrecognized ScriptType; event fields will be interpreted only when a usable Format is available.', line);
        if (knownVersion && (isSsa ? 'ssa' : 'ass') !== ctx.format) {
          ctx.diagnostic('ASS_SCRIPT_TYPE_MISMATCH', 'warning', 'ScriptType disagrees with the selected format; declared event Format or ScriptType determines field mapping.', line);
        }
      } else if (lowerKey === 'wrapstyle') {
        if (/^[0-3]$/.test(value.trim())) wrapStyle = Number(value.trim());
        else ctx.diagnostic('ASS_WRAP_STYLE', 'warning', 'Invalid WrapStyle; the last valid value or default 0 is used for plain text.', line);
      } else if (lowerKey === 'timer') {
        const timer = value.trim();
        if (!/^\d+(?:\.\d+)?$/.test(timer) || Number(timer) !== 100) {
          ctx.diagnostic('ASS_TIMER_UNAPPLIED', 'warning', 'Non-100 or invalid legacy Timer is retained but not applied; cue times remain literal event timestamps, not an adjusted playback clock.', line);
        }
      }
      continue;
    }

    if (section === 'v4 styles' || section === 'v4+ styles') {
      if (lowerKey === 'format') {
        styleFormat = value.split(',').map(name => name.trim());
        ctx.metadata.push({ kind: 'ass-style-format', raw, source });
        if (styleFormat.some(name => !name)) {
          ctx.diagnostic('ASS_STYLE_FORMAT', 'warning', 'Style Format contains empty field names; raw data is retained.', line);
        }
      } else if (lowerKey === 'style') {
        if (styleFormat === null) {
          styleFormat = section === 'v4 styles' ? SSA_STYLES : ASS_STYLES;
          ctx.diagnostic('ASS_STYLE_FORMAT_ASSUMED', 'warning', 'Missing style Format; canonical fields for this style section were assumed.', line);
        }
        const fields = splitFields(value, styleFormat);
        ctx.metadata.push({ kind: 'ass-style', raw, source, ...(fields === null ? {} : { fields }) });
        if (fields === null || fields.at(-1)!.value.includes(',')) {
          ctx.diagnostic('ASS_STYLE_FIELD_COUNT', 'warning', 'Style field count does not match Format; raw style data is retained.', line);
        }
      } else ctx.metadata.push({ kind: 'ass-style-data', raw, source });
      continue;
    }

    if (section === 'events') {
      if (lowerKey === 'format') {
        eventFormat = value.split(',').map(name => name.trim());
        eventUsable = eventFormatValid(eventFormat);
        ctx.metadata.push({ kind: 'ass-event-format', raw, source });
        if (!eventUsable) {
          ctx.diagnostic('ASS_EVENT_FORMAT', 'error', 'Event Format requires exactly one Start, End and final Text field, with no empty field names.', line);
        }
        continue;
      }
      if (lowerKey === 'dialogue' || lowerKey === 'comment') {
        if (eventFormat === null && !knownVersion) {
          ctx.metadata.push({ kind: lowerKey === 'comment' ? 'ass-comment' : 'ass-rejected-event', raw, source });
          ctx.diagnostic('ASS_EVENT_SKIPPED', 'error', 'Unknown ScriptType with no event Format cannot be mapped safely; raw event is retained.', line);
          continue;
        }
        if (eventFormat === null) {
          eventFormat = isSsa ? SSA_EVENTS : ASS_EVENTS;
          ctx.diagnostic('ASS_EVENT_FORMAT_ASSUMED', 'warning', 'Missing event Format; canonical ASS/SSA fields were assumed.', line);
        }
        if (!eventUsable) {
          ctx.metadata.push({ kind: lowerKey === 'comment' ? 'ass-comment' : 'ass-rejected-event', raw, source });
          ctx.diagnostic('ASS_EVENT_SKIPPED', 'error', 'Event cannot be mapped unambiguously with the current Format; raw event is retained.', line);
          continue;
        }
        const fields = splitFields(value, eventFormat);
        if (fields === null) {
          ctx.metadata.push({ kind: lowerKey === 'comment' ? 'ass-comment' : 'ass-rejected-event', raw, source });
          ctx.diagnostic('ASS_EVENT_FIELD_COUNT', 'error', 'Event has fewer comma-delimited fields than Format; raw event is retained.', line);
          continue;
        }
        if (lowerKey === 'comment') {
          ctx.metadata.push({ kind: 'ass-comment', raw, source, fields });
          continue;
        }
        const start = timestamp(valueOf(fields, 'start'), ctx, line);
        const end = timestamp(valueOf(fields, 'end'), ctx, line);
        if (start === null || end === null) {
          ctx.metadata.push({ kind: 'ass-rejected-event', raw, source, fields });
          ctx.diagnostic('ASS_INVALID_TIME', 'error', 'Event requires safe nonnegative h:mm:ss.cc timestamps; no replacement times were invented.', line);
          continue;
        }
        const rawText = valueOf(fields, 'text');
        const initialWrap = /^Banner;/i.test(valueOf(fields, 'effect')) ? 2 : wrapStyle;
        const accepted = ctx.addCue({ start, end, trackId: 'default', text: plainText(rawText, initialWrap, wrapStyle, ctx, line), rawText, source, fields });
        if (!accepted) ctx.metadata.push({ kind: 'ass-rejected-event', raw, source, fields });
        continue;
      }
      ctx.metadata.push({ kind: 'ass-unsupported-event', raw, source });
      ctx.diagnostic('ASS_EVENT_UNSUPPORTED', 'warning', 'Event type is unsupported and retained as metadata.', line);
      continue;
    }

    ctx.metadata.push({ kind: 'ass-opaque', raw, source });
    if (lowerKey === 'dialogue' || lowerKey === 'comment') {
      ctx.diagnostic('ASS_EVENT_OUTSIDE_SECTION', 'warning', 'Event outside [Events] was retained as metadata, without inventing section context.', line);
    }
  }
}
