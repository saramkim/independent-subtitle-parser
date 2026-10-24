import { MAX_FILE_BYTES, readSubtitle } from './workflow.mjs';

self.onmessage = async ({ data: { file, options } }) => {
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('File exceeds the example limit of 16 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    self.postMessage({ result: readSubtitle(bytes, options) });
  } catch (error) {
    // I/O and unexpected API errors are host failures, not parser diagnostics.
    self.postMessage({ hostError: error instanceof Error ? error.message : String(error) });
  }
};
