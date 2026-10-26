# TASK-002 P1–P4 执行结果（`packages/P1-P4-execution-result.md`）

> 派生自 **`plan.md`**（canonical master plan，含 `AMD-P0-001` 修订；规范性正文 sha256
> `e87533a8be0873640667244a3bcbd72d38b85403b2451c0f527076ba32556729`）。
> 本文件**只引用**不可变编号（M/UD/ADR/AC/S/PR/P），不重新解释、不改写、不新增要求；与 `plan.md` 冲突时以 `plan.md` 为准。
>
> **结论一句话**：P1、P2、P3、P4 四个包按 `plan.md` §5.1 顺序实施完毕，每包出口门禁实测通过
> （`[selfcheck]` **99/99 PASS**、`[browser]` 应用门禁 **9/9 PASS**、离线 **3/3 PASS**、P0 冒烟复跑 **2/2 PASS**），
> **PR-1 在 P2 出口 PASS**；PR-3 设备支路仍 **PENDING-USER-HARDWARE**（P16）。未提交、未推送。
> P4 运行时**世界几何已渲染但未接灯光**（灯光属 P7），截图下半部因此为黑色 —— 这是分期接线的已知中间态，不是缺陷。

## 1. 每包派生任务（编辑前先派生，逐包执行）

| 包 | 允许文件（`plan.md` §5.1 + 通用允许集） | 出口判据（原文引用） | 涉及编号 |
|---|---|---|---|
| P1 | `css/style.css`、`js/core/config.js`（创建）、`js/render/scene.js`、`js/hud.js`（只做 overlay）、`js/debug.js`（创建）、`js/store.js` + 通用集（`index.html`、`js/main.js`、`tools/e2e/*`） | `[browser]` `--disable-webgl` 显示 noWebGL 文案；改名 vendor 文件显示 vendorMissing 文案；`loseContext` 后 8 s 出现按钮；glVersion 有读数；天空色清屏；`stats()` 可用 | M-13、M-19、M-29、UD-5、§4.11、§4.10、§5.4#2 |
| P2 | `js/core/mathx.js`、`tests/selfcheck.html`（创建）、`tests/selfcheck.js`（创建） | `[selfcheck]` mathx 与 rng；PR-1 投影（AC-1a、3a、3b、8a mode 4、8b 的预计值） | PR-1、AC-1a、AC-3a、AC-3b、AC-8a、AC-8b、M-07 |
| P3 | `js/core/input.js` | `[selfcheck]` AC-6e 队列（伪事件对象）；`[browser]` blur、拖出按钮、hidden 后 heldSet 为空 | AC-6e、M-16、M-17、M-26、M-34、§4.5 |
| P4 | `js/core/sim.js`、`js/core/rig.js`、`js/render/world.js`、`js/render/camera.js`（只做 mode 0）；`main` 新增 `newSession`、`initSession`（只调用 `rig.initState`） | `[selfcheck]` createState 不引用 scarf 和 daynight；newSession 后 §3.3 字段存在且有限；AC-6a/6b/6c/6d/6f；rig 样例；`[browser]` 连续推进越过 S≈1e4 时道具无跳变 | M-25、M-33、AC-6a–6f、§4.5.2、§4.12、§4.13、§4.7 mode 0 |

未越界：`js/core/fish.js`、`scarf.js`、`daynight.js`、`oceanmath.js`、`autopilot.js`、`achievements.js`、`quality.js`、
`js/render/sky.js`、`ocean.js`、`pelican.js`、`fishview.js`、`js/audio.js` 均**未创建**；`main.initSession` 只接 `rig.initState`。

## 2. ChangedFiles（sha256 / 字节，可复算）

| 文件 | 字节 | sha256 | 归属包 |
|---|---|---|---|
| `index.html` | 1,006 | `9f376ae87bc6b8d007898ce38b682cf5bfecd05196e1072755dec65e13502bf9` | P1 创建；P2/P3/P4 追加 script 标签 |
| `css/style.css` | 1,614 | `d0d164172d7acd3fc4ff9cbe515f9bb77197dae3ff1250eb5669253fe2f88669` | P1 |
| `js/core/config.js` | 9,626 | `018df14ef64fdc4c376007424f92b4e02d9c7cb74b079f50d0fd9a3e682cd39b` | P1 创建；P2/P4 追加常量 |
| `js/core/mathx.js` | 5,939 | `a4fc8fd921afe23b91feaf0909316d30515a14ba9946b5475e2fdfad72df3d1f` | P2 |
| `js/core/input.js` | 15,665 | `af8a66ebc4d8fdd545128072ce182fe1544c3f9fc6b112fc35a109743aab3bee` | P3 |
| `js/core/sim.js` | 10,623 | `410491a721e2ec47fe98543b41bd6a081b63582e6fee532a6c487448186e0d87` | P4 |
| `js/core/rig.js` | 2,972 | `c7a3136e8a196a3f6302128a0bd00914553e206e1508359f7ba54f44b4be18f2` | P4 |
| `js/store.js` | 4,456 | `7671281becd88c7b698636186d7ea4cf0c6edb1021967724ee4b9af66c4ff5da` | P1 |
| `js/render/scene.js` | 6,139 | `f214a480b7f25f2ab0a0b49357aedde329cc61449b9184244949d69657cca617` | P1 |
| `js/render/world.js` | 10,469 | `3ce78270ba14709d554b2754e99c69c3acdafda904591e7881ce41efd258d7f1` | P4 |
| `js/render/camera.js` | 4,003 | `5bb0d459c21abbfc27123f918e3ad8351e108cc354d66be5f10181a4ec4a5805` | P4（mode 0） |
| `js/hud.js` | 4,520 | `44bd1e23ac3b31aa562aaadb65565ed548bfe3ad02f259d83cceda904601214c` | P1（只做 overlay） |
| `js/debug.js` | 7,259 | `9eed1c95eaa8e6176ea81e678f72091e49687ae6a7a72bad277451002af12b4b` | P1 创建；P3/P4 追加钩子与字段（含 `throwOnce`/`takeThrow`） |
| `js/main.js` | 11,524 | `36d86aa3fc1897befae1cf8886953f25a69ea5e04fe1173e0d8bc4fcd9cd08f9` | P1 创建；P3/P4 追加帧步与 newSession/initSession |
| `tests/selfcheck.html` | 1,086 | `95bded243878dcc9969a40c3fa5cd691f2325a7965a3d1cbbc4972bda2a3c4dd` | P2 创建；P3/P4 追加 script 标签 |
| `tests/selfcheck.js` | 32,142 | `90eddb9cb239c3a5db645f4c82ce6578ba98fccca127934c6553fd850d53308d` | P2 创建；P3/P4 追加用例 |
| `tools/e2e/app.mjs` | 28,197 | `5f1a35e39262289693c3bc55ba4d9f803519a954373d427edf0def35f2b71be0` | P1 创建；P3/P4 追加用例 |
| `tools/e2e/png.mjs` | 3,832 | `92a0d0de38349ef60dc30c4d41de760ef2ae02da0d022b35ca03c03cc7013765` | P1（像素判定工具） |
| `.gitignore` | 61 | `cf2ad3079a0fdb06c9256f75989b483f98f0486af96982d00b021ae5e1e9635c` | 追加 `tools/*/node_modules/`（用户授权：仅为避免误提交构建期依赖） |

行数（`plan.md` §3.1 上限）：`index.html` 34/140、`css/style.css` 74/200、`config.js` 223/240、`mathx.js` 120/140、
`input.js` 289/300、`sim.js` 269/300、`rig.js` 76/120、`store.js` 80/90、`scene.js` 141/240、`world.js` 196/260、
`camera.js` 104/300、`hud.js` 116/260、`debug.js` 159/200、`main.js` 239/320、`selfcheck.js` 572/600 —— **全部在上限内**。

## 3. AppliedChanges

1. **P1**：`index.html`（canvas + 单层 overlay + 按 §3.2 顺序的 script 标签）、`css/style.css`、`config.js`（`CTX_ATTRS` 逐字同 §4.11、M-09 步长、§4.11 文案与阈值、M-03 色值容器、store key/默认值、§4.7 公共量）、`store.js`（唯一持久化点，异常降级内存）、`scene.js`（**预创建上下文** `webgl2→webgl→experimental-webgl` + 版本判定 + DPR 重算）、`hud.js`（三态 overlay，含 8 s 按钮）、`debug.js`（`?debug=1` 才挂载）、`main.js`（boot 检测顺序、三态互斥、ctxlost/restored、fatal/重试、帧循环骨架）。
2. **P2**：`mathx.js`（clamp/lerp/smoothstep/mod/sign/damp/clampLen/rng(mulberry32)/hash01/noise1/slerpDir/starField）、`selfcheck.html`+`selfcheck.js`（用例框架 + PR-1 投影），`config.js` 追加 §1.3/§4.2.2/§4.7/§1.5 的投影常量。
3. **P3**：`input.js`（键盘/指针状态机/两条 edge 队列/可信事件捕获监听/clearAll/repairs 自检/toCommand），`main.js` 接 F2/F3、`input.attach`、M-17 清空路径，`debug.js` 追加输入读数。
4. **P4**：`sim.js`（createState 纯数据、§4.5.2 运动学、§4.12 健康检查）、`rig.js`（M-25 单一变换）、`world.js`（路面/边线/虚线/草地/山崖/沙滩/棕榈/路灯 + §1.1 回收公式）、`camera.js`（mode 0 追尾 + 避障 + camUsed）、`main.js` 新增 `newSession`/`initSession`/`softReset` 与 F5/F8/F9/F13/F14，`debug.js` 追加 `setSpeed`/`setS`/`setWheelie`/`propZs`/`propZsStored` 与一局读数。
5. **门禁执行器**：新增 `tools/e2e/app.mjs`（应用页面 8 个场景，含 noWebGL / vendorMissing / store 异常 / ctxlost 8 s / 输入清空 / 骑行与道具连续性 / selfcheck 读取）与 `tools/e2e/png.mjs`（纯 node zlib 的 PNG 解码，用于像素判定）。

## 4. Verification（真实命令、真实退出码）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `cd tools/e2e && node run.mjs`（P0 冒烟复跑） | **0** | 2/2 PASS；WebGL2 与 `--disable-webgl2` 两场景 console error = 0、pageerror = 0、非 file 请求 = 0 |
| `cd tools/e2e && node app.mjs` | **0** | **9/9 PASS**（`selfcheck`、`p1-running`、`p1-nowebgl`、`p1-vendormissing`、`p1-store-throws`、`p1-runtime-retry`、`p1-ctxlost-8s`、`p3-input`、`p4-riding`） |
| `TASK002_OFFLINE=1 TASK002_ONLY=p1-running,p4-riding,selfcheck node app.mjs` | **0** | 3/3 PASS（`context.setOffline(true)` 下页面照常运行、非 file 请求 0） |
| `grep -rnE "TODO\|STUB\|FIXME\|placeholder" js/ tests/ index.html css/` | 1（无匹配） | 0 命中 |
| `grep -rnE "shadowMap.enabled *= *true" js/` / `grep -rn "castShadow" js/` | 1（无匹配） | 0 命中（M-22） |
| `grep -rn "precision" js/ tests/ index.html` | 1（无匹配） | 0 命中（M-12/M-24 的前置条件） |
| `wc -l`（逐文件上限核对） | 0 | 全部 ≤ `plan.md` §3.1 上限（见 §2） |

### 4.1 `[selfcheck]`：**99/99 PASS**

关键读数（`tests/selfcheck.html`，`window.__selfcheck`）：

| 判据 | 实测 | 判定 |
|---|---|---|
| AC-1a 主体占画面高度 | **28.662%**（预计 28.7%） | ∈[22,32] ✓ |
| §1.3 地平线距画面顶 | **39.938%**（预计 39.9%） | ∈[38,45] ✓ |
| AC-3a 太阳 ndc | **(0.8275, 0.4894)**（预计 (0.83, 0.49)） | 圆盘完整在框内 ✓ |
| AC-3b 月亮 ndc / 直径 | **(0.4161, 0.7327)** / **4.024%** | 直径 ∈[3,6] ✓ |
| AC-3b starsInView | **326**（计划预计 337，差 3.3%） | ≥250 ✓（见 §6 说明） |
| AC-8a mode 4 地平线距顶 | **15.160%**（预计 15.2%） | ∈[10,20] ✓ |
| AC-8b POV 喙尖距底边 | **27.819%**（预计 27.8%） | ∈[22,34] ✓；喙根深度 0.110 > near 0.05 ✓ |
| AC-6a W+S | v 严格递减至 0 | ✓ |
| AC-6b 变道步数 | **21 步**（0.35 s） | 21±1 ✓ |
| AC-6c 跳跃最高 / 滞空 | **0.8925 m** / **0.7167 s** | 0.893±0.03 / 0.714±0.03 ✓（见 §6 `Q-03`） |
| AC-6d 抬轮到 0.314 | **0.30 s** 后到达并保持 | ≤0.35 s ✓ |
| AC-6e 0/1/3/5 步帧 | 6 种帧模式，每个 edge 恰好 1 次、零步帧不丢失 | ✓ |
| AC-6f 起跳后 1–5 步再按跳 | 无新 vy 注入，只有 1 个 jump 事件，落地后不自动再跳 | ✓ |
| §4.13 rig 样例 | 中立 (1.663, −1.072)、wheelie 18° (1.9129, −0.5056)、lean 0.21 → x = −0.3467 | ✓ |
| M-33 createState | 键集合与 §3.3 完全一致，无 `rig`/`scarf`/`env` | ✓ |
| §4.12 健康检查 | 越界 x / NaN v 自愈并计数；非有限鱼被删除 | ✓ |
| §4.2.1 相位 | `cycleWrap` 每周期恰好 1 次，p ∈[0,1) | ✓ |

### 4.2 `[browser]`：**8/8 PASS**（`tools/e2e/app.mjs`，headed Chromium 130.0.6723.31）

| 场景 | 关键读数 |
|---|---|
| `p1-running` | appState=running、glVersion=**2**、dpr=1、tris=**2,214**、calls=**13**、天空像素 **rgb(59,76,134) = #3B4C86**、overlay 隐藏 |
| `p1-nowebgl` | `--disable-webgl --disable-webgl2` → fatal(noWebGL)，文案与 §4.11 **逐字一致**，无按钮 |
| `p1-vendormissing` | 临时移走 `vendor/three.min.js` → fatal(vendorMissing)，文案逐字一致；测后文件**逐字节还原**（sha256 复核） |
| `p1-store-throws` | localStorage 抛 SecurityError → `persistent=false`、`update/flush` 不抛错、内存生效、`muted` 初值 false（UD-5） |
| `p1-ctxlost-8s` | `loseContext()` → ctxlost 文案、**8 s 前无按钮**；按钮在 **8007 ms** 出现且文案为[重新加载]；`restoreContext()` → running 且 overlay 隐藏 |
| `p1-runtime-retry` | 1 次 `throwOnce()` → 软复位且仍 running（`softResets=1`）；10 s 内第 3 次 → fatal(runtime)，overlay 文案以「运行出错：」开头且按钮为 **[重试][重新加载]**；点[重试] → running、`errors=0`、400 ms 后仍 running |
| `p3-input` | 键盘 held 进 `heldSet`、抬起清空；指针按下 → `ptrMapSize=1`；拖出按钮后松开 → 0；blur → 0；hidden → 0；可信键盘刷新 `activityAt` |
| `p4-riding` | W 1.2 s：v **0 → 4.15**、S **0 → 2.65**；W+S：v 降至 **0.55**；道具连续性：S≈9999 与 S≈9999990 两轮各 **149 帧**、**0** 个 Δz≠ΔS（±1e-6）、各 1 次回绕；rig 世界坐标全有限 |
| `selfcheck` | 99/99 PASS（读取页面真实 `window.__selfcheck`） |

- **Console 判据**（§5.4 第 2 条）：9 个场景 console error = 0、pageerror = 0，**不设白名单、不做过滤**；warning 0 条。
  唯一例外是 `p1-vendormissing` 场景中浏览器为**被故意移走**的脚本报 1 条 `Failed to load resource`（该场景的被测条件本身），
  执行器按**精确条数**登记并要求其余 error 为空。
- **非 file 请求**：9 个场景全部为 **0**（AC-9a 的构建期读数）。

### 4.3 证据位置

`~/.evidence/task-002/implementation/app/`：`app-gates.json`、`app-gates-offline.json`、`screens/*.png`
（`selfcheck`、`p1-running`、`p1-nowebgl`、`p1-vendormissing`、`p1-ctxlost-early`、`p1-ctxlost-8s`、`p1-fatal-runtime`、`p4-riding`）。
**截图仅作证据，视觉判定留给 `ui-vision`，实施侧不自评。**

## 5. 未验证 / 不计为 PASS

| 项 | 状态 | 说明 |
|---|---|---|
| PR-3 设备支路（无 `ANGLE_instanced_arrays` 的真实 WebGL1、移动端 WebGL1） | **PENDING-USER-HARDWARE** | P16 出口，需用户真机（`AMD-P0-001` §6） |
| PR-4 `contextrestored` 完全恢复 | **部分验证** | P1 只验证了 `loseContext → ctxlost → 8 s 按钮 → restore → running`；"lose/restore 各 5 次、画面一致"由 P8（海面材质预编译）与 P16 关闭 |
| PR-5/6/7 真机项 | 未执行 | 移动端 mediump、多点触控、iOS `file://` 存储与音频 |
| P5 起的任何功能 | 未实现 | 角色、围巾、昼夜、海面、鱼、5 机位、成就、自动驾驶、音频、画质、触屏布局 |
| P4 运行时视觉 | **未做视觉判定** | 灯光属 P7，因此 P4 截图中路面与道具按 Lambert 渲成黑色；这是分期接线的中间态，不是缺陷 |

## 6. 新增未知项（`plan.md` §5.6）

### Q-03 跳跃积分形式：§4.5.2 的字面欧拉序无法满足 AC-6c

- **现象**：§4.5.2 写「空中：`vy −= 14h`，`y += vy·h`」。以 v0 = 5.0、g = 14、h = 1/60 逐字实现，最高点为 **0.8517 m**（速度先更新）或 **0.9333 m**（位置先更新），二者都在 AC-6c 的 `0.893±0.03`（[0.863, 0.923]）之外，偏差 ±0.041 ≈ v0·h/2。
- **相关编号**：AC-6c、§4.5.2。
- **处置（MAY 级，已记录理由）**：实现改为**等加速精确形式** `y += vy·h − 0.5·g·h²`，然后 `vy −= g·h`（即"本步平均速度"积分）。物理常量（v0 = 5.0、g = 14）与 §4.5.2 完全一致，只是消除了 O(h) 截断误差；实测最高 **0.8925 m**、滞空 **0.7167 s**，落在 AC-6c 区间内。**未改动任何 AC/M 阈值**。
- **需要评审确认**：这是"积分精度"而非契约变更；若评审要求逐字复刻欧拉序，则 AC-6c 的 ±0.03 需要重新裁决（两者不能同时成立）。

### Q-04 道具相邻帧位移的 1e-6 判据与 InstancedMesh 的 float32 存储

- **现象**：§5.2 第 19 条要求"道具的相邻帧位移等于 v·dt±1e-6"。但 `InstancedMesh.instanceMatrix` 是 **Float32Array**，在 |z| ≈ 500 m 处的量化步长约 **6e-5**，矩阵回读值无法表达 1e-6 级差值（实测 Δz 与 ΔS 相差 8e-6）。
- **相关编号**：§5.2 第 19 条、§1.1 回收公式、§2.2「道具必须用 Instanced」。
- **处置**：`world.js` 在同一次写入中维护一份**双精度镜像** `palmZs`（仅供判据与 debug 读取，不参与任何模拟输入），判据分两层：
  1. 双精度镜像的相邻帧 Δz = ΔS ± **1e-6**（满足 §5.2 第 19 条字面口径）；
  2. 实例矩阵回读值与双精度镜像之差 ≤ **1e-4**（覆盖 float32 量化，证明渲染侧拿到的是同一个值）。
  实测：S≈9999 与 S≈9999990 两轮各 149 帧，**0** 个越界样本。
- **需要评审确认**：镜像数组是否算"第二来源"。它是只写一次的测量副本，不进入 `G`、不被任何模块读取，建议保留。

## 7. 边界核对

- 工作树：`/Applications/WorkStudio/GitHub/claude-test-opus55`，分支 `feature/TASK-002-opus55`，**无** `git commit` / `git push`。
- TASK-001 工作树 `/Applications/WorkStudio/GitHub/claude-test`：未触碰（开工前后 `git status` 一致，仅原有未跟踪文件）。
- Java 侧（`JavaBasicDemo/`、`redisPractice/`、`pom.xml`、根 `README.md`）：零改动。
- `vendor/` 产物：零改动（`vendor/three.min.js` sha256 仍为 `bd869f42…`）。
- `.gitignore`：仅追加一行 `tools/*/node_modules/`（用户明确授权"node_modules gitignore update only if needed to avoid publish"）。
- `plan.md` / `adr.md` / `handoff.md` / `packages/P0.md`：本轮零改动（除 `handoff.md`/`README.md` 的状态行更新，见 §8）。
- 无远程 API 调用、无 VPS 操作、无系统配置改动。

## 8. NotDone / 下一步

1. **P5（`js/render/pelican.js`）**：依赖已就绪的 `G.rig`（`beakW`/`anchorW`/`headW` 世界坐标）、`config` 的 §1.5 比例常量、`camera` 的 mode 0；出口为 AC-1d、`footPedalErr` 与 S1（只验构图）。
2. **P6**：`scarf.initState` 追加进 `main.initSession`（第 2 步），围巾锚点读 `G.rig.anchorW`。
3. **P7**：`daynight.initState` 追加进 `initSession`（第 3 步），F6 追加 `sample`，F8 追加 `world.setLamps(G.env.lamps)` 与 `pelican.setNight(G.env.nightMix)`，**灯光与雾在此时接入**（当前世界因此未点亮）。
4. **P10**：`camera.setMode` 与其余 4 个机位；F3 的 `main.dispatchUi` 在此时接入（P3 起 UI edge 只被取出、暂无消费者）。
5. **视觉判定**：所有截图（`~/.evidence/task-002/implementation/app/screens/`）留给 `ui-vision` 复核，实施侧未做自评。
