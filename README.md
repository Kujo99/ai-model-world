# 大模型世界 · AI Model World

一个把每个大语言模型拟人化成像素角色的世界。点进来就能一眼看懂当下的大模型格局：
谁最强、谁最贵、谁最会写代码、谁刚出生、谁已经退役。

首屏是「今日格局」：最聪明、最会编程、最划算、最便宜、记性最好、最新发布、国内最强、
开源最强，八块领奖台，三秒看懂当下谁在什么位置。

往下是广场，分「国外 / 国内」两区，每区再按厂商实力分「头部 / 主力 / 尚无评测」三条街。
国外住着 OpenAI、Anthropic、Google、Meta、xAI，国内住着 DeepSeek、通义、Kimi、智谱、豆包、混元。
每家厂商住一间能看见内部的小屋，屋里站着这家当下的门面模型。

**画归画，数归数。** 房间与角色负责身份与观感；真正用来横向比较的是名牌下的
四条能力横条（聪明 / 编程 / 记性 / 便宜）——格子越多越强，
缺数据画成带描边的空槽，厂商自报的成绩缀一个「自报」。
最下面一行是这个模型的一句话定位，由数据自动生成，不经过任何 LLM。

**找东西靠导航条上那个搜索框。** 它搜三种东西：模型名（直达房间）、厂商（直达全家桶）、
以及**能力**——「多模态」会算出全站有多少个并直通筛好的名单，
「智谱 多模态」这样组合起来也认，一次输入回答「某家有没有某类模型」。

**这个站点不需要人维护。** 新模型发布、旧模型退役、价格调整、榜单更新，全部自动同步。

---

## 文档

| 文档 | 内容 |
|---|---|
| [docs/HANDOFF.md](docs/HANDOFF.md) | **接手开发先读这一份**：当前状态、不可违背的原则、踩过的坑、代码地图 |
| [docs/DESIGN.md](docs/DESIGN.md) | **模型属性 → 人物形象的完整对照表**，含所有档位阈值与厂商形象母题 |
| [docs/DATA.md](docs/DATA.md) | 数据来源、字段仲裁规则、合规边界、容错设计 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构与零维护链路 |
| [docs/research/coding-benchmarks-2026.md](docs/research/coding-benchmarks-2026.md) | 编程测评数据源全景：许可证原文、覆盖率实测、已排除的源及理由 |
| [docs/research/reference-sites-2026.md](docs/research/reference-sites-2026.md) | 参考网站与信息设计方案，当前的能力条改造出自这里 |
| [docs/llm-metadata-sources-research.md](docs/llm-metadata-sources-research.md) | 元数据源调研原始报告（结论均经 `curl` 实测） |
| [docs/data-sources-research.md](docs/data-sources-research.md) | 榜单与参数量调研原始报告 |
| [docs/pixel-character-pipeline-research.md](docs/pixel-character-pipeline-research.md) | 像素角色合成管线调研报告 |

---

## 数据来源

| 用途 | 来源 | 许可 |
|---|---|---|
| 模型元数据 | [models.dev](https://models.dev) | MIT |
| 榜单分数（智力 / 数学 / 科学 / 编程） | [Epoch AI](https://epoch.ai) | CC-BY 4.0 |
| 编程测评（Coding / Agentic Coding） | [LiveBench](https://livebench.ai) | Apache-2.0 |
| 参数量与开源许可 | [Hugging Face](https://huggingface.co) | 逐模型判断 |
| 新模型发现与发布日期交叉校验 | OpenRouter · Vercel AI Gateway · LiteLLM | 仅用于发现，不转存展示 |
| 角色美术素材 | [Liberated Pixel Cup](https://lpc.opengameart.org) | CC0 / OGA-BY，署名见 `assets/lpc/CREDITS.md`，站内 `/credits/` 页由它生成 |
| 中文像素字体 | [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) | OFL-1.1 |

本项目**不使用** Artificial Analysis 的任何数据（其条款禁止再分发），
也不抓取 LMArena（其条款禁止自动化抓取）。详见 [docs/DATA.md](docs/DATA.md) 的合规章节。

---

## 本地开发

```bash
npm install
npm run dev
```

`npm run dev` 会先由 `prebuild` 钩子合成精灵图（约 13 秒），再启动开发服务器。
本机 3000 端口常被占用时会自动改用 3001。

> `loadSnapshot()` 与 `listSpriteSlugs()` 只在生产构建里缓存；开发时每次请求重读磁盘，
> `npm run sync` / `npm run sprites` 之后刷新页面即可看到结果，不需要重启。
> 但 `next build` 会把 `.next` 写成静态导出状态，之后再 `npm run dev` 前要 `rm -rf .next`。

### 数据与素材管线

```bash
npm run sync       # 抓取上游、仲裁、校验，产出 data/models.json
npm run sprites    # 由 data/models.json 再生产 public/：角色精灵图 + 搜索索引
npm run font       # 中文像素字体子集化（改了中文文案后才需要跑）

npx tsx scripts/sync/selftest.ts   # 数据管线 217 项纯函数自检，不联网
```

### 体检脚本

`scripts/qa/` 下全部只读，用来回答「为什么是这个结果」。完整清单见
[HANDOFF.md](docs/HANDOFF.md#三快速上手)，最常用的几个：

```bash
npx tsx scripts/qa/why-flagship.ts openai   # 这家为什么是这个模型上广场
npx tsx scripts/qa/stale-flagships.ts       # 还有哪些门面不是本家最新的
npx tsx scripts/qa/roster-signals.ts        # 广场每位门面有哪些数据、缺哪些
npx tsx scripts/qa/shots.ts                 # 三个断点批量截图，视觉自验证
npx tsx scripts/qa/verify-text.ts "某段文字" # 区分「没改干净」和「浏览器缓存」
```

两条管线均**离线确定性**：不需要任何 API 密钥，同样的输入永远产出同样的输出。

> 从中国大陆运行时 Hugging Face 会连接失败，参数量与许可证字段会留空并标记
> `confidence: unknown`，不影响管线其余部分。生产环境的抓取跑在 GitHub Actions 上，不受此影响。

---

## 贡献

系统里唯一依赖人类常识的地方是厂商的形象母题——机器读得出 DeepSeek 的定价，
读不出它应该是一头鲸鱼。这部分放在 `src/data/vendor-registry.ts`，是一张查表。

**如果你发现某家厂商还没有专属形象**（它会显示为「神秘旅人」兜底形象），
欢迎提 PR 加一行。加不加系统都能正常运行，加了只是更好看。

---

## 许可

代码 MIT。美术素材与字体各自遵循其上游许可，见上表。
