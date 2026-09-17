/**
 * 把 Next 的静态导出打成一个能作为 B 站 Toy 发布的包。
 *
 * 直接把 `next build` 的产物传上去是跑不起来的，实测踩到三件事，这个脚本各修一件。
 *
 * **一、挂载路径不固定。** Toy 的正式地址是 `/toy/<slug>/`，但预览是
 * `/toy/preview/preview_xxxx/`，两者前缀不同。所以不能把 basePath 写死在产物里
 * ——写死了预览必然白屏，而预览是审核前唯一能自检的地方。做法是先用
 * `NEXT_BASE_PATH` 构建出一个前缀统一、好识别的产物，再在这里把这个前缀按每个文件
 * 自身的深度换成相对路径。换完之后包挂在任何路径下都能跑。
 *
 * **二、存储不认目录 URL。** 实测 Toy 的对象存储上 `/chronicle/` 与 `/chronicle`
 * 都返回 404，只有 `/chronicle/index.html` 是 200。Next 默认生成的站内链接全是
 * 目录形式，照搬过去等于每个跳转都断。所以这里给所有以 `/` 结尾的站内链接补上
 * `index.html`。
 *
 * **三、包太大。** 完整产物 485 MB、zip 后 77 MB，其中 295 MB 是 App Router
 * 给客户端导航预取用的 `.txt` RSC 负载。静态导出下这些请求本来就取不到正确响应
 * （Next 拿到 HTML 后会自己 abort），删掉不影响功能，只是页面切换从 SPA 退回整页跳转。
 * 删完 zip 约 36 MB，平台接得住。
 *
 * 用法：
 *   NEXT_BASE_PATH=/toy/ai-model-world NEXT_DIST_DIR=.next-toy npm run build
 *   npx tsx scripts/toy/pack.ts
 *   toy update <id> .toy-pkg --json        # 先不加 --yes，拿预览链接自检
 */
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SRC = join(ROOT, process.env.NEXT_DIST_DIR ?? '.next-toy');
const OUT = join(ROOT, '.toy-pkg');
/** 与构建时的 NEXT_BASE_PATH 保持一致，只是个便于识别与替换的记号 */
const BASE = `${process.env.NEXT_BASE_PATH ?? '/toy/ai-model-world'}/`;

const TEXT_EXT = /\.(html|css|js|mjs)$/;

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

  // 一、删掉客户端导航的预取负载
  let dropped = 0;
  let droppedBytes = 0;
  for (const f of files) {
    if (!f.endsWith('.txt')) continue;
    droppedBytes += statSync(f).size;
    rmSync(f);
    dropped += 1;
  }

  // 二、前缀换相对路径；三、目录链接补 index.html
  let rewritten = 0;
  for (const f of files) {
    if (!TEXT_EXT.test(f) || f.endsWith('.txt')) continue;
    const rel = f.slice(OUT.length + 1);
    const depth = rel.split('/').length - 1;
    const prefix = depth === 0 ? './' : '../'.repeat(depth);

    let text = readFileSync(f, 'utf8');
    if (!text.includes(BASE)) continue;

    text = text.split(BASE).join(prefix);
    /*
     * 给目录形式的站内链接补 index.html。
     *
     * 三种形态都要覆盖，少一种就漏一批链接：
     *   href="./model/foo/"            普通跳转
     *   href="../"                     子页返回首页，没有中间路径段
     *   href="./leaderboard/all/?k=v"  带查询串，斜杠后面不是引号
     * 所以收尾用 ["?#] 三选一，中间的路径段整体可选。
     *
     * 资源引用不会被误伤：它们都以扩展名收尾，匹配不到「斜杠 + 结束符」。
     */
    text = text.replace(
      /((?:src|href)=")((?:\.{1,2}\/)(?:[^"?#]*\/)?)(?=["?#])/g,
      '$1$2index.html',
    );

    writeFileSync(f, text);
    rewritten += 1;
  }

  const kept = walk(OUT);
  const total = kept.reduce((n, f) => n + statSync(f).size, 0);
  console.log(`删除预取负载 ${dropped} 个（${(droppedBytes / 1048576).toFixed(0)} MB）`);
  console.log(`改写 ${rewritten} 个文件的路径`);
  console.log(`产出 ${OUT}：${kept.length} 个文件，${(total / 1048576).toFixed(0)} MB`);
}

main();
