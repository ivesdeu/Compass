/**
 * Production build: copy root index.html + public/ into dist/ without bundling.
 * (Vite rollup would incorrectly process auth-gate.js and the main app chunk.)
 *
 * Optional: CHAT_EMBED_URL — full URL to the deployed Next.js /chat page
 * (e.g. https://your-app.vercel.app/chat). Set in Netlify env so the iframe
 * does not point at localhost in production.
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'public'), dist, { recursive: true });

const chatEmbedUrl = (process.env.CHAT_EMBED_URL || '').trim();
if (chatEmbedUrl) {
  const indexPath = join(dist, 'index.html');
  let html = readFileSync(indexPath, 'utf8');
  const next = html.replace(
    /(<meta\s+name="chat-embed-url"\s+content=")[^"]*(")/i,
    `$1${chatEmbedUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}$2`,
  );
  if (next === html) {
    console.warn('build-static: CHAT_EMBED_URL set but chat-embed-url meta not found in dist/index.html');
  } else {
    writeFileSync(indexPath, next);
    console.log('build-static: chat-embed-url set from CHAT_EMBED_URL');
  }
}

console.log('dist/ ready (static copy from index.html + public/)');
