/**
 * 把 Next 的静态导出打成一个能作为 B 站 Toy 发布的包。
 *
 * Toy 的静态托管是个纯对象存储，只认完整的文件路径：实测 `/chronicle/`、
 * `/chronicle`、`/chronicle.html` 全是 404，只有 `/chronicle/index.html` 返回 200。
 * 整个脚本存在的理由就是把 Next 的产物适配到这个约束上。
 *
 * 做三件事：
 *
 * **一、删掉 `.txt` 预取负载。** 完整产物 428 MB，其中 244 MB 是 App Router 给客户端
 * 导航预取用的 RSC 负载。删掉之后预取请求会 404（控制台有噪声），页面切换退回整页
 * 跳转，但水合与页面内交互完全不受影响。删完 zip 约 36 MB，留着是 92 MB。
 *
 * **二、给目录形式的站内链接补 `index.html`。** 服务端渲染出来的链接全是 `/model/x/`
 * 这种目录形式，在这个存储上点一个断一个。
 *
 * **三、注入一段点击兜底脚本。** 水合之后 React 会用 JS 里的 href 覆盖 HTML 里的，
 * 又变回目录形式，所以光改 HTML 不够。脚本在捕获阶段拦住站内链接的点击，把目录 URL
 * 补成 `index.html` 再跳。因为 `.txt` 已经删了，客户端路由本来也会退化成整页跳转，
 * 这里等于把那次跳转的目标修正到一个真实存在的文件上，没有额外代价。
 *
 * ---
 *
 * **⚠️ 绝对不能把 basePath 换成相对路径。** 这是 2026-09-17 整站失去交互的事故根因。
 *
 * 当时为了让预览地址（`/toy/preview/preview_xxxx/`，前缀和正式地址不同）也能跑，
 * 脚本把产物里的 `/toy/ai-model-world/` 按每个文件自身的深度换成了 `../`。结果是
 * 全站水合静默失败：页面看着完全正常，但所有按钮点了都没反应，控制台一条报错都没有。
 *
 * 逐项试出来的结论：
 *
 * 1. **JS 不能动。** chunk 躺在 `_next/static/chunks/`（深度 3），换成 `../../../`
 *    之后是在页面文档里解析的，直接飞出站点根，turbopack 的 chunk 基址失效。
 * 2. **HTML 里的 `<script src>` 也不能动。** 哪怕换出来的相对路径解析后完全正确，
 *    水合照样失败。turbopack 按脚本 src 的字面值登记 chunk，而内联 flight 数据里的
 *    模块引用（`I[39756,["/toy/.../chunks/xxx.js"],"default"]`）是绝对路径，
 *    两边对不上，模块永远解析不出来。
 * 3. **`<base href>` 也救不了。** 把两边同时剥成不带前缀的相对路径再靠 `<base>`
 *    统一解析，仍然不水合。
 * 4. 运行时设 `TURBOPACK_CHUNK_BASE_PATH` 同样无效，原因同第 2 条。
 *
 * 所以这个包只能挂在构建时写死的那个路径下，也就是正式地址 `/toy/<slug>/`。
 * `toy create` 生成的预览链接打开会是没有样式的裸 HTML，这是预期内的，
 * 不代表包有问题。自检请用本地模拟挂载：
 *
 *   npx tsx scripts/toy/verify.ts
 *
 * 用法：
 *   npm run toy:build
 *   toy update <id> .toy-pkg --yes
 */
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SRC = join(ROOT, process.env.NEXT_DIST_DIR ?? '.next-toy');
const OUT = join(ROOT, '.toy-pkg');
/** 与构建时的 NEXT_BASE_PATH 一致。产物里的前缀保持原样，这里只用于识别站内链接 */
const BASE = `${process.env.NEXT_BASE_PATH ?? '/toy/ai-model-world'}/`;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 目录形式的站内链接，补上 index.html。
 *
 * 三种形态都要覆盖，少一种就漏一批链接：
 *   href="/toy/x/model/foo/"          普通跳转
 *   href="/toy/x/"                    回首页，base 后面没有路径段
 *   href="/toy/x/leaderboard/all/?k"  带查询串，斜杠后面不是引号
 * 所以收尾用 ["?#] 三选一，中间的路径段整体可选。
 *
 * 资源引用不会被误伤：它们都以扩展名收尾，匹配不到「斜杠 + 结束符」。
 * 内联 flight 数据里的链接是转义过的 `\"href\":\"`，匹配不上，不会被动到。
 */
const DIR_LINK = new RegExp(`(href=")(${escapeRe(BASE)}(?:[^"?#]*/)?)(?=["?#])`, 'g');

/**
 * 点击兜底：接管全部站内链接的跳转。
 *
 * 光把 HTML 里的 href 补成 `index.html` 不够，两个原因：
 *   1. 水合之后 React 会用 JS 里的值覆盖 href，又变回 `/model/x/` 这种目录形式；
 *   2. 就算 href 是 `/model/x/index.html`，Next 的客户端路由也会把它规范化成
 *      `/model/x`，再因为拿不到 RSC 负载退化成整页跳转，落到一个 404 上。
 *
 * 所以这里在捕获阶段直接拦下点击，自己算出真实存在的文件路径再跳，绕开路由。
 * `.txt` 预取负载本来就删了，客户端路由无论如何都会退化成整页跳转，没有额外损失。
 *
 * 放行的情况：外链、页内锚点、指向静态资源的链接、带修饰键的点击
 * （后者只就地把 href 改对，跳转仍交给浏览器，保证「新标签页打开」也能用）。
 *
 * 另外还要接管 `history.pushState`：全局搜索的结果不是链接，是 `router.push`
 * 跳的，拦不到点击。这里只在「路径变了」时才接管，路径不变、只改查询串的调用
 * （排行榜筛选靠 `replaceState` 把状态写进地址栏）原样放行。
 */
const CLICK_SHIM = `<script>(function(){function fix(u){var p=u.pathname;var last=p.slice(p.lastIndexOf("/")+1);if(last.indexOf(".")>=0)return /\\.html$/.test(last)?u:null;u.pathname=p.replace(/\\/?$/,"/")+"index.html";return u}document.addEventListener("click",function(e){var t=e.target;var a=t&&t.closest&&t.closest("a[href]");if(!a)return;var u;try{u=new URL(a.getAttribute("href"),location.href)}catch(x){return}if(u.origin!==location.origin)return;if(u.hash&&u.pathname===location.pathname)return;if(!fix(u))return;if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey){a.setAttribute("href",u.href);return}e.preventDefault();e.stopImmediatePropagation();location.href=u.href},true);var push=history.pushState.bind(history);history.pushState=function(s,t,url){if(url!=null){var u;try{u=new URL(String(url),location.href)}catch(x){u=null}if(u&&u.origin===location.origin&&u.pathname!==location.pathname&&fix(u)){location.href=u.href;return}}return push(s,t,url)}})()</script>`;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function main(): void {
  rmSync(OUT, { recursive: true, force: true });
  cpSync(SRC, OUT, { recursive: true });

  const files = walk(OUT);

  let dropped = 0;
  let droppedBytes = 0;
  for (const f of files) {
    if (!f.endsWith('.txt')) continue;
    droppedBytes += statSync(f).size;
    rmSync(f);
    dropped += 1;
  }

  let patched = 0;
  let links = 0;
  for (const f of files) {
    if (!f.endsWith('.html')) continue;
    const text = readFileSync(f, 'utf8');
    let next = text.replace(DIR_LINK, (_m, attr: string, url: string) => {
      links += 1;
      return `${attr}${url}index.html`;
    });
    next = next.replace('</head>', `${CLICK_SHIM}</head>`);
    if (next === text) continue;
    writeFileSync(f, next);
    patched += 1;
  }

  const kept = walk(OUT);
  const total = kept.reduce((n, f) => n + statSync(f).size, 0);
  console.log(`删除预取负载 ${dropped} 个（${(droppedBytes / 1048576).toFixed(0)} MB）`);
  console.log(`处理 ${patched} 个 HTML，补全 ${links} 条目录链接，注入点击兜底`);
  console.log(`产出 ${OUT}：${kept.length} 个文件，${(total / 1048576).toFixed(0)} MB`);
}

main();
