import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function directorySize(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += await directorySize(full);
      } else if (entry.isFile()) {
        total += (await stat(full)).size;
      }
    } catch {
      /* file vanished mid-walk; ignore */
    }
  }
  return total;
}
