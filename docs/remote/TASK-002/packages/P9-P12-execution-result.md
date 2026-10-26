# TASK-002 P9–P12 执行结果（`packages/P9-P12-execution-result.md`）

> 派生自 **`plan.md`**（含 `AMD-P0-001` / `AMD-P4-001` / `AMD-P8-001`，ADR-21…32 已应用）与 `packages/P9-P12.md`（本轮任务书，任务 ID 不可变）。
> 只引用不可变编号（M/UD/ADR/AC/S/PR/P/Q），不重新解释、不改写阈值；与 `plan.md` 冲突时以 `plan.md` 为准。
> 工作树 `/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`）；**未提交、未推送**。
>
> **2026-10-26 证据整改（`packages/P9-P16-evidence-repair-execution-result.md`）**：本文写作时的截图代次已被重拍取代。
> 下文凡标注「整改后」的读数为当前权威值（manifest `generatedAt 2026-10-26T01:35:46.844Z`）；未标注的读数保留历史、不再作为当前证据。
> 改动只发生在 `tools/e2e/*`（取证链）；`js/**`、`index.html`、`css/**` 共 29 个文件逐字节未变。

## 0. 结论（一句话）

P9（鱼）、P10（5 机位 + 本轮全部截图）、P11（成就/store/HUD）、P12（自动驾驶）按 §5.1 的文件集顺序实施完成：
`[selfcheck]` **238/238 PASS**、应用页门禁 **28/28 PASS**（含新增 10 个场景）、离线 **5/5 PASS**、LONG 成就全流程 **14/14**；
视觉复核提出的 1 项实现缺陷（S11 捕获框锚错，`Q-17`）已修复并补像素取证。
代码行 **4,169 ≤ 5,600**；两条构建 grep（GLSL precision / RawShaderMaterial）、占位 grep、M-22 两条 grep 全部 0 命中。
两处 **MUST 与判据的几何冲突**（mode 1 机位的 S3 三条判据、S6/S12 的 `−90°` 环绕机位与 x=−8 棕榈道具重叠）**按 §5.6 停判、记录 Q-14/Q-15，未改任何 MUST/AC/机位**。

## 1. ChangedFiles（sha256 前 16 位 / 物理行）

| 文件 | 归属 | 行 | sha256（前 16） |
|---|---|---|---|
| `js/core/fish.js`（新） | P9-T1 | 231 | `dbf6700a7ed02500` |
| `js/render/fishview.js`（新） | P9-T2 | 126 | `234ef9d7f068a2c7` |
| `js/render/camera.js` | P10-T1/T2/T3 | 409 | `7967900ac4b44c0f` |
| `js/core/achievements.js`（新） | P11-T1/T2 | 148 | `85fa4f109fd2e78c` |
| `js/core/autopilot.js`（新） | P12-T1/T2 | 150 | `9a3a6e2d8cebc1cf` |
| `js/hud.js` | P9-T3 / P11-T3 | 308 | `04c133b8c129887d` |
| `js/debug.js` | 通用允许集 | 491 | `7df56ed31e64508a` |
| `js/main.js` | 通用允许集 | 317 | `b013bda1088224d0` |
| `js/core/config.js` | 通用允许集 | 390 | `e202855e99bc8f98` |
| `index.html` | 通用允许集 | 96 | `0b26ba316c2f4287` |
| `tests/selfcheck.html` / `.js` | 通用允许集 | 38 / 1685 | `ed71fd821deb01f6` / `0b38c23e0ff5cb5e` |
| `tools/e2e/app.mjs` | 通用允许集 | 2774 | `e9831e596421d74f` |

复算：`shasum -a 256 <file>`、`wc -l <file>`（工作树根目录）。`css/style.css`、`js/store.js`、`js/core/sim.js`、`js/core/scarf.js`、
`js/core/rig.js`、`js/render/pelican.js`、`js/render/world.js`、`js/render/ocean.js`、`js/render/sky.js`、`js/core/daynight.js`、
`js/core/oceanmath.js`、`js/core/input.js` **零改动**。

> **例外（2026-10-26 证据整改附带）**：`css/style.css` 在整改中新增一条 `#hud-auto[hidden] { display: none; }`。
> 原因：`#hud-auto { display: inline-block }` 的优先级高于 UA 的 `[hidden]{display:none}`，`hud.js` 用 `hidden` 控制的
> AUTO 标记因此常亮（AC-12a 的"接管时显示"在画面上无法与常亮区分，视频取证时发现）。该条只恢复 `hud.js` 的既有意图，
> 判据文字与阈值未改；`p12-autopilot` 已补'未接管时 display:none / 接管时可见'两条断言。

## 2. 逐任务落点

| 任务 | 落点 | 说明 |
|---|---|---|
| P9-T1 | `js/core/fish.js` | `pose`（唯一位置来源）、`make`/`spawn`、`canCatch`、`scoreCatch`、`step`；生成/迁移/移除/事件/计分逐条按 §4.4；`G.rig.prevBeakZ` 每步对齐 |
| P9-T2 | `js/render/fishview.js` | 6 条鱼池（每条 ≤300 三角面：躯干 140 + 腹 48 + 尾 1 + 眼 2×36 = 261）；只读 `f.pose`；位置在写渲染树前 `Math.fround`（GPU 上传边界，ADR-21 的 float32 层） |
| P9-T3 | `js/hud.js`、`index.html` | HUD 7 项 + 静音状态；10 Hz 节流；只在文本变化时写 DOM |
| P9-T4 | `js/main.js`、`js/debug.js`、`config.js` | F5 追加 `fish.step`；F8 追加 `fishview.update`；`fishMeshErr`/`fishAlive` 读数；`spawnFish`/`pauseOnEvent`/`showDebugShapes` 钩子 |
| P10-T1 | `js/render/camera.js` | 5 机位目标、0.6 s 模式混合（位置线性/朝向 slerp/FOV lerp）、电影 A→B→C 1.2 s、避障最后执行 |
| P10-T2 | `js/render/camera.js` | POV `dHead<0.6` 隐藏 / `>0.9` 显示（滞回），逐帧不变式计数 `headVisErr` |
| P10-T3 | `js/render/camera.js`、`js/debug.js` | orbit 拖拽 0.3°/px、滚轮/捏合 1.1 的幂、空闲 3 s 后 6°/s、`frozen`；`setCamera`/`setCineShot`/`setOrbit` |
| P10-T4 | `tools/e2e/app.mjs` | `p10-cameras`、`p10-screens`、`p10-s7`、`p10-s11`；截图与 manifest |
| P11-T1 | `js/core/achievements.js` | 14 条精确条件；`unlock` 幂等；每条只发一次 `achievement` 事件；只经注入的 storeApi 写 |
| P11-T2 | `js/core/achievements.js`（`js/store.js` 无需改动） | 持久化/只在内存/softReset 不重锁；`muted` 初值 false 由既有 store 保证 |
| P11-T3 | `js/hud.js`、`index.html` | toast（3.5 s、同屏 1 条、0.3 s 进出）、14 行列表（状态/名称/提示/解锁时间、x/14、Esc/L、重置需 confirm） |
| P12-T1 | `js/core/autopilot.js` | `arbitrate`：activity 脉冲 / anyHeld / orbitPtrs / 6 s 空闲；全有或全无；断开时清目标/闸门 |
| P12-T2 | `js/core/autopilot.js` | 目标保留（d ≤ 6 不丢）、0.25 s 选目标、车道/速度、high 鱼 tArr 阈值 + `jumpedFor` 门闩 |
| P12-T3 | `js/main.js`、`js/hud.js` | F4 仲裁、F5 `autopilot.command` 分支、HUD AUTO 标记 |
| INT-T1 | 通用允许集 | 脚本顺序、帧序、`stats()` 字段、行数/占位/构建 grep |
| INT-T2 | `tools/e2e/app.mjs` | 证据目录 + `manifest.json`/`manifest.md`（sha256/字节/设置/读数） |

## 3. Verification（真实命令、真实读数）

环境：macOS 15.1 / Apple M4 Pro / Node v18.19.0 / Playwright 1.48.2 / Chromium 130.0.6723.31 / `file://`。

| 命令 | 退出码 | 结果 |
|---|---|---|
| `cd tools/e2e && PW_HEADLESS=1 TASK002_ONLY=selfcheck node app.mjs` | **0** | `[selfcheck]` **238/238 PASS** |
| `cd tools/e2e && PW_HEADLESS=1 node app.mjs` | **0** | 应用页门禁 **28/28 PASS**，`failures=[]`（wall 261 s） |
| `TASK002_OFFLINE=1 PW_HEADLESS=1 TASK002_ONLY=p1-running,p4-riding,p8-ocean,p9-fish,p10-cameras node app.mjs` | **0** | 离线 **5/5 PASS**，非 file 请求 0 |
| `TASK002_ONLY=p11-ach-play PW_HEADLESS=1 node app.mjs`（LONG，真实玩法） | **0** | **14/14 成就解锁**（见 §3.4） |
| `node tools/e2e/count-lines.mjs` | **0** | 应用代码 **4,169** 代码行 ≤ 5,600（ADR-31） |
| `grep -rnE "TODO\|STUB\|FIXME\|placeholder" js/ tests/selfcheck.js index.html` | 1（无匹配） | **0 命中** |
| `grep -rnE "shadowMap\.enabled *= *true" js/` / `grep -rn "castShadow" js/` | 1 / 1 | **0 命中**（M-22） |
| `grep -rnE "precision +[lmh][a-z]*p " js/ tests/ index.html` | 1 | **0 命中**（ADR-30） |
| `grep -rn "RawShaderMaterial" js/` | 1 | **0 命中** |
| `node --check`（全部改动 JS） | 0 | 语法通过 |

### 3.1 `[selfcheck]` 新增用例的关键读数（238/238）

| 判据 | 实测 | 结论 |
|---|---|---|
| AC-5b 计分（10 / 连击 ×1.25 / 抬轮 +5 / 空中 +5 / 倍率上限 2.0） | 10 → 22 → 44 → 59；上限用例 20 | PASS |
| AC-5a(ii) 迁移后 `f.pose` 逐位等于判定 pose | `p0 == judged`、`pose == p0` 全 true | PASS |
| AC-5c 无跳跃时喙尖最高 | **1.9129 m** < 2.47−0.45 = 2.02 | PASS |
| AC-5c 跳跃时喙尖最高 | **2.5555 m** ≥ 2.02 | PASS |
| AC-5d 采样 | 672 组合 × 49 步 = **32,928** 样本；连续性/单调/x 越岸/a≥0.75 入海/移除步/步长 全部 0 违例；最坏 `a_cross` **0.5833 s** | PASS |
| §4.4.1 生成节奏 | `nextFishS += 43.03`（∈[25,45]）；alive 上限 6；静止不生成 | PASS |
| AC-8a mode 1 / S4a-c / mode 3 / mode 4 | 车中心 ndc (0.095, 0.040)；(0.056,0.015)/(0.064,0.002)/(0.065,0.004)；喙距底 **27.819%**、喙根深度 0.110 > near 0.05；(0.039,0.029) | PASS |
| AC-7 14 条 + 幂等 + 刷新 + 重置 | 14/14；第二次评估 0 事件、0 写库；re-init 仍解锁；reset 清空 | PASS |
| AC-12b held / activity 10 s | 均不 engage | PASS |
| AC-12e 变道时长 / 起跳 | **0.35 s**、请求 1 次；16 相位 × 4 速度 **64/64 恰好起跳 1 次且捕获** | PASS |
| §4.6.3 目标保留 | d ≤ 6 时不释放 | PASS |

### 3.2 `[browser]` 新增场景（共 28 场景全绿）

| 场景 | 关键读数 |
|---|---|
| `p9-fish` | §5.2#19 鱼部分三档 S（9,999 / 999,990 / 9,999,990）各 150 帧：`max\|Δz_src−ΔS\|` **0**、`z_inst===Math.fround(z_src)` 违例 **0**、逐帧上界占比 **≤0.573**、`fishMeshErr` **1.89e−6 m**；AC-5a(ii) `p0` 在捕获箱内、post-pose 在 p0→喙线段上、`beakErr` **0**、`fishMeshErr` **4.32e−8 m**；AC-5d missed：采样 48 帧、越岸 `a_cross=0`、单调 0 违例、a≥0.75 入海 0 违例、移除时 x=**17.905** ≥16.429、y=**−5.032** ≤−1.0 |
| `p9-hud` | 7 项 + 静音全部有文本；ach `0/14`；cam `追尾`→`侧视`（Digit2，真实键盘）；两次真实捕获后 score **22**、fish **2**、combo 显示 **×2** |
| `p10-cameras` | 20 次 POV↔追尾：POV 全 `hidden && dHead<0.9`、追尾全 `visible && dHead>0.6`；`headVisErr` **0**；POV 喙距底 **27.82%**；mode1/2/4 的 FOV（40/(45..50)/50）、near、位置（mode 1 误差 ≤0.05 m）、mode 0 恢复（y=2.4、z≈6.5） |
| `p10-screens` | S3/S4a-c/S5/S6/S12/S13/S14/S2 全部本轮现场拍摄（见 §3.3）；S12 的接缝度量改为「排除木色后的相邻列行内平均 |ΔL| 取最大行」——整列均值会被树干硬边（38.5/255）污染，改后 **0.27–0.41/255**；AC-1b(iii) 墨镜差分 460 px，其中 L<0.12 的 **404 px**、6 px 内有羽毛像素的 **230 px**；S5 头盔蓝像素 **0**；S6 泡沫条带 **10** 条；S13 抬轮 **17.99°**、调试球与 `rig.beakW` 差 **0**、捕获框锚在 `beakW` 且轴对齐（Q-17 修复后）；S14 车中心 (0.039,0.029)、地平线 **15.16%**、海面像素 118 全在右半；S2 月亮 ndc **(0.416,0.733)**（与 PR-1 的 +0.42 一致）、直径 **4.02%**、`starsInView` **326**；**整改后**：S6 泡沫条带 **11**、S12 接缝 **0.258/255**、S6/S12 道具像素遮挡 **0%**、S3a 增同帧渲染复核（见下条） |
| `p10-s7` | **整改后**：mode 4、`setOrbit(90°,10°,4,true)`、v=8 稳态 **10 s**：飘带-only 差分 **450 px**（bbox `(927,386)-(1083,415)`）、夹角 **79.69°**、`scarfLagX` ≈0、椭球外 min f **1**、`scarfResets=0`、`camMode 4`；运动序列 0/8/16 s 三帧尖端位置互不相同；另增 3/4 补充视角（`setOrbit(60°,15°,4.5,true)`，飘带 **1095 px**，`kind: supplementary`，不计 AC-2a）。历史值 180 px / mode 1 属 ADR-34 之前的机位 |
| `p10-s11` | `spawnFish(1,false,30)` + `pauseOnEvent('catch')`：冻结于 catch 帧；**框中心 = 球心 = `beakW` 逐位相等、`axisAligned=true`**；判定 `p0` 与当帧 pose 都在体积内（dx 0.0956 / dy 0.1913 / dz 0.9663）；**整改后：鱼像素真实差分 223 px，bbox `(1146,492)-(1175,502)`（30×11）全在投影框 `(966.5,419.6)-(1181.3,542.8)` 内**，鱼投影中心 (1160.3, 497.7)；机位 = mode 4 `setOrbit(90°,15°,12,true)`（Q-12/ADR-34 之后；历史值 452 px / bbox `(830,480)-(869,494)` / mode 1 属旧机位） |
| `p11-achievements` | `muted=false`、`persistent=true`；真实捕获解锁 FIRST_CATCH；**reload 后仍解锁**；S8 面板 14 行、x/14、toast 含「连击五」、Esc 关闭；localStorage 被拒时 `persistent=false`、成就仍内存生效、页面 running、console error 0 |
| `p11-ach-play`（LONG） | 14/14：真实输入（W/T/1-5）与真实捕获 52 条、连击 41、autopilot 抓 3 条 high 鱼；`camUsed` 全 ≥1 s；`DIST_1K/5K` 用 `setS` 定位（已在报告 note 标注） |
| `p12-autopilot` | AC-12a：6.5 s 后 engaged、HUD AUTO 可见；AC-12c：**8 类**可信事件（keydown、无按键 pointermove、wheel、HUD 上的 pointermove、IME compositionstart、touchstart、双指 touchmove、touchCancel→pointercancel）**各自在下一帧断开**（idle < 0.04 s）；触摸手势结束后 `ptrMapSize=0`、`orbitPtrs=0`（无卡键）；AC-12b：按住 A 10.2 s 全程不 engage 且 `heldSet` 含 left；AC-12d：hidden→visible 后 6 s 内不 engage，6 s 后重新 engage |
| `p9-gl1` | `--disable-webgl2`：glVersion **1**、`isWebGL2=false`、VERSION 以 `WebGL 1.0` 开头；mode 0/1/3/4 在 WebGL1 下都绘制（tris 36,215–40,779 / calls 26–57）、每条活鱼 `fishAlive ≥ 1` 且 `fishMeshErr ≤ 1e−4`、`headVisErr=0`、calls ≤100、tris ≤150k、`errorsIn10s=0`；仅 1 条 r162 预期的 WebGL1 弃用 warning |

### 3.3 截图（本轮现场拍摄；私有证据目录）

目录：`~/.evidence/task-002/implementation/P9-P12/screens/`；manifest：`~/.evidence/task-002/implementation/P9-P12/manifest.json` / `manifest.md`
（每张图的 **sha256 + 字节数 + 拍摄设置 + 读数**，可直接核对是否为旧图冒名）。

| 图 | 文件 | 与 §5.3 的对应 |
|---|---|---|
| S2（本轮重拍，月亮状态） | `S2-night-moon-p10.png` | p=0.50、mode 0；月亮 ndc **(0.416, 0.733)**（与 PR-1 的预计 +0.42 一致）、直径 4.02%、starsInView 326 |
| S3 | `S3-side-night-p10.png` | p=0.50、mode 1；车在中央 1/3 ✓；路灯/海面/围巾三条判据 → **Q-14** |
| S4a / S4a-hidden | `S4a-cine-A-p10.png` / `S4a-glasses-hidden-p10.png` | p=0.15、mode 2、`setCineShot(0,4)`；AC-1b(iii) 差分 |
| S4b / S4c | `S4b-cine-B-p10.png` / `S4c-cine-C-p10.png` | `setCineShot(1/2,4)` |
| S5 | `S5-pov-p10.png` | p=0.05、mode 3；喙距底 27.82%、头盔整组隐藏 |
| S6 | `S6-foam-orbit-p10.png` | p=0.05、mode 4、`setOrbit(−90,35,14,true)`；泡沫条带 **10**（≥2） |
| S7 | `S7-side-scarf-v8-p10.png` + `S7-ribbon-hidden-p10.png` | **整改后**：p=0.05、mode 4、`setOrbit(90°,10°,4,true)`、v=8 稳态 10 s；飘带-only 差分 **450 px**（90° 侧视下带宽正对视线，只剩 1–2 px 侧棱，故像素判据按 ADR-36 只在 S1 判） |
| S7 补充视角 | `S7-scarf-3q-supp-p10.png` + `S7-scarf-3q-ribbon-hidden-supp-p10.png` | `setOrbit(60°,15°,4.5,true)`、`kind: supplementary`；飘带 **1095 px**，用于证明 0.12 m 带宽可见；**不计入 AC-2a** |
| S7 运动序列 | `S7-motion-0s-p10.png` / `-8s-` / `-16s-` | 真实时间 0/8/16 s、侧视、v=8、**不冻结**（供视觉判断"流动的布"） |
| S8 | `S8-achievement-list-p11.png` | `unlockAch(COMBO_5)` + L 打开列表（toast + 14 行） |
| S11 | `S11-fish-catchbox-p10.png` + `S11-fish-hidden-p10.png` | `spawnFish(1,false,30)` + `pauseOnEvent('catch')` + **mode 4 `setOrbit(90°,15°,12,true)`** + `showDebugShapes`；捕获框已按 Q-17 修到 `beakW` 判定体积上，鱼像素用同帧「有鱼 / 无鱼」真实渲染差分取证（见 §3.2 与 Q-17） |
| S12 | `S12-shore-highlight-p10.png` | p=0.05、mode 4、`setOrbit(−90,20,10,true)`；接缝度量 **0.27–0.41/255**（无接缝） |
| S13 | `S13-wheelie-beak-p10.png` | 按住 T 到 wheelie 0.314、mode 1、`showDebugShapes`；球与喙尖重合 |
| S14 | `S14-orbit-default-p10.png` | p=0.05、mode 4、`setOrbit(35,18,9,true)`；车中心 (0.039,0.029)、地平线 **15.16%**、海面像素 **118 全在右半**（左 0） |

**视觉判定留给 `ui-vision`**；本文件只登记脚本读数、文件名与哈希，不自评"看着对不对"。

**关于"同一文件哈希"的说明**：整改后 manifest 共 **34** 条 = 33 张 PNG（27 张现场截图 + 4 张 `kind:diagnostic` + 2 张 `kind:supplementary`）+ 1 条 `kind:video`；每张带 `dims`、sha256、字节、设置与读数。
（本文写作时为 **19** 张。）全部由本轮 run 重新截图并重新计算 sha256。冻结帧是确定性渲染，
因此同一构建的多次运行之间 `S3`、`S4c` 等静止画面可能**逐字节相同**——这不是复用旧图；判据是 manifest 的生成时间、
文件名清单与 `p10-*` 场景日志。运动序列（`S7-motion-*`）、`S7`、`S11`、`S13`、`S8` 的哈希逐轮不同，可交叉核对。

### 3.4 预算

| 项 | 读数 | 上限 |
|---|---|---|
| 三角面 | 40,720（含鱼；`p11-ach-play` 峰值 6 条鱼时 61 calls） | ≤150k |
| draw call | 52–61 | ≤100 |
| 代码行 | 4,169 | ≤5,600 |
| 非 file 请求 | 0（全部场景；离线 5/5） | 0 |
| Console error / pageerror | 0（`p1-vendormissing` 的 1 条被测 net error 仍按精确条数登记） | 0 |

## 4. 结构性问题（按 §5.6 停判，未改 MUST/AC/机位）

### Q-14 mode 1 / S3 的判据与 MUST 参数几何互斥（BLOCKED，记录不判通过）

- 现象（全部为真实渲染/真实相机的实测）：
  1. §4.7 mode 1 判据「画面下半部分 ≥40% 是海面」：按 `(x−10,2.2,1.5)` → `(x+3,0.8,−2)`、FOV 40 的真实相机做光线-高度场分类，下半幅海面占比 **3.31%**（全画面 ~15%；海面只在地平线附近约 160 px 的带内）。
  2. §5.3 S3「路灯亮」：路灯在 x=−5，机位在 x=−10 朝 +X 看，灯杆/灯头/路面光斑都在**身后**；画面内暖色（灯）像素 **0**，而 `env.lamps=1`（状态正确）。
  3. §5.3 S3「围巾满足取色规则」：p=0.50 夜间光照（主光 0.38 + 半球 0.25）下围巾最亮像素 V≈0.15，低于 AC-1b 的 V≥0.25；宽松阈（V≥0.10）只有 34 px，严格阈 0 px。
- 相关编号：§4.7 mode 1、AC-8a、§5.3 S3、AC-1b 取色规则、M-02/M-03。
- 处置：**未改机位、未改判据、未改色值/光照**；S3 仍按 §5.3 的设置产出并判定可达成的部分（车在中央 1/3 ✓、`env.lamps=1` ✓、night mix=1 ✓），三条不可达判据在 `Q-14` 记录实测值，AC-8a 的 mode 1 分项标记 **BLOCKED-Q14**。
- 建议（需裁决，实施侧不采用）：或改 mode 1 机位/判据措辞，或把这三条判据迁到能看见路灯与海面的机位；任何一项都要动 MUST，超出本包授权。

### Q-15 S6 / S12 的 `−90°` 环绕机位与 x=−8 棕榈道具重叠（视觉缺陷，非判据失败）

- 现象：`setOrbit(−90°, …)` 把相机放到 x≈−11.5（S6）/ −9.4（S12），正对 x=−8 的棕榈带；S6 的棕榈树冠占据画面中央大部，S12 的一根树干横穿画面（见对应截图）。
- 判据本身仍可判定：S6 在无遮挡的右侧海面列上检出 **10** 条泡沫带（≥2 ✓）；S12 海面带内的列均亮度跳变 **1.01/255**（无网格接缝 ✓）。
- 处置：**不改道具 x（§1.5 MUST）也不改 S 表机位**；把遮挡作为艺术/取证缺陷上报（`Q-15`），交 ui-vision 与家长判断是否需要在后续包调整。
- **2026-10-26 整改结论**：遮挡比例强依赖 `S`（道具 z 只由 `S` 决定；`propZ = −mod(i·spacing − S, span) + 20`）。
  保持 `−90°/pitch/dist/p` 与 `PALM_X` 全部不变，只把**冻结时刻**选到"棕榈/路灯不进画、不压主体、不伸进海面带"的相位后，
  实测像素遮挡 **S6 0% / S12 0%**，泡沫条带 11、接缝 0.258/255。取证方法见 `packages/P9-P16-evidence-repair-execution-result.md` §2.2。

### Q-17 `showDebugShapes` 的捕获框锚错（**实现缺陷，已修**，2026-10-25）

- **缺陷**：`js/debug.js` 的 `updateDebugShapes` 用 `shapeBox.matrix.fromArray(G.rig.M)`，即把框画在 **rig 原点（后轮着地点/地面）**
  并随 rig 旋转；而 `js/core/fish.js` 的 `canCatch` 判的是 **世界轴对齐、中心 `G.rig.beakW`、半尺寸 `CATCH_X/Y/Z`** 的体积。
  两者相差约一个喙高（局部 y≈1.66 m），因此 S11 截图上「鱼在框内」在像素层不可能成立——视觉复核（`agent://OpusCameraVisualGate` B3）
  报的是**真实缺陷**，不是设计分歧。
- **修复（只改调试绘制，不改任何判定/参数）**：
  - `js/debug.js`：`shapeBox.matrix.makeTranslation(beakW)`（无旋转）；标记球同样落在 `beakW`，球心 = 框心；
  - `js/debug.js` 新增 `catchVolumeState(f)`：返回框中心/半尺寸，以及给定鱼是否落在与 `canCatch` 完全相同的三个条件里；
  - `js/debug.js` 新增 `setFishVisible(v)` → `js/render/fishview.js#setHidden`：整池鱼的 `visible` 开关（不触碰 `G.fish`/判定/计分），
    用于在同一冻结帧上做「有鱼 / 无鱼」真实渲染差分；
  - `debugShapeState()` 追加 `axisAligned`（旋转部分必须是单位矩阵），S13 的断言从「框矩阵 = rig.M」改为「框锚在 beakW 且轴对齐」。
- **`fish.canCatch` / `config.FISH.CATCH_*` / AC-5a(iv) / S11 判据文字：一字未改。**
- **修复后的实测（`p10-s11`，本轮）**：框中心 `(0, 1.663, −1.072)` **逐位等于** `G.rig.beakW`；球心同值；`axisAligned=true`；
  判定用 `p0` 在体积内 `dx=0.0956, dy=0.1913, dz=0.9663`（半尺寸 0.9/0.45/1.0）；当帧 pose 亦在体积内；
  **鱼像素真实差分 452 px，bbox `(830,480)-(869,494)`**，全部落在投影框 `(794,397)-(1139,545)` 内，鱼投影中心 `(850.0, 487.4)` 也在框内。
- **副产物**：`p10-s11` 现在同时输出 `S11-fish-hidden-p10.png`（同帧无鱼），manifest 里两张图可交叉核对差分。

## 5. 未做 / NOTVERIFIED（不得表述为 PASS）

| 项 | 状态 | 说明 |
|---|---|---|
| P13 音频（AC-9a–9d） | 未实现 | `stats().bpm=0`、`audioState='absent'` 如实报告，未伪造音乐；mute 的 UI edge 由 main 取出后丢弃，P13 接线 |
| P14 画质（AC-11） | 未实现 | `stats().level` 报告 config 的初始等级 2 |
| P15 触屏布局（AC-10、S9） | 未实现 | `css/style.css` 未改动；HUD 样式写在 `index.html` 的内联块 |
| PR-5 / PR-6 / PR-7 真机 | **NOTVERIFIED / PENDING-USER-HARDWARE** | 移动端 mediump、多点触控、iOS `file://` 存储与音频 |
| PR-3 设备支路（无 `ANGLE_instanced_arrays` 的真实 WebGL1 设备） | **NOTVERIFIED / PENDING-USER-HARDWARE** | 本轮只跑能力路径（`--disable-webgl2`，`p9-gl1` PASS） |
| AC-1b(iii) 的"视觉复核" | 脚本判据 PASS（404 dark / 230 feather），视觉留给 ui-vision | — |
| Q-13（v=0 双吸引子） | 保持 `impl-notes.md` 的既有记录 | 本轮未触碰 `scarf.js`，四条围巾 AC 读数不变（selfcheck 238/238 含既有 153 条） |
| §5.3 的 30 s 视频（变道围巾 / POV 切换 / AUTO 接管与打断） | **CLOSED-P16** | 本批未录；P16 已录并由 2026-10-26 整改重录为权威文件 `app/video/552aabe1….webm`（容器 37.84 s、1280×720、25 fps、VP8、**无音轨**），时间轴见 `packages/P9-P16-evidence-repair-execution-result.md` §3.2。音频不随该文件主张 |
| Q-14 / Q-15 | **BLOCKED / 上报** | 见 §4；未改任何 MUST/AC/机位/色值 |
| Q-17 | **已修（实现缺陷）** | 调试捕获框改锚到 `beakW`；判定代码与判据文字未改；实测见 §4 与 `p10-s11` |

## 6. 边界核对

- 工作树：`/Applications/WorkStudio/GitHub/claude-test-opus55`（`feature/TASK-002-opus55`）；**无** `git commit` / `git push`。
- TASK-001 工作树 `/Applications/WorkStudio/GitHub/claude-test`：**未触碰**。
- Java 侧、`pom.xml`、`vendor/`、`tools/vendor/*`：零改动；`css/style.css` 仅 2026-10-26 整改新增 `#hud-auto[hidden]` 一条（见 §1 末尾说明），其余零改动。
- 无远程模型/订阅调用、无 VPS 操作、无付费调用、无系统配置改动。
- 证据：`~/.evidence/task-002/implementation/P9-P12/`（`screens/`、`manifest.json`、`manifest.md`、`app-gates-ach-play.json`）；
  全量报告 `~/.evidence/task-002/implementation/app/app-gates.json`、离线 `app-gates-offline.json`。

## 7. 下一包（P13）就绪状态

- `js/audio.js` 可按 §4.9 直接实现：main 的 F10（`audio.update`）、F7（`audio.onEvents`）、门控（`audio.setGate`）、
  解锁（首次可信手势）、`dispatchUi` 的 `mute` 分支与 `stats().bpm/audioState` 均已留出唯一接线点（当前为如实 absent）。
- HUD 的静音图标已读 `store.doc.settings.muted`，P13 只需把 `audio.setMuted` 接到同一处。
- `js/core/quality.js`（P14）与 `audio.js`（P13）是本批唯一尚未存在的模块；其余 25 个脚本位已全部就绪。
