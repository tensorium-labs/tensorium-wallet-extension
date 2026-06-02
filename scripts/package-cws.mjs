import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const submissionDir = path.join(root, 'submission');
const distDir = path.join(root, 'dist');
const zipName = `tensorium-wallet-extension-v${pkg.version}.zip`;
const zipPath = path.join(submissionDir, zipName);

if (!fs.existsSync(distDir)) {
  throw new Error('dist/ not found. Run the build first.');
}

fs.mkdirSync(submissionDir, { recursive: true });
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

execFileSync('zip', ['-qr', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });

console.log(`Created ${path.relative(root, zipPath)}`);
