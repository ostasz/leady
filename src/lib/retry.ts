import { logWarn } from './logger';

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function isTransient(err: any) {
    const s = err?.code || err?.status || err?.response?.status;
    return s === 429 || s === 503;
}

/**
 * Executes a function with exponential backoff retry for transient errors (429, 503).
 * @param fn Async function to execute
 * @param retries Maximum number of retries (default 2)
 * @param baseDelay Base delay in ms for backoff (default 200)
 */
export async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 200): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err: any) {
            attempt++;
            if (attempt > retries || !isTransient(err)) {
                throw err;
            }

            const backoff = Math.floor((baseDelay * 2 ** (attempt - 1)) + Math.random() * 150);
            logWarn(`[Retry] Transient error ${err?.code || 'unknown'}. Retrying in ${backoff}ms... (Attempt ${attempt}/${retries})`);

            await sleep(backoff);
        }
    }
}
