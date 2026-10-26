# TASK-002 P13–P16 执行结果（`packages/P13-P16-execution-result.md`）

> 派生自 **`plan.md`**（含 `AMD-P0-001` / `AMD-P4-001` / `AMD-P8-001` / `AMD-P10-001`，ADR-21…39 已应用）与本轮主 agent 指派。
> 只引用不可变编号（M/UD/ADR/AC/S/PR/P/Q），不重新解释、不改写阈值；与 `plan.md` 冲突时以 `plan.md` 为准。
> 工作树 `/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`）；**未提交、未推送**。

## 0. 结论（一句话）

先应用了 **AMD-P10-001 的全部获批裁决**（ADR-33、34、35、36、37、38、39；其中 ADR-34 的 `dx`/`y` 口径由实施侧独立复算定为
`dx=23` + `y=0.6`（世界绝对高度）），再完成 **P13 音频 / P14 画质 / P15 触屏与 CSS 迁移 / P16 集成**：
`[selfcheck]` **271/271 PASS**、应用页门禁 **32/32 PASS**、离线 **32/32 PASS**；代码行 **4,770 ≤ 5,600**；
构建 grep（TODO/STUB、shadowMap/castShadow、GLSL precision、RawShaderMaterial）全部 0 命中；
`index.html` 的内联 `<style` 计数 **0**；30 s 真实视频 **脚本墙钟 33.57 s / 文件 4,505,739 B（容器 37.24 s）**。
（2026-10-26 整改：那两个数不是同一个量——33.57 s 是 `videoElapsed` 墙钟，容器时长以 `ffprobe` 为准；权威重录见
`packages/P9-P16-evidence-repair-execution-result.md`：容器 **37.84 s**、1280×720、25 fps、VP8、**无音轨**。）
Console 只有已知的两条 `THREE.WebGLRenderer: WebGL 1 support was deprecated`（Q-02），无新 warning 类别。

## 1. ChangedFiles（物理行 / sha256 前 16 位）

| 文件 | 归属 | 行 | sha256（前 16） |
|---|---|---|---|
| `js/audio.js`（新） | P13 | 491 | `b799d3bd9cd02b25` |
| `js/core/quality.js`（新） | P14 | 163 | `3640aa5435237a15` |
| `js/core/config.js` | P10（`CAM_SIDE`，ADR-34）+ P13/P14（追加常量） | 432 | `c41b86b8bf52227f` |
| `js/render/camera.js` | P10（mode 1 注释，ADR-34） | 411 | `0fea05728c5e35b8` |
| `js/render/scene.js` | P14（`applyQuality`/DPR/resolution） | 265 | `f5941d37242c3134` |
| `js/main.js` | 通用允许集（F7/F8/F10/F11、mute、门控、初始画质、触屏） | 368 | `6d6600489a233bba` |
| `js/debug.js` | 通用允许集（`forceLamps`/`lampValue`/`forceQuality`/`burnMs`/`injectNaN`） | 580 | `d7a8e0f2332b8e58` |
| `js/hud.js` | P15（`initTouch`/`touchVisible`/`updateMute`） | 358 | `2cf69aac10f03948` |
| `index.html` | P15（删内联样式块 + 触屏 DOM + 两个 script，ADR-39） | 84 | `1b644b61712d59d7` |
| `css/style.css` | P15（原样迁入 HUD 样式 + 触屏样式） | 156 | `e97cdd4a03794236` |
| `tests/selfcheck.js` / `.html` | 通用允许集（ADR-33/34、AC-9d、AC-11） | 1867 / 42 | `a8f947a0dbb869a2` / `4dda9d14788783ea` |
| `tools/e2e/app.mjs` | 通用允许集（S3→S3a/S3b、S7/S11/S13 改 mode 4、4 个新场景） | 3449 | `7da1aae7ff3faf67` |
| `tools/e2e/adr34-projection.mjs`（新） | ADR-34 独立复算脚本 | 209 | `74791161ba85f454` |
| `docs/remote/TASK-002/plan.md` | AMD-P10-001 的规范替换 | 1433 | `4376b791dc5ebeac` |
| `docs/remote/TASK-002/adr.md` | ADR-33…39 + 决策数 | 89 | `c2481e059d218e32` |
| `docs/remote/TASK-002/handoff.md` | P10/P15 行 | 114 | `047c497c9a2421b6` |

复算：`shasum -a 256 <file>`、`wc -l <file>`。**零改动**：`js/core/{sim,rig,fish,scarf,daynight,oceanmath,autopilot,achievements,input,mathx}.js`、
`js/store.js`、`js/render/{sky,ocean,world,pelican,fishview}.js`、`vendor/*`、Java 相关目录。

## 2. 逐任务落点

| 任务 | 落点 | 说明 |
|---|---|---|
| AMD 应用 | `plan.md`、`adr.md`、`handoff.md` | AC-1b（L 口径，ADR-37）、AC-8a（S3→S3a）、§4.7 mode 1 行（ADR-34 的最终数值）、§5.1 P10/P15、§5.3 debug 钩子 + S3a/S3b/S6/S7/S11/S12/S13、§6.1 ADR-33…39 |
| ADR-34 定值 | `js/core/config.js` 的 `CFG.CAM_SIDE` | 位置 `(车x+23, 0.6, 车z−22)`、注视 `(车x, 0.6, 车z+7)`、FOV 40 / k 4 / near 0.1；`0.6` 为世界绝对高度 |
| P13 | `js/audio.js`、`js/main.js`、`js/debug.js`、`js/hud.js` | 链路 `sources→music/sfx/amb→master(0.6)→comp(−18,4)→dest`；2 s LCG 噪声；25 ms 调度 / 0.12 s 前瞻 / 16 分音符；BPM `clamp(2·round(rpm/2),72,144)`、每小节 ≤12；kick/hat/bass/pad（Am–F–C–G，±6 cent，LP `lerp(2200,900,night)`）；风/浪环境声；5 种音效；手势解锁、门控、静音持久化 |
| P14 | `js/core/quality.js`、`js/render/scene.js` | 1.5 s 窗口（>250 ms 帧整窗作废）、2 坏窗口降级、5 好窗口 + ≥10 s 升级、振荡封锁 60 s；DPR 0.75/1.0/1.5/2.0、星点 1200/2000/3000/3000、雾 300/360/420/420、海面网格与法线路径 |
| P15 | `index.html`、`css/style.css`、`js/hud.js`、`js/main.js` | 触屏 DOM（◀▶ 72 px、2×2 64 px、🎥🔊🏆 56 px，全部 ≥56）；`pointer:coarse` 或首个 touch 指针显示；键盘并存；HUD 样式原样迁入 CSS |
| P16 | 全部 | 30 s 视频、离线、GL1、ctxlost/restore、NaN 自愈、零尺寸、按键屏蔽、面板交互、性能读数 |

## 3. Verification（真实命令、真实读数）

| 命令 | 结果 |
|---|---|
| `TASK002_ONLY=selfcheck PW_HEADLESS=1 node tools/e2e/app.mjs` | **271/271 PASS**（新增 33 条） |
| `PW_HEADLESS=1 node tools/e2e/app.mjs` | **32/32 场景 PASS**（报告 `app-gates.json`） |
| `TASK002_OFFLINE=1 PW_HEADLESS=1 node tools/e2e/app.mjs` | **32/32 PASS**（报告 `app-gates-offline.json`） |
| `node tools/e2e/count-lines.mjs` | 代码行 **4,770 / 5,600 PASS** |
| `grep -c "<style" index.html` | **0** |
| `grep -rn "TODO\|STUB" js/`、`shadowMap.enabled *= *true`、`castShadow`、`precision +[lmh][a-z]*p `、`RawShaderMaterial` | 全部 **0** 命中 |
| `node tools/e2e/adr34-projection.mjs` | dx=23/y=0.6 三条车道 **47.71 / 66.20 / 75.03%**；dx=21 车道 −2.5 **26.2%**；y=1.6 车道 −2.5 **23.8%** |

关键读数（全部来自本轮真实运行）：

- **ADR-34**：真实相机 `(22.9990, 0.60005, −21.9991)`（与目标差 ≤0.05 m）、FOV 40、near 0.1；
  S3a 真实相机下半海面 **65.32%**（车道 1，step 12 采样）、车心 `ndc=(0.2326, 0.0344)`、车高 **94.43 px**。
- **ADR-33 回归**：旧陆侧机位三条车道 **1.07 / 2.77 / 5.60%**（step 4），全部 <40%。
- **S3b**：4 个合格光斑圆片（深度 25.2 / 55.1 / 84.9 / 114.7 m，投影宽 206 / 94 / 61 / 45 px）在 `forceLamps(0/1)` 差分中分别有
  **3232 / 384 / 141 / 84** px，总差分 **4207 px**。
- **S7**：mode 4 下飘带-only 差分 **450 px**；同一判据在海侧 mode 1 下只有 **26 px**（ADR-34/36 的实测依据）。
- **P13**：手势后 `audioState=running`、`ctx.state=running`、bpm 从 72 **单调升到 144 用时 14.57 s**（≤26 s）；
  hidden → `suspended`（`ctx.state` 同步核对），回来 → `running`；静音 → `suspended` + store 持久化 + 图标 🔇；仓库音频文件 **0**。
- **P14**：`burnMs(25)` → **4.515 s** 降到 L1（`fpsWin≈39`）；停止后 **10.548 s** 升回 L2（`fpsWin=60`）；
  `forceQuality(0)` → DPR **0.75**、逐顶点法线、仍渲染（12,678 tris / 52 calls）。
- **P15**：9 个按钮 72/72/64×4/56×3，全部在视口内且与车投影包围盒无交叠；CDP 真实多点：2 指 → `ptrMapSize=2` 且 held，
  抬 1 指 → 1 且仍 held，抬 2 指 → 0 且释放；拖出后松开不卡；键盘与触屏并存；**S8/S9 迁移前后差分 0 px**。
- **P16**：5 种 NaN 注入 1 步内自愈（`bike` 触发 §4.12 的 `non-finite t/S` → softReset，属契约行为）；
  零尺寸不抛错；Space/方向/Esc `preventDefault` 全真；面板打开时 W 仍加速；`ctxlost→restored` 新增帧错误 **0**；
  离线 running + 非 file 请求 **0**；`--disable-webgl2` 下 `glVersion=1` 且渲染正常、Console 0 error；
  **30 s 视频 墙钟 33.57 s / 文件 4,505,739 B / 容器 37.24 s**（含变道、POV、电影镜头、AUTO 接管与真实按键打断）。
  **整改后**（2026-10-26）：容器 **37.84 s**、1280×720、25/1 fps、vp8、**`audioStreams = 0`**、sha256 `079b24b2…`，
  时间轴逐步读数见 `packages/P9-P16-evidence-repair-execution-result.md` §3.2；**该文件不能用于证明音频已验证**。
- 性能读数：`fpsWin=60`、`tris=40,518`、`calls=52`、`level=2`、`dpr=1`（headless；真实 GPU 门槛属 PR-9）。

## 4. 本轮修掉的实现缺陷（失败保留，不删除历史）

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | `p16` 的"零尺寸不新增错误"与"restore 后 10 s 无错误"断言失败（实际 1） | `injectNaN('bike')` 让 `S` 在同一步变成非有限，`sim.healthCheck` 按 §4.12 抛 `non-finite t/S` → softReset。这是**契约规定的合成错误**，不是缺陷；断言口径写错 | 断言改为"注入期间只允许出现 §4.12 的那一条合成错误"+"零尺寸/ctxlost 用增量判据" |
| 2 | `injectNaN('fish')` 直接 push 半个对象会让 `fish.step` 在自愈前读到 `undefined` 字段 | 注入方式不符合"数值健康检查自愈"的语义 | 改为先 `PB.fish.spawn` 再把它 `s` 写 NaN |
| 3 | `p13` 的 AC-9c 探针在 headless 下 `document.hidden` 仍为 false | headless 浏览器不把后台页标记为 hidden | 先试真实切标签页；不成立时覆写 `document.hidden` 并派发真实 `visibilitychange`，报告记录 `method:'override'` |
| 4 | `p15` 的"抬一指仍 held"失败（仍为 2） | CDP `touchMove` 不会为缺失的触点生成 release | 改用 `touchEnd` + 剩余触点（CDP 的正式语义），实测 2→1→0 |

## 5. 未做 / NOTVERIFIED（不得表述为 PASS）

| 项 | 状态 | 说明 |
|---|---|---|
| S3a/S3b/S7/S11/S13/S6/S12/S8/S9/S10 的**视觉**判定 | **PENDING-USER-VISION** | 截图已重拍并登记 manifest；判定交 `ui-vision` / 用户 |
| AC-9b 的听感 | 未验证 | 只验证链路、BPM 映射、门控与状态机 |
| 真机触屏多点 / 音频解锁（PR-6/PR-7） | **PENDING-USER-HARDWARE** | headless 用 CDP 真实触摸事件覆盖 |
| 真实 GPU fps（PR-9） | **PENDING-USER-HARDWARE** | headless 读数见上；集显 ≥55 fps 需真机 |
| PR-3 设备支路（真实 WebGL1 设备） | **PENDING-USER-HARDWARE** | 能力路径（`--disable-webgl2`）本轮再次 PASS |
| AC-2d 的 10 min 长跑 | 未重跑 | 本批不动物理与渲染负载（AMD-P10-001 §6） |
| GC 停顿 <5 ms（M-31） | 未录制 | 需要 Performance 面板录制；本轮只做了"稳态帧无新增分配"的代码审查 |

## 6. 边界核对

- **无** `git commit` / `git push`；**无**付费调用（本轮未调用远程模型）；**无** VPS 操作；**无**系统配置改动。
- TASK-001 工作树 `/Applications/WorkStudio/GitHub/claude-test`：本轮未写入。
- `vendor/`、`JavaBasicDemo/`、`redisPractice/`、`pom.xml`：零改动。

## 7. 下一包（P16 出口）就绪状态

- 应用侧门禁、离线、GL1 能力路径、错误恢复、30 s 视频**已就绪**。
- **待用户/真机**：PR-3 设备支路、PR-5/PR-6/PR-7（移动端与 iOS `file://` 下的触屏、音频解锁、localStorage）、PR-9（真实 GPU fps）。
- **待视觉复核**：S3a/S3b/S7/S11/S13/S6/S12/S8/S9/S10 的截图判定。
