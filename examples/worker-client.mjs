// Browser host recipe. One disposable worker per request; cancel also stops reads.
export function startParse(file, options, { timeoutMs = 10_000, createWorker = () => new Worker(new URL('./parse-worker.mjs', import.meta.url), { type: 'module' }) } = {}) {
  let worker, timer, rejectPending, settled = false;
  const finish = () => {
    settled = true;
    clearTimeout(timer);
    worker?.terminate();
  };
  const promise = new Promise((resolve, reject) => {
    rejectPending = reject;
    try {
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        if (settled) return;
        finish();
        if (data.hostError) reject(new Error(data.hostError));
        else resolve(data.result);
      };
      worker.onerror = () => { if (!settled) { finish(); reject(new Error('Worker failed to load or execute. Serve the example over HTTP and check browser policy.')); } };
      worker.onmessageerror = () => { if (!settled) { finish(); reject(new Error('Worker result could not be transferred.')); } };
      timer = setTimeout(() => { if (!settled) { finish(); reject(new Error('Example deadline exceeded; worker terminated.')); } }, timeoutMs);
      worker.postMessage({ file, options });
    } catch (error) { finish(); reject(error); }
  });
  return { promise, cancel() {
    if (!settled) { finish(); rejectPending(new Error('Cancelled by the host.')); }
  } };
}
