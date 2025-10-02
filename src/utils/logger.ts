import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'charts.log');

function ensureDir() {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

export function log(level: 'info' | 'warn' | 'error', message: string, meta?: any) {
  try {
    ensureDir();
    const entry = { ts: new Date().toISOString(), level, message, meta };
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    // swallow logging errors
    // console.warn('logger failed', e);
  }
}

export default { log };
