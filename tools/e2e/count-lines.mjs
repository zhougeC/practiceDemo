// TASK-002 [build] 行数门禁（plan.md §3.1 / ADR-31）：按"代码行"统计应用代码。
// 代码行 = 非空、且不是纯注释的行：
//   - JS：去掉 /* */ 块内（含跨行）的行、以及以 // 开头的行；
//   - HTML/CSS：去掉 <!-- --> 块内的行、/* */ 块内的行，以及空行。
// 门禁：应用代码（不含 tests、tools、vendor）的代码行合计 ≤ 5600。
// 逐文件上限只是分配目标，超出时不判失败（ADR-31），因此这里只报告，不做逐文件断言。
// 用法：node tools/e2e/count-lines.mjs [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const EXCLUDE_DIRS = new Set(['tests', 'tools', 'vendor', 'node_modules', '.git']);

/**
 * 递归收集应用代码文件（js/、css/ 与根 index.html）。
 * @param {string} dir 目录
 * @param {string[]} out 输出列表
 * @returns {string[]} 文件绝对路径
 */
function collect(dir, out) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) collect(p, out);
    else if (/\.(js|css|html)$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * 统计一个文件的代码行。
 * @param {string} text 文件内容
 * @param {string} ext 扩展名（.js / .css / .html）
 * @returns {number} 代码行数
 */
function codeLines(text, ext) {
  const lines = text.split('\n');
  let n = 0;
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (ext === '.js') {
      if (inBlock) {
        if (line.indexOf('*/') >= 0) inBlock = false;
        continue;
      }
      if (line.indexOf('/*') >= 0) {
        // 单行块注释 /* ... */ 整行算注释；跨行则进入块状态
        if (line.indexOf('*/') < 0) { inBlock = true; continue; }
        if (line.indexOf('/*') === 0 && line.lastIndexOf('*/') === line.length - 2) continue;
      }
      if (line.indexOf('//') === 0) continue;
      n++;
    } else if (ext === '.css') {
      if (inBlock) {
        if (line.indexOf('*/') >= 0) inBlock = false;
        continue;
      }
      if (line.indexOf('/*') >= 0 && line.indexOf('*/') < 0) { inBlock = true; continue; }
      if (line.indexOf('/*') === 0) continue;
      n++;
    } else {
      if (inBlock) {
        if (line.indexOf('-->') >= 0) inBlock = false;
        continue;
      }
      if (line.indexOf('<!--') >= 0) {
        if (line.indexOf('-->') < 0) { inBlock = true; continue; }
        if (line.indexOf('<!--') === 0) continue;
      }
      n++;
    }
  }
  return n;
}

const files = collect(ROOT, []);
const rows = files.map((p) => {
  const text = readFileSync(p, 'utf8');
  const ext = extname(p);
  return {
    file: relative(ROOT, p),
    physical: text.split('\n').length,
    code: codeLines(text, ext),
  };
}).sort((a, b) => b.code - a.code);

const total = rows.reduce((s, r) => s + r.code, 0);
const LIMIT = 5600;
const result = { limit: LIMIT, total, pass: total <= LIMIT, files: rows };
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 1));
} else {
  for (const r of rows) console.log(String(r.code).padStart(5), String(r.physical).padStart(5), r.file);
  console.log(`TOTAL code lines ${total} (limit ${LIMIT}) → ${result.pass ? 'PASS' : 'FAIL'}`);
}
process.exit(result.pass ? 0 : 1);
