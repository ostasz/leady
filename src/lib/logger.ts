const isProd = process.env.NODE_ENV === 'production';

export function logInfo(msg: string, meta?: Record<string, any>) {
    if (!isProd) {
        console.log(`[INFO] ${msg}`, meta ?? '');
    } else {
        // In production, we serialize meta to avoid circular references and ensure clean logs
        // We could filter out sensitive keys here if needed
        console.log(JSON.stringify({
            level: 'INFO',
            message: msg,
            ...meta
        }));
    }
}

export function logWarn(msg: string, meta?: Record<string, any>) {
    if (!isProd) {
        console.warn(`[WARN] ${msg}`, meta ?? '');
    } else {
        console.warn(JSON.stringify({
            level: 'WARN',
            message: msg,
            ...meta
        }));
    }
}

export function logError(msg: string, meta?: Record<string, any>) {
    if (!isProd) {
        console.error(`[ERROR] ${msg}`, meta ?? '');
    } else {
        console.error(JSON.stringify({
            level: 'ERROR',
            message: msg,
            ...meta
        }));
    }
}
