// Scans the project for the "fake font" malware that infected this repo in
// Sept 2026 (commits f6ec584 on main, 9627df6 on Dev were force-pushed with it).
// It hid an obfuscated JS payload in a .woff2 file, ran it from a hidden
// .vscode task on folderOpen, and appended it to tailwind.config.js behind a
// long run of spaces so it also ran on every `npm run dev` / `build`.
//
// The Oct 2026 wave changed disguise: the payload sat in public/fonts/ as
// fa-brand-400.orc (an extension nothing scanned), a copy went into a root
// file named `init` (no extension), package.json scripts became
// `node init && next dev`. Earlier, infected machines had also rewritten
// .gitignore (no more .env lines, a new config.bat line) and that went out
// with normal commits as far back as Jan 2026.
//
// Runs automatically before `dev`, `dev:next` and `build` (npm pre-scripts),
// from the git hooks in .githooks/, and in CI (.github/workflows).
//
// Plain Node with no dependencies and no git/`file` binaries, because Vercel
// and Railway builds have neither a .git folder nor a guaranteed `file`.
// It only READS files and never imports anything from the project, so it is
// safe to run on a checkout you do not trust yet.
//
// Usage: node scripts/security-scan.mjs   (exit code 1 = something found)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const IN_CI = process.env.GITHUB_ACTIONS === 'true';

// Generated or third-party output. Everything else is scanned, including
// public/ (where a disguised font would live) and this script itself.
// Any `.next*` folder is build output too (.next-dev, .next-build, ...).
const SKIP_DIR_PREFIX = '.next';
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  'out',
  'build',
  'dist',
  'coverage',
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Campaign tag the payload sets first thing: a global named "!" (Houseiana,
// Sept 2026) or "i" (Nawy, Apr 2026) assigned a version like 9-8619,
// A9-8618 or 9-8618-<suffix>. The version changes between waves, so match
// the shape, not the value. \x21 is "!", so this file does not match itself.
const MARKER = /global\s*(\[\s*['"]\x21['"]\s*\]|\.i)\s*=\s*['"][A-Z]?\d+-\d+/;
// Every wave ends the loader by calling itself with Node's global object and
// require, so it can load modules from inside a config file. App code never
// does this. Split with \s* so this file does not match itself.
const LOADER_CALL = /\}\s*\(\s*global\s*,\s*require\s*\)\s*\)/;

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const BINARY_ASSET_EXT = new Set([
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
]);
// Text formats that are not code. Any other text file (no extension, or one
// like .orc) is checked for JavaScript hiding inside it.
const TEXT_DATA_EXT = new Set([
  '.md',
  '.mdx',
  '.txt',
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.htm',
  '.svg',
  '.xml',
  '.yml',
  '.yaml',
  '.toml',
  '.lock',
  '.map',
  '.csv',
  '.log',
  '.example',
  '.sample',
  '.template',
  '.php',
  '.py',
  '.sh',
  '.ps1',
  '.bat',
  '.cmd',
  '.sql',
  '.vue',
  '.svelte',
  '.astro',
  '.hbs',
  '.handlebars',
  '.ejs',
  '.pug',
  '.twig',
]);
const CONFIG_FILE =
  /(\.config\.[cm]?[jt]s|^server\.js|^\.eslintrc.*|^package\.json)$/;
// Signs of JavaScript. A file needs two of them to count, so a README or a
// shell script that mentions one in passing does not match.
const JS_SIGNS = [
  /\brequire\s*\(\s*['"]/,
  /\bmodule\.exports\b|\bexports\.[\w$]+\s*=/,
  /\b(?:const|let|var)\s+[\w$]+\s*=/,
  /=>/,
  /\bfunction\s*\(/,
];

let failed = false;

function report(file, message) {
  failed = true;
  if (IN_CI) {
    console.log(`::error file=${file}::${message}`);
  } else {
    console.error(`  ✖ ${file}\n      ${message}`);
  }
}

function warn(file, message) {
  if (IN_CI) {
    console.log(`::warning file=${file}::${message}`);
  } else {
    console.warn(`  ⚠ ${file}\n      ${message}`);
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const skip =
        SKIP_DIRS.has(entry.name) || entry.name.startsWith(SKIP_DIR_PREFIX);
      if (!skip) yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

// Real fonts and images are full of control bytes. The payload was plain JS
// saved as fa-solid-900.woff2, so a "binary" asset that reads as printable
// text is a disguised script.
function looksLikeText(buf) {
  const sample = buf.subarray(0, 8192);
  if (sample.length === 0) return false;
  let printable = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte < 127)
    ) {
      printable++;
    }
  }
  return printable / sample.length > 0.95;
}

function looksLikeJs(text) {
  return JS_SIGNS.filter((sign) => sign.test(text)).length >= 2;
}

// 8. npm scripts that run a file which is not a JS file (`node init`), or
// run inline code (`node -e`). Checked in every package.json, since
// monorepo sub-projects were infected too.
function checkScripts(file, full, text) {
  let scripts;
  try {
    ({ scripts = {} } = JSON.parse(text));
  } catch {
    return;
  }
  const base = dirname(full);
  for (const [script, command] of Object.entries(scripts)) {
    if (typeof command !== 'string') continue;
    // (?<![\w-]) so `ts-node --compiler-options {...}` is not read as node.
    if (/(?<![\w-])node\s+(?:-[\w-]+\s+)*(?:-e|--eval|-p|--print)\b/.test(command)) {
      report(file, `npm script "${script}" runs inline code: ${command}`);
    }
    const runs = /(?<![\w-])node\s+(?:-{1,2}[\w-]+(?:=\S+)?\s+)*([^\s&|;'"-][^\s&|;'"]*)/g;
    for (const [, target] of command.matchAll(runs)) {
      if (target === '.' || CODE_EXT.has(extname(target).toLowerCase())) {
        continue;
      }
      // `node server` resolves to server.js; anything else is not a script.
      if (!extname(target) && existsSync(join(base, `${target}.js`))) continue;
      report(
        file,
        `npm script "${script}" runs "${target}", which is not a JS file: ${command}`
      );
    }
  }
}

for (const full of walk(ROOT)) {
  const file = relative(ROOT, full).split(sep).join('/');
  const name = basename(file);
  const ext = extname(file).toLowerCase();

  let buf;
  try {
    if (statSync(full).size > MAX_FILE_BYTES) continue;
    buf = readFileSync(full);
  } catch (err) {
    // Antivirus locks or quarantines files it flags, so an unreadable file
    // is a finding in itself. Keep scanning the rest either way.
    report(file, `Could not read file (${err.code}), possibly quarantined by antivirus`);
    continue;
  }

  // 1. Known markers of this malware family, in any file type.
  const latin = buf.toString('latin1');
  const tag = latin.match(MARKER);
  if (tag) {
    report(file, `Known malware marker found: ${tag[0]}`);
  }
  if (LOADER_CALL.test(latin)) {
    report(file, 'Malware loader found (code that runs itself with global and require)');
  }

  // 2. Binary assets that are really text.
  if (BINARY_ASSET_EXT.has(ext)) {
    if (looksLikeText(buf)) {
      report(
        file,
        'Font/image file is actually text - possible disguised script'
      );
    }
    continue;
  }

  // 3. Editor tasks that run by themselves when the folder is opened.
  const isEditorConfig =
    file.startsWith('.vscode/') || ext === '.code-workspace';
  if (isEditorConfig) {
    const text = buf.toString('utf8');
    if (/"runOn"\s*:\s*"folderOpen"/.test(text)) {
      report(file, 'Auto-run editor task (runOn: folderOpen)');
    }
    if (text.includes('task.allowAutomaticTasks')) {
      report(
        file,
        'Workspace enables automatic tasks (task.allowAutomaticTasks)'
      );
    }
  }

  // 9. A committed .env file. Locally it is normal and git-ignored, but in a
  // CI checkout it can only be there because someone committed it.
  if (IN_CI && /^\.env(\.(?!example$|sample$|template$)[\w.-]+)?$/.test(name)) {
    report(file, 'Environment file with secrets is committed to the repo');
  }

  // 10. JavaScript hiding in a file with no extension (`init`) or one that
  // nothing else checks (`.orc`).
  const isHiddenJs =
    !CODE_EXT.has(ext) &&
    !TEXT_DATA_EXT.has(ext) &&
    !file.startsWith('.vscode/') &&
    !name.startsWith('.') &&
    looksLikeText(buf) &&
    looksLikeJs(buf.toString('utf8'));
  if (isHiddenJs) {
    report(file, 'JavaScript code in a file without a JS extension');
  }

  const isConfig = CONFIG_FILE.test(name);
  const isCode = CODE_EXT.has(ext) || isHiddenJs;
  if (!isCode && !isConfig) continue;
  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);

  if (isCode) {
    // 4. Code hidden after a long run of spaces, so it sits off-screen.
    // Needs code BEFORE the spaces too (`};<spaces>payload`), otherwise
    // deeply indented JSX would match.
    if (lines.some((line) => /\S {80,}\S/.test(line))) {
      report(file, 'Code hidden after a long run of spaces');
    }
    // 5. Obfuscator output: many identifiers like _0x followed by 4-6 hex
    // digits. The payload has hundreds; a threshold keeps one-off constants
    // such as the _0x80040111 Firefox error code in old jQuery from matching.
    const obfuscated = text.match(/(?<![\w$])_0x[0-9a-f]{4,6}(?![\w$])/g);
    if (obfuscated && obfuscated.length >= 10) {
      report(file, 'Obfuscated identifiers (_0x...) found');
    }
    // Newer obfuscator builds use random names instead of _0x, but keep the
    // string-array rotation loop and hundreds of hex literals.
    const hexLiterals = text.match(/\b0x[0-9a-f]{2,}\b/gi);
    if (
      /while\s*\(\s*!!\[\]\s*\)/.test(text) &&
      hexLiterals &&
      hexLiterals.length >= 100
    ) {
      report(file, 'Obfuscated code (string-array rotation + hex literals) found');
    }
  }

  // 6. Config files are short and hand-written; one very long line there
  // means something was injected. (App code has legit long lines, so only
  // configs get this check.)
  if (isConfig && lines.some((line) => line.length > 500)) {
    report(file, 'Config file has a line longer than 500 characters');
  }

  if (name === 'package.json') checkScripts(file, full, text);
}

// 7. npm lifecycle hooks run on `npm install`. None exist today, so a new one
// should be looked at by a human. Warning only, since some are legit.
try {
  const { scripts = {} } = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
    if (scripts[hook]) {
      warn(
        'package.json',
        `npm "${hook}" hook present, review it: ${scripts[hook]}`
      );
    }
  }
} catch {
  // No package.json or invalid JSON: nothing to check here.
}

// 11. On infected machines the malware edits .gitignore: it deletes the .env
// lines so the next commit pushes secrets, and adds config.bat so the file
// it drops in the project never shows up in `git status`.
try {
  const ignore = readFileSync('.gitignore', 'utf8');
  // Needs a rule that matches `.env` itself; `.env*.local` alone does not.
  if (!/^\s*\/?(?:\.env\*?|\*\.env)\s*$/m.test(ignore)) {
    report('.gitignore', '.env files are no longer git-ignored');
  }
  if (/^\s*\/?config\.bat\s*$/m.test(ignore)) {
    report('.gitignore', 'Ignores config.bat, the file the malware drops');
  }
} catch {
  // No .gitignore: nothing to check here.
}

if (failed) {
  console.error(
    '\nSecurity scan FAILED. Do not run or build this project until the files ' +
      'above are removed.\nSee scripts/security-scan.mjs for what each check means.'
  );
  process.exit(1);
}
console.log('\x1b[32m🔐  Security scan passed  ✅\x1b[0m');
