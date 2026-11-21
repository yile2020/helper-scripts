// ==UserScript==
// @name         贵州省网络研修专题｜完成后切换下一门课
// @name:zh-CN   贵州省网络研修专题｜完成后切换下一门课
// @name:en      Guizhou Online Training｜Next Course After Completion
// @namespace    https://github.com/yilecoding/helper-scripts
// @version      2026.11.12.1
// @description  从专题页一键进入第一门未完成课程；课程完成后在当前标签页进入下一门；面板显示专题与课件进度；可选后台保活。
// @description:zh-CN 从专题页一键进入第一门未完成课程；课程完成后在当前标签页进入下一门；面板显示专题与课件进度；可选后台保活。
// @description:en  Start the first unfinished course from the topic page, then use the platform's native entry for the next course after completion.
// @author       壹樂（V：ita1125）
// @match        http://gzwy.gov.cn/page.html*
// @match        https://gzwy.gov.cn/page.html*
// @match        http://www.gzwy.gov.cn/page.html*
// @match        https://www.gzwy.gov.cn/page.html*
// @icon         http://www.gzwy.gov.cn/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @license      MIT
// @homepageURL  https://github.com/yile2020/helper-scripts
// @supportURL   https://github.com/yile2020/helper-scripts/issues
// @updateURL    https://raw.githubusercontent.com/yile2020/helper-scripts/main/gzwy-course-autonext/gzwy-course-autonext.user.js
// @downloadURL  https://raw.githubusercontent.com/yile2020/helper-scripts/main/gzwy-course-autonext/gzwy-course-autonext.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const TAG = '[专题续课]';
    const PAGE = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
    const ENABLED_KEY = 'gzwy-course-autonext-enabled';
    const KEEPALIVE_KEY = 'gzwy-course-autonext-keepalive';
    // 缓存（GM 值，跨标签页共享）：专题课程列表、当前播放页的课件进度、最近动作、哪个播放页负责自动切课。
    const LIST_KEY = 'gzwy-course-autonext-list';
    const PLAYER_KEY = 'gzwy-course-autonext-player';
    const LOG_KEY = 'gzwy-course-autonext-log';
    const OWNER_KEY = 'gzwy-course-autonext-owner';
    const AUTOSTART_KEY = 'gzwy-course-autonext-autostart';
    const ROOT_ID = 'gzwy-course-autonext-panel';
    const TOPIC_ID = '28c0ade8b77e42ac821863d958ade8c8';
    const LIST_URL = '/nc/class/course/list';
    const TICK_MS = 5000;
    const LIST_POLL_MS = 60000;      // 课还在播：一分钟核对一次平台进度
    const DONE_POLL_MS = 15000;      // 课件全看完：等平台同步，查得勤一点
    const OWNER_STALE_MS = 30000;
    const PLAYER_FRESH_MS = 30000;
    const AUTOSTART_MS = 90000;
    const TAB_ID = Math.random().toString(36).slice(2);
    let enabled = GM_getValue(ENABLED_KEY, false) === true;
    let keepAlive = GM_getValue(KEEPALIVE_KEY, false) === true;
    let currentCourseId = '';
    let wares = [];
    let checking = false;
    let navigating = false;
    let stopped = false;
    let lastListCheck = 0;
    let topicSyncedAt = 0;
    let autoStartUntil = 0;

    function routeInfo() {
        const route = PAGE.location.hash || '';
        const query = new URLSearchParams(route.split('?')[1] || '');
        const isTopic = route.includes('/pc/nc/pagespecial/specialDetail') && query.get('id') === TOPIC_ID;
        const isPlayer = route.includes('/pc/nc/pagecourse/coursePlayer');
        return { isTopic, isPlayer, courseId: isPlayer ? query.get('id') || '' : '', classId: isPlayer ? query.get('classid') || '' : '' };
    }

    const routeState = routeInfo();
    if (!routeState.isTopic && !routeState.isPlayer) return;
    currentCourseId = routeState.courseId;
    const isTopicPage = routeState.isTopic;

    // ---------- 通用 ----------

    function readValue(key) {
        const value = GM_getValue(key, null);
        return value && typeof value === 'object' ? value : null;
    }

    function clock(at) {
        const d = new Date(at);
        const pad = n => String(n).padStart(2, '0');
        return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    function mmss(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
    }

    function addLog(text) {
        const log = (GM_getValue(LOG_KEY, null) || []).slice(-5);
        log.push({ at: Date.now(), text });
        GM_setValue(LOG_KEY, log);
        console.info(TAG, text);
    }

    function findVm(match) {
        try {
            const seen = new Set();
            const stack = [];
            const add = vm => { if (vm && !seen.has(vm)) { seen.add(vm); stack.push(vm); } };
            PAGE.document.querySelectorAll('*').forEach(node => add(node.__vue__));
            while (stack.length) {
                const vm = stack.pop();
                if (match(vm)) return vm;
                if (Array.isArray(vm.$children)) vm.$children.forEach(add);
            }
        } catch (error) {
            console.debug(TAG, '读取页面组件失败', error);
        }
        return null;
    }

    function progressOf(item) {
        const value = Number(item && item.progress);
        return Number.isFinite(value) ? value : 0;
    }

    // 把站点的 lists[].subList[] 摊平成缓存用的课程行。
    function flattenLists(lists) {
        const courses = [];
        (lists || []).forEach(group => (group.subList || []).forEach(item => {
            courses.push({
                id: String(item.businessId), name: item.name || '未命名课程', type: item.typeValue || '',
                typeText: item.typeText || item.typeValue || '非课程项目',
                progress: progressOf(item), playState: !!item.playState, classId: group.classId || '',
            });
        }));
        return courses;
    }

    function saveList(courses) {
        GM_setValue(LIST_KEY, { courses, at: Date.now() });
    }

    function doneCount(courses) {
        return courses.filter(course => course.progress >= 100).length;
    }

    // ---------- 面板 ----------

    function setStatus(message, kind) {
        const status = document.querySelector('#' + ROOT_ID + ' [data-status]');
        if (!status) return;
        status.textContent = message;
        status.dataset.kind = kind || 'info';
    }

    function button(label, callback, className) {
        const el = document.createElement('button');
        el.type = 'button';
        el.textContent = label;
        el.className = className || '';
        el.addEventListener('click', callback);
        return el;
    }

    function setEnabled(value) {
        enabled = value;
        GM_setValue(ENABLED_KEY, value);
        const checkbox = document.querySelector('#' + ROOT_ID + ' [data-enabled]');
        if (checkbox) checkbox.checked = value;
    }

    function renderInfo() {
        const info = document.querySelector('#' + ROOT_ID + ' [data-info]');
        if (!info) return;
        const rows = [];
        const list = readValue(LIST_KEY);
        const player = readValue(PLAYER_KEY);
        const playerLive = player && (!isTopicPage || Date.now() - player.at < PLAYER_FRESH_MS);
        const watchingId = isTopicPage ? (playerLive ? player.courseId : '') : currentCourseId;
        if (list && list.courses.length) {
            rows.push(['专题进度', doneCount(list.courses) + ' / ' + list.courses.length + ' 门完成（' + clock(list.at) + ' 核对）']);
            const current = list.courses.find(course => course.id === watchingId);
            if (current) rows.push(['正在学', '《' + current.name + '》平台记录 ' + current.progress + '%']);
            else if (isTopicPage) rows.push(['正在学', '没有打开的课程页']);
            const next = list.courses.find(course => course.progress < 100 && course.id !== watchingId);
            rows.push(['下一门', next ? '《' + next.name + '》' + (next.type === 'course' ? '' : '（' + next.typeText + '，需手动）') : '没有了']);
        } else {
            rows.push(['专题进度', '还没有数据，开始学习后会自动核对']);
        }
        if (playerLive && player.wares.length) {
            const finished = player.wares.filter(ware => ware.rate >= 100).length;
            let text = finished + ' / ' + player.wares.length + ' 段完成';
            if (player.duration) text += ' · 当前第 ' + player.index + ' 段 ' + mmss(player.time) + ' / ' + mmss(player.duration) + (player.paused ? '（暂停中）' : '');
            rows.push(['课件', text]);
        }
        (GM_getValue(LOG_KEY, null) || []).slice(-3).forEach((entry, index) => {
            rows.push([index === 0 ? '最近动作' : '', clock(entry.at) + ' ' + entry.text]);
        });
        info.replaceChildren(...rows.map(([label, value]) => {
            const row = document.createElement('div');
            row.className = 'row';
            const key = document.createElement('span');
            key.className = 'key';
            key.textContent = label;
            const val = document.createElement('span');
            val.className = 'val';
            val.textContent = value;
            row.append(key, val);
            return row;
        }));
    }

    function renderPanel() {
        if (document.getElementById(ROOT_ID)) return;
        const host = document.createElement('section');
        host.id = ROOT_ID;
        host.innerHTML = '<div class="title">专题续课</div>' +
            '<label class="switch"><input type="checkbox" data-enabled><span>课程完成后进入下一门</span></label>' +
            '<label class="switch"><input type="checkbox" data-keepalive><span>后台保活（切到后台不暂停、自动续播）</span></label>' +
            '<div class="info" data-info></div>' +
            '<div class="status" data-status></div><div class="actions" data-actions></div>';
        const style = document.createElement('style');
        style.textContent =
            '#' + ROOT_ID + '{position:fixed;z-index:2147483646;right:18px;bottom:18px;width:340px;box-sizing:border-box;padding:14px 16px;background:#fff;border:1px solid #dcdfe6;border-radius:10px;box-shadow:0 4px 18px #0002;color:#303133;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
            '#' + ROOT_ID + ' .title{font-size:15px;font-weight:700;margin-bottom:8px}' +
            '#' + ROOT_ID + ' .switch{display:flex;align-items:center;gap:8px;cursor:pointer}' +
            '#' + ROOT_ID + ' .switch input{accent-color:#409eff}' +
            '#' + ROOT_ID + ' .info{margin-top:10px;padding-top:8px;border-top:1px solid #ebeef5;font-size:12px}' +
            '#' + ROOT_ID + ' .row{display:flex;gap:8px;padding:1px 0}' +
            '#' + ROOT_ID + ' .key{flex:0 0 56px;color:#909399}' +
            '#' + ROOT_ID + ' .val{flex:1;min-width:0;word-break:break-all}' +
            '#' + ROOT_ID + ' .status{margin-top:8px;padding-top:8px;border-top:1px solid #ebeef5;color:#606266;font-size:12px}' +
            '#' + ROOT_ID + ' .status[data-kind="success"]{color:#67c23a}' +
            '#' + ROOT_ID + ' .status[data-kind="error"]{color:#f56c6c}' +
            '#' + ROOT_ID + ' .actions:empty{display:none}' +
            '#' + ROOT_ID + ' button{margin-top:10px;padding:7px 10px;border:1px solid #409eff;border-radius:5px;background:#fff;color:#409eff;cursor:pointer}' +
            '#' + ROOT_ID + ' button.primary{background:#409eff;color:#fff}';
        document.documentElement.append(style, host);
        const checkbox = host.querySelector('[data-enabled]');
        checkbox.checked = enabled;
        checkbox.addEventListener('change', () => {
            setEnabled(checkbox.checked);
            stopped = false;
            lastListCheck = 0;
            if (!enabled) setStatus('已暂停自动切课。');
            else setStatus(isTopicPage ? '已开启。点「开始学习」进入第一门未完成课程。' : '已开启。这门课被平台记满 100% 后，本页直接进入下一门。');
        });
        const keepBox = host.querySelector('[data-keepalive]');
        keepBox.checked = keepAlive;
        keepBox.addEventListener('change', () => {
            keepAlive = keepBox.checked;
            GM_setValue(KEEPALIVE_KEY, keepAlive);
            if (isTopicPage) setStatus(keepAlive ? '后台保活已开启，对之后打开的课程页生效。' : '后台保活已关闭，对之后打开的课程页生效。');
            else setStatus(keepAlive ? '后台保活已开启：切到后台不暂停，暂停后会自动续播。' : '后台保活已关闭。');
        });
        if (isTopicPage) {
            host.querySelector('[data-actions]').append(button('开始学习第一门未完成课程', startFirstCourse, 'primary'));
            setStatus('点「开始学习」进入第一门未完成课程。之后课程页会自己一门接一门，本页只显示进度。');
        } else {
            setStatus(enabled ? '已开启。这门课被平台记满 100% 后，本页直接进入下一门。' : '自动切课未开启，只显示进度。');
        }
        renderInfo();
    }

    // ---------- 专题页：启动第一门课、显示缓存的进度 ----------

    // 用功能特征识别 Vue 实例，不依赖压缩后的组件名。
    function findCourseListVm() {
        return findVm(vm => Array.isArray(vm.lists) && typeof vm.clickEnter === 'function' &&
            vm.lists.some(group => Array.isArray(group.subList)));
    }

    // 贵州站点用项目版组件覆盖了通用组件，clickEnter 的参数表不同：
    //   项目版（dsf-pc.js）：clickEnter(group, item, classId, group, index, previousProgress, isStudentFlag)
    //   通用版（dsf-nc.pc.js）：clickEnter(item, classId, group, index, previousProgress)
    // 按形参个数区分，调用方式与页面「进入」按钮的模板保持一致。
    function usesProjectSignature(vm) {
        const methods = vm.$options && vm.$options.methods;
        const fn = (methods && methods.clickEnter) || vm.clickEnter;
        return fn.length >= 6;
    }

    function canEnter(vm, item) {
        if (usesProjectSignature(vm)) return vm.isstudent == 1 || (!!vm.showClick && !!item.playState);
        return !!vm.showClick && !!item.playState;
    }

    function callNativeEnter(vm, group, index) {
        const item = group.subList[index];
        const previousProgress = index > 0 ? group.subList[index - 1].progress : null;
        if (usesProjectSignature(vm)) {
            if (vm.isstudent == 1) vm.clickEnter(group, item, group.classId, group, index, previousProgress, 1);
            else vm.clickEnter(group, item, group.classId, group, index, previousProgress);
        } else {
            vm.clickEnter(item, group.classId, group, index, previousProgress);
        }
    }

    function startFirstCourse() {
        const vm = findCourseListVm();
        if (!vm) {
            setStatus('专题课程列表还在加载，请稍等后再点。');
            return;
        }
        saveList(flattenLists(vm.lists));
        let target = null;
        vm.lists.some(group => (group.subList || []).some((item, index) => {
            if (progressOf(item) >= 100) return false;
            target = { group, index, item };
            return true;
        }));
        if (!target) {
            setStatus('专题列表中没有未完成课程。', 'success');
        } else if (target.item.typeValue !== 'course') {
            setStatus('下一项是“' + (target.item.typeText || target.item.typeValue || '非课程项目') + '”，请先按平台要求处理。');
        } else if (!canEnter(vm, target.item)) {
            setStatus('《' + (target.item.name || '第一门未完成课程') + '》当前未开放或不满足平台前置条件，请先按平台提示处理。');
        } else {
            setEnabled(true);
            try {
                // 与用户手动点击「进入」走同一套站点逻辑：时间、报名、前置条件。
                callNativeEnter(vm, target.group, target.index);
                addLog('从专题页进入《' + (target.item.name || '未命名课程') + '》');
                setStatus('已打开《' + (target.item.name || '课程') + '》。之后课程页会自己一门接一门，本页只显示进度。没看到新标签页就允许弹出式窗口后再点一次。');
            } catch (error) {
                console.error(TAG, '开始课程失败', error);
                setStatus('未能打开课程。请确认登录和报名状态后重试。', 'error');
            }
        }
        renderInfo();
    }

    function topicTick() {
        const vm = findCourseListVm();
        const list = readValue(LIST_KEY);
        if (vm) {
            const own = flattenLists(vm.lists);
            if (!list) {
                saveList(own);
            } else if (list.at > topicSyncedAt && doneCount(list.courses) !== doneCount(own)) {
                // 课程页核对到新进度了：让页面上的课程列表也刷新一下。
                topicSyncedAt = list.at;
                const refresh = typeof vm.initData === 'function' ? vm
                    : (vm.$parent && typeof vm.$parent.initData === 'function' ? vm.$parent : null);
                if (refresh) { try { refresh.initData(); } catch (error) { console.debug(TAG, '刷新专题列表失败', error); } }
            }
        }
        renderInfo();
    }

    // ---------- 课程页：缓存课件进度，核对平台进度，记满后在本页进入下一门 ----------

    function findPlayerVm() {
        return findVm(vm => String(vm.queryiId || '') === currentCourseId && vm.curPlayItem &&
            vm.chapterInfo && Array.isArray(vm.chapterInfo.children));
    }

    function readWares() {
        const vm = findPlayerVm();
        const media = document.querySelector('video,audio');
        const children = vm ? vm.chapterInfo.children : [];
        wares = children.map(item => ({ rate: Number(item.finishedRate) || 0 }));
        const index = vm ? children.findIndex(item => String(item.id) === String(vm.curPlayItem.id)) : -1;
        GM_setValue(PLAYER_KEY, {
            courseId: currentCourseId, wares, index: index + 1,
            time: media ? media.currentTime : 0,
            duration: media && Number.isFinite(media.duration) ? media.duration : 0,
            paused: media ? media.paused : true, at: Date.now(),
        });
    }

    // 不能用「最后一段播完」来判断：站点的结束回调先执行，会立刻把当前课件绕回第一段。
    function allWaresFinished() {
        return wares.length > 0 && wares.every(ware => ware.rate >= 100);
    }

    // 同时开着多个课程页时只让一个负责自动切课，免得一起跳到同一门。
    function isOwner() {
        const owner = readValue(OWNER_KEY);
        if (owner && owner.tab !== TAB_ID && Date.now() - owner.at < OWNER_STALE_MS) return false;
        GM_setValue(OWNER_KEY, { tab: TAB_ID, at: Date.now() });
        return true;
    }

    // 用站点自己的请求工具读专题课程列表（和专题页用的是同一个接口，只读）。
    function fetchLists() {
        return new Promise((resolve, reject) => {
            const dsf = PAGE.dsf;
            if (!dsf || !dsf.http || typeof dsf.http.get !== 'function') {
                reject(new Error('页面还没准备好'));
                return;
            }
            setTimeout(() => reject(new Error('请求超时')), 15000);
            dsf.http.get(LIST_URL, { id: TOPIC_ID }, PAGE.$$webRoot && PAGE.$$webRoot.nc)
                .done(result => {
                    if (result && result.success && Array.isArray(result.data)) resolve(result.data);
                    else reject(new Error((result && result.message) || '平台没有返回课程列表'));
                })
                .error(error => reject(new Error((error && error.message) || '请求失败')));
        });
    }

    function goToCourse(next) {
        navigating = true;
        GM_setValue(AUTOSTART_KEY, { courseId: next.id, at: Date.now() });
        const classId = next.classId || routeState.classId;
        // 与站点「进入」按钮打开的地址一致；同一个路由只换参数不会重建播放器，所以改完地址再刷新。
        const url = PAGE.location.pathname + '#/pc/nc/pagecourse/coursePlayer?id=' + next.id + '&classid=' + classId + '&type=ztb';
        setTimeout(() => {
            PAGE.location.href = url;
            PAGE.location.reload();
        }, 1500);
    }

    function decide(courses) {
        const current = courses.find(course => course.id === currentCourseId);
        if (!current) {
            stopped = true;
            setStatus('这门课不在目标专题的课程列表里，不自动切课。', 'error');
            return;
        }
        if (current.progress < 100) {
            setStatus(allWaresFinished()
                ? '课件已全部看完，平台记录 ' + current.progress + '%，等平台同步到 100%…'
                : '正在学，平台记录 ' + current.progress + '%。到 100% 后本页直接进入下一门。');
            return;
        }
        const next = courses.find(course => course.progress < 100);
        if (!next) {
            stopped = true;
            addLog('专题全部课程已完成');
            setStatus('专题列表中没有未完成课程了。', 'success');
        } else if (next.type !== 'course') {
            stopped = true;
            addLog('下一项是“' + next.typeText + '”，需手动处理');
            setStatus('《' + current.name + '》已完成。下一项是“' + next.typeText + '”，请按平台要求手动完成。');
        } else if (!next.playState) {
            stopped = true;
            setStatus('《' + next.name + '》当前不在学习时间范围，无法进入。');
        } else {
            addLog('《' + current.name + '》已完成，进入《' + next.name + '》');
            setStatus('《' + current.name + '》已完成，正在进入《' + next.name + '》…', 'success');
            goToCourse(next);
        }
    }

    async function checkList() {
        if (!enabled || checking || navigating || stopped) return;
        if (Date.now() - lastListCheck < (allWaresFinished() ? DONE_POLL_MS : LIST_POLL_MS)) return;
        if (!isOwner()) {
            setStatus('另一个课程页正在负责自动续课，本页不自动切换。');
            return;
        }
        checking = true;
        lastListCheck = Date.now();
        try {
            const courses = flattenLists(await fetchLists());
            saveList(courses);
            if (enabled && !navigating) decide(courses);
        } catch (error) {
            console.debug(TAG, '核对专题进度失败', error);
            setStatus('核对专题进度失败（' + error.message + '），稍后重试。', 'error');
        } finally {
            checking = false;
            renderInfo();
        }
    }

    // ---- 后台保活（默认关闭，只在课程页生效）----
    // 站点播放器有两处会让挂后台的课停下来：
    //   1. initPlayerTabStop：visibilitychange 且 document.hidden 时暂停播放器；
    //   2. 无操作提醒：document.onmousemove 超过设定分钟数没触发，就暂停并弹「是否继续学习」。
    // 人脸核验、随堂测验等弹窗不处理，出现时停下来等人工操作。
    function installVisibilityShield() {
        const doc = PAGE.document;
        const proto = PAGE.Document.prototype;
        const shield = (name, value) => {
            const desc = Object.getOwnPropertyDescriptor(proto, name);
            if (!desc || !desc.get) return;
            try {
                Object.defineProperty(doc, name, { configurable: true, get: () => (keepAlive ? value : desc.get.call(doc)) });
            } catch (error) { console.debug(TAG, '无法接管 ' + name, error); }
        };
        shield('hidden', false);
        shield('webkitHidden', false);
        shield('visibilityState', 'visible');
        shield('webkitVisibilityState', 'visible');
        ['visibilitychange', 'webkitvisibilitychange'].forEach(type => doc.addEventListener(type, event => {
            if (keepAlive) event.stopImmediatePropagation();
        }, true));
    }

    function isShown(el) {
        return getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
    }

    function keepPlaying() {
        // 自动跳到下一门后的头一分半也要保证开播，否则没开保活的人会卡在不自动播放上。
        const autoStart = Date.now() < autoStartUntil;
        if (navigating || (!keepAlive && !autoStart)) return;

        if (keepAlive) {
            // 等同于动了一下鼠标：重置站点的无操作计时。
            const poke = PAGE.document.onmousemove;
            if (typeof poke === 'function') {
                try { poke.call(PAGE.document, new MouseEvent('mousemove')); } catch (error) { console.debug(TAG, '重置无操作计时失败', error); }
            }
            const box = Array.from(document.querySelectorAll('.el-message-box__wrapper')).find(isShown);
            if (box) {
                const confirm = box.textContent.includes('是否继续学习') && box.querySelector('.el-message-box__btns .el-button--primary');
                if (confirm) { confirm.click(); addLog('已确认「是否继续学习」'); }
                else setStatus('平台弹出了提示窗口，请手动处理。');
                return;
            }
        }
        if (Array.from(document.querySelectorAll('.el-dialog__wrapper')).some(isShown)) {
            setStatus('平台弹出了验证或答题窗口，请手动处理，处理完会继续播放。');
            return;
        }
        const media = document.querySelector('video,audio');
        if (!media || !media.paused || media.ended) return;
        Promise.resolve(media.play()).catch(() => {
            // 没有用户手势时浏览器只允许静音自动播放。
            media.muted = true;
            return media.play();
        }).catch(error => console.debug(TAG, '续播失败', error));
    }

    function playerTick() {
        readWares();
        renderInfo();
        checkList();
        keepPlaying();
    }

    function startPlayer() {
        const autoStart = readValue(AUTOSTART_KEY);
        if (autoStart && autoStart.courseId === currentCourseId && Date.now() - autoStart.at < AUTOSTART_MS) {
            autoStartUntil = autoStart.at + AUTOSTART_MS;
        }
        installVisibilityShield();
        setInterval(playerTick, TICK_MS);
        // 一段播完后平台会回写完成度，稍等就核对一次，比等下一轮快。
        document.addEventListener('ended', () => setTimeout(() => { lastListCheck = 0; playerTick(); }, 3000), true);
        console.info(TAG, '课程页已启动');
    }

    function start() {
        renderPanel();
        if (isTopicPage) {
            setInterval(topicTick, TICK_MS);
            topicTick();
        } else {
            startPlayer();
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
