#!/usr/bin/env bash
# 用 Ego 浏览器生成小红书教程图（1080×1440）。
# 用法：bash promo/src/render-ego.sh
# 先由 render.cjs 导出每张图的 HTML，再在 Ego 的任务空间里逐张打开、等字体加载、截图，最后关闭任务空间。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HTML_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xhs-render.XXXXXX")"
HTML_DIR="$HTML_DIR" node "$ROOT/promo/src/render.cjs"
LIST="$HTML_DIR/list.json"

# ego-browser 的脚本不继承环境变量，路径直接写进脚本
ego-browser nodejs <<EOF
const fs = await import("node:fs/promises");
const list = JSON.parse(await fs.readFile("$LIST", "utf8"));
const task = await taskSpace("生成小红书教程图 " + Date.now());
try {
  const page = task.page("p1");
  await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1440, deviceScaleFactor: 1, mobile: false });
  for (const { html, png } of list) {
    await page.goto("file://" + encodeURI(html), { timeout: 60000 });
    await page.waitForLoadState();
    await page.waitForFunction(() => document.fonts.status === "loaded", undefined, { timeout: 30000 });
    const overflow = await page.evaluate(() => {
      const m = document.querySelector("main") || document.querySelector(".page");
      return m.scrollHeight > m.clientHeight + 2 ? m.scrollHeight - m.clientHeight : 0;
    });
    await page.screenshot({ path: png });
    console.log("saved " + png.split("/").pop() + (overflow ? "  ⚠ 内容超出 " + overflow + "px" : ""));
  }
} finally {
  await task.finish({ keep: [] });
}
EOF
rm -rf "$HTML_DIR"
