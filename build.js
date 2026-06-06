import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const nm = join(root, 'node_modules');
const pub = join(root, 'public');

const copies = [
  ['@mercuryworkshop/scramjet/dist', 'scramjet'],
  ['@mercuryworkshop/bare-mux/dist', 'bare-mux'],
  ['@mercuryworkshop/epoxy-transport/dist', 'epoxy'],
];

for (const [src, dest] of copies) {
  const target = join(pub, dest);
  mkdirSync(target, { recursive: true });
  cpSync(join(nm, src), target, { recursive: true, force: true });
  console.log(`Copied ${src} → public/${dest}`);
}

console.log('Build complete.');
