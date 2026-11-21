// 抓取公开页面的真实截图（GitHub 仓库 / README / 扩展商店），并在页面上画红框标注后截图。
// 用法：NODE_PATH=/path/to/node_modules node promo/src/capture.cjs
// 输出：promo/shots/*.png，以及 promo/shots/capture-log.json（记录每个按钮实际抓到的文字）
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const REPO = 'https://github.com/yile2020/helper-scripts';
const EDGE_STORE = 'https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd?hl=zh-CN';
const CHROME_STORE = 'https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=zh-CN';
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const log = {};

/** 在页面里给若干元素画红框 + 序号，返回整体包围盒（页面坐标）。 */
async function mark(page, targets) {
    return page.evaluate((targets) => {
        document.querySelectorAll('.__mk').forEach((n) => n.remove());
        const found = [];
        targets.forEach((t, i) => {
            const all = Array.from(document.querySelectorAll(t.sel));
            const el = all.find((n) => (t.text ? new RegExp(t.text).test((n.innerText || n.textContent || '').trim()) : true)
                && n.getBoundingClientRect().width > 0);
            if (!el) { found.push(null); return; }
            const r = el.getBoundingClientRect();
            const x = r.left + scrollX, y = r.top + scrollY;
            const pad = t.pad ?? 6;
            const box = document.createElement('div');
            box.className = '__mk';
            Object.assign(box.style, {
                position: 'absolute', left: `${x - pad}px`, top: `${y - pad}px`,
                width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
                border: '4px solid #FF2D2D', borderRadius: '8px', zIndex: 2147483647,
                pointerEvents: 'none', boxSizing: 'border-box',
            });
            if (t.badge !== false) {
                const b = document.createElement('div');
                b.textContent = String(t.badge ?? i + 1);
                Object.assign(b.style, {
                    position: 'absolute', width: '32px', height: '32px',
                    ...({ left: { left: '-44px', top: 'calc(50% - 16px)' },
                        right: { left: 'calc(100% + 10px)', top: 'calc(50% - 16px)' },
                        top: { left: 'calc(50% - 16px)', top: '-42px' } })[t.badgePos || 'left'],
                    borderRadius: '50%', background: '#FF2D2D', color: '#fff', font: '700 19px/32px sans-serif',
                    textAlign: 'center',
                });
                box.appendChild(b);
            }
            document.body.appendChild(box);
            found.push({ text: (el.innerText || el.textContent || '').trim().slice(0, 80), x, y, w: r.width, h: r.height });
        });
        return found;
    }, targets);
}

async function shoot(page, name, clip) {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, clip, fullPage: !!clip });
    console.log('saved', name);
}

function around(f, { top = 40, bottom = 40, height, x = 0, width = 1280 } = {}) {
    const y = Math.max(0, f.y - top);
    return { x, y, width, height: height ?? (f.h + top + bottom) };
}

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
        viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN',
        colorScheme: 'light',
    });
    const page = await ctx.newPage();

    // ── GitHub 仓库 ──
    await page.goto(REPO, { waitUntil: 'networkidle', timeout: 60000 });
    log.repoUrl = page.url();

    // 02 仓库首页顶部：圈仓库名
    let f = await mark(page, [{ sel: 'header a, #repository-container-header a, strong[itemprop="name"] a, [itemprop="name"] a', text: '^helper-scripts$', pad: 8, badgePos: 'right' }]);
    log.repoName = f;
    await shoot(page, '02-repo-top', { x: 0, y: 0, width: 850, height: 258 });

    // README 用窄窗口（640px）抓：文字自动换行，放进图里字更大
    const narrow = await browser.newContext({ viewport: { width: 640, height: 1000 }, deviceScaleFactor: 3, locale: 'zh-CN', colorScheme: 'light' });
    const np = await narrow.newPage();
    await np.goto(REPO, { waitUntil: 'networkidle', timeout: 60000 });

    /** 取 README 里两处元素之间的纵向范围，作为截图区域。 */
    const span = (a, b, padTop = 18, padBottom = 18) => np.evaluate(([a, b, padTop, padBottom]) => {
        const find = ([sel, re]) => Array.from(document.querySelectorAll(sel))
            .find((n) => new RegExp(re).test((n.innerText || '').trim()) && n.getBoundingClientRect().height > 0);
        const ea = find(a), eb = find(b);
        if (!ea || !eb) return null;
        const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
        const y = ra.top + scrollY - padTop;
        return { x: 0, y, width: 640, height: rb.bottom + scrollY + padBottom - y };
    }, [a, b, padTop, padBottom]);

    // 03a 目录：① 研修助手条目 ② 快速开始
    f = await mark(np, [
        { sel: 'article a', text: '暑期教师研修自动连播助手', badgePos: 'right' },
        { sel: 'article a', text: '^快速开始$', badgePos: 'right' },
    ]);
    log.toc = f;
    await shoot(np, '03a-readme-toc', await span(['article h2', '^目录$'], ['article a', '^实用工具$'], 18, 8));

    // 03b / 08 研修助手小节：圈「👉 点击安装」
    f = await mark(np, [{ sel: 'article a', text: '点击安装', badgePos: 'left' }]);
    log.installLink = f;
    await shoot(np, '03b-readme-smartedu', await span(['article h3', '暑期教师研修自动连播助手'], ['article a', '点击安装'], 18, 12));

    // 04a / 05a 快速开始：分别圈 Edge 链接、Chrome 链接
    for (const [name, text] of [['04a-readme-edge-link', '^Edge$'], ['05a-readme-chrome-link', '^Chrome$']]) {
        f = await mark(np, [{ sel: 'article a', text, pad: 5, badgePos: 'top' }]);
        log[name] = f;
        await shoot(np, name, await span(['article h2', '^快速开始$'], ['article li', '^安装脚本管理器'], 18, 0));
    }
    await mark(np, []);

    // ── 扩展商店：用真实 Edge / Chrome 的 UA 和品牌信息打开，避免出现「浏览器不兼容」「改用 Chrome」这类无头浏览器才有的提示 ──
    async function storePage(brand) {
        const ver = '142';
        const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver}.0.0.0 Safari/537.36`
            + (brand === 'Microsoft Edge' ? ` Edg/${ver}.0.0.0` : '');
        const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN', userAgent: ua });
        const p = await c.newPage();
        const cdp = await c.newCDPSession(p);
        await cdp.send('Emulation.setUserAgentOverride', {
            userAgent: ua, acceptLanguage: 'zh-CN,zh;q=0.9',
            userAgentMetadata: {
                brands: [{ brand, version: ver }, { brand: 'Chromium', version: ver }, { brand: 'Not_A Brand', version: '24' }],
                fullVersion: `${ver}.0.0.0`, platform: 'Windows', platformVersion: '15.0.0', architecture: 'x86', model: '', mobile: false,
            },
        });
        return p;
    }
    async function dismiss(p, texts) {
        for (const t of texts) {
            const b = p.getByRole('button', { name: t, exact: true });
            if (await b.count()) { await b.first().click().catch(() => {}); await p.waitForTimeout(600); }
        }
    }

    try {
        const p = await storePage('Microsoft Edge');
        await p.goto(EDGE_STORE, { waitUntil: 'networkidle', timeout: 60000 });
        await p.waitForTimeout(2500);
        await dismiss(p, ['拒绝']);
        f = await mark(p, [{ sel: 'button', text: '^(获取|Get|安装|Install)$', pad: 6 }]);
        const notes = await p.evaluate(() => document.body.innerText.match(/(不兼容|新版 Microsoft Edge)[^\n]*/g));
        log.edgeStore = { url: p.url(), button: f, warnings: notes };
        // 无头浏览器里「获取」按钮是灰的并提示不兼容（读者的真 Edge 不会这样），所以只截扩展名称区域，不截按钮
        await mark(p, []);
        await shoot(p, '04b-edge-store', { x: 140, y: 70, width: 520, height: 135 });
    } catch (e) { log.edgeStoreError = String(e); }

    try {
        const p = await storePage('Google Chrome');
        await p.goto(CHROME_STORE, { waitUntil: 'networkidle', timeout: 60000 });
        await p.waitForTimeout(2500);
        await dismiss(p, ['不了，谢谢', '不用了，谢谢']);
        f = await mark(p, [{ sel: 'button', text: '(添加至 Chrome|Add to Chrome|添加到 Chrome)', pad: 6 }]);
        const notes = await p.evaluate(() => document.body.innerText.match(/(切换到 Chrome|改用 Chrome)[^\n]*/g));
        log.chromeStore = { url: p.url(), button: f, warnings: notes };
        // 同上：按钮和红色提示条都是无头浏览器才有的状态，只截扩展名称区域
        await mark(p, []);
        await shoot(p, '05b-chrome-store', { x: 90, y: 245, width: 620, height: 195 });
    } catch (e) { log.chromeStoreError = String(e); }

    // ── 商店搜索结果页：不经过 GitHub 也能找到篡改猴（方式 B 的用户需要） ──
    try {
        const p = await storePage('Microsoft Edge');
        await p.goto('https://microsoftedge.microsoft.com/addons/search/%E7%AF%A1%E6%94%B9%E7%8C%B4?hl=zh-CN', { waitUntil: 'networkidle', timeout: 60000 });
        await p.waitForTimeout(2500);
        await dismiss(p, ['拒绝']);
        await p.evaluate(() => { const x = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === '✕'); if (x) x.click(); });
        await p.waitForTimeout(500);
        // 圈出第一条结果的标题「篡改猴」（不圈「获取」按钮：无头浏览器里它的状态和真 Edge 不同）
        f = await mark(p, [
            { sel: 'input', text: '', pad: 4, badgePos: 'left' },
            { sel: 'h2, h3, a, span, div', text: '^篡改猴$', pad: 6, badgePos: 'left' },
        ]);
        log.edgeSearch = f;
        await shoot(p, '03a-edge-search', { x: 0, y: 0, width: 980, height: 322 }); // 右边的「获取」按钮在无头浏览器里是灰的，不截
    } catch (e) { log.edgeSearchError = String(e); }

    try {
        const p = await storePage('Microsoft Edge');
        await p.goto('https://scriptcat.org/zh-CN', { waitUntil: 'networkidle', timeout: 60000 });
        await p.waitForTimeout(1500);
        // 只截网站外观，不圈搜索框：站内搜「暑期教师研修」会出来很多同类脚本，教程让读者用直达链接
        await shoot(p, '08a-scriptcat-home', { x: 0, y: 0, width: 1280, height: 300 });
    } catch (e) { log.scriptcatError = String(e); }

    fs.writeFileSync(path.join(OUT, 'capture-log.json'), JSON.stringify(log, null, 2));
    console.log(JSON.stringify(log, null, 2));
    await browser.close();
})();
