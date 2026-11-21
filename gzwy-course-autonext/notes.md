# 贵州省网络研修专题自动续课

目标专题：`http://www.gzwy.gov.cn/page.html#/pc/nc/pagespecial/specialDetail?id=28c0ade8b77e42ac821863d958ade8c8`

## 调研结果

- 页面是 Vue 单页应用，入口文件加载 `modules/nc/js/dsf-nc.pc.js`，课程播放器使用 ckplayer。
- 专题页列表从 `nc/class/course/list` 获取有序 `lists[].subList[]`；课程行包含 `businessId`、`name`、`typeValue`、`progress`、`playState` 等字段。
- 专题列表的「进入」按钮调用 Vue 组件的 `clickEnter`。**贵州站点实际生效的是 `static/js/project/dsf-pc.js` 里的项目版组件**，参数表是 `clickEnter(group, item, classId, group, index, previousProgress, isStudentFlag)`；`modules/nc/js/dsf-nc.pc.js` 里的通用版是 `clickEnter(item, classId, group, index, previousProgress)`。按通用版顺序去调项目版，第二个参数变成 classId 字符串，`playState` 读不到，页面提示「不在学习时间范围」且不打开课程。脚本按形参个数（≥6 为项目版）区分两种调用方式。
- 课程播放页从 `nc/course/play/getPlayTrend` 取 `playTree`，使用 `locationSite` 载入当前课件。播放器结束回调可在课程树里继续下一课件；站点原生切换函数会把最后一项绕回第一项。
- 学习进度由页面播放器按正常播放进度调用 `nc/course/play/pulseSaveRecord` 上报；专题列表可重新加载后读取平台记录的完成百分比。

## 脚本行为

gzwy-course-autonext.user.js 在目标专题页和课程播放页显示面板，默认关闭。**切课由课程页自己完成，不依赖专题页标签页**：

- **专题页**：点「开始学习第一门未完成课程」，用专题组件原生的 clickEnter 打开课程（这一步需要一次真实点击，保留站点的开放时间、报名状态、前置课程检查）。之后专题页只显示进度；课程页核对到完成门数变了，专题页会调一次列表组件父级的 `initData()` 把页面上的课程列表也刷新。
- **课程页**：每 5 秒读 Vue 播放器课程树 `chapterInfo.children[].finishedRate` 和媒体元素的播放时间，写进缓存。开关打开时，用站点自己的 `dsf.http.get('/nc/class/course/list', { id: 专题 id })` 读专题课程列表（和专题页用的是同一个只读接口）：课还在播时每 60 秒一次，课件全部看完后每 15 秒一次，一段播完 3 秒后也会查一次。当前课程 `progress` 到 100 就按列表顺序取第一门未完成课程，在**当前标签页**把地址改成站点「进入」按钮打开的那个地址（`#/pc/nc/pagecourse/coursePlayer?id=…&classid=…&type=ztb`）再刷新。下一项不是课程（考试、直播等）、`playState` 为假、或者没有待学课程时停下并说明。
- **缓存**（GM 值，跨标签页共享）：专题课程列表及核对时间、当前课程页的课件进度、最近 6 条动作、哪个课程页负责切课。面板据此显示：专题进度（几门完成、几点核对的）、正在学哪门及平台记录的百分比、下一门、课件完成段数与当前播放时间、最近动作。
- 同时开着多个课程页时，只有一个负责自动切课（30 秒心跳），其余只显示进度，避免一起跳到同一门。
- 自动跳转后的头 90 秒，即使没开后台保活，也会在视频没自动开播时调用 `play()`（被拒绝则静音再播），否则会卡在浏览器的自动播放限制上。

踩过的坑：

- 不能用「最后一个课件播完」来判断课程学完：站点的结束回调 `playEnd` 先于脚本执行，`end_action` 为 2 时立刻 `playNextCourse()`，最后一项会绕回第一项，脚本看到的当前课件已经是第一个。表现就是课件在课程内循环，永远不切下一门。
- 前两版让专题页（或经由 `window.opener`）去开下一门，切课取决于专题页标签页还活着、没被浏览器降频或丢弃、弹窗没被拦，实测一直卡在切换上。现在课程页自己读列表、自己跳，没有新标签页，也就没有弹窗拦截和标签页越开越多的问题。
- 同一路由只换 `id` 参数，Vue 不会重建播放器组件（`queryiId` 只在创建时取一次），所以改完地址必须刷新页面。
- 直接跳转没有经过项目版 clickEnter，脚本自己照它的条件判断：类型是课程、`playState` 为真、前面的课程已完成（按列表顺序取第一门未完成的，自然满足按序学习）。项目版 clickEnter 里没有人脸核验这一步，人脸核验在播放页里，照常生效。

脚本不改学习进度接口，不自动答题、不模拟视频结束，也不处理人脸核验。

## 后台保活（可选，默认关闭）

面板第二个开关，设置跨标签页共享，只在课程播放页生效，对开关之后打开（或自动跳转刷新后）的播放页起作用。站点播放器有两处会让挂后台的课停下来（均见 `static/js/project/dsf-pc.js`）：

- `initPlayerTabStop`：收到 `visibilitychange` 且 `document.hidden` 为真时暂停播放器。脚本在保活开启时让播放页的 `document.hidden` / `visibilityState` 读成前台，并在捕获阶段拦下 `visibilitychange`。
- 无操作提醒：`document.onmousemove` 超过后台配置的分钟数没触发，就暂停并弹「您已学习 N 分钟了,是否继续学习？」。脚本每 5 秒调用一次 `document.onmousemove` 重置计时；弹窗仍然出现时点「确定」（弹窗 DOM 按 Element UI 的 `.el-message-box` 推断，未在真实页面核对）。

另外每 5 秒检查一次：视频处于暂停且未播完时调用 `play()`，被浏览器自动播放策略拒绝则静音后再播。保活开着时手动暂停会被续播，要暂停先关开关。

页面上有可见的 `.el-dialog__wrapper`（人脸核验二维码、随堂测验等）或其他提示框时不续播，面板提示手动处理。

## 已知限制

- 开关打开时，打开一门平台已记满 100% 的课程会在几秒内被带去下一门未完成课程；想回看已学完的课先关开关。
- 课程页在后台且没开保活时，站点自己会暂停播放，浏览器也会把定时器降到大约每分钟一次，切课会慢。挂后台请开保活。
- `dsf.http`、课程列表接口路径、播放器组件的属性名都来自对站点脚本的调研，站点更新后需要重新调研；实现使用功能特征识别 Vue 实例，避免依赖压缩后的组件名。
- 专题页面板上的「正在学」「课件」来自课程页 30 秒内写入的缓存，课程页关掉后就不显示。
- 支持 gzwy.gov.cn / www.gzwy.gov.cn 的 HTTP 和 HTTPS 页面地址。

## 安装

离线测试命令：`NODE_PATH=/path/to/node_modules node gzwy-course-autonext/test/run.cjs`。测试使用本地页面模拟播放器、专题 Vue 课程列表、站点入口和 `dsf.http.get`。

用 Tampermonkey 安装 gzwy-course-autonext.user.js，打开目标专题页，点「开始学习第一门未完成课程」（会自动打开开关）；要挂后台就先勾上「后台保活」。若之前安装过旧版，请在 Tampermonkey 中更新脚本并刷新专题页。
