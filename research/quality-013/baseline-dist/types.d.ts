export type SubtitleFormat = 'srt' | 'vtt' | 'sami' | 'ass' | 'ssa';
export type Severity = 'info' | 'warning' | 'error' | 'fatal';
export interface Diagnostic {
    code: string;
    severity: Severity;
    message: string;
    /** One-based source line, when available. */
    line?: number;
}
export interface SourceRange {
    line: number;
    endLine: number;
}
export interface Track {
    id: string;
    language?: string;
    label?: string;
    kind?: string;
    sourceClass?: string;
}
export interface Field {
    name: string;
    value: string;
}
/** Ordered format-specific fields preserve duplicates and avoid object-key hazards. */
export interface Cue {
    id?: string;
    start: number;
    /** null means the input provides no known end (SAMI final interval). */
    end: number | null;
    trackId: string;
    text: string;
    /** Original payload markup, with CRLF/CR normalized to LF. Never safe HTML. */
    rawText: string;
    source: SourceRange;
    settings?: string;
    fields?: Field[];
}
export interface MetadataBlock {
    kind: string;
    raw: string;
    source: SourceRange;
    fields?: Field[];
}
export interface Limits {
    maxInputLength: number;
    maxLines: number;
    maxLineLength: number;
    maxCues: number;
    maxDiagnostics: number;
}
export interface ParseOptions {
    /** Omit to detect. A format is an explicit choice, not a filename hint. */
    format?: SubtitleFormat;
    limits?: Partial<Limits>;
}
export interface Detection {
    format: SubtitleFormat | null;
    confidence: 'high' | 'low' | 'none' | 'ambiguous';
    candidates: SubtitleFormat[];
}
export interface ParseResult {
    format: SubtitleFormat | null;
    status: 'ok' | 'partial' | 'fatal';
    cues: Cue[];
    tracks: Track[];
    metadata: MetadataBlock[];
    diagnostics: Diagnostic[];
    /** True when maxDiagnostics omitted or displaced a diagnostic; repeated info codes coalesce separately. */
    diagnosticsTruncated: boolean;
    /** Exact input string, including original BOM/newline spelling. */
    sourceText: string;
}
export interface DecodeOptions {
    /** WHATWG TextDecoder label; default UTF-8, or UTF-8/UTF-16 from BOM. */
    encoding?: string;
    /** Default true: reject malformed bytes instead of replacing silently. */
    fatal?: boolean;
    maxBytes?: number;
}
export interface DecodeResult {
    text: string | null;
    encoding: string | null;
    bom: 'utf-8' | 'utf-16le' | 'utf-16be' | null;
    diagnostics: Diagnostic[];
}
