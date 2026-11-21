// 生成小红书教程图（1080×1440，宣传海报风格）。
// 用法：NODE_PATH=/path/to/node_modules node promo/src/render.cjs
//
// 截图放在 promo/shots/ 下。文件存在就用真截图，不存在就画一个橙色虚线「待替换」框。
// 你实拍完，把截图按下面 SHOT 名称存进 promo/shots/，再跑一次本脚本即可。
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const OUT = process.env.OUT_DIR || ROOT; // 图片和策划文档放在同一目录
const REPO = 'github.com/yile2020/helper-scripts';
const SEARCH = 'yile2020/helper-scripts';
// 脚本猫（国内备用安装）页面地址。上线并核对后填在这里（或用环境变量 SCRIPTCAT_URL），
// 图 1、8、10 会自动加上国内备用地址；留空则不显示。
const SCRIPTCAT = process.env.SCRIPTCAT_URL ?? 'https://scriptcat.org/zh-CN/script-show-page/9185'; // 2026-11-21 发布，审核中
const SC_SHOW = SCRIPTCAT.replace(/^https?:\/\//, '');
let TOTAL = 0; // 运行时取 slides.length

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let shotIdx = 0;
function shot(file, { label, w = 960, todo, h = 250 }) {
    const p = path.join(SHOTS, file);
    const tilt = (shotIdx++ % 2 ? 0.8 : -0.8);
    if (fs.existsSync(p)) {
        const b64 = fs.readFileSync(p).toString('base64');
        return `<figure class="shot" style="width:${w}px;--r:${tilt}deg">
            ${label ? `<figcaption>${esc(label)}</figcaption>` : ''}
            <i class="tape"></i><img src="data:image/png;base64,${b64}"></figure>`;
    }
    return `<figure class="todo" style="width:${w}px;min-height:${h}px">
        <div class="todo-tag">待替换 · 未完成</div>
        <div class="todo-icon">📷</div>
        <div class="todo-text">${todo}</div>
        <div class="todo-file">实拍后存为 promo/shots/${esc(file)}，重新生成</div>
    </figure>`;
}

const tips = (items, head = '💡 小贴士') =>
    `<div class="tips"><div class="tips-h">${head}</div><ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
const pill = (t, cls = '') => `<span class="pill ${cls}">${t}</span>`;
const addr = (t) => `<div class="addr${t.length > 34 ? ' long' : ''}"><span class="addr-k">地址栏输入</span><span class="addr-v">${esc(t)}</span></div>`;

const THEMES = { mint: '#19B88A', violet: '#6C5CE7', orange: '#FF8A00', coral: '#FF4D2E', sun: '#FFC21A' };

function frame({ n, step, title, browser, route, body, theme }) {
    const hasTodo = body.includes('class="todo') || body.includes('warn-inv');
    const num = step ? String(step.match(/\d+/)[0]).padStart(2, '0') : '';
    const t = theme || (route === 'A' ? 'violet' : route === 'B' ? 'orange' : num && Number(num) <= 2 ? 'mint' : 'coral');
    shotIdx = 0;
    return `<div class="page" style="--t:${THEMES[t]}">
      <i class="blob b1"></i><i class="blob b2"></i>
      <header>
        ${num ? `<div class="stepnum"><small>STEP</small>${num}</div>` : ''}
        <div class="head-r">
          <div class="chips">${browser ? pill(browser, browser.startsWith('Edge') ? 'edge' : 'chrome') : ''}${route ? pill(route === 'A' ? '方式 A · GitHub' : '方式 B · 脚本猫（国内）', route === 'A' ? 'ra-pill' : 'rb-pill') : ''}${!browser && !route && num ? pill(Number(num) >= 4 ? 'A、B 都一样' : '所有人都要做', 'plain') : ''}</div>
          <h1><span class="hl">${title}</span></h1>
        </div>
      </header>
      <main>${body}</main>
      <footer>
        <span class="brand">研修助手 · 安装教程</span>
        <span class="mid">${hasTodo ? '<b class="warn">⚠ 含待替换内容</b>' : '个人维护开源脚本 · 非平台官方'}</span>
        <span class="num">${n} / ${TOTAL}</span>
      </footer>
    </div>`;
}

const slides = [];

// 脚本猫地址还没有时，用橙色「待补」占位，并让页脚显示「含待替换」
const SC_AUTHOR = process.env.SCRIPTCAT_AUTHOR ?? 'yile2020';
const scAddr = () => SCRIPTCAT
    ? addr(SC_SHOW)
    : `<div class="addr todo-addr"><span class="addr-k">地址栏输入</span><span class="addr-v">脚本猫地址（发布后补）</span></div>`;
const scLine = () => SCRIPTCAT ? `<b class="nw">${esc(SC_SHOW)}</b>` : '<b class="warn-inv">地址发布后补</b>';
const NAME = '2026年暑期教师研修｜国家中小学智慧教育平台｜自动连播助手';

// 01 封面
slides.push(() => {
    const panel = fs.existsSync(path.join(SHOTS, '09-panel.png'))
        ? shot('09-panel.png', { w: 400 }) : '';
    return `<div class="page cover">
      <i class="blob c1"></i><i class="blob c2"></i><i class="blob c3"></i>
      <div class="cover-top"><span class="tag-w">国家中小学智慧教育平台 · 2026 暑期教师研修</span></div>
      <div class="badge-free">免费<br>开源</div>
      <div class="cover-main ${panel ? 'with-panel' : ''}">
        <div>
          <div class="cover-title">研修助手</div>
          <div class="cover-title2"><span>零基础安装教程</span></div>
          <div class="cover-sub">两种方式 · 国内打不开 GitHub 也能装</div>
        </div>
        ${panel}
      </div>
      <div class="cover-card">
        <div class="cover-card-h">跟着做 5 步就好 👇</div>
        <ol class="flow">
          <li>装扩展「篡改猴」</li><li>打开「允许用户脚本」</li>
          <li class="wide">选一种方式装脚本：<span class="ra">A · GitHub</span> 或 <span class="rb">B · 脚本猫（国内）</span></li>
          <li>点「安装」</li><li>看到「研修助手」面板 🎉</li>
        </ol>
      </div>
      <div class="chips cover-chips">${pill('💻 电脑端')}${pill('Edge / Chrome')}${pill('非平台官方')}</div>
      <div class="cover-foot">完整说明 → GitHub 搜 <b>${SEARCH}</b>
        <div class="sc">国内备用 → 脚本猫 ${SCRIPTCAT ? `<b class="nw">${esc(SC_SHOW)}</b>` : '（地址见最后一张）'}</div></div>
    </div>`;
});

// 02 先选方式
slides.push((n) => frame({
    n, title: '两种方式怎么选？', theme: 'sun',
    body: `<div class="lane">
        <div class="lane-h">所有人先做</div>
        <div class="lane-b"><em>1</em>安装扩展「篡改猴」<span>图 3 / 4</span></div>
        <div class="lane-b"><em>2</em>打开「允许用户脚本」<span>图 5 / 6</span></div>
      </div>
      <div class="arrow">↓ 第 3 步：选<b>一种</b>方式装脚本</div>
      <div class="routes">
        <div class="route a"><div class="route-h">方式 A<br>GitHub</div>
          <div class="route-who">能打开 GitHub 的</div>
          <ul><li>完整说明和最新版在这里</li><li>装好后自动更新</li></ul><div class="route-go">看图 7 →</div></div>
        <div class="route b"><div class="route-h">方式 B<br>脚本猫</div>
          <div class="route-who">GitHub 打不开的<br>（国内网络）</div>
          <ul><li>国内访问更稳</li><li>也会自动更新</li></ul><div class="route-go">看图 8 →</div></div>
      </div>
      <div class="arrow">↓ 然后都一样</div>
      <div class="lane">
        <div class="lane-b"><em>4</em>在篡改猴安装页点「安装」<span>图 9</span></div>
        <div class="lane-b"><em>5</em>进研修页面，看到面板<span>图 10</span></div>
      </div>
      <div class="note center">两种方式装的是<b>同一个脚本</b>，装一个就行 ✌️</div>`,
}));

// 03 Edge 装篡改猴
slides.push((n) => frame({
    n, step: '第 1 步', browser: 'Edge 用户', title: '安装扩展「篡改猴」',
    body: addr('microsoftedge.microsoft.com/addons')
        + shot('03a-edge-search.png', { label: '① 搜索「篡改猴」 ② 认准第一个，开发者 Jan Biniok' })
        + shot('04c-edge-get.png', { w: 960, h: 300, todo: '真实 Edge 里：篡改猴的「获取」按钮，以及点击后弹出的确认框（圈出要点的按钮）' })
        + tips([
            '点<b>「获取」</b>，弹出确认框后再点一次添加',
            '篡改猴就是 Tampermonkey；能打开 GitHub 的，也可以从 README「快速开始」里点 Edge 直达',
        ]),
}));

// 04 Chrome 装篡改猴
slides.push((n) => frame({
    n, step: '第 1 步', browser: 'Chrome 用户', title: '安装扩展「篡改猴」',
    body: addr('chromewebstore.google.com')
        + shot('05b-chrome-store.png', { label: '搜索「篡改猴」，认准这个', w: 620 })
        + shot('05c-chrome-add.png', { w: 960, h: 300, todo: '真实 Chrome 里：「添加至 Chrome」按钮，以及点击后弹出的确认框（圈出要点的按钮）' })
        + tips([
            '点<b>「添加至 Chrome」</b>，确认框里再点一次添加',
            '⚠ Chrome 应用商店<b>在国内经常打不开</b>，打不开就用 Edge（Windows 自带），看上一张',
        ]),
}));

// 05 Edge 允许用户脚本
slides.push((n) => frame({
    n, step: '第 2 步', browser: 'Edge 用户', title: '打开「允许用户脚本」',
    body: addr('edge://extensions')
        + shot('06-edge-extensions.png', { w: 960, h: 560, todo: '真实 Edge：扩展页 → 篡改猴「详细信息」→「允许用户脚本」开关（打开状态）。<br>如果你的 Edge 没有这个开关，改拍扩展页的「开发人员模式」开关。<br><b>开关名称以实拍为准，并同步改下方文字</b>' })
        + tips([
            '把上面的地址<b>复制</b>到地址栏，回车',
            '找到篡改猴，点「详细信息」',
            '打开「允许用户脚本」',
            '⚠ <b>不开这一项，脚本装了也不会运行</b>',
        ]),
}));

// 06 Chrome 允许用户脚本
slides.push((n) => frame({
    n, step: '第 2 步', browser: 'Chrome 用户', title: '打开「允许用户脚本」',
    body: addr('chrome://extensions')
        + shot('07-chrome-extensions.png', { w: 960, h: 560, todo: '真实 Chrome：扩展页 → 篡改猴「详情」→「允许用户脚本」开关（打开状态）。<br><b>开关名称以实拍为准，并同步改下方文字</b>' })
        + tips([
            '把上面的地址<b>复制</b>到地址栏，回车',
            '找到篡改猴，点「详情」，打开「允许用户脚本」',
            '旧版 Chrome 没有这个开关：打开扩展页右上角的「开发者模式」',
            '⚠ <b>不开这一项，脚本装了也不会运行</b>',
        ]),
}));

// 07 方式 A：GitHub
slides.push((n) => frame({
    n, step: '第 3 步', route: 'A', title: '从 GitHub 安装',
    body: addr(REPO)
        + shot('02-repo-top.png', { label: '实拍 · 仓库首页，认准 yile2020 / helper-scripts', w: 860 })
        + shot('03b-readme-smartedu.png', { label: '往下翻找到研修助手，点「👉 点击安装」' })
        + tips([
            '不用注册、不用登录 GitHub',
            'README 很长：往下翻，或点「目录」里的「⭐ 2026 暑期教师研修自动连播助手」',
            '页面或安装链接打不开 → 改用<b>方式 B</b>（下一张）',
        ]),
}));

// 08 方式 B：脚本猫
slides.push((n) => frame({
    n, step: '第 3 步', route: 'B', title: '从脚本猫安装（国内）',
    body: scAddr()
        + shot('08a-scriptcat-home.png', { label: '认准网站：ScriptCat 脚本猫', w: 860 })
        + shot('08b-scriptcat-page.png', { w: 960, h: 300, todo: '脚本猫上的研修助手页面（圈出安装按钮）' })
        + tips([
            '用上面的地址<b>直接打开</b>，别在站内搜：同类脚本很多，容易装错',
            `认准脚本名：<b>${NAME}</b>${SC_AUTHOR ? `，作者 <b>${esc(SC_AUTHOR)}</b>` : ''}`,
            '从这里装的，以后也从脚本猫自动更新',
        ]),
}));

// 09 确认安装（两种方式相同）
slides.push((n) => frame({
    n, step: '第 4 步', title: '在篡改猴安装页点「安装」',
    body: shot('08-tm-install.png', { w: 960, h: 520, todo: '真实浏览器：点安装后，篡改猴打开的脚本安装页（能看到脚本名和「安装」按钮，圈出「安装」）' })
        + tips([
            '方式 A、B 点安装后，都会打开篡改猴的安装页',
            `核对脚本名：<br><b>${NAME}</b>`,
            '点<b>「安装」</b>',
            '⚠ 看到<b>满屏代码</b>？说明篡改猴没装好或没开开关，回到第 1、2 步',
        ]),
}));

// 10 检查面板
slides.push((n) => frame({
    n, step: '第 5 步', title: '进研修页面，检查面板',
    body: `<div class="row">
        ${shot('09-panel.png', { w: 470, h: 660, todo: '登录 basic.smartedu.cn，打开 2026 暑期教师研修专题，右侧「研修助手」面板完整截图<br><b>打码姓名、头像、单位</b>' })}
        <div class="check">
          <div class="check-h">看到这些就装好了 ✅</div>
          <ul>
            <li>标题「研修助手」</li>
            <li>第一行「2026年“暑期教师研修”专题（基础教育）」</li>
            <li>「自动续学」勾选框、「倍速」</li>
            <li>按钮：扫描进度 · 刷新 · 诊断 · 重置进度 · 停止</li>
            <li>课程目录，每门课右侧「开始」或「去学」</li>
          </ul>
        </div>
      </div>`
        + tips([
            '在目录里点一门课开始',
            '第一次打开会逐门扫描进度，数字会慢慢更新',
            '「重置进度」会清空本地观看记录，别随手点',
            '同一账号只在一个地方学，关掉手机 App 和别的学习页',
        ]),
}));

// 11 排查 + 两个地址
slides.push((n) => frame({
    n, title: '装不上？先看这里', theme: 'coral',
    body: `<div class="faq">
        <div class="q"><em>Q</em><div><b>GitHub 或「点击安装」打不开</b><span>改用方式 B：从脚本猫安装（图 8）</span></div></div>
        <div class="q"><em>Q</em><div><b>点安装后满屏代码</b><span>篡改猴没装好，或第 2 步的开关没开</span></div></div>
        <div class="q"><em>Q</em><div><b>装好了看不到面板</b><span>开关开了吗？篡改猴里研修助手启用了吗？网址是 basic.smartedu.cn 且已登录？刷新一下</span></div></div>
        <div class="q"><em>Q</em><div><b>视频自己停了，提示多处学习</b><span>同一账号只在一个地方学，关掉手机 App 和其他浏览器的学习页</span></div></div>
        <div class="q"><em>Q</em><div><b>还是不行</b><span>点面板「诊断」复制报告，发到 GitHub Issues，或评论说卡在第几张图</span></div></div>
      </div>
      <div class="gh">
        <div class="gh-row"><span class="tag ta">A · GitHub</span><span class="gh-url">${REPO}</span></div>
        <div class="gh-row"><span class="tag tb">B · 脚本猫</span><span class="gh-url">${scLine()}</span></div>
        <div class="gh-s">最新版 · 完整说明 · 问题反馈都在 GitHub</div>
      </div>
      <div class="note">个人维护的免费开源脚本，不是平台官方工具。学时以平台记录为准，不承诺任何结果，请遵守平台学习要求。脚本不收费，看到出售的不要买。</div>`,
}));

const CSS = `
:root{--ink:#1A1A2E;--cream:#FFF7E6;--sun:#FFD43B;--violet:#6C5CE7;--orange:#FF8A00;--coral:#FF4D2E;--mint:#19B88A}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1440px;background:var(--cream)}
body{font-family:'Noto Sans SC','WenQuanYi Zen Hei','Noto Color Emoji',sans-serif;color:var(--ink)}
.disp,h1,.stepnum,.cover-title,.cover-title2,.route-h,.brand,.tips-h,figcaption,.lane-h,.arrow,.badge-free,.cover-card-h{font-family:'ZCOOL QingKe HuangYou','Noto Sans SC',sans-serif;font-weight:400}
.page{width:1080px;height:1440px;padding:56px 60px 0;display:flex;flex-direction:column;position:relative;overflow:hidden;
  background:radial-gradient(circle,rgba(26,26,46,.09) 2px,transparent 2.5px) 0 0/28px 28px,var(--cream)}
.blob{position:absolute;border-radius:50%;z-index:0;pointer-events:none}
.b1{width:420px;height:420px;right:-150px;top:-170px;background:var(--t);opacity:.95}
.b2{width:160px;height:160px;right:210px;top:-80px;background:var(--sun)}
header,main,footer{position:relative;z-index:1}
header{display:flex;gap:26px;align-items:center;margin-bottom:30px}
.stepnum{flex:none;width:136px;height:136px;border-radius:30px;background:var(--t);color:#fff;border:4px solid var(--ink);
  box-shadow:8px 8px 0 var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:86px;line-height:.9;transform:rotate(-4deg)}
.stepnum small{font-size:26px;letter-spacing:4px;margin-bottom:6px}
.head-r{flex:1;min-width:0}
.chips{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.pill{display:inline-block;padding:6px 20px;border-radius:999px;font-size:26px;font-weight:900;background:#fff;border:3px solid var(--ink);color:var(--ink)}
.pill.edge{background:#2F80ED;color:#fff}.pill.chrome{background:#EA4335;color:#fff}
.pill.ra-pill{background:var(--violet);color:#fff}.pill.rb-pill{background:var(--orange);color:#fff}
.pill.plain{background:var(--sun)}
h1{font-size:76px;line-height:1.08;letter-spacing:1px}
.hl{background:linear-gradient(transparent 62%,var(--sun) 62%,var(--sun) 92%,transparent 92%);padding:0 4px}
main{flex:1;display:flex;flex-direction:column;align-items:center;gap:30px;min-height:0}
.shot{position:relative;background:#fff;padding:10px;border-radius:20px;border:4px solid var(--ink);box-shadow:10px 10px 0 var(--ink);
  transform:rotate(var(--r,0deg));margin-top:30px}
.shot img{display:block;width:100%;border-radius:10px}
.shot figcaption{position:absolute;left:22px;top:-38px;z-index:2;background:var(--t);color:#fff;font-size:30px;padding:4px 18px;border-radius:12px;
  border:3px solid var(--ink);transform:rotate(-2deg);box-shadow:4px 4px 0 var(--ink);max-width:90%}
.tape{position:absolute;right:40px;top:-18px;width:120px;height:34px;background:rgba(255,212,59,.85);transform:rotate(6deg);z-index:2;border-radius:4px}
.todo{border:5px dashed var(--coral);border-radius:20px;padding:30px 34px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;
  background:repeating-linear-gradient(45deg,#FFF0D9 0 22px,#FFE4BD 22px 44px)}
.todo-tag{position:absolute;top:-4px;right:-4px;background:var(--coral);color:#fff;font-size:24px;font-weight:900;padding:6px 18px;border-radius:0 14px 0 14px}
.todo-icon{font-size:58px;margin-bottom:6px}
.todo-text{font-size:28px;line-height:1.5;color:#8A3B00;font-weight:700}
.todo-file{margin-top:12px;font-size:20px;color:#A0602A;font-family:monospace}
.addr{display:flex;align-items:center;gap:16px;background:var(--sun);border:4px solid var(--ink);border-radius:999px;padding:12px 30px 12px 14px;font-size:34px;box-shadow:6px 6px 0 var(--ink)}
.addr-k{background:var(--ink);color:var(--sun);font-weight:900;font-size:24px;border-radius:999px;padding:6px 16px}
.addr-v{font-weight:900;letter-spacing:.3px;white-space:nowrap}
.addr-k{flex:none;white-space:nowrap}
.addr.long{font-size:30px}
.todo-addr{background:repeating-linear-gradient(45deg,#FFF0D9 0 18px,#FFE4BD 18px 36px);border-style:dashed;border-color:var(--coral)}
.todo-addr .addr-v{color:#B34700}
.tips{align-self:stretch;position:relative;background:#fff;border:4px solid var(--ink);border-radius:24px;box-shadow:10px 10px 0 var(--ink);padding:34px 30px 22px;margin-top:10px}
.tips-h{position:absolute;left:24px;top:-24px;background:var(--sun);border:3px solid var(--ink);border-radius:12px;padding:2px 18px;font-size:30px;transform:rotate(-2deg)}
.tips ul{list-style:none;counter-reset:t;display:flex;flex-direction:column;gap:12px}
.tips li{counter-increment:t;font-size:30px;line-height:1.45;padding-left:52px;position:relative}
.tips li:before{content:counter(t);position:absolute;left:0;top:4px;width:38px;height:38px;border-radius:50%;background:var(--t);color:#fff;border:3px solid var(--ink);font-size:20px;font-weight:900;display:flex;align-items:center;justify-content:center}
.tips b{color:var(--coral)}
.row{display:flex;gap:28px;align-self:stretch;align-items:flex-start}
.check{flex:1;background:#fff;border:4px solid var(--ink);border-radius:24px;box-shadow:10px 10px 0 var(--ink);padding:24px 24px}
.check-h{font-size:32px;font-weight:900;margin-bottom:14px;background:var(--mint);color:#fff;display:inline-block;padding:4px 16px;border-radius:12px;border:3px solid var(--ink)}
.check ul{list-style:none;display:flex;flex-direction:column;gap:12px}
.check li{font-size:27px;line-height:1.4;padding-left:38px;position:relative}
.check li:before{content:'✓';position:absolute;left:0;color:var(--mint);font-weight:900;font-size:30px}
footer{height:96px;margin:24px -60px 0;padding:0 60px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:space-between;font-size:22px}
footer .brand{color:var(--sun);font-size:34px}
footer .mid{opacity:.75}
footer .num{background:var(--sun);color:var(--ink);font-weight:900;border-radius:999px;padding:4px 18px;font-size:24px}
.warn{color:#FFB15C}
.faq{align-self:stretch;display:flex;flex-direction:column;gap:20px}
.q{background:#fff;border:4px solid var(--ink);border-radius:20px;box-shadow:7px 7px 0 var(--ink);padding:18px 22px;display:flex;gap:18px;align-items:flex-start}
.q em{flex:none;font-style:normal;width:48px;height:48px;border-radius:14px;background:var(--coral);color:#fff;border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:28px;margin-top:2px}
.q b{display:block;font-size:31px}
.q span{display:block;font-size:26px;line-height:1.42;color:#3A3A50;margin-top:2px}
.gh{align-self:stretch;background:var(--ink);color:#fff;border-radius:24px;padding:22px 28px;text-align:center;box-shadow:10px 10px 0 var(--sun)}
.gh-row{display:flex;align-items:center;justify-content:center;gap:16px;margin:6px 0}
.gh .tag{flex:none;border-radius:10px;padding:4px 14px;font-size:24px;font-weight:900;border:2px solid #fff}
.gh .ta{background:var(--violet)}.gh .tb{background:var(--orange)}
.gh .gh-url{font-size:34px;font-weight:900;color:var(--sun)}
.gh-s{font-size:24px;opacity:.8;margin-top:6px}
.warn-inv{background:var(--coral);color:#fff;border-radius:8px;padding:2px 12px;font-size:28px}
.nw{white-space:nowrap}
.note{align-self:stretch;font-size:23px;line-height:1.6;color:#5A5A70}
.note.center{text-align:center;font-size:30px;color:var(--ink);font-weight:700}
.lane{align-self:stretch;background:#fff;border:4px solid var(--ink);border-radius:24px;box-shadow:8px 8px 0 var(--ink);padding:20px 26px;display:flex;flex-direction:column;gap:12px}
.lane-h{font-size:32px;color:var(--mint)}
.lane-b{font-size:32px;font-weight:900;display:flex;align-items:center;gap:14px}
.lane-b em{font-style:normal;flex:none;width:46px;height:46px;border-radius:50%;background:var(--mint);color:#fff;border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:24px}
.lane-b span{margin-left:auto;font-size:22px;font-weight:900;background:var(--sun);border:2px solid var(--ink);border-radius:999px;padding:2px 14px}
.arrow{font-size:36px;color:var(--ink);background:var(--sun);border:3px solid var(--ink);border-radius:999px;padding:4px 24px;transform:rotate(-1deg)}
.arrow b{font-weight:400;color:var(--coral)}
.routes{align-self:stretch;display:grid;grid-template-columns:1fr 1fr;gap:26px}
.route{border-radius:26px;padding:24px 24px 22px;color:#fff;display:flex;flex-direction:column;gap:12px;border:4px solid var(--ink);box-shadow:10px 10px 0 var(--ink)}
.route.a{background:var(--violet);transform:rotate(-1.2deg)}.route.b{background:var(--orange);transform:rotate(1.2deg)}
.route-h{font-size:54px;line-height:1.05}
.route-who{font-size:27px;font-weight:900;background:rgba(255,255,255,.22);border-radius:14px;padding:8px 14px;line-height:1.4}
.route ul{list-style:none;display:flex;flex-direction:column;gap:6px}
.route li{font-size:26px;line-height:1.4}
.route li:before{content:'✓ '}
.route-go{margin-top:auto;align-self:flex-start;background:#fff;color:var(--ink);border:3px solid var(--ink);border-radius:999px;padding:4px 18px;font-size:24px;font-weight:900}
.ra{color:var(--violet)}.rb{color:var(--orange)}
/* 封面 */
.cover{padding:64px 64px 0;background:radial-gradient(circle,rgba(26,26,46,.12) 2px,transparent 2.5px) 0 0/28px 28px,var(--sun)}
.c1{width:520px;height:520px;right:-220px;bottom:180px;background:var(--coral)}
.c2{width:220px;height:220px;left:-90px;top:420px;background:var(--mint)}
.c3{width:120px;height:120px;right:150px;top:70px;background:#fff;opacity:.6}
.cover>*{position:relative;z-index:1}
.cover>i.blob{position:absolute;z-index:0}
.cover-top{margin-bottom:20px}
.tag-w{display:inline-block;background:#fff;border:4px solid var(--ink);border-radius:999px;padding:8px 24px;font-size:28px;font-weight:900;box-shadow:5px 5px 0 var(--ink)}
.badge-free{position:absolute;right:70px;top:150px;width:170px;height:170px;border-radius:50%;background:var(--coral);color:#fff;border:5px solid var(--ink);
  box-shadow:7px 7px 0 var(--ink);display:flex;align-items:center;justify-content:center;text-align:center;font-size:48px;line-height:1.05;transform:rotate(12deg);z-index:2}
.cover-main{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:auto}
.cover-title{font-size:200px;line-height:1;letter-spacing:4px;color:var(--ink);text-shadow:8px 8px 0 #fff}
.cover-main.with-panel .cover-title{font-size:150px}
.cover-title2{margin-top:18px}
.cover-title2 span{display:inline-block;background:var(--ink);color:var(--sun);font-size:86px;padding:6px 28px 12px;border-radius:18px;transform:rotate(-2deg);box-shadow:8px 8px 0 #fff}
.cover-sub{margin-top:30px;font-size:40px;font-weight:900}
.cover-card{margin-top:auto;background:#fff;border:5px solid var(--ink);border-radius:28px;box-shadow:12px 12px 0 var(--ink);padding:26px 28px}
.cover-card-h{font-size:40px;margin-bottom:16px}
.flow{list-style:none;counter-reset:s;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.flow li{counter-increment:s;background:var(--cream);border:3px solid var(--ink);border-radius:16px;padding:14px 16px;font-size:29px;font-weight:900;display:flex;align-items:center;gap:12px}
.flow li:before{content:counter(s);flex:none;width:44px;height:44px;border-radius:50%;background:var(--coral);color:#fff;border:3px solid var(--ink);font-size:24px;display:flex;align-items:center;justify-content:center}
.flow li.wide{grid-column:1 / -1}
.cover-chips{margin-top:36px}
.cover-foot{margin:44px -64px 0;padding:22px 64px 26px;background:var(--ink);color:#fff;font-size:30px;font-weight:700;text-align:center}
.cover-foot b{color:var(--sun)}
.cover-foot .sc{margin-top:6px;font-size:26px;opacity:.9}
`;

const NAMES = ['01-封面', '02-两种方式怎么选', '03-Edge装篡改猴', '04-Chrome装篡改猴', '05-Edge允许用户脚本',
    '06-Chrome允许用户脚本', '07-方式A-GitHub安装', '08-方式B-脚本猫安装', '09-确认安装', '10-检查面板', '11-排查与地址'];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
    TOTAL = slides.length;
    if (NAMES.length !== slides.length) throw new Error('NAMES 和 slides 数量不一致');
    for (const f of fs.readdirSync(OUT)) if (/^图\d\d-.*\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f)); // 清掉旧编号的图
    for (let i = 0; i < slides.length; i++) {
        const html = `<!doctype html><html><head><meta charset="utf-8">
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=ZCOOL+QingKe+HuangYou&display=block" rel="stylesheet">
            <style>${CSS}</style></head><body>${slides[i](i + 1)}</body></html>`;
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => {
            const m = document.querySelector('main') || document.querySelector('.page');
            return m.scrollHeight > m.clientHeight + 2 ? m.scrollHeight - m.clientHeight : 0;
        });
        const file = path.join(OUT, `图${NAMES[i]}.png`);
        await page.screenshot({ path: file });
        console.log(`saved ${path.basename(file)}${overflow ? `  ⚠ 内容超出 ${overflow}px` : ''}`);
    }
    await browser.close();
})();
