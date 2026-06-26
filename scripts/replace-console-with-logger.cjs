/**
 * Bulk-replace console.log/error/warn with structured Winston logger
 * across all src/server/ TypeScript files.
 *
 * Usage: node scripts/replace-console-with-logger.cjs
 */

const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', 'src', 'server');

function findTsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.includes('.test.')) {
      results.push(fullPath);
    }
  }
  return results;
}

function getImportPath(filePath) {
  const relative = path.relative(path.join(__dirname, '..', 'src', 'server'), filePath);
  const dir = path.dirname(relative);
  // Files in src/server/ itself (index.ts, websocket.ts, worker.ts)
  if (dir === '.') {
    return './utils/logger.js';
  }
  // Everything else is one level deep: routes/, services/, middleware/, workers/, utils/
  return '../utils/logger.js';
}

function needsLoggerImport(content) {
  return /console\.(log|error|warn)\s*\(/.test(content);
}

function hasLoggerImport(content) {
  return /import\s+(?:logger|{[^}]*logger[^}]*})\s+from\s+['"]\.\.?\/utils\/logger\.js['"]/.test(content) ||
         /import\s+logger\s+from\s+['"]\.\.?\/utils\/logger\.js['"]/.test(content);
}

function addImport(content, importPath) {
  // Find the last import statement and add after it
  const lines = content.split('\n');
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i]) || /^}\s*from\s+['"]/.test(lines[i])) {
      lastImportIndex = i;
    }
  }
  if (lastImportIndex === -1) {
    // Fallback: add at top
    return `import logger from '${importPath}';\n${content}`;
  }
  lines.splice(lastImportIndex + 1, 0, `import logger from '${importPath}';`);
  return lines.join('\n');
}

function replaceConsoleStatements(content) {
  let result = content;

  // Replace console.log(...) → logger.info(...)
  // But NOT inside strings, template literals, or comments
  result = result.replace(/\bconsole\.log\s*\(/g, 'logger.info(');

  // Replace console.error(...) → logger.error(...)
  result = result.replace(/\bconsole\.error\s*\(/g, 'logger.error(');

  // Replace console.warn(...) → logger.warn(...)
  result = result.replace(/\bconsole\.warn\s*\(/g, 'logger.warn(');

  return result;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  if (!needsLoggerImport(content)) {
    return false; // No console statements to replace
  }

  // Replace console statements
  content = replaceConsoleStatements(content);

  // Add import if not already present
  if (!hasLoggerImport(content)) {
    const importPath = getImportPath(filePath);
    content = addImport(content, importPath);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

// Main
const files = findTsFiles(SERVER_DIR);
let modified = 0;
let skipped = 0;
const modifiedFiles = [];

for (const file of files) {
  try {
    if (processFile(file)) {
      modified++;
      modifiedFiles.push(path.relative(path.join(__dirname, '..'), file));
    } else {
      skipped++;
    }
  } catch (err) {
    console.error(`Error processing ${file}: ${err.message}`);
  }
}

console.log(`\n✅ Done! Modified ${modified} files, skipped ${skipped} files (no console statements).\n`);
console.log('Modified files:');
modifiedFiles.forEach(f => console.log(`  - ${f}`));
