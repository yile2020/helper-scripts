'use strict'

const path = require('path')
const h = require('../../tools/userscript-harness.cjs')

const SCRIPT = path.join(__dirname, '..', 'gzwy-course-autonext.user.js')
const FIXTURES = path.join(__dirname, 'fixtures')
const TOPIC_URL = '/topic.html#/pc/nc/pagespecial/specialDetail?id=28c0ade8b77e42ac821863d958ade8c8'
const PANEL = '#gzwy-course-autonext-panel'
const P = 'gzwy-course-autonext-'
const K = { enabled: P + 'enabled', keepAlive: P + 'keepalive', list: P + 'list', owner: P + 'owner' }

// rows 是 [businessId, progress, typeValue?]
const cacheRows = rows => rows.map(([id, progress, type]) => ({
    id, name: '课程 ' + id, type: type || 'course', typeText: type === 'exam' ? '考试' : '课程', progress, playState: true, classId: 'class-1',
}))

;(async () => {
    const env = await h.setup(FIXTURES)
    const t = h.createRunner('gzwy-course-autonext')
    const { assert, eq } = t

    const status = page => page.$eval(PANEL + ' [data-status]', el => el.textContent)
    const info = page => page.$eval(PANEL + ' [data-info]', el => el.textContent)
    const waitStatus = (page, text) => page.waitForFunction(
        ([sel, text]) => document.querySelector(sel).textContent.includes(text), [PANEL + ' [data-status]', text], { timeout: 9000 })

    // 页面里按站点的数据结构造课程列表
    const makeLists = `(rows => [{ classId: 'class-1', subList: rows.map(([businessId, progress, typeValue]) => ({
        businessId, name: '课程 ' + businessId, progress, playState: true,
        typeValue: typeValue || 'course', typeText: typeValue === 'exam' ? '考试' : '课程' })) }])`

    async function openTopic(values, rows, options = {}) {
        const context = await env.browser.newContext()
        const page = await context.newPage()
        await h.install(page, SCRIPT, { values: { [K.enabled]: false, [K.keepAlive]: false, ...values } })
        await page.goto(env.base + TOPIC_URL)
        await page.evaluate(({ rows, projectSignature, makeLists }) => {
            window.__entered = []
            window.__refreshed = 0
            const lists = eval(makeLists)(rows)
            // 项目版与站点 dsf-pc.js 的检查一致：第二个参数不是课程行时提示「不在学习时间范围」。
            const clickEnter = projectSignature
                ? function (e, t, s, a, i, n, o) {
                    if (!t || !t.playState) { window.__toast = '不在学习时间范围'; return }
                    window.__call = { groupFirst: e === lists[0], classId: s, groupFourth: a === lists[0], index: i, previous: n, flag: o === undefined ? null : o }
                    window.__entered.push(t.businessId)
                }
                : function (item) { window.__entered.push(item.businessId) }
            document.body.__vue__ = {
                lists, showClick: true, clickEnter, $options: { methods: { clickEnter } },
                $parent: { initData() { window.__refreshed++ } },
            }
        }, { rows, projectSignature: options.projectSignature === true, makeLists })
        await page.waitForSelector(PANEL)
        return { context, page }
    }

    // 课程页 c1：rates 是各课件的 finishedRate，rows 是平台接口返回的专题列表
    async function openPlayer(values, rates, rows) {
        const context = await env.browser.newContext()
        const page = await context.newPage()
        await h.install(page, SCRIPT, { values: { [K.enabled]: true, [K.keepAlive]: false, ...values } })
        await page.goto(env.base + '/player.html#/pc/nc/pagecourse/coursePlayer?id=c1&classid=class-1&type=ztb')
        await page.evaluate(({ rates, rows, makeLists }) => {
            const children = rates.map((finishedRate, index) => ({ id: 'w' + index, finishedRate }))
            // 与真实站点一致：最后一段播完后站点已把当前课件绕回第一段，只能看完成度。
            document.body.__vue__ = { queryiId: 'c1', curPlayItem: children[0], chapterInfo: { children } }
            window.__listCalls = 0; window.__played = 0; window.__moved = 0; window.__visibility = 0
            window.dsf = { http: { get(url, params) {
                window.__listCalls++
                window.__listRequest = { url, id: params.id }
                const chain = {
                    done(cb) { setTimeout(() => cb({ success: true, data: eval(makeLists)(rows) }), 20); return chain },
                    error() { return chain },
                }
                return chain
            } } }
            // fixture 的 video 没有片源，一直是 paused，用假的 play() 计数。
            document.getElementById('lesson').play = () => { window.__played++; return Promise.resolve() }
            document.onmousemove = () => { window.__moved++ }
            document.addEventListener('visibilitychange', () => { window.__visibility++ })
            document.dispatchEvent(new Event('visibilitychange'))
        }, { rates, rows, makeLists })
        await page.waitForSelector(PANEL)
        return { context, page }
    }

    // ---------- 专题页 ----------

    await t.test('点开始：进入第一门未完成课程，面板显示专题进度', async () => {
        const { context, page } = await openTopic({}, [['c1', 100], ['c2', 0], ['c3', 0]])
        try {
            await page.click(PANEL + ' [data-actions] button')
            eq(JSON.stringify(await page.evaluate(() => window.__entered)), '["c2"]')
            eq(await page.$eval(PANEL + ' [data-enabled]', input => input.checked), true)
            const text = await info(page)
            assert(text.includes('1 / 3 门完成'), '面板没有专题进度：' + text)
            assert(text.includes('从专题页进入《课程 c2》'), '面板没有最近动作：' + text)
            assert((await h.errors(page)).length === 0, '专题页有未捕获异常')
        } finally { await context.close() }
    })

    await t.test('项目版 clickEnter（7 个形参）按 group, item, classId… 的顺序调用', async () => {
        const { context, page } = await openTopic({}, [['c1', 100], ['c2', 0]], { projectSignature: true })
        try {
            await page.click(PANEL + ' [data-actions] button')
            eq(await page.evaluate(() => window.__toast || null), null)
            eq(JSON.stringify(await page.evaluate(() => window.__entered)), '["c2"]')
            eq(JSON.stringify(await page.evaluate(() => window.__call)),
                JSON.stringify({ groupFirst: true, classId: 'class-1', groupFourth: true, index: 1, previous: 100, flag: null }))
        } finally { await context.close() }
    })

    await t.test('下一项是考试：专题页不进入', async () => {
        const { context, page } = await openTopic({}, [['c1', 100], ['c2', 0, 'exam']])
        try {
            await page.click(PANEL + ' [data-actions] button')
            eq(JSON.stringify(await page.evaluate(() => window.__entered)), '[]')
            assert((await status(page)).includes('考试'), '状态没有提示考试')
        } finally { await context.close() }
    })

    await t.test('课程页核对到新进度后，专题页刷新自己的课程列表', async () => {
        const { context, page } = await openTopic(
            { [K.list]: { courses: cacheRows([['c1', 100], ['c2', 100], ['c3', 0]]), at: Date.now() + 60000 } },
            [['c1', 100], ['c2', 60], ['c3', 0]])
        try {
            await page.waitForFunction(() => window.__refreshed === 1, null, { timeout: 9000 })
            await page.waitForTimeout(5500)
            eq(await page.evaluate(() => window.__refreshed), 1)
            assert((await info(page)).includes('2 / 3 门完成'), '面板没有用缓存的进度')
        } finally { await context.close() }
    })

    // ---------- 课程页 ----------

    await t.test('平台记满 100%：本页直接进入下一门（当前课件已被站点绕回第一段）', async () => {
        const { context, page } = await openPlayer({}, [100, 100, 100], [['c1', 100], ['c2', 0], ['c3', 0]])
        try {
            await page.waitForURL(url => url.hash.includes('id=c2'), { timeout: 12000 })
            // 脚本改完地址会紧接着刷新页面，等刷新完再读。
            await page.waitForTimeout(1500)
            await page.waitForLoadState('load')
            eq(await page.evaluate(() => location.hash), '#/pc/nc/pagecourse/coursePlayer?id=c2&classid=class-1&type=ztb')
            await page.waitForSelector(PANEL)
            assert((await info(page)).includes('《课程 c1》已完成，进入《课程 c2》'), '跳转后面板没有保留最近动作')
            assert((await h.errors(page)).length === 0, '课程页有未捕获异常')
        } finally { await context.close() }
    })

    await t.test('课件看完但平台还没记满：不跳，面板显示课件与平台进度', async () => {
        const { context, page } = await openPlayer({}, [100, 100], [['c1', 80], ['c2', 0]])
        try {
            await waitStatus(page, '平台记录 80%')
            const text = await info(page)
            assert(text.includes('0 / 2 门完成'), '没有专题进度：' + text)
            assert(text.includes('《课程 c1》平台记录 80%'), '没有正在学：' + text)
            assert(text.includes('下一门《课程 c2》'), '没有下一门：' + text)
            assert(text.includes('2 / 2 段完成'), '没有课件进度：' + text)
            eq(JSON.stringify(await page.evaluate(() => window.__listRequest)),
                JSON.stringify({ url: '/nc/class/course/list', id: '28c0ade8b77e42ac821863d958ade8c8' }))
            await page.waitForTimeout(3000)
            assert(await page.evaluate(() => location.hash.includes('id=c1')), '不该跳转')
        } finally { await context.close() }
    })

    await t.test('开关关闭：不核对、不跳，但仍显示课件进度', async () => {
        const { context, page } = await openPlayer({ [K.enabled]: false }, [100, 60], [['c1', 100], ['c2', 0]])
        try {
            await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('1 / 2 段完成'), PANEL + ' [data-info]', { timeout: 9000 })
            await page.waitForTimeout(3000)
            eq(await page.evaluate(() => window.__listCalls), 0)
            assert(await page.evaluate(() => location.hash.includes('id=c1')), '不该跳转')
        } finally { await context.close() }
    })

    await t.test('下一项是考试 / 全部学完：不跳并说明', async () => {
        const a = await openPlayer({}, [100], [['c1', 100], ['c2', 0, 'exam'], ['c3', 0]])
        const b = await openPlayer({}, [100], [['c1', 100], ['c2', 100]])
        try {
            await waitStatus(a.page, '考试')
            await waitStatus(b.page, '没有未完成课程')
            await a.page.waitForTimeout(6000)
            assert(await a.page.evaluate(() => location.hash.includes('id=c1')), '不该跳转')
            eq(await a.page.evaluate(() => window.__listCalls), 1)
        } finally { await a.context.close(); await b.context.close() }
    })

    await t.test('另一个课程页正在负责续课：本页不跳', async () => {
        const { context, page } = await openPlayer({ [K.owner]: { tab: 'other-tab', at: Date.now() + 60000 } }, [100], [['c1', 100], ['c2', 0]])
        try {
            await waitStatus(page, '另一个课程页')
            eq(await page.evaluate(() => window.__listCalls), 0)
            assert(await page.evaluate(() => location.hash.includes('id=c1')), '不该跳转')
        } finally { await context.close() }
    })

    await t.test('后台保活开启：拦下 visibilitychange、重置无操作计时、暂停后续播', async () => {
        const { context, page } = await openPlayer({ [K.keepAlive]: true }, [100, 60], [['c1', 60], ['c2', 0]])
        try {
            await page.waitForFunction(() => window.__played > 0 && window.__moved > 0, null, { timeout: 9000 })
            eq(await page.evaluate(() => window.__visibility), 0)
            eq(await page.evaluate(() => document.hidden), false)
            assert((await h.errors(page)).length === 0, '课程页有未捕获异常')
        } finally { await context.close() }
    })

    await t.test('后台保活关闭：不拦事件、不续播', async () => {
        const { context, page } = await openPlayer({}, [100, 60], [['c1', 60], ['c2', 0]])
        try {
            await page.waitForTimeout(6500)
            eq(await page.evaluate(() => window.__played), 0)
            eq(await page.evaluate(() => window.__moved), 0)
            eq(await page.evaluate(() => window.__visibility), 1)
        } finally { await context.close() }
    })

    await t.test('平台弹出验证/答题窗口时保活不续播', async () => {
        const { context, page } = await openPlayer({ [K.keepAlive]: true }, [100, 60], [['c1', 60], ['c2', 0]])
        try {
            await page.evaluate(() => {
                const dialog = document.createElement('div')
                dialog.className = 'el-dialog__wrapper'
                dialog.textContent = '扫一扫人脸识别'
                document.body.append(dialog)
            })
            await waitStatus(page, '手动处理')
            await page.evaluate(() => { window.__played = 0 })
            await page.waitForTimeout(5500)
            eq(await page.evaluate(() => window.__played), 0)
        } finally { await context.close() }
    })

    await t.test('「是否继续学习」弹窗自动点确认', async () => {
        const { context, page } = await openPlayer({ [K.keepAlive]: true }, [100, 60], [['c1', 60], ['c2', 0]])
        try {
            await page.evaluate(() => {
                const box = document.createElement('div')
                box.className = 'el-message-box__wrapper'
                box.innerHTML = '<p>您已学习30分钟了,是否继续学习？</p><div class="el-message-box__btns"><button class="el-button">取消</button><button class="el-button el-button--primary">确定</button></div>'
                box.querySelector('.el-button--primary').addEventListener('click', () => { window.__confirmed = true; box.remove() })
                document.body.append(box)
            })
            await page.waitForFunction(() => window.__confirmed === true, null, { timeout: 9000 })
        } finally { await context.close() }
    })

    await t.test('自动跳转后的课程页没开保活也会尝试开播', async () => {
        const { context, page } = await openPlayer(
            { [P + 'autostart']: { courseId: 'c1', at: Date.now() } }, [0, 0], [['c1', 0], ['c2', 0]])
        try {
            await page.waitForFunction(() => window.__played > 0, null, { timeout: 9000 })
            eq(await page.evaluate(() => window.__moved), 0)
        } finally { await context.close() }
    })

    await env.close()
    t.done()
})().catch(error => { console.error(error); process.exitCode = 1 })
