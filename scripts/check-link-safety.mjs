import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const allowedHttpPrefixes = [
  'http://localhost',
  'http://127.0.0.1',
  'http://0.0.0.0',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
];

const trackedFiles = execSync(
  'git ls-files "*.js" "*.jsx" "*.ts" "*.tsx" "*.md" "*.mdx" "*.html"',
  { encoding: 'utf8' }
)
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith('web-app/dist/'))
  .filter((file) => !file.startsWith('build/'))
  .filter((file) => !file.startsWith('node_modules/'));

const issues = [];

function isAllowedHttpUrl(url) {
  return allowedHttpPrefixes.some((prefix) => url.startsWith(prefix));
}

function findExternalHttpLinks(content) {
  const matches = [];
  const regex = /https?:\/\/[^\s"')<>\]]+/g;
  for (const match of content.matchAll(regex)) {
    const url = match[0];
    if (url.includes('${')) {
      continue;
    }
    if (url.startsWith('https://')) {
      continue;
    }
    if (isAllowedHttpUrl(url)) {
      continue;
    }
    matches.push(url);
  }
  return matches;
}

function findUnsafeBlankLinks(content) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes('target="_blank"') && !line.includes("target='_blank'")) {
      continue;
    }

    const window = [lines[index - 1] || '', line, lines[index + 1] || '', lines[index + 2] || ''].join('\n');
    if (!/rel\s*=\s*["'][^"']*noopener noreferrer[^"']*["']/.test(window)) {
      findings.push(index + 1);
    }
  }

  return findings;
}

for (const file of trackedFiles) {
  const content = readFileSync(path.resolve(file), 'utf8');
  const externalHttpLinks = findExternalHttpLinks(content);
  const unsafeBlankLinks = findUnsafeBlankLinks(content);

  for (const url of externalHttpLinks) {
    issues.push(`${file}: insecure external http link -> ${url}`);
  }

  for (const line of unsafeBlankLinks) {
    issues.push(`${file}:${line}: target="_blank" without rel="noopener noreferrer"`);
  }
}

if (issues.length > 0) {
  console.error('Link safety check failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Link safety check passed for ${trackedFiles.length} files.`);