// 生成发布到脚本猫（ScriptCat）用的研修助手副本：去掉 @updateURL / @downloadURL。
//
// 为什么去掉：仓库版的这两行指向 raw.githubusercontent.com，大陆网络经常打不开。
// 去掉后，Tampermonkey 会用「从哪里装的就从哪里更新」——从脚本猫装的就从脚本猫检查更新。
// @name 和 @namespace 保持和 GitHub 版一致，Tampermonkey 会把两边当成同一个脚本，
// 先装过 GitHub 版的人再从脚本猫装一次，只是覆盖并换成脚本猫的更新来源，不会装出两份。
//
// 用法：node promo/src/scriptcat-build.cjs
// 输出：promo/scriptcat/smartedu-2026-basic.user.js（复制全文粘贴到脚本猫发布页）
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'smartedu-2026-basic', 'smartedu-2026-basic.user.js');
const OUT_DIR = path.join(__dirname, '..', 'scriptcat');
const OUT = path.join(OUT_DIR, 'smartedu-2026-basic.user.js');

const src = fs.readFileSync(SRC, 'utf8');
const end = src.indexOf('// ==/UserScript==');
if (end < 0) throw new Error('没找到 ==/UserScript== 头部结束标记');

const header = src.slice(0, end);
const removed = header.split('\n').filter((l) => /^\/\/\s*@(updateURL|downloadURL)\b/.test(l));
if (removed.length !== 2) throw new Error(`预期去掉 2 行，实际找到 ${removed.length} 行`);

const out = header.split('\n').filter((l) => !removed.includes(l)).join('\n') + src.slice(end);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, out);

const version = (header.match(/^\/\/\s*@version\s+(\S+)/m) || [])[1];
console.log(`已生成 ${path.relative(process.cwd(), OUT)}（版本 ${version}）`);
console.log('去掉的行：\n  ' + removed.join('\n  '));
