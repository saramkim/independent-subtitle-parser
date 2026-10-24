// Newly authored cases; expected values come from format documents or the stated
// preservation policy, not any parser's output. This is a focused probe, not a
// representative corpus or a ranking of whole libraries.
const vtt = (timing, text = 'Hello\n안녕') => `WEBVTT\n\n${timing}\n${text}`;
export const fixtures = [
  { id: 'srt-clock-unicode', format: 'srt', basis: 'LOC SRT structure + arithmetic',
    source: '1\n01:02:03,004 --> 01:02:04,005\nHello\n안녕', expected: [[3723004, 3724005, 'Hello\n안녕']] },
  { id: 'srt-overlap', format: 'srt', basis: 'Preserve authored overlap and source order',
    source: '1\n00:00:01,000 --> 00:00:04,000\nA\n\n2\n00:00:02,000 --> 00:00:03,000\nB', expected: [[1000, 4000, 'A'], [2000, 3000, 'B']] },
  { id: 'srt-markup-preserved', format: 'srt', basis: 'Package rawText preservation policy',
    source: '1\n00:00:01,000 --> 00:00:02,000\n<i>안녕</i> &amp; A', expected: [[1000, 2000, '<i>안녕</i> &amp; A']] },
  { id: 'vtt-clock-unicode', format: 'vtt', basis: 'W3C 2026 section 4.1 + arithmetic',
    source: vtt('01:02:03.004 --> 01:02:04.005'), expected: [[3723004, 3724005, 'Hello\n안녕']] },
  { id: 'vtt-compact-arrow', format: 'vtt', basis: 'W3C 2026 section 6.3 recovery (not valid authoring)',
    source: vtt('00:01.000-->00:02.000'), expected: [[1000, 2000, 'Hello\n안녕']] },
  { id: 'vtt-single-hour', format: 'vtt', basis: 'W3C 2026 section 6.3 recovery (not valid authoring)',
    source: vtt('1:00:00.000 --> 1:00:01.000'), expected: [[3600000, 3601000, 'Hello\n안녕']] },
  { id: 'vtt-form-feed', format: 'vtt', basis: 'W3C 2026 section 6.3 + Infra ASCII whitespace',
    source: vtt('00:01.000\f-->\f00:02.000'), expected: [[1000, 2000, 'Hello\n안녕']] },
  { id: 'vtt-four-fraction-digits', format: 'vtt', basis: 'W3C 2026 section 6.3: fraction length must equal three',
    source: vtt('00:01.0000 --> 00:02.000'), expected: [] },
  { id: 'vtt-nbsp-not-timing-whitespace', format: 'vtt', basis: 'Infra ASCII whitespace excludes NBSP',
    source: vtt('00:01.000\u00a0--> 00:02.000'), expected: [] },
  { id: 'vtt-settings-adjacent', format: 'vtt', basis: 'W3C 2026 section 6.3 end timestamp then remaining settings',
    source: vtt('00:01.000 --> 00:02.000align:start'), expected: [[1000, 2000, 'Hello\n안녕']] },
  { id: 'vtt-note-style', format: 'vtt', basis: 'W3C 2026 section 4.1: non-cue blocks',
    source: 'WEBVTT\n\nNOTE note\nprivate test note\n\nSTYLE\n::cue { color: lime; }\n\n00:01.000 --> 00:02.000\nA', expected: [[1000, 2000, 'A']] },
  { id: 'vtt-duplicate-id', format: 'vtt', basis: 'Package recovery policy: diagnose but retain duplicate-ID cues',
    source: 'WEBVTT\n\nx\n00:01.000 --> 00:02.000\nA\n\nx\n00:03.000 --> 00:04.000\nB', expected: [[1000, 2000, 'A'], [3000, 4000, 'B']] },
  { id: 'ass-centiseconds', format: 'ass', basis: 'Matroska ASS centiseconds + arithmetic; raw payload policy',
    source: '[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,1:02:03.04,1:02:04.05,Default,,0,0,0,,A, B', expected: [[3723040, 3724050, 'A, B']] },
];
