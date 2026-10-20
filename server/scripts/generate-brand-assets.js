// Regenerates the brand logo and favicon in public/assets.
// Usage: node server/scripts/generate-brand-assets.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from '../config/environment.js';
import { logoImage } from './lib/placeholderImages.js';

const dir = path.join(ROOT_DIR, 'public', 'assets');
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(path.join(dir, 'key-property-logo.png'), logoImage(512));
await fs.writeFile(path.join(ROOT_DIR, 'public', 'favicon.png'), logoImage(64));
console.log('Brand assets written to public/assets/key-property-logo.png and public/favicon.png');
