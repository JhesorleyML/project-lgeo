import { parentPort, workerData } from 'node:worker_threads';
import { runCbmsEtlJob, type EtlJobInput } from './cbms-etl-processor.js';

async function main() {
  const job = workerData as EtlJobInput | undefined;
  if (!job) {
    throw new Error('Missing workerData for CBMS ETL worker');
  }

  const result = await runCbmsEtlJob(job);
  parentPort?.postMessage({ status: 'COMPLETED', result });
}

main().catch((err) => {
  parentPort?.postMessage({
    status: 'FAILED',
    error: err instanceof Error ? err.message : 'Worker ETL execution failed',
  });
  process.exitCode = 1;
});
