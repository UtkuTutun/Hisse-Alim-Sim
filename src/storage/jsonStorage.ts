import fs from 'fs';
import path from 'path';

export class JsonStorage {
  baseDir: string;
  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private filePath(key: string) {
    return path.join(this.baseDir, `${key}.json`);
  }

  read<T = any>(key: string): T | null {
    const fp = this.filePath(key);
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, 'utf8');
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error('json parse error', err);
      return null;
    }
  }

  write(key: string, data: any) {
    const fp = this.filePath(key);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  }
}
