// 生成「一乐AI」置顶自我介绍笔记的 4 张图（1080×1440，黄黑海报风，和头像、教程图同一套）。
// 用法：NODE_PATH=/path/to/node_modules node promo/src/intro-render.cjs
// 输出：promo/intro/图1-封面.png … 图4-怎么许愿.png
// 文案和 promo/xhs-intro-post.md 的「内页图文字稿」一致；不写具体数量和 Star 数。
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'intro');
fs.mkdirSync(OUT, { recursive: true });
const AVATAR = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'avatar', 'avatar.png')).toString('base64');
const REPO = 'yile2020/helper-scripts';
const ADMIN = 'yile2020/fastapi-react-admin';

const CSS = `
:root{--ink:#1A1A2E;--cream:#FFF7E6;--sun:#FFD43B;--violet:#6C5CE7;--orange:#FF8A00;--coral:#FF4D2E;--mint:#19B88A}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1440px}
body{font-family:'Noto Sans SC','WenQuanYi Zen Hei','Noto Color Emoji',sans-serif;color:var(--ink)}
.disp,h1,.stamp,.card-h,.col-h,.step em,.big{font-family:'ZCOOL QingKe HuangYou','Noto Sans SC',sans-serif;font-weight:400}
.page{width:1080px;height:1440px;padding:60px 60px 0;display:flex;flex-direction:column;position:relative;overflow:hidden;
  background:radial-gradient(circle,rgba(26,26,46,.09) 2px,transparent 2.5px) 0 0/28px 28px,var(--cream)}
.blob{position:absolute;border-radius:50%;z-index:0}
.page>*:not(.blob){position:relative;z-index:1}
h1{font-size:84px;line-height:1.1;margin-bottom:34px}
.hl{background:linear-gradient(transparent 62%,var(--sun) 62%,var(--sun) 92%,transparent 92%);padding:0 4px}
.sticker{align-self:flex-start;display:inline-block;background:var(--ink);color:var(--sun);border-radius:14px;padding:6px 22px;font-size:30px;font-weight:900;margin-bottom:18px;transform:rotate(-2deg)}
.card{background:#fff;border:4px solid var(--ink);border-radius:26px;box-shadow:10px 10px 0 var(--ink);padding:34px 36px;margin-bottom:40px}
.card-h{font-size:54px;margin-bottom:8px;display:flex;align-items:center;gap:14px}
.card-h i{font-style:normal;font-size:24px;background:var(--t,var(--mint));color:#fff;border:3px solid var(--ink);border-radius:999px;padding:2px 16px;font-family:'Noto Sans SC';font-weight:900}
.card p{font-size:33px;line-height:1.6;color:#3A3A50}
.card b{color:var(--coral)}
.code{display:inline-block;background:var(--sun);border:3px solid var(--ink);border-radius:12px;padding:4px 16px;font-weight:900;font-size:31px;margin-top:12px}
footer{margin:auto -60px 0;height:96px;padding:0 60px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:space-between;font-size:22px}
footer .brand{color:var(--sun);font-size:34px;font-family:'ZCOOL QingKe HuangYou'}
footer .mid{opacity:.75}
footer .num{background:var(--sun);color:var(--ink);font-weight:900;border-radius:999px;padding:4px 18px;font-size:24px}
/* 封面 */
.cover{background:radial-gradient(circle,rgba(26,26,46,.12) 2px,transparent 2.5px) 0 0/28px 28px,radial-gradient(circle at 50% 40%,#FFE266,#FFD43B 60%,#FFC400)}
.cover .avatar{width:380px;height:380px;border-radius:50%;border:8px solid var(--ink);box-shadow:12px 12px 0 var(--ink);align-self:flex-start}
.cover .name{font-family:'Noto Serif SC',serif;font-weight:900;font-size:230px;line-height:1.05;margin-top:30px;letter-spacing:8px;text-shadow:10px 10px 0 #fff}
.cover .sub{display:inline-block;align-self:flex-start;background:var(--ink);color:var(--sun);border-radius:20px;font-size:64px;padding:8px 32px 14px;margin-top:26px;transform:rotate(-1.5deg);box-shadow:8px 8px 0 #fff}
.cover .line{font-size:36px;font-weight:900;margin-top:34px;line-height:1.5}
.cover .tags{display:flex;gap:14px;flex-wrap:wrap;margin-top:34px}
.cover .tags span{background:#fff;border:3px solid var(--ink);border-radius:999px;padding:6px 22px;font-size:28px;font-weight:900}
.cover footer{margin-top:auto;justify-content:center;font-size:30px;font-weight:700;gap:12px}
.cover footer b{color:var(--sun)}
/* 能做/不做 */
.two{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:start;margin-bottom:40px}
.col{border:4px solid var(--ink);border-radius:26px;box-shadow:10px 10px 0 var(--ink);padding:26px 26px;background:#fff}
.col.yes{background:#E8FBF3}.col.no{background:#FFEDE8}
.col-h{font-size:56px;margin-bottom:20px}
.col.yes .col-h{color:var(--mint)}.col.no .col-h{color:var(--coral)}
.col li{list-style:none;font-size:35px;line-height:1.4;font-weight:700;padding:18px 0 18px 58px;position:relative;border-bottom:3px dashed rgba(26,26,46,.15)}
.col li:last-child{border:0}
.col li:before{position:absolute;left:0;top:18px;width:40px;height:40px;border-radius:50%;border:3px solid var(--ink);color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;font-weight:900}
.col.yes li:before{content:'✓';background:var(--mint)}.col.no li:before{content:'✕';background:var(--coral)}
.note{font-size:26px;line-height:1.6;color:#5A5A70}
/* 许愿 */
.step{display:flex;gap:26px;align-items:center;background:#fff;border:4px solid var(--ink);border-radius:26px;box-shadow:10px 10px 0 var(--ink);padding:32px 32px;margin-bottom:36px}
.step em{font-style:normal;flex:none;width:100px;height:100px;border-radius:50%;background:var(--coral);color:#fff;border:4px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:52px}
.step b{display:block;font-size:48px;margin-bottom:6px}
.step span{font-size:32px;color:#3A3A50;line-height:1.4}
.addr{background:var(--ink);color:#fff;border-radius:26px;box-shadow:10px 10px 0 var(--sun);padding:30px 34px;margin-bottom:30px;font-size:31px;line-height:1.7}
.addr b{color:var(--sun);font-size:44px;display:block}
`;

const footer = (n) => `<footer><span class="brand">一乐AI</span><span class="mid">个人开发者 · 免费开源 · 非平台官方</span><span class="num">${n} / 4</span></footer>`;
const blobs = (t) => `<i class="blob" style="width:420px;height:420px;right:-150px;top:-170px;background:${t}"></i><i class="blob" style="width:160px;height:160px;right:210px;top:-80px;background:var(--sun)"></i>`;

const pages = [
    // 1 封面
    `<div class="page cover">
      <i class="blob" style="width:520px;height:520px;right:-220px;bottom:200px;background:var(--coral)"></i>
      <i class="blob" style="width:220px;height:220px;left:-90px;top:520px;background:var(--mint)"></i>
      <img class="avatar" src="${AVATAR}">
      <div class="name">我是一乐</div>
      <div class="sub">你说需求，我用AI做出来</div>
      <div class="line">个人开发者 · 开源脚本一大堆<br>还有开源后台框架</div>
      <div class="tags"><span>🛠 做工具</span><span>🧩 写脚本</span><span>⚙️ 自动化</span><span>🆓 免费开源</span></div>
      <footer>想让我做什么？<b>评论区许愿 👇</b></footer>
    </div>`,
    // 2 我是谁
    `<div class="page" style="--t:#19B88A">${blobs('#19B88A')}
      <div class="sticker">ABOUT ME</div>
      <h1><span class="hl">我是一乐</span></h1>
      <div class="card" style="--t:var(--violet)"><div class="card-h">开源脚本 <i>免费</i></div>
        <p>一大堆油猴脚本：读书、办公、网盘、网页工具什么都有，<b>全部免费</b>，放在专门的脚本仓库。</p>
        <div class="code">GitHub 搜 ${REPO}</div></div>
      <div class="card" style="--t:var(--orange)"><div class="card-h">开源后台框架 <i>MIT</i></div>
        <p><b>fastapi-react-admin</b>：登录、权限、审批、AI 助手、文件上传这些每个系统都要重做的部分，一次做好。</p>
        <div class="code">GitHub 搜 ${ADMIN}</div></div>
      <div class="card" style="--t:var(--coral)"><div class="card-h">还有这些 <i>个人维护</i></div>
        <p>研修助手、百度网盘非会员批量转存，以及各种网页自动化、小工具、小项目。</p></div>
      ${footer(2)}</div>`,
    // 3 能做不做
    `<div class="page" style="--t:#FF4D2E">${blobs('#FF4D2E')}
      <div class="sticker">MY SCOPE</div>
      <h1><span class="hl">能做什么 / 不做什么</span></h1>
      <div class="two">
        <div class="col yes"><div class="col-h">能做</div><ul>
          <li>批量处理文件、整理资料</li><li>网页自动化</li><li>小工具、浏览器脚本、小程序</li><li>后台系统的底座：权限、审批、AI 助手</li><li>AI 提效方法</li></ul></div>
        <div class="col no"><div class="col-h">不做</div><ul>
          <li>毕设代做</li><li>代学、代考</li><li>违反平台规则的东西</li></ul>
          <p class="note" style="margin-top:26px;font-size:28px">需求我会挑着做，不保证每条都回复或实现。</p></div>
      </div>
      <div class="card" style="--t:var(--mint)"><div class="card-h">怎么判断能不能做</div><p>重复的事、能自动化的、结果看得见的，<b>基本都能做</b>。说不准的，评论区问我就行。</p></div>
      ${footer(3)}</div>`,
    // 4 怎么许愿
    `<div class="page" style="--t:#FF8A00">${blobs('#FF8A00')}
      <div class="sticker">WISH POOL</div>
      <h1><span class="hl">评论区许愿池</span></h1>
      <div class="step"><em>1</em><div><b>说想解决的事</b><span>比如：每天要手动整理一堆表格</span></div></div>
      <div class="step"><em>2</em><div><b>说现在怎么做</b><span>比如：现在是一个个复制粘贴</span></div></div>
      <div class="step"><em>3</em><div><b>每周挑一个做出来</b><span>过程和成品，都做成笔记讲给大家</span></div></div>
      <div class="addr"><b>${REPO}</b>专门放免费脚本的仓库：脚本都免费，不收费、不用付费领取<br>
        <span style="opacity:.8">个人维护的开源项目，非平台官方，请遵守平台规定</span></div>
      ${footer(4)}</div>`,
];
const NAMES = ['图1-封面', '图2-我是谁', '图3-能做不做', '图4-怎么许愿'];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
    for (let i = 0; i < pages.length; i++) {
        const html = `<!doctype html><html><head><meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=Noto+Serif+SC:wght@900&family=ZCOOL+QingKe+HuangYou&display=block" rel="stylesheet">
          <style>${CSS}</style></head><body>${pages[i]}</body></html>`;
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const over = await page.evaluate(() => { const p = document.querySelector('.page'); return p.scrollHeight > p.clientHeight + 2 ? p.scrollHeight - p.clientHeight : 0; });
        await page.screenshot({ path: path.join(OUT, `${NAMES[i]}.png`) });
        console.log('saved', NAMES[i], over ? `⚠ 内容超出 ${over}px` : '');
    }
    await browser.close();
})();
