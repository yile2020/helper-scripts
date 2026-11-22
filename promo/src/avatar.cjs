// 生成小红书头像「一乐AI」（1080×1080，黄黑海报风，和教程封面同色；名字用粗衬线体）。
// 用法：NODE_PATH=/path/to/node_modules node promo/src/avatar.cjs
// 输出：promo/avatar/avatar.png（方图，上传用）、avatar-preview-circle.png（圆形预览，看实际效果）
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'avatar');
fs.mkdirSync(OUT, { recursive: true });

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=ZCOOL+QingKe+HuangYou&family=Noto+Serif+SC:wght@900&display=block" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1080px;position:relative;overflow:hidden;font-family:'ZCOOL QingKe HuangYou',sans-serif;
  background:radial-gradient(circle at 50% 42%,#FFE266 0%,#FFD43B 55%,#FFC400 100%)}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(26,26,46,.13) 3px,transparent 3.5px);background-size:44px 44px}
.blob{position:absolute;border-radius:50%}
.b1{width:440px;height:440px;right:-160px;bottom:-140px;background:#FF4D2E}
.b2{width:210px;height:210px;left:-70px;top:-60px;background:#19B88A}
.b3{width:150px;height:150px;right:90px;top:70px;background:#fff;opacity:.55}
.b4{width:90px;height:90px;left:120px;bottom:90px;background:#6C5CE7}
svg{position:absolute;left:0;top:50px;transform:scale(.8);transform-origin:540px 0}
.name{position:absolute;left:0;right:0;top:575px;text-align:center;font-family:'Noto Serif SC',serif;font-weight:900;font-size:310px;line-height:1.1;color:#1A1A2E;letter-spacing:14px;padding-left:14px;
  text-shadow:10px 10px 0 #fff}
.ai{position:absolute;left:665px;top:395px;transform:rotate(10deg);background:#FF4D2E;color:#fff;border:8px solid #1A1A2E;border-radius:26px;
  font-size:96px;line-height:1;padding:4px 22px 12px;box-shadow:8px 8px 0 #1A1A2E}
</style></head><body>
<div class="dots"></div>
<i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><i class="blob b4"></i>
<svg width="1080" height="640" viewBox="0 0 1080 640">
  <!-- 猫头：黑色圆脸 + 两只尖耳朵 -->
  <polygon points="300,250 330,70 470,185" fill="#1A1A2E" stroke="#1A1A2E" stroke-width="30" stroke-linejoin="round"/>
  <polygon points="780,250 750,70 610,185" fill="#1A1A2E" stroke="#1A1A2E" stroke-width="30" stroke-linejoin="round"/>
  <polygon points="345,215 355,125 430,185" fill="#FF4D2E"/>
  <polygon points="735,215 725,125 650,185" fill="#FF4D2E"/>
  <ellipse cx="540" cy="340" rx="290" ry="235" fill="#1A1A2E"/>
  <!-- 眼睛：两个白圆 + 瞳孔 + 高光 -->
  <circle cx="420" cy="330" r="66" fill="#fff"/><circle cx="660" cy="330" r="66" fill="#fff"/>
  <circle cx="436" cy="338" r="34" fill="#1A1A2E"/><circle cx="676" cy="338" r="34" fill="#1A1A2E"/>
  <circle cx="448" cy="324" r="11" fill="#fff"/><circle cx="688" cy="324" r="11" fill="#fff"/>
  <!-- 鼻子和嘴 -->
  <path d="M495 430 Q517 462 540 430 Q563 462 585 430" fill="none" stroke="#FFD43B" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="540" cy="398" rx="20" ry="13" fill="#FF4D2E"/>
  <!-- 胡须 -->
  <g stroke="#1A1A2E" stroke-width="10" stroke-linecap="round"><line x1="215" y1="395" x2="115" y2="372"/><line x1="220" y1="435" x2="120" y2="448"/>
  <line x1="865" y1="395" x2="965" y2="372"/><line x1="860" y1="435" x2="960" y2="448"/></g>
</svg>
<div class="name">一乐</div>
<div class="ai">AI</div>
</body></html>`;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, 'avatar.png') });
    // 圆形预览：小红书头像会被裁成圆，看看四角有没有切到内容
    await page.addStyleTag({ content: 'html{background:#eee}body{border-radius:50%}' });
    await page.screenshot({ path: path.join(OUT, 'avatar-preview-circle.png') });
    await browser.close();
    console.log('saved', OUT);
})();
