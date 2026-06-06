import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketWebsiteCommand,
  DeletePublicAccessBlockCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, relative, extname } from 'path';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import https from 'https';
import http from 'http';

const REGION = 'us-east-2';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const COUNT = parseInt(process.argv[2]) || 1;

function fetchBuf(url, depth = 0) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      if ([301,302,307,308].includes(r.statusCode) && r.headers.location && depth < 3) {
        r.resume();
        return fetchBuf(new URL(r.headers.location, url).href, depth + 1).then(resolve);
      }
      const chunks = [];
      r.on('data', d => chunks.push(d));
      r.on('end', () => resolve(r.statusCode < 400 ? Buffer.concat(chunks) : null));
    }).on('error', () => resolve(null));
  });
}

async function setupBucket(bucketName, files, publicDir) {
  const client = new S3Client({ region: REGION });
  await client.send(new CreateBucketCommand({
    Bucket: bucketName,
    CreateBucketConfiguration: { LocationConstraint: REGION },
  }));
  await client.send(new DeletePublicAccessBlockCommand({ Bucket: bucketName }));
  await client.send(new PutBucketPolicyCommand({
    Bucket: bucketName,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: `arn:aws:s3:::${bucketName}/*` }],
    }),
  }));
  await client.send(new PutBucketWebsiteCommand({
    Bucket: bucketName,
    WebsiteConfiguration: { IndexDocument: { Suffix: 'index.html' }, ErrorDocument: { Key: 'index.html' } },
  }));
  for (const file of files) {
    const key = relative(publicDir, file).replace(/\\/g, '/');
    const ext = extname(file).toLowerCase();
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: readFileSync(file),
      ContentType: MIME[ext] || 'application/octet-stream',
    }));
  }
  return `https://${bucketName}.s3.amazonaws.com/index.html`;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    statSync(full).isDirectory() ? out.push(...walk(full)) : out.push(full);
  }
  return out;
}

const root = import.meta.dirname;
const publicDir = join(root, 'public');
const thumbDir = join(publicDir, '_thumbs');

console.log(`\nGenerating ${COUNT} bucket(s)...`);
console.log('Building static files...');
execSync('npm run build', { stdio: 'inherit' });

// Download and cache thumbnails locally
console.log('\nDownloading thumbnails...');
mkdirSync(thumbDir, { recursive: true });
const games = JSON.parse(readFileSync(join(publicDir, 'games-list.json'), 'utf8'));
const thumbMap = {};
const CONCURRENCY = 20;

for (let i = 0; i < games.length; i += CONCURRENCY) {
  const batch = games.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(async (g) => {
    const url = g.thumbnail;
    if (!url || !url.startsWith('http')) return;
    const ext = url.split('?')[0].match(/\.\w+$/)?.[0] || '.jpg';
    const fname = `${g.id.replace(/[^a-z0-9]/gi, '_')}${ext}`;
    const data = await fetchBuf(url);
    if (data) {
      writeFileSync(join(thumbDir, fname), data);
      thumbMap[g.id] = `_thumbs/${fname}`;
    }
  }));
  process.stdout.write(`  ${Math.min(i + CONCURRENCY, games.length)}/${games.length}\r`);
}

const localGames = games.map(g => ({
  ...g,
  thumbnail: thumbMap[g.id] || g.thumbnail,
}));
writeFileSync(join(publicDir, 'games-list.json'), JSON.stringify(localGames, null, 2));
console.log(`\nDownloaded ${Object.keys(thumbMap).length}/${games.length} thumbnails`);

const files = walk(publicDir);
const bucketNames = Array.from({ length: COUNT }, () => `ph-${randomBytes(5).toString('hex')}`);

console.log(`\nCreating and uploading to ${COUNT} bucket(s) in parallel...`);
const urls = await Promise.all(
  bucketNames.map(async (name, i) => {
    const url = await setupBucket(name, files, publicDir);
    process.stdout.write(`  [${i + 1}/${COUNT}] ${url}\n`);
    return url;
  })
);

// Restore original games-list.json
writeFileSync(join(publicDir, 'games-list.json'), JSON.stringify(games, null, 2));
rmSync(thumbDir, { recursive: true });

console.log('\n✓ Done! Links:\n');
urls.forEach(u => console.log(u));
console.log();
