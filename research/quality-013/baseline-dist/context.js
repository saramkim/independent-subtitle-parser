export const DEFAULT_LIMITS = Object.freeze({
    maxInputLength: 8 * 1024 * 1024, maxLines: 250_000, maxLineLength: 1024 * 1024,
    maxCues: 100_000, maxDiagnostics: 1_000,
});
export class ParseAbort extends Error {
}
const severityRank = { info: 0, warning: 1, error: 2, fatal: 3 };
export class ParseContext {
    format;
    limits;
    cues = [];
    tracks = [];
    metadata = [];
    problem = false;
    truncated = false;
    infoCodes = new Set();
    diagnosticBuckets = [[], [], [], []];
    diagnosticCount = 0;
    diagnosticOrder = 0;
    constructor(format, limits) {
        this.format = format;
        this.limits = limits;
    }
    diagnostic(code, severity, message, line) {
        if (severity === 'info') {
            if (this.infoCodes.has(code))
                return;
            this.infoCodes.add(code);
        }
        if (severity === 'warning' || severity === 'error' || severity === 'fatal')
            this.problem = true;
        const rank = severityRank[severity];
        if (this.diagnosticCount >= this.limits.maxDiagnostics) {
            this.truncated = true;
            this.problem = true;
            // Four fixed buckets keep overflow work O(1), even for large budgets.
            const lowest = this.diagnosticBuckets.findIndex(bucket => bucket.length > 0);
            if (rank <= lowest && severity !== 'fatal')
                return;
            // Keep earlier diagnostics at equal severity; replace the newest member
            // of a lower severity when an actionable cause arrives.
            this.diagnosticBuckets[lowest].pop();
        }
        else
            this.diagnosticCount++;
        const diagnostic = { code, severity, message, ...(line === undefined ? {} : { line }) };
        this.diagnosticBuckets[rank].push({ diagnostic, order: this.diagnosticOrder++ });
    }
    fatal(code, message, line) {
        this.diagnostic(code, 'fatal', message, line);
        throw new ParseAbort(message);
    }
    addCue(cue) {
        if (!Number.isSafeInteger(cue.start) || cue.start < 0 ||
            (cue.end !== null && (!Number.isSafeInteger(cue.end) || cue.end <= cue.start))) {
            this.diagnostic('INVALID_INTERVAL', 'error', 'Cue requires safe nonnegative integer milliseconds and end greater than start.', cue.source.line);
            return false;
        }
        if (this.cues.length >= this.limits.maxCues)
            this.fatal('CUE_LIMIT', 'Cue count exceeds maxCues.', cue.source.line);
        this.cues.push(cue);
        return true;
    }
    result(sourceText, fatal = false) {
        const diagnostics = this.diagnosticBuckets.flat().sort((a, b) => a.order - b.order).map(entry => entry.diagnostic);
        return { format: this.format, status: fatal ? 'fatal' : this.problem ? 'partial' : 'ok',
            cues: fatal ? [] : this.cues, tracks: fatal ? [] : this.tracks,
            metadata: fatal ? [] : this.metadata, diagnostics, diagnosticsTruncated: this.truncated, sourceText };
    }
}
