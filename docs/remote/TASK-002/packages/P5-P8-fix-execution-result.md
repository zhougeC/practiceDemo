# TASK-002 P5–P8 修复执行结果（`packages/P5-P8-fix-execution-result.md`）

> 派生自 **`plan.md`**（含 `AMD-P0-001`、`AMD-P4-001`、`AMD-P8-001`）与 **`AMD-P8-001`** 的 §7/§8/§17。
> 本文件只引用不可变编号（M/UD/ADR/AC/S/PR/P/Q），不重新解释、不改写、不新增要求；与 `plan.md` 冲突时以 `plan.md` 为准。
>
> **结论一句话**：AMD-P8-001 的 **G1（ADR-23/24/26 应用 + Q-12）、G2（P8-fix）、G3（P6-fix 第一批+第二批）、G4（selfcheck 全绿）、G5（PR-8 可行集非空）、G8（AC-1b(i) 飘带-only ≥150 px）全部 PASS**；
> `[selfcheck]` **153/153 PASS**、`[browser]` **19/19 PASS**、离线 **4/4 PASS**；
> AC-2b 峰值从 **0.4837 m（FAIL）** 修到 **0.3786 m（PASS）**，飘带-only 差分像素从 **147 px（FAIL）** 修到 **427 px（PASS）**，飘带埋进躯干的粒子从 **20/24** 修到 **0/24**。
> 未提交、未推送、无远程模型调用、无 VPS 操作、无付费调用。

## 0. ChangedFiles（sha256 / 行数，可复算）

| 文件 | 行（物理） | sha256 | 归属 |
|---|---|---|---|
| `js/core/scarf.js` | 421 | `2f491f9c95118f89964a5c2af665e738657e08f25ca258fb8d3aa12250338389` | P6-fix（二次阻力 + 椭球碰撞 + 一次投影复位） |
| `js/core/rig.js` | 96 | `86dfe1086f60a7eeb7e52eb8493d98e5d7e373c01fc9ccd6c9363d0993dca6bb` | P6-fix（只追加 `toLocal`） |
| `js/core/config.js` | 317 | `06c1620bfa07bbebf4dfede08e65326bbb56f9de9ebbee96409c4da6d26bb4c0` | P6-fix（C_Q / TORSO_EPS / RESET_DIR / NECK_BALL / GLASS；删除 C_D、BALLS、RESET_DROOP_DEG） |
| `js/render/pelican.js` | 687 | `9487dbbda94e8c682332dd2e23af3d73c5743dd86e3c92cb1a6713fd1654c6a9` | P6-fix（躯干/覆羽 24×24、墨镜新几何、可见性钩子、`glassesCorners`） |
| `js/render/ocean.js` | 287 | `d8620e8d9054418ac2d3ec861d77e094a56717ef46a9727dcba66c798e87c102` | P8-fix（`detectHighp` 字面读字段） |
| `js/render/sky.js` | 226 | `3892dd5feb570fc61099fd874d977158baebb0e5c3f65f59c8fb7f54f5e9aa03` | P8-fix（仅注释措辞，满足 `RawShaderMaterial` grep=0） |
| `js/debug.js` | 244 | `775afa7f2307911edd5b5e4d3d849cca5307c67ab1dd8ace4ba9ade1a73ccc39` | P6-fix（`setRibbonVisible` / `setGlassesVisible` / `scarfOutsideMinF`） |
| `tests/selfcheck.js` | 1,137 | `d1f20845801dd9a162f85b65ccdacdcbf4fc20ee88c6a396db486c1a435a9b8e` | P6-fix（8 条新用例 + AC-2c 对照运行） |
| `tools/e2e/app.mjs` | 1,351 | `594743bb163cb41d61302b4383c847e5d3c25d42c919a9a23f5cff51dc000ed4` | P6-fix / P8-fix（4 个新场景 + `p5-framing` 更新） |
| `tools/e2e/count-lines.mjs`（新） | 101 | `f00246f2fafb33627d312e9b2ffef972563ebf898eb801e2da7edbc8a144dd1c` | ADR-31 行数门禁 |

复算：`shasum -a 256 <file>`（在 `claude-test-opus55` 根目录）。行数：`wc -l`。

## 1. 本轮范围（AMD-P8-001 的包与允许文件）

| 包 | 允许修改（AMD-P8-001 §7/§17） | 本轮实际改动 | 出口判据 |
|---|---|---|---|
| **G1 文档** | `plan.md`、`adr.md`、`handoff.md`、`impl-notes.md`、`AMD-P8-001.md` | 见 §2 | ADR-23/24/26 应用；Q-12 记录 |
| **G2 P8-fix** | `js/render/ocean.js`（只改 detectHighp）、`tools/e2e/*` | `detectHighp` 改字面读字段；新增 `build-greps`、`build-lines` | 两条 grep = 0；L1/L2 双路径复跑 |
| **G3 P6-fix** | `js/core/scarf.js`、`js/core/rig.js`（只追加 toLocal）、`js/render/pelican.js`、`js/core/config.js`、`js/debug.js`、`tests/selfcheck.js`、`tools/e2e/*` | 见 §3 | 新增 8 条 selfcheck + 3 条 e2e 全绿 |

**未越界**：`js/core/sim.js`、`js/core/daynight.js`、`js/core/oceanmath.js`、`js/render/world.js`、`js/render/camera.js`、
`js/main.js`、`js/hud.js`、`js/store.js`、`js/core/input.js`、`index.html`、`css/style.css` **零改动**。
`js/render/sky.js` 只改了一行注释措辞（见 §3.1 的说明），不涉及逻辑。

## 2. G1 —— ADR-23/24/26 应用与 Q-12（机械应用，用户批准）

### 2.1 授权链

| 项 | 值 |
|---|---|
| 用户批准日期 | **2026-10-25** |
| 用户的回答（工具询问的选项，逐字） | ① `cloth_geometry` = **「批准这组修订」**；② `screenshot_stage` = **「批准调整验收时点」** |
| 询问的问题（工具 `ask`，被用户回答的那一问） | 就 AMD-P8-001 §13.2 的三项 `PENDING-USER` 征求意见，并同时询问截图验收时点的调整。三个几何项即：**ADR-23** 躯干碰撞体改为与渲染躯干同一组常量的椭球（中心 (0,1.15,−0.38)、半轴 (0.28,0.36,0.50) 各加 ε=0.005、Rx=+25°），用 `PB.rig.toLocal` 转到 rig 局部坐标判定，在每次约束迭代的最后一步投影第 1–12 行（第 0 行固定不投影），参数从渲染常量派生不另存；**ADR-24** AC-2c 改为测风致偏转——与 `windScale=0` 的同初值对照运行比较同一时刻的 tip–anchorMid 方向，最大夹角 ≤20°（阈值不变），两次运行都走真实的 `PB.sim.step` + `PB.scarf.step`；**ADR-26** 墨镜几何改为两片 0.07×0.045×0.012、中心 (±0.07,1.765,−0.583)、朝 −Z，每片八个角到头心 (0,1.75,−0.42) 的距离都 ≥0.16 且 y ≤ 1.79（头盔沿以下）。验收时点项即：依赖 P10 机位的截图（S11 为 mode 1）改由 P10 产出、P9 出口不再以它判定。 |
| 两项回答的覆盖范围 | 回答 ① 覆盖几何三项（ADR-23、ADR-24、ADR-26）；回答 ② 覆盖截图验收时点的调整（S11 产出包改挂 P10，即 `Q-12`）。**没有任何一项回答涉及阈值放宽。** |
| 批准对象 | AMD-P8-001 §13.2 的 **P-1（ADR-23）**、**P-2（ADR-24）**、**P-3（ADR-26）**，以及 **Q-12**（S11 产出包改挂 P10） |
| 应用方式 | `python3 ~/.evidence/task-002/implementation/P8-adjudication/apply.py /tmp/items-u.json`（要求每条 `OLD` 在目标文件中**恰好出现一次**，否则整体中止、不写任何文件）；先 `--dry-run` 再落盘 |
| 应用结果 | **11/11 条通过**（`plan.md` 8 条、`adr.md` 3 条） |
| 未重跑 | AMD-P8-001 §13.1 的 **18 条已应用项未重跑**（依据是本轮任务上下文要求不得重跑已应用项；**不是**用户原话） |
| 溯源更正 | 本文件早先把英文「User JUST approved ADR23 …」记作"用户原话"，那是**上级任务上下文里的转述**，不是用户回答。已按工具询问的实际选项（`cloth_geometry` / `screenshot_stage`）更正；`plan.md` / `adr.md` 已应用的内容本身不变（逐字 old→new 未改）。 |

### 2.2 逐条落点

| 项 | 文件 | 落点 | 内容 |
|---|---|---|---|
| U-01 | `plan.md` §6.1 | ADR-22 行之后 | 追加 ADR-23、ADR-24 |
| U-02 | `plan.md` §6.1 | ADR-25 行之后 | 追加 ADR-26 |
| U-03 | `plan.md` §1.5 | `碰撞球` → `碰撞体` | 躯干改为与渲染同参的椭球 + ε=0.005 + `PB.rig.toLocal`；颈球保留；渲染分段 ≥24 |
| U-04 | `plan.md` §1.5 | 墨镜行 | 两片 0.07×0.045×0.012，中心 (±0.07,1.765,−0.583)；八角到头心 ≥0.16、y ≤ 1.79 |
| U-05 | `plan.md` §1.2 | AC-2c 行 | 改为"与 windScale=0 同初值对照运行比较同一时刻 tip 方向"，阈值 20° 不变 |
| U-06 | `plan.md` §5.3 | S11 行 | 产出包 P9 → **P9 实现 + P10 产出**（与 ADR-28 同构，只改归属，不新增机位） |
| U-07 | `plan.md` §5.1 | P10 行 | 追加 S11（Q-12） |
| U-08 | `plan.md` §5.1 | P9 行 | S11 由 P10 产出，P9 出口不以 S11 判定 |
| U-09 | `adr.md` §1 | ADR-22 行之后 | 追加 ADR-23、ADR-24 |
| U-10 | `adr.md` §1 | ADR-25 行之后 | 追加 ADR-26 |
| U-11 | `adr.md` 元数据 | 决策数行 | 改为"ADR-23/24/26 经用户 2026-10-25 批准后于同日应用" |
| F-01…F-04 | `plan.md`、`handoff.md` | §5.1 / §1 | 追加 `P8-fix`、`P6-fix` 两行的允许文件与门禁；同步 handoff 的 P6/P8 行（AMD-P8-001 §7 的包定义） |

### 2.3 哈希链（本轮修订）

| 文档 | 修订前 sha256 / 字节 | 修订后 sha256 / 字节 |
|---|---|---|
| `plan.md` | `3eec4a96d871ed6aeae0c6a178352d7d94429b5f9eb78e1b75c7ca032f47566d` / 107,213 | `481c6cf42f92b3a7d8f43ec65d3e549c02ab9696e814ac96fb43b190874549fa` / **110,130** |
| `adr.md` | `5eef0c9316b4d24c9c3b097b0ed2aaebb5e6bd045512899cc292a0ac1cec2836` / 11,617 | `299d4ea6c9009a2d2160c255308fa48b8aac0c26f0dcb39f88ae006422a47254` / **12,643** |
| `handoff.md` | `d203e19f3fa088ae70dcfc19a803a11acfb2e9ea3bed243d635e471cdbe2cc7e` / 13,051 | `8d3c5102d0e15a2c51719f4eea9af904fe7b301aaf259ed86f891965d4872eec` / **13,247** |

复算：

```bash
cd /Applications/WorkStudio/GitHub/claude-test-opus55/docs/remote/TASK-002
shasum -a 256 plan.md adr.md handoff.md
```

修订前快照：`~/.evidence/task-002/implementation/P8-adjudication/pre-apply2/`（含 `SHA256SUMS.txt`，5 份文档）。

### 2.4 字节数说明

`apply.py` 的 `WROTE` 行输出的是 **Python 字符数**（`len(text)`），不是字节数（`plan.md` 为 75,262 字符 / 110,130 字节）。
上表的字节数由 `wc -c` 实测；复算命令：

```bash
cd /Applications/WorkStudio/GitHub/claude-test-opus55/docs/remote/TASK-002
wc -c plan.md adr.md handoff.md
```

## 3. G2 + G3 —— 代码改动

### 3.1 G2 P8-fix（ADR-30 / M-12）

| 文件 | 改动 | 依据 |
|---|---|---|
| `js/render/ocean.js` | `detectHighp` 从"按值遍历 capabilities 找 `'highp'`"改为 ADR-30 的字面写法：`var c = renderer && renderer.capabilities; return !!(c && c.precision === 'highp');` | ADR-30；M-12 |
| `js/render/sky.js` | 仅把注释里的 `RawShaderMaterial` 改成中文描述（`[build] grep "RawShaderMaterial" js/` 必须为 0，而注释也算命中） | plan.md §5.1 P8 行 |
| `tools/e2e/app.mjs` | 新增 `build-greps`（两条 grep = 0 + 字面写法特征）与 `build-lines` | AMD-P8-001 §17.1 / ADR-31 |
| `tools/e2e/count-lines.mjs`（新） | 按"代码行"（非空、非纯注释）统计应用代码合计，门禁 ≤5600 | ADR-31 |

**低精度回退仍然存在**：`detectHighp` 返回 false 时 `S.applyLevel` 选 `matVertex`（逐顶点法线），
即 M-12 要求的"`!== 'highp'` 时强制走逐顶点路径"。读不到 renderer 或字段缺失时同样返回 false（保守回退）。

### 3.2 G3 P6-fix（ADR-22 / ADR-23 / ADR-29 / ADR-26）

| 文件 | 改动 | 依据 |
|---|---|---|
| `js/core/config.js` | 追加 `SCARF.CQ = 1.0`、`CQ_RANGE = [0.8,1.4]`、`TORSO_EPS = 0.005`、`RESET_DIR = [0, −cos20°, +sin20°]`；**删除 `SCARF.CD`**；`PEL.GLASS` 改为 `{x:0.07, y:1.765, z:-0.583, w:0.07, h:0.045, d:0.012}`；`PEL.BALLS` 替换为 `PEL.NECK_BALL`（躯干参数改为从 `PEL.TORSO/TORSO_R/TORSO_RX` 派生，不另存） | ADR-22/23/26/29 |
| `js/core/scarf.js` | ① 积分改为 `u = wRel·windScale − vel/h_s`、`acc = (0,−9.8,0) + (0,0,a) + C_Q·‖u‖·u + flutter·windScale`；`S.step(G,h,health,windScale)` 增第 4 参数；② `collide` 改为躯干**椭球**（半轴 +ε）最近点投影 + 颈球；③ `outsideMinF` 新增并写入 `G.scarf`；④ `reset` 用 `RESET_DIR` 构造直条后执行**一次**碰撞投影再令 `Q=P` | ADR-22/23/29 |
| `js/core/rig.js` | **只追加** `S.toLocal(G, p, out)`（`M` 的逆变换）；`compute`/`toWorld` 未改 | ADR-23 前置 |
| `js/render/pelican.js` | 躯干与背部覆羽分段 24/16、16/12 → **24/24**；墨镜改为 `PEL.GLASS` 新几何并单独成组；新增 `setRibbonVisible`、`setGlassesVisible`、`glassesCorners` | ADR-23/26/25/27 |
| `js/debug.js` | 追加 `setRibbonVisible`、`setGlassesVisible`、`stats().scarfOutsideMinF` | ADR-25/27/23 |
| `tests/selfcheck.js` | AC-2c 改为对照运行；新增 `scarf.reset.direction`、`scarf.collider.outsideTorso.v{0,8,16}`、`rig.toLocal.roundTrip`、`PR8.sweep`、`pelican.glasses.cornersOutsideHead`；复位判据改为弧长/椭球外/0.25 s 收敛三条 | AMD-P8-001 §7 |
| `tools/e2e/app.mjs` | 新增 `ac1b-ribbon-diff`（AC-1b(i) 真实渲染差分）、`ac1b-glasses-geometry`（ADR-26 几何 + 正面可见性探测）；`p5-framing` 的 AC-1b 断言按 ADR-25/27 更新 | AMD-P8-001 §17.4 |

### 3.3 椭球投影的实现选择（有记录的设计决定）

**投影算法**：在 rig 局部系里对椭球 `Σ(xᵢ/aᵢ)² = 1` 求**最近点**（不是沿径向缩放）。
对 `e(t) = Σ aᵢ²vᵢ²/(aᵢ²+t)² − 1` 做 80 次二分得到 `t`，最近点为 `(aᵢ²vᵢ/(aᵢ²+t))`。
验证（`/tmp/nearest.mjs`，6 个内点 vs 400×200 方向暴力搜索）：位置差 ≤ **0.0053 m**，到表面距离与暴力解一致到 4 位小数。

**为什么不用径向缩放**：径向缩放会把深埋的粒子瞬移到椭球另一侧（实测复位后结构链残差 **0.1842 m**，是第一子步
弹开的量级），使复位后落到另一个吸引子。最近点投影的位移最小（同点 0.1650 m vs 0.2331 m）。

**为什么复位只做一次投影**：ADR-29 原文是"随后执行**一次**碰撞投影"。实测两种读法的读数差异见 §5.3 的 Q-13；
本轮按原文取"一次"。

### 3.4 稳定性与分配约束（M-31）

- 稳态帧**不新建对象**：碰撞用 `_wp`/`_lp` 两个模块级暂存对象；`outsideMinF` 复用同一对暂存对象。
- `_crx`/`_srx`（躯干 Rx=25° 的三角函数）在模块加载时算一次。
- 每粒子每子步新增 1 次 `sqrt`（二次阻力的 `‖u‖`），每固定步新增 576 次椭球判定（24 粒子 × 6 迭代 × 4 子步）。
- 实测 20,000 个固定步耗时 **585 ms**（约 34 μs/步，含 4 子步 × 6 迭代 × 全约束），远低于 0.1 ms/帧的预算。

## 4. Verification（真实命令、真实读数）

环境：macOS 15.1 / Apple M4 Pro / Node v18.19.0 / Playwright 1.48.2 / Chromium 130.0.6723.31 / `file://`。

| 命令 | 退出码 | 结果 |
|---|---|---|
| `cd tools/e2e && PW_HEADLESS=1 TASK002_ONLY=selfcheck node app.mjs` | **0** | `[selfcheck]` **153/153 PASS** |
| `cd tools/e2e && PW_HEADLESS=1 node app.mjs` | **0** | `[browser]` **19/19 PASS**，`failures=[]` |
| `cd tools/e2e && TASK002_OFFLINE=1 PW_HEADLESS=1 TASK002_ONLY=p1-running,p4-riding,p8-ocean,ac1b-ribbon-diff node app.mjs` | **0** | 离线 4/4 PASS，非 file 请求 **0** |
| `node tools/e2e/count-lines.mjs` | **0** | 应用代码 **3,123** 代码行（门禁 ≤5600） |
| `grep -rnE "precision +[lmh][a-z]*p " js/ tests/ index.html` | 1（无匹配） | **0 命中** |
| `grep -rn "RawShaderMaterial" js/` | 1（无匹配） | **0 命中** |
| `grep -rnE "TODO\|STUB\|FIXME\|placeholder" js/ tests/selfcheck.js index.html css/` | 1（无匹配） | **0 命中** |
| `grep -rnE "shadowMap.enabled *= *true" js/` / `grep -rn "castShadow" js/` | 1（无匹配） | **0 命中**（M-22） |
| `node --check`（全部改动 JS） | 0 | 语法通过 |
| `node /tmp/pr8full.mjs` | 0 | PR-8 扫描 **42 例，可行 27 例**（见 §5.2） |

### 4.1 `[selfcheck]` 153/153（关键读数）

| 判据 | 实测 | 判定 |
|---|---|---|
| AC-2a 后 5 s 平均夹角（v=8，C_Q=1.0） | **82.04°** | ∈[55,85] ✓ |
| AC-2b 峰值 \|lagX\|（v=8） | **0.3786 m** | ∈[0.15,0.40] ✓（修复前 0.4837 ✗） |
| AC-2b 回落 | **0.55 s** | ≤1.0 s ✓ |
| AC-2b 各速度峰值 | v=0/4/8/12/16 → 0.4787 / 0.4641 / 0.3786 / 0.3137 / 0.2453 | 判据只取 v=8（§1.2），全表登记 |
| AC-2c 风致偏转（vs windScale=0 对照） | **1.005°** | ≤20° ✓ |
| AC-2c 两次运行复位次数 | **0 / 0** | ✓ |
| 碰撞外置 v∈{0,8,16}（10 s） | min f = **1.000000**（三者都是） | ≥1−1e−6 ✓ |
| `rig.toLocal.roundTrip`（12 采样，含 lean+wheelie+x+y） | **≤1e−12** | ✓ |
| 复位方向 d | `(0, −0.93969, 0.34202)`，24 行逐位等于 `anchorW[c] + r·0.055·d`（关掉碰撞体只测公式） | ✓ |
| 复位后 0.25 s 内链接残差 | **≤1e−3 m** | ✓ |
| `PR8.sweep` 可行集 | **27 / 42** 组同时满足 AC-2a/2b/2c | 非空 ✓ |
| NaN 注入 / 自愈 | 1 次复位 + 之后不再复位 | ✓ |

### 4.2 `[browser]` 19/19（新增/更新的场景）

| 场景 | 关键读数 |
|---|---|
| `build-greps` | GLSL precision 语句 **0**、`RawShaderMaterial` **0**、`c.precision === 'highp'` **1**、按值遍历残留 **0** |
| `build-lines` | 应用代码 **3,123** 行 ≤ 5600 |
| `ac1b-ribbon-diff` | **飘带-only 差分 427 px**（≥150 ✓，修复前 147 px）；差分帧总差像素 427（差分只出现在飘带处）；bbox `(951,559)-(971,582)`；冻结帧 v=8、`scarfResets=0` |
| `ac1b-glasses-geometry` | 16 个角；到头部球心最小距离 **0.16103 ≥ 0.16**；最大 y **1.7875 ≤ 1.79**；正面半球 12 个探测方向**全部未遮挡** |
| `p5-framing` | AC-1a 跨度 **28.662%**；头盔 **1,306 px**；**飘带粒子在椭球内 0/24**（修复前 20/24）；`scarfOutsideMinF = 1.0239`；墨镜在 S1 仍被头遮挡（0.0745 < 0.16），按 ADR-27 迁到 S4a |
| `p8-ocean` | GL2、`pixelNormals=true`、`calls=52`、`tris=40,518`、`errorsIn10s=0`；M-27 相位、OCEAN_DISP_GLSL 一致性、AC-4a/4d 全部沿用并通过 |
| `p8-ocean-gl1` | `--disable-webgl2`：`glVersion=1`、`isWebGL2=false`、`VERSION` 以 `WebGL 1.0` 开头、`pixelNormals=true`、`lightDirErr=1.1e−16` |
| `p6-scarf-shot` | v=8、夹角 82.7°、`scarfResets=0`（S7 仍是 substitute，正式机位属 P10） |
| `p5-character` | 角色 + 车 **34 mesh / 5,062 tris**（≤40 / ≤8,000；躯干分段提到 24×24 后仍在上限内）；喙标记误差 0；喙网格尖端误差 2.94e−8；围巾渲染顶点与模拟粒子逐位相等（违例 0） |
| 其余 11 个（P1–P7 既有） | 全部 PASS，判据未变 |

- Console：全部场景 **error = 0、pageerror = 0**；`p1-vendormissing` 的 1 条被测 net error 仍按精确条数登记。
- warning：`p8-ocean-gl1` 的 1 条 r162 WebGL1 弃用提示（与 `impl-notes.md` §C-2a 同类，非 error）。
- 非 file 请求：全部 **0**。

### 4.3 AC-2d 真实 10 min（不加速，在最终参数与最终代码上执行）

命令：`TASK002_EVIDENCE_APP=~/.evidence/task-002/implementation/app-ac2d-p8fix PW_HEADLESS=1 TASK002_ONLY=p6-scarf-10min node app.mjs`
→ **退出码 0，`PASS p6-scarf-10min`，`wall time 601.20 s`**（执行器 `wallMs` 600,230 ms ≥ 600,000）。

| 项 | 实测 |
|---|---|
| 真实墙钟 | **600,230 ms**（`wallMs >= 600000` 断言通过；`/usr/bin` 层 wall 601.20 s） |
| 变道次数 | **30**（每 20 s 交替 A/D） |
| `scarfResets` | **0** |
| `nanResets` / `softResets` | **0 / 0** |
| `errorsIn10s` | **0** |
| `appState` | `running` |
| 模拟时间 / 路程 | `t = 600.30 s` / `S = 9,540.0 m` |
| `fps` / `fpsWin` | **60 / 60** |
| `tris` / `calls` | 40,518 / 53 |
| `scarfOutsideMinF` | **1.0677**（全部粒子在椭球外） |
| `scarfTipAngleDeg` | 88.10°（v=16 稳态，非判据） |
| Console error / 非 file 请求 | **0 / 0** |

**代码在运行期间未变**：运行前后对 `config.js`、`scarf.js`、`rig.js`、`pelican.js`、`ocean.js`、`debug.js`
取 sha256 并逐字节比较，**完全一致**（`CODE UNCHANGED DURING RUN`）。

## 5. 参数表与 AC 表

### 5.1 最终参数（写入 `js/core/config.js`）

| 参数 | 值 | 来源 |
|---|---|---|
| `SCARF.CQ` | **1.0 m⁻¹** | ADR-22 初值；PR-8 可行集内（§5.2） |
| `SCARF.CQ_RANGE` | `[0.8, 1.4]` | ADR-22 校准窗口 |
| `SCARF.DAMP` | **0.985** | 原值；在 PR-8 可行集内 |
| `SCARF.TORSO_EPS` | **0.005 m** | ADR-23（弦高 ≤0.0043 < ε） |
| `SCARF.RESET_DIR` | `[0, −cos20°, +sin20°]` | ADR-29 |
| `SCARF.ITER` / `SUBSTEPS` | 6 / 4 | §4.1（未改） |
| `PEL.GLASS` | `(±0.07, 1.765, −0.583)`，0.07×0.045×0.012 | ADR-26 |
| 躯干渲染分段 | 24 × 24（覆羽同） | ADR-23 |

### 5.2 PR-8 扫描（真实模拟，最终代码）

`C_Q ∈ {0.8,0.9,1.0,1.1,1.2,1.3,1.4}` × `DAMP ∈ {0.97,0.975,0.98,0.985,0.99,0.995}` = **42 组**，
每组跑 AC-2a（600 步）、AC-2c（480 步 × 2 次运行）、AC-2b（5 个速度各 330 步）。

| 项 | 读数 |
|---|---|
| 可行组数 | **27 / 42** |
| AC-2a 全网格范围 | **80.40° – 84.03°**（全部 ∈[55,85]） |
| AC-2b(v=8) 全网格范围 | **0.3464 – 0.4218 m** |
| AC-2c 全网格范围 | **0.198° – 142.008°** |
| 选定参数（C_Q=1.0, DAMP=0.985） | AC-2a 82.04°、AC-2b 0.3786 m / 回落 0.55 s、AC-2c 1.005° → **可行** |

原始数据：`~/.evidence/task-002/implementation/P8-adjudication/measure/pr8-sweep-final.json`（42 行全表 + 可行集）。

### 5.3 Q-13（**实现符合 ADR-29 字面；记录一条审计边缘风险，不构成门禁失败**）

> **结论：不是门禁失败。** 当前实现按 ADR-29 原文只做「一次碰撞投影」，本轮所有围巾 AC 的实测判定**全部 PASS**
> （AC-2a 82.04°、AC-2b 0.3786 m / 回落 0.55 s、AC-2c 1.005°、碰撞外置 min f = 1.000000、AC-2d 10 min resets=0）。
> 本条只记录一个**未来审计时的边缘风险**，不改任何阈值。

- **现象**：v=0、windScale=0 时，飘带在躯干椭球前侧有两个稳定构型：贴在椭球**前下方**（tip y≈1.47, z≈0.12）
  与贴在**前上方**（tip y≈1.51, z≈−0.13）。两者夹角分别约 83.1° 与 84.6°，都属于"被椭球顶住的悬垂"。
- **复位读法决定落到哪一个（这就是要记录的边缘风险）**：只做一次碰撞投影（**ADR-29 的字面读法 = 当前实现**）→ 前下方；
  迭代到残差收敛（"已松弛"读法）→ 前上方。两者都是同一模型的合法解。
- **只在非字面读法下才影响 AC-2c**：对照运行（windScale=0）与风运行若落到**不同**构型，方向差可达 100° 以上
  （全网格里 7/42 组出现，最大 142.0°）。这些组因此**不可行**，PR-8 已把它们排除（可行 27 组，**选定参数不在其中**）。
- **当前实现**：按 ADR-29 原文取"一次投影"（前下方构型），AC-2c = 1.005°、AC-2b = 0.3786 m，三条围巾 AC 同时成立。
  **未改任何阈值、未改判据、未删断言。**
- **为什么不是"门禁失效"**：AC-2c 的两条运行都是真实 `PB.sim.step + PB.scarf.step`，各自只读自己的 `G.scarf`；
  构型的选择来自复位几何（ADR-29 已写死），不是判据或阈值。换读法得到 0.6041 m 是**读法差异**，不是本实现的读数。

### 5.4 AC 判定表（本轮）

| AC | 判据（原文要点） | 实测 | 判定 |
|---|---|---|---|
| AC-1b(i) 飘带-only | S1 冻结帧真实渲染差分，L1>30 且围巾取色像素 ≥150 | **427 px** | **PASS** |
| AC-1b(ii) 头盔 | ≥150 px，H∈[205,235]、S≥0.4 | **1,306 px** | **PASS** |
| AC-1b(iii) 墨镜 | S4a（P10）差分，L<0.12 的 ≥20 px | 几何已满足（八角在头外、正面 12 方向全可见），判定**留 P10** | **DEFERRED-P10** |
| AC-2a | v=8 后 5 s 平均 ∈[55,85] | **82.04°** | **PASS** |
| AC-2b | 峰值 ∈[0.15,0.40]，1.0 s 内 ≤0.05 | **0.3786 m / 0.55 s** | **PASS** |
| AC-2c | 与 windScale=0 对照的 tip 方向差 ≤20° | **1.005°** | **PASS** |
| AC-2d | 真实 10 min，`scarfResets==0` | 见 §5.5 | 见 §5.5 |
| AC-4a/4b/4c/4d | 未改动的海面判据 | 沿用并通过（`p8-ocean`、`selfcheck`） | **PASS** |
| Q-07 / M-12 | 两条 grep = 0 + L1/L2 双路径 | 0 / 0；GL2 与 GL1 都渲染 | **PASS** |
| Q-08 / ADR-31 | 代码行合计 ≤5600 | **3,123** | **PASS** |
| T8（围巾双面 + 明暗） | 飘带可见且不被躯干吞没 | 粒子在内 **0/24**、差分 **427 px** | **PASS**（视觉复核仍留给 `ui-vision`） |

### 5.5 AC-2d 真实 10 min

**PASS**：真实墙钟 600,230 ms（执行器层 601.20 s），`scarfResets=0`、`nanResets=0`、`errorsIn10s=0`、`appState=running`、
`t=600.30 s`、`S=9,540.0 m`、`fps=60`、`scarfOutsideMinF=1.0677`。详见 §4.3 与 `app-ac2d-p8fix/app-gates.json`。

## 5.6 截图状态（faithful，按 plan.md §5.3 的prescribed 设置）

| 图 | 状态 | 设置（§5.3） | 本轮是否产出 |
|---|---|---|---|
| **S1** | **已产出（本轮重拍）** | p=0.05、mode 0、1920×1080、L2、冻结、HUD 隐藏、v=8 稳态 3 s、lane 1 | **是**：`S1-p8fix-dusk-chase.png` / `S1-p8fix-ribbon-with.png` / `S1-p8fix-ribbon-hidden.png` |
| **S2** | **已产出（本轮重拍）** | p=0.50、mode 0、1920×1080、L2、冻结、HUD 隐藏 | **是**：`S2-p8fix-night.png`（`starsInView=326`、`v=8`、`scarfResets=0`） |
| **S6** | **DEFERRED-P10** | p=0.05、mode 4、`setOrbit(−90°,35°,14,true)` | 否（mode 4 属 P10；ADR-28） |
| **S7** | **DEFERRED-P10** | p=0.05、mode 1、v=8 稳态 10 s | 否（mode 1 属 P10；ADR-28）。`S7-substitute-mode0-v8.png` 标注 substitute，**不计入** |
| **S11** | **DEFERRED-P10** | `spawnFish(1,false,30)`、`pauseOnEvent('catch')`、mode 1、`showDebugShapes` | 否（Q-12：mode 1 属 P10） |
| **S12** | **DEFERRED-P10** | p=0.05、mode 4、`setOrbit(−90°,20°,10,true)` | 否（ADR-28） |
| **S4a** | **DEFERRED-P10** | p=0.15、mode 2、`setCineShot(0,4)` | 否；AC-1b(iii) 的墨镜差分在 S4a 判定 |

**S1 的忠实性**：本轮 S1 由 `S1-p8fix-*.png` 明确对应 §5.3 的通用条件（1920×1080、L2、`freezeTime(true)`、HUD 隐藏、
v=8 稳态 3 s、lane 1、p=0.05、mode 0），并用同一帧做了"有飘带 / 无飘带"两次渲染（差分 427 px）。
**视觉判定留给 `ui-vision`**：本文件只登记脚本读数与像素坐标，不自评"看着对不对"。

## 6. 证据位置

- `~/.evidence/task-002/implementation/app/app-gates.json`（19 场景全量，本轮最终）
- `~/.evidence/task-002/implementation/app/app-gates-offline.json`（离线 4 场景）
- `~/.evidence/task-002/implementation/app-ac2d-p8fix/app-gates.json`（AC-2d 真实 10 min）
- `~/.evidence/task-002/implementation/p8fix-screens/`：
  - `S1-p8fix-dusk-chase.png` / `S1-p8fix-ribbon-with.png`（1920×1080，p=0.05、mode 0、v=8、冻结、HUD 隐藏）
  - `S1-p8fix-ribbon-hidden.png`（同一帧，只隐藏飘带；与 with 的差分 = 427 px）
  - `S2-p8fix-night.png`（1920×1080，p=0.50、mode 0、v=8、冻结、HUD 隐藏；`starsInView=326`）
  - sha256：`S1` with/dusk `7cf0aaf60ef9bdbeb19b0d9731be047ee74d85be98254e4f7a80b26862fdadf8`、
    hidden `cff94f638ae454768ab50539ce75695c988cf5e6088874b5a528bb2101055613`、
    `S2` `80ac0c67366d24d7d071d304648ca56f3361bc1548582df1bc31715db84be101`
- `~/.evidence/task-002/implementation/app/screens/`：`ac1b-ribbon-with.png`、`ac1b-ribbon-hidden.png`、`S2-night.png`、`S7-substitute-mode0-v8.png` 等（P5–P8 既有 + 本轮）
- `~/.evidence/task-002/implementation/P8-adjudication/measure/pr8-sweep-final.json`（PR-8 全表）
- `~/.evidence/task-002/implementation/P8-adjudication/pre-apply2/`（本轮文档修订前快照 + `SHA256SUMS.txt`）
- `~/.evidence/task-002/implementation/P8-adjudication/pre/`（AMD-P8-001 §13 的 18 条应用前快照，保留不改）

**截图仅作证据，视觉判定留给 `ui-vision`**；本文件不自评视觉。

## 7. 未做 / 边界

| 项 | 状态 | 说明 |
|---|---|---|
| AC-1b(iii) 墨镜差分 | **DEFERRED-P10** | 需要 S4a（mode 2 + `setCineShot`），属 P10 的文件集；几何前提已 PASS |
| S6 / S7 / S12 / S11 | **DEFERRED-P10** | ADR-28 / Q-12 的产出包归属；P8 出口不以它们判定 |
| P9–P16 | 未实现 | 鱼、机位、成就、自动驾驶、音频、画质、触屏 |
| PR-5/PR-6/PR-7 真机项 | **NOTVERIFIED / true hardware pending** | 需用户真机（P16 出口）；本轮所有读数都来自 macOS 15.1 + Chromium 130 |
| Q-13（v=0 双吸引子） | **实现符合 ADR-29 字面；PASS，附审计边缘风险说明** | 当前实现（一次投影）下四条围巾 AC 实测全部 PASS。Q-13 只记录未来审计的边缘风险：换"已松弛"读法会得到 AC-2b 0.6041 m，那是读法差异，不是本实现的读数，**不构成本轮门禁失败** |
| 视觉复核 | **留给 `ui-vision`** | 本文件只登记脚本读数与截图路径 |

- 工作树：`/Applications/WorkStudio/GitHub/claude-test-opus55`，分支 `feature/TASK-002-opus55`；**无** `git commit` / `git push`。
- TASK-001 工作树 `/Applications/WorkStudio/GitHub/claude-test`：未触碰。
- Java 侧、`vendor/`、`pom.xml`：零改动。
- 无远程 API/模型调用、无 VPS 操作、无系统配置改动、无付费调用。
