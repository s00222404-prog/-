import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
for (const route of ['rules', 'privacy']) {
  const target = join(dist, route);
  await mkdir(target, { recursive: true });
  await copyFile(join(dist, 'index.html'), join(target, 'index.html'));
}
