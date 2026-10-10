const { parentPort, workerData } = require('worker_threads');

console.info = () => {};

(async () => {
  try {
    const { decompile } = await import('@run-slicer/cfr/cfr.runtime.js');
    const classes = new Map(workerData);
    const sources = await decompile([...classes.keys()], {
      source: async (name) => classes.get(name) || null,
    });
    parentPort.postMessage({ sources });
  } catch (err) {
    parentPort.postMessage({ error: err.message || 'Unknown decompiler error' });
  } finally {
    parentPort.close();
  }
})();
