import type { ParseContext } from '../context.js';
import { decodeEntities } from '../text.js';
import type { Cue, Field, SourceRange, Track } from '../types.js';

interface Tag {
  start: number;
  end: number;
  name: string;
  closing: boolean;
  fields: Field[];
  malformed: boolean;
}
interface Paragraph { start: number; contentStart: number; end: number; fields: Field[]; className: string }
interface SyncBlock { start: number; offset: number; paragraphs: Paragraph[] }

const SPACE = /[\t\n\f\r ]/;
const BLOCK_TAGS = new Set(['div', 'blockquote', 'center', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'dt', 'dd', 'tr', 'caption']);
const KNOWN_TAGS = new Set(['b', 'basefont', 'bdo', 'big', 'blockquote', 'br', 'caption', 'center', 'col', 'colgroup', 'dd', 'div', 'dl', 'dt', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strike', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul']);

/** A bounded forward scanner, not an HTML parser or execution environment. */
function* tags(input: string): Generator<Tag> {
  let offset = 0;
  while (offset < input.length) {
    const start = input.indexOf('<', offset);
    if (start < 0) return;
    if (input.startsWith('<!--', start)) {
      const close = input.indexOf('-->', start + 4);
      const end = close < 0 ? input.length : close + 3;
      yield { start, end, name: '!comment', closing: false, fields: [], malformed: close < 0 };
      offset = end;
      continue;
    }
    let cursor = start + 1;
    const closing = input[cursor] === '/';
    if (closing) cursor++;
    const nameStart = cursor;
    while (cursor < input.length && /[A-Za-z0-9:_-]/.test(input[cursor]!)) cursor++;
    if (cursor === nameStart || !/[A-Za-z]/.test(input[nameStart]!)) {
      // Literal '<', processing instructions, and declarations are not active markup.
      if (input[start + 1] === '!' || input[start + 1] === '?') {
        const close = input.indexOf('>', start + 2);
        const end = close < 0 ? input.length : close + 1;
        yield { start, end, name: '!declaration', closing: false, fields: [], malformed: close < 0 };
        offset = end;
      } else offset = start + 1;
      continue;
    }
    const name = input.slice(nameStart, cursor).toLowerCase();
    const fields: Field[] = [];
    let malformed = false;
    while (cursor < input.length && input[cursor] !== '>') {
      while (cursor < input.length && SPACE.test(input[cursor]!)) cursor++;
      if (input[cursor] === '>') break;
      if (input[cursor] === '/' && input[cursor + 1] === '>') { cursor++; break; }
      const attributeStart = cursor;
      while (cursor < input.length && !SPACE.test(input[cursor]!) && !['=', '>', '/', '<'].includes(input[cursor]!)) cursor++;
      if (cursor === attributeStart) { malformed = true; cursor++; continue; }
      const attribute = input.slice(attributeStart, cursor).toLowerCase();
      while (cursor < input.length && SPACE.test(input[cursor]!)) cursor++;
      let value = '';
      if (input[cursor] === '=') {
        cursor++;
        while (cursor < input.length && SPACE.test(input[cursor]!)) cursor++;
        const quote = input[cursor];
        if (quote === '"' || quote === "'") {
          const valueStart = ++cursor;
          while (cursor < input.length && input[cursor] !== quote) cursor++;
          value = input.slice(valueStart, cursor);
          if (cursor === input.length) malformed = true;
          else cursor++;
        } else {
          const valueStart = cursor;
          while (cursor < input.length && !SPACE.test(input[cursor]!) && input[cursor] !== '>') cursor++;
          value = input.slice(valueStart, cursor);
        }
      }
      fields.push({ name: attribute, value: decodeEntities(value, 'attribute') });
    }
    if (cursor >= input.length) malformed = true;
    const end = Math.min(input.length, cursor + 1);
    yield { start, end, name, closing, fields, malformed };
    if (!closing && !malformed && ['style', 'script', 'title', 'samiparam'].includes(name)) {
      // Raw-text contents may contain '<', quotes, or fake tags. Only the closing
      // element ends this region; parsing its internals as attributes is unsafe.
      const closePattern = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, 'gi');
      closePattern.lastIndex = end;
      offset = closePattern.exec(input)?.index ?? input.length;
    } else offset = end;
  }
}

function first(fields: Field[], name: string): string | undefined {
  return fields.find(field => field.name === name)?.value;
}

function unquote(value: string): string {
  if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))) return value.slice(1, -1);
  return value;
}

function declarations(raw: string): Field[] {
  const result: Field[] = [];
  let start = 0;
  let quote = '';
  for (let i = 0; i <= raw.length; i++) {
    const char = raw[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === ';' || i === raw.length) {
      const declaration = raw.slice(start, i);
      const colon = declaration.indexOf(':');
      if (colon >= 0) result.push({ name: declaration.slice(0, colon).trim().toLowerCase(), value: unquote(declaration.slice(colon + 1).trim()) });
      start = i + 1;
    }
  }
  return result;
}

function cssWithoutComments(raw: string): string {
  const pieces: string[] = [];
  let offset = 0;
  let quote = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (raw.startsWith('/*', i)) {
      pieces.push(raw.slice(offset, i), ' ');
      const end = raw.indexOf('*/', i + 2);
      offset = end < 0 ? raw.length : end + 2;
      i = offset - 1;
    } else if (raw.startsWith('<!--', i) || raw.startsWith('-->', i)) {
      pieces.push(raw.slice(offset, i));
      offset = i + (raw.startsWith('<!--', i) ? 4 : 3);
      i = offset - 1;
    }
  }
  pieces.push(raw.slice(offset));
  return pieces.join('');
}

function* rules(raw: string): Generator<{ selector: string; fields: Field[] }> {
  const input = cssWithoutComments(raw);
  let offset = 0;
  while (offset < input.length) {
    const open = input.indexOf('{', offset);
    if (open < 0) return;
    let close = open + 1;
    let quote = '';
    for (; close < input.length; close++) {
      const char = input[close];
      if (quote) {
        if (char === '\\') close++;
        else if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '}') break;
    }
    if (close >= input.length) return;
    yield { selector: input.slice(offset, open).trim(), fields: declarations(input.slice(open + 1, close)) };
    offset = close + 1;
  }
}

function* parameterAssignments(raw: string): Generator<Field> {
  const input = cssWithoutComments(raw);
  for (let i = 0; i < input.length;) {
    if (!/[A-Za-z]/.test(input[i]!)) { i++; continue; }
    const start = i++;
    while (i < input.length && /[A-Za-z0-9_-]/.test(input[i]!)) i++;
    const name = input.slice(start, i).toLowerCase();
    while (i < input.length && SPACE.test(input[i]!)) i++;
    if (input[i] !== '=') continue;
    i++;
    while (i < input.length && SPACE.test(input[i]!)) i++;
    const quote = input[i];
    let value: string;
    if (quote === '"' || quote === "'") {
      const valueStart = ++i;
      while (i < input.length && input[i] !== quote) i++;
      value = input.slice(valueStart, i);
      if (i < input.length) i++;
    } else {
      const valueStart = i;
      while (i < input.length && !SPACE.test(input[i]!) && input[i] !== ';') i++;
      value = input.slice(valueStart, i);
    }
    yield { name, value };
  }
}

function projectText(raw: string, ctx: ParseContext, line: number): string {
  // Most paragraphs and inter-paragraph gaps have no markup. Preserve exactly
  // the same HTML ASCII-space collapse, including decoded numeric whitespace;
  // String.trim() would incorrectly remove NBSP and other Unicode text spaces.
  if (!raw.includes('<')) return decodeEntities(raw, 'html').replace(/[\t\n\f\r ]+/g, ' ').replace(/^ | $/g, '');
  const chunks: string[] = [];
  let cursor = 0;
  let pre = 0;
  let hadPre = false;
  let ignored = '';
  const warned = new Set<string>();
  const append = (text: string): void => {
    if (ignored) return;
    const decoded = decodeEntities(text, 'html');
    chunks.push(pre ? decoded : decoded.replace(/[\t\n\f\r ]+/g, ' '));
  };
  for (const tag of tags(raw)) {
    append(raw.slice(cursor, tag.start));
    cursor = tag.end;
    if (ignored) {
      if (tag.closing && tag.name === ignored) ignored = '';
      continue;
    }
    if (tag.name.startsWith('!')) continue;
    if (tag.malformed) {
      append(raw.slice(tag.start, tag.end));
      continue;
    }
    if (tag.name === 'script' || tag.name === 'style') {
      if (!tag.closing) ignored = tag.name;
      if (!warned.has(tag.name)) ctx.diagnostic('SAMI_NON_TEXT_CONTENT', 'warning', `${tag.name} content is retained only in rawText; it is never executed.`, line);
      warned.add(tag.name);
    } else if (tag.name === 'br' || tag.name === 'hr') {
      if (!tag.closing) chunks.push('\n');
    } else if (tag.name === 'pre') {
      hadPre = true;
      pre = tag.closing ? Math.max(0, pre - 1) : pre + 1;
    } else if (tag.name === 'img') {
      if (!tag.closing) chunks.push(first(tag.fields, 'alt') ?? '');
      if (!warned.has('img')) ctx.diagnostic('SAMI_IMAGE_NOT_RENDERED', 'warning', 'Image alt text is included when present; images are retained in rawText and never fetched.', line);
      warned.add('img');
    } else if (BLOCK_TAGS.has(tag.name)) chunks.push('\n');
    else if ((tag.name === 'td' || tag.name === 'th') && tag.closing) chunks.push('\t');
    else if (!KNOWN_TAGS.has(tag.name) && !warned.has(tag.name)) {
      ctx.diagnostic('SAMI_UNKNOWN_TAG', 'warning', `Unsupported tag ${tag.name} is retained in rawText; its text content is included.`, line);
      warned.add(tag.name);
    }
  }
  append(raw.slice(cursor));
  const text = chunks.join('');
  return hadPre ? text : text.replace(/[\t\f\r ]+/g, ' ').replace(/ *\n */g, '\n').replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '');
}

/** Independent per-class state: a missing class does not clear another language. */
export function parseSami(lines: string[], ctx: ParseContext): void {
  const input = lines.join('\n');
  const lineStarts = [0];
  for (let i = 0; i < input.length; i++) if (input[i] === '\n') lineStarts.push(i + 1);
  const lineAt = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (lineStarts[middle]! <= offset) low = middle;
      else high = middle;
    }
    return low + 1;
  };
  const range = (start: number, end: number): SourceRange => ({ line: lineAt(start), endLine: lineAt(Math.max(start, end - 1)) });
  const tracks = new Map<string, Track>();
  const active = new Map<string, Cue>();
  const getTrack = (className: string): Track => {
    const id = className ? `sami:class:${className}` : 'sami:default';
    let track = tracks.get(id);
    if (!track) {
      track = { id, ...(className ? { sourceClass: className } : {}) };
      tracks.set(id, track);
      ctx.tracks.push(track);
    }
    return track;
  };
  let block: SyncBlock | null = null;
  let paragraph: Paragraph | null = null;
  let capture: { name: string; start: number; contentStart: number } | null = null;
  let sawRoot = false;
  let sawSync = false;
  let warnedSourceId = false;
  let previousStart: number | null = null;
  let strayStart: number | null = null;
  const finishParagraph = (end: number): void => {
    if (paragraph && block) {
      paragraph.end = end;
      block.paragraphs.push(paragraph);
    }
    paragraph = null;
  };
  const finishBlock = (end: number): void => {
    finishParagraph(end);
    if (!block) return;
    if (block.paragraphs.length === 0) {
      const raw = input.slice(strayStart ?? end, end);
      if (projectText(raw, ctx, lineAt(block.offset)).trim()) {
        ctx.diagnostic('SAMI_MISSING_PARAGRAPH', 'warning', 'SYNC text without P was recovered into the default track.', lineAt(block.offset));
        block.paragraphs.push({ start: strayStart ?? block.offset, contentStart: strayStart ?? block.offset, end, fields: [], className: '' });
      } else {
        // Historical Microsoft SAMI guidance (W3C-hosted §4.9) explicitly
        // closes the caption block when a SYNC has no content.
        for (const prior of active.values()) {
          if (block.start > prior.start) prior.end = block.start;
          else ctx.diagnostic('SAMI_AMBIGUOUS_END', 'warning', 'An empty SYNC cannot end a cue at an equal or earlier time; end remains null.', lineAt(block.offset));
        }
        active.clear();
        ctx.metadata.push({ kind: 'sami-clear-all', raw, source: range(block.offset, end), fields: [{ name: 'start', value: String(block.start) }] });
      }
    } else {
      // Explicit </P> may leave free text before the next paragraph. Recover it
      // explicitly, instead of quietly dropping it when other paragraphs exist.
      const paragraphs: Paragraph[] = [];
      let gapStart = strayStart ?? block.offset;
      const recoverGap = (gapEnd: number): void => {
        const raw = input.slice(gapStart, gapEnd);
        if (projectText(raw, ctx, lineAt(gapStart)).trim()) {
          ctx.diagnostic('SAMI_UNASSIGNED_TEXT', 'warning', 'Text outside P was recovered into the default track.', lineAt(gapStart));
          paragraphs.push({ start: gapStart, contentStart: gapStart, end: gapEnd, fields: [], className: '' });
        }
      };
      for (const p of block.paragraphs) {
        recoverGap(p.start);
        paragraphs.push(p);
        gapStart = p.end;
      }
      recoverGap(end);
      block.paragraphs = paragraphs;
    }
    const grouped = new Map<string, Paragraph[]>();
    for (const p of block.paragraphs) {
      const group = grouped.get(p.className);
      if (group) group.push(p);
      else grouped.set(p.className, [p]);
    }
    for (const [className, paragraphs] of grouped) {
      const track = getTrack(className);
      const prior = active.get(track.id);
      if (prior) {
        if (block.start > prior.start) prior.end = block.start;
        else ctx.diagnostic('SAMI_AMBIGUOUS_END', 'warning', 'A non-increasing update cannot give the previous cue a valid end; that end remains null.', lineAt(block.offset));
      }
      const rawParts = paragraphs.map(p => input.slice(p.contentStart, p.end));
      const texts = rawParts.map((raw, index) => projectText(raw, ctx, lineAt(paragraphs[index]!.start)));
      const fields = paragraphs.flatMap((p, index) => p.fields.map(field => ({ name: `p.${index}.${field.name}`, value: field.value })));
      const source = range(paragraphs[0]!.start, paragraphs.at(-1)!.end);
      const rawText = rawParts.join('\n');
      if (texts.every(text => /^[\s\u00a0]*$/.test(text))) {
        active.delete(track.id);
        ctx.metadata.push({ kind: 'sami-clear', raw: rawText, source, fields: [{ name: 'trackId', value: track.id }, { name: 'start', value: String(block.start) }, ...fields] });
      } else {
        const cue: Cue = { start: block.start, end: null, trackId: track.id, text: texts.join('\n'), rawText, source, fields };
        if (ctx.addCue(cue)) active.set(track.id, cue);
      }
    }
    block = null;
  };
  const finishCapture = (end: number, tagEnd: number): void => {
    if (!capture) return;
    const raw = input.slice(capture.contentStart, end);
    const name = capture.name;
    ctx.metadata.push({ kind: `sami-${name}`, raw, source: range(capture.start, tagEnd) });
    if (name === 'style') {
      for (const rule of rules(raw)) {
        let label: string | undefined;
        let language: string | undefined;
        let kind: string | undefined;
        for (const field of rule.fields) {
          if (field.name === 'name') label = field.value;
          else if (field.name === 'lang') language = field.value;
          else if (field.name === 'samitype' || field.name === 'sami_type') kind = field.value;
        }
        for (const selector of rule.selector.split(',')) {
          const match = /^(?:p)?\.([^\s.#:[\]>+~(),]+)$/i.exec(selector.trim());
          if (!match) continue;
          const track = getTrack(match[1]!);
          if (label !== undefined) track.label = label;
          if (language !== undefined) track.language = language;
          if (kind !== undefined) track.kind = kind;
        }
      }
    } else if (name === 'samiparam') {
      for (const field of parameterAssignments(raw)) if (field.name === 'timestamp' && field.value.toLowerCase() !== 'ms') {
        ctx.fatal('SAMI_UNSUPPORTED_TIME_UNIT', `SAMI TimeStamp unit ${field.value} is unsupported; milliseconds cannot be assumed.`, lineAt(capture.start));
      }
      for (const rule of rules(raw)) if (rule.selector.toLowerCase() === 'metrics') {
        for (const field of rule.fields) if (field.name === 'time' && field.value.toLowerCase() !== 'ms') {
          ctx.fatal('SAMI_UNSUPPORTED_TIME_UNIT', `SAMI Metrics time unit ${field.value} is unsupported; milliseconds cannot be assumed.`, lineAt(capture.start));
        }
      }
    }
    capture = null;
  };

  for (const tag of tags(input)) {
    if (tag.malformed) ctx.diagnostic('SAMI_MALFORMED_TAG', 'warning', 'Malformed or unterminated markup was found; inspect sourceText for the exact input.', lineAt(tag.start));
    if (capture) {
      if (tag.closing && tag.name === capture.name) finishCapture(tag.start, tag.end);
      continue;
    }
    if (tag.name === 'sami' && !tag.closing) sawRoot = true;
    if (['head', 'style', 'samiparam', 'title'].includes(tag.name) && !tag.closing && tag.name !== 'head') {
      capture = { name: tag.name, start: tag.start, contentStart: tag.end };
      continue;
    }
    // Never interpret fake timing/paragraph tags inside executable raw-text content.
    if (tag.name === 'script' && !tag.closing) {
      capture = { name: 'script', start: tag.start, contentStart: tag.end };
      ctx.diagnostic('SAMI_NON_TEXT_CONTENT', 'warning', 'Script content is retained as metadata/rawText and is never executed.', lineAt(tag.start));
      continue;
    }
    if (tag.name === 'sync' && !tag.closing) {
      finishBlock(tag.start);
      sawSync = true;
      if (tag.fields.filter(field => field.name === 'start').length > 1) ctx.diagnostic('SAMI_DUPLICATE_ATTRIBUTE', 'warning', 'Duplicate SYNC Start attribute: the first selects semantics; sourceText retains all values.', lineAt(tag.start));
      const startValue = first(tag.fields, 'start');
      if (startValue === undefined || !/^\d+$/.test(startValue.trim()) || !Number.isSafeInteger(Number(startValue))) {
        ctx.diagnostic('SAMI_INVALID_START', 'error', 'SYNC Start requires a nonnegative safe integer in milliseconds; this block was skipped.', lineAt(tag.start));
        block = null;
        continue;
      }
      const start = Number(startValue);
      if (previousStart !== null && start <= previousStart) ctx.diagnostic('SAMI_NON_INCREASING_SYNC', 'warning', 'SYNC starts are not strictly increasing; source order is preserved.', lineAt(tag.start));
      previousStart = start;
      block = { start, offset: tag.start, paragraphs: [] };
      strayStart = tag.end;
    } else if (tag.name === 'p' && !tag.closing) {
      finishParagraph(tag.start);
      if (!block) {
        ctx.diagnostic('SAMI_PARAGRAPH_WITHOUT_SYNC', 'warning', 'Paragraph outside a valid SYNC block is retained only in sourceText.', lineAt(tag.start));
        continue;
      }
      const className = first(tag.fields, 'class')?.trim() ?? '';
      if (!warnedSourceId && first(tag.fields, 'id')?.trim().toLowerCase() === 'source') {
        warnedSourceId = true;
        ctx.diagnostic('SAMI_SOURCE_ID_UNAPPLIED', 'warning', 'Source ID paragraph text and fields are retained, but persistent speaker state and separate Source ID display are not modeled.', lineAt(tag.start));
      }
      if (/\s/.test(className)) ctx.diagnostic('SAMI_COMPLEX_CLASS', 'warning', 'A multi-token Class is kept as a distinct track; CSS class-list matching is not implemented.', lineAt(tag.start));
      const duplicateNames = new Set<string>();
      for (const field of tag.fields) {
        if (duplicateNames.has(field.name)) ctx.diagnostic('SAMI_DUPLICATE_ATTRIBUTE', 'warning', `Duplicate ${field.name} attribute: the first selects semantics, all are retained in fields.`, lineAt(tag.start));
        duplicateNames.add(field.name);
      }
      paragraph = { start: tag.start, contentStart: tag.end, end: tag.end, fields: tag.fields, className };
    } else if (tag.name === 'p' && tag.closing) finishParagraph(tag.start);
    else if (tag.closing && ['sync', 'body', 'sami'].includes(tag.name)) {
      finishBlock(tag.start);
      if (tag.name === 'sami') {
        if (input.slice(tag.end).trim()) {
          ctx.metadata.push({ kind: 'sami-trailing', raw: input.slice(tag.end), source: range(tag.end, input.length) });
          ctx.diagnostic('SAMI_TRAILING_CONTENT', 'info', 'Content after the closing SAMI element is retained as trailing metadata and is not parsed as cues.', lineAt(tag.end));
        }
        break;
      }
    }
  }
  if (capture) {
    ctx.diagnostic('SAMI_UNCLOSED_METADATA', 'warning', 'An unclosed metadata/raw-text element consumed the remaining input.', lineAt(capture.start));
    finishCapture(input.length, input.length);
  }
  finishBlock(input.length);
  for (const cue of ctx.cues) if (cue.end === null) ctx.diagnostic('SAMI_OPEN_ENDED_CUE', 'info', 'No reliable later update supplies an end for this track; end remains null.', cue.source.line);
  if (!sawRoot) ctx.diagnostic('SAMI_MISSING_ROOT', 'warning', 'SAMI root element is missing; SYNC fragments were recovered.');
  if (!sawSync) ctx.diagnostic('SAMI_NO_SYNC', 'error', 'No SYNC blocks were found.');
}
