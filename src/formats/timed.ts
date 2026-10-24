import type { ParseContext } from '../context.js';
import { recoveredVttTime, srtTime, vttTime } from '../time.js';
import { projectText } from '../text.js';

function validateSettings(settings: string, ctx: ParseContext, line: number): void {
  const seen = new Set<string>();
  for (const token of settings.split(/[ \t\f]+/).filter(Boolean)) {
    const colon = token.indexOf(':');
    const name = token.slice(0, colon);
    const value = token.slice(colon + 1);
    const percent = (s: string) => /^\d+(?:\.\d+)?%$/.test(s) && Number(s.slice(0, -1)) <= 100;
    let valid = false;
    if (name === 'vertical') valid = /^(rl|lr)$/.test(value);
    if (name === 'align') valid = /^(start|center|end|left|right)$/.test(value);
    if (name === 'size') valid = percent(value);
    if (name === 'region') valid = value.length > 0;
    if (name === 'position' || name === 'line') {
      const [number, alignment, extra] = value.split(',');
      valid = extra === undefined && number !== undefined && (name === 'position' ? percent(number) : /^-?\d+$/.test(number) || percent(number)) &&
        (alignment === undefined || (name === 'position' ? /^(line-left|center|line-right)$/.test(alignment) : /^(start|center|end)$/.test(alignment)));
    }
    if (colon <= 0 || !valid) ctx.diagnostic('VTT_SETTING_UNSUPPORTED', 'warning', 'Unknown or invalid cue setting is preserved in settings.', line);
    if (seen.has(name)) ctx.diagnostic('VTT_SETTING_DUPLICATE', 'warning', 'Duplicate cue setting is preserved; no rendering precedence is applied.', line);
    seen.add(name);
  }
}

export function parseTimed(lines: string[], ctx: ParseContext): void {
  const vtt = ctx.format === 'vtt';
  const hasArrow = (value: string | undefined): boolean => value !== undefined &&
    (value.includes('-->') || (!vtt && value.includes('->')));
  ctx.tracks.push({ id: 'default' });
  let i = 0;
  let previousStart = -1;
  const identifiers = new Set<string>();
  if (vtt) {
    if (!/^WEBVTT(?:[ \t]|$)/.test(lines[0] ?? '') || lines[0]!.includes('-->')) ctx.fatal('VTT_SIGNATURE', 'WebVTT requires a WEBVTT signature at the beginning.', 1);
    const header: string[] = [lines[0]!];
    i = 1;
    while (i < lines.length && lines[i] !== '') {
      if (lines[i]!.includes('-->')) {
        ctx.diagnostic('MISSING_SEPARATOR', 'warning', 'Recovered cue after a header without an empty line.', i + 1);
        break;
      }
      header.push(lines[i++]!);
    }
    ctx.metadata.push({ kind: 'vtt-header', raw: header.join('\n'), source: { line: 1, endLine: header.length } });
    if (header.some(x => x.includes('X-TIMESTAMP-MAP'))) ctx.diagnostic('VTT_TIMESTAMP_MAP_UNAPPLIED', 'warning', 'X-TIMESTAMP-MAP is preserved but cue times remain local; HLS mapping is not applied.', 1);
  }
  while (i < lines.length) {
    if (lines[i] === '') { i++; continue; }
    const blockStart = i;
    const first = lines[i]!;
    if (vtt && !lines[i + 1]?.includes('-->') && (/^NOTE(?:[ \t]|$)/.test(first) || /^(?:STYLE|REGION)[ \t]*$/.test(first))) {
      i++;
      while (i < lines.length && lines[i] !== '') i++;
      ctx.metadata.push({ kind: `vtt-${first.split(/[ \t]/)[0]!.toLowerCase()}`, raw: lines.slice(blockStart, i).join('\n'), source: { line: blockStart + 1, endLine: i } });
      if (!/^NOTE(?:[ \t]|$)/.test(first)) {
        ctx.diagnostic('VTT_LAYOUT_UNAPPLIED', 'info', 'Style/region definitions are preserved without CSS or layout evaluation.', blockStart + 1);
        if (ctx.cues.length > 0) ctx.diagnostic('VTT_LATE_BLOCK', 'warning', 'STYLE/REGION appears after a cue.', blockStart + 1);
      }
      continue;
    }
    let id: string | undefined;
    if (!hasArrow(first) && hasArrow(lines[i + 1])) { id = first; i++; }
    const timingLine = i;
    const timing = vtt ? null : /^([ \t]*)(\S+)[ \t]+--?>[ \t]+(\S+)(?:[ \t]+([\s\S]*))?$/.exec(lines[i]!);
    // Section 6.3 browser parsing is more permissive than section 4 authoring.
    // Consume exactly three fractional digits, and only ASCII line whitespace.
    const recovered = vtt ? /^([ \t\f]*)(\d+(?::\d{2}){1,2}\.\d{3})(?!\d)([ \t\f]*)-->([ \t\f]*)(\d+(?::\d{2}){1,2}\.\d{3})(?!\d)([ \t\f]*)([\s\S]*)$/.exec(lines[i]!) : null;
    const start = vtt ? (recovered ? recoveredVttTime(recovered[2]!) : null) : (timing ? srtTime(timing[2]!) : null);
    const endPunctuation = !vtt && timing !== null && /^\d+:\d{2}:\d{2},\d{3}\.$/.test(timing[3]!);
    const end = vtt ? (recovered ? recoveredVttTime(recovered[5]!) : null) : (timing ? srtTime(endPunctuation ? timing[3]!.slice(0, -1) : timing[3]!) : null);
    if (start === null || end === null) {
      ctx.diagnostic('INVALID_TIMING', 'error', 'Unrecognized timing or orphan content; preserved in sourceText.', timingLine + 1);
      // Skip damaged block, but resynchronize at another timing or identifier+timing.
      i++;
      while (i < lines.length && lines[i] !== '' && !hasArrow(lines[i]) && !hasArrow(lines[i + 1])) i++;
      continue;
    }
    if (!vtt) {
      if (endPunctuation) ctx.diagnostic('SRT_END_PUNCTUATION', 'warning', 'Ignored one terminal period after an otherwise complete SRT end timestamp; original timing remains in sourceText.', timingLine + 1);
      if (!lines[timingLine]!.includes('-->')) ctx.diagnostic('SRT_ARROW_RECOVERED', 'warning', 'Recovered a single-dash SRT arrow; sourceText retains the original timing line.', timingLine + 1);
      if (id === undefined || !/^\d+$/.test(id)) ctx.diagnostic('SRT_INDEX', 'warning', 'Missing or nonnumeric SRT index; cue recovered.', blockStart + 1);
      if (!/^\d{2,}:\d{2}:\d{2},\d{3}$/.test(timing![2]!) || !/^\d{2,}:\d{2}:\d{2},\d{3}$/.test(timing![3]!)) ctx.diagnostic('SRT_TIME_EXTENSION', 'warning', 'Accepted dot fraction or short hour as an explicit SRT extension.', timingLine + 1);
    }
    if (vtt && recovered && (recovered[1] !== '' || recovered[3] === '' || recovered[4] === '' ||
      vttTime(recovered[2]!) === null || vttTime(recovered[5]!) === null ||
      lines[timingLine]!.includes('\f') || (recovered[7] !== '' && recovered[6] === ''))) {
      ctx.diagnostic('VTT_TIMING_RECOVERED', 'warning', 'Accepted WebVTT parser recovery outside authoring syntax; original timing remains in sourceText.', timingLine + 1);
    }
    const settings = vtt ? recovered![7]! : timing![4] ?? '';
    if (settings) {
      if (vtt) validateSettings(settings, ctx, timingLine + 1);
      else ctx.diagnostic('SRT_SETTINGS_UNAPPLIED', 'warning', 'Trailing timing-line data is preserved as settings without interpretation.', timingLine + 1);
    }
    i++;
    const payloadStart = i;
    while (i < lines.length && lines[i] !== '') {
      const timingLike = (value: string | undefined) => value !== undefined && (vtt
        ? /^[ \t\f]*\d+(?::\d{2}){1,2}\.\d+[ \t\f]*-->/.test(value)
        : /^[ \t]*\S*:\S*[ \t]+--?>/.test(value));
      if (timingLike(lines[i]) || (!vtt && /^\d+$/.test(lines[i]!) && timingLike(lines[i + 1]))) {
        ctx.diagnostic('MISSING_SEPARATOR', 'warning', 'Recovered a cue boundary without an empty line.', i + 1);
        break;
      }
      if (vtt && lines[i]!.includes('-->')) ctx.diagnostic('VTT_PAYLOAD_ARROW', 'warning', 'Arrow in non-timing payload is invalid WebVTT; the literal line is retained.', i + 1);
      i++;
    }
    const rawText = lines.slice(payloadStart, i).join('\n');
    if (!rawText) ctx.diagnostic('EMPTY_CUE', 'warning', 'Cue has an empty payload; interval is retained.', timingLine + 1);
    const projection = projectText(rawText, vtt ? 'vtt' : 'srt', ctx, payloadStart + 1, start, end);
    const added = ctx.addCue({ ...(id === undefined ? {} : { id }), start, end, trackId: 'default',
      text: projection.text, rawText, source: { line: blockStart + 1, endLine: Math.max(i, timingLine + 1) },
      ...(settings ? { settings } : {}), ...(projection.fields.length ? { fields: projection.fields } : {}) });
    if (added) {
      if (vtt && id !== undefined) {
        if (identifiers.has(id)) ctx.diagnostic('VTT_DUPLICATE_ID', 'warning', 'Duplicate WebVTT cue identifier; original IDs and cues are retained.', blockStart + 1);
        identifiers.add(id);
      }
      if (start < previousStart) ctx.diagnostic('CUE_ORDER', 'warning', 'Descending cue start time; source order is retained.', timingLine + 1);
      previousStart = start;
    }
  }
}
