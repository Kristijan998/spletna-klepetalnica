const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const uiDir = path.join(src, 'components', 'ui');

function walk(dir) {
  let files = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) files = files.concat(walk(p));
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) files.push(p);
  }
  return files;
}

const uiFiles = fs.readdirSync(uiDir).filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
const uiBasenames = uiFiles.map(f => f.replace(/\.(js|jsx|ts|tsx)$/, ''));

const files = walk(src);
const importRegex = /@\/components\/ui\/([A-Za-z0-9_\-]+)/g;
const results = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const imp = m[1];
    const existsExact = uiBasenames.includes(imp);
    if (!existsExact) {
      const found = uiBasenames.find(b => b.toLowerCase() === imp.toLowerCase());
      results.push({file: path.relative(root, file), import: imp, existsExact, found});
    }
  }
}

if (results.length === 0) {
  console.log('No mismatched imports found.');
  process.exit(0);
}

for (const r of results) {
  console.log(`${r.file} -> import "${r.import}" : exactExists=${r.existsExact} ${r.found ? `; case-insensitive match -> "${r.found}"` : '; NO match in ui dir'}`);
}

process.exit(0);
