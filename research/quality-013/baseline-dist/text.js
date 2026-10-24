import { HTML_ENTITIES } from './entities.js';
import { vttTime } from './time.js';
// HTML numeric reference compatibility replacements (WHATWG HTML).
const C1 = [0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178];
/** Decode exactly once. Unknown/malformed references are kept verbatim. */
export function decodeEntities(text, mode, unknown) {
    return text.replace(/&(?:#(?:[xX][0-9a-fA-F]+|[0-9]+);?|[a-zA-Z][a-zA-Z0-9]*;?)/g, (raw, offset) => {
        const name = raw.slice(1);
        if (name.startsWith('#')) {
            const digits = name.endsWith(';') ? name.slice(0, -1) : name;
            let cp = digits[1]?.toLowerCase() === 'x' ? parseInt(digits.slice(2), 16) : Number(digits.slice(1));
            if (!(cp > 0 && cp <= 0x10ffff) || (cp >= 0xd800 && cp <= 0xdfff)) {
                unknown?.(raw);
                return '\uFFFD';
            }
            if (cp >= 0x80 && cp <= 0x9f)
                cp = C1[cp - 0x80];
            return String.fromCodePoint(cp);
        }
        // Longest named match; at most 32 checks even for a megabyte-long bogus name.
        for (let length = Math.min(name.length, 32); length > 0; length--) {
            const key = name.slice(0, length);
            if (Object.hasOwn(HTML_ENTITIES, key)) {
                if (mode === 'attribute' && !key.endsWith(';') && /[=a-zA-Z0-9]/.test(name[length] ?? text[offset + raw.length] ?? ''))
                    return raw;
                return HTML_ENTITIES[key] + name.slice(length);
            }
        }
        unknown?.(raw);
        return raw;
    });
}
function* markup(raw, quoted) {
    let position = 0;
    while (position < raw.length) {
        const index = raw.indexOf('<', position);
        if (index < 0)
            return;
        let quote = '';
        let i = index + 1;
        for (; i < raw.length; i++) {
            const c = raw[i];
            if (quote) {
                if (c === quote)
                    quote = '';
            }
            else if (quoted && (c === '"' || c === "'"))
                quote = c;
            else if (c === '>')
                break;
            // WebVTT annotations can contain '<'; only '>' terminates the token.
            // SRT's HTML-like recovery still restarts at a nested opening delimiter.
            else if (quoted && c === '<')
                break;
        }
        if (i === raw.length)
            return;
        if (quoted && raw[i] === '<') {
            position = i;
            continue;
        }
        yield { raw: raw.slice(index, i + 1), index };
        position = i + 1;
    }
}
/** A reading projection, not a renderer or HTML sanitizer. Markup remains in rawText. */
export function projectText(raw, mode, ctx, line, start, end) {
    const parts = [];
    const fields = [];
    let position = 0;
    let lastTimestamp = start;
    let unknownTag = false;
    let sawMarkup = false;
    for (const match of markup(raw, mode === 'srt')) {
        parts.push(decodeEntities(raw.slice(position, match.index), mode === 'vtt' ? 'vtt' : 'html', () => ctx.diagnostic('ENTITY_RECOVERY', 'warning', 'Invalid or unknown character reference recovered; rawText retains the original spelling.', line)));
        const tag = match.raw;
        const inner = tag.slice(1, -1);
        const timestamp = mode === 'vtt' ? vttTime(inner) : null;
        const known = mode === 'vtt'
            ? /^\/?(?:b|i|u|ruby|rt|c|v|lang)(?:\.[^\t\n\r &<>.]+)*(?:[ \t]+[^>\r\n]*)?$/.test(inner)
            : /^\/?(?:b|i|u|s|font(?:[ \t]+[\s\S]*)?|br\s*\/?)$/i.test(inner);
        if (timestamp !== null) {
            if (timestamp <= lastTimestamp || timestamp >= end)
                ctx.diagnostic('VTT_TIMESTAMP_ORDER', 'warning', 'Inline timestamp must increase strictly within cue interval.', line);
            lastTimestamp = timestamp;
            fields.push({ name: 'timestamp', value: inner });
        }
        else if (known) {
            sawMarkup = true;
            fields.push({ name: 'markup', value: tag });
            if (mode === 'srt' && /^br\b/i.test(inner))
                parts.push('\n');
        }
        else {
            unknownTag = true;
            parts.push(tag);
        }
        position = match.index + tag.length;
    }
    parts.push(decodeEntities(raw.slice(position), mode === 'vtt' ? 'vtt' : 'html', () => ctx.diagnostic('ENTITY_RECOVERY', 'warning', 'Invalid or unknown character reference recovered; rawText retains the original spelling.', line)));
    if (unknownTag)
        ctx.diagnostic('UNKNOWN_MARKUP', 'warning', 'Unrecognized markup is preserved literally in the reading text.', line);
    if (sawMarkup)
        ctx.diagnostic('MARKUP_PRESERVED', 'info', 'Reading text flattens markup; rawText and fields preserve tags, voices and languages.', line);
    return { text: parts.join(''), fields };
}
