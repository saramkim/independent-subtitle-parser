import type { Cue, Limits, MetadataBlock, ParseResult, Severity, SubtitleFormat, Track } from './types.js';
export declare const DEFAULT_LIMITS: Readonly<Limits>;
export declare class ParseAbort extends Error {
}
export declare class ParseContext {
    readonly format: SubtitleFormat;
    readonly limits: Limits;
    readonly cues: Cue[];
    readonly tracks: Track[];
    readonly metadata: MetadataBlock[];
    private problem;
    private truncated;
    private readonly infoCodes;
    private readonly diagnosticBuckets;
    private diagnosticCount;
    private diagnosticOrder;
    constructor(format: SubtitleFormat, limits: Limits);
    diagnostic(code: string, severity: Severity, message: string, line?: number): void;
    fatal(code: string, message: string, line?: number): never;
    addCue(cue: Cue): boolean;
    result(sourceText: string, fatal?: boolean): ParseResult;
}
