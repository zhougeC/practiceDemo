# TASK-002 移交入口（handoff.md）

> **状态：`APPROVED`（2026-10-25）。** 用户原话：「批准计划，可以开始实施」；UD-1…UD-5、ADR-01…ADR-19 与全局 master plan 均已批准。
> P0 任务书见 `packages/P0.md`，执行记录见 `packages/P0-execution-result.md`。
> 本文件是**导航与非规范摘要**，只做"指路 + 门禁 + 停止条件"。**任何冲突以 `plan.md` 为准**，本文件不得用于替代或改写规范正文。

## 1. 入口与权威

| 项 | 值 |
|---|---|
| 唯一权威计划 | **`plan.md`**（canonical master plan；正文 = `design-v3.md` 逐字副本 + 2 处索引补全） |
| `plan.md` sha256 | 批准前原件 `71c51565d767f569aaabebfa2a2ff868e5628e43a1a7dac300896239587ce717`（96,974 B）；当前文件 sha256 与元数据链见 `impl-notes.md` §A |
| 正文来源快照 | `design-v3.md` sha256 `452ba330c9824af366293b134918c9c1f15b4e407eea3f751bac872d4c3edede`（96,702 B） |
| 决策记录 | `adr.md`（ADR-01…19 + UD-1…UD-5，均 **APPROVED** 2026-10-25） |
| 最终门禁评审 | `review-3.md`（`READYFORUSERAPPROVAL`，无阻塞，置信度 0.87） |
| 基线 | BASE_SHA `2263425df8bd074f3c5e0d8f15e695e4f6c709e0`；工作树 `/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`），**未提交、未推送** |
| 阅读顺序 | `plan.md`（规范）→ `adr.md`（决策）→ `review-3.md`（门禁结论）→ 同目录历史快照（非规范） |

**编号即契约**：`M-xx`（不变量）、`UD-n`（用户裁决）、`ADR-xx`（决策）、`AC-xx`（验收）、`S-n`（截图机位）、`PR-n`（证明义务）、`P-n`（实施包）。
引用时**逐字沿用编号**，不得重新解释、不得在任务书里改号。

## 2. MUST vs MAY（一句话版）

- **MUST（不可改，34 条）**：M-01…M-32（`plan.md` §2.1）+ **M-33**（唯一初始化路径 `newSession` = `createState` + `initSession`）+ **M-34**（可信事件集合是取消 AUTO 的唯一判据来源）。
- **UD（已批准，5 条）**：UD-1 three `0.162.0` / WebGL2 优先 + WebGL1 回退；UD-2 完整昼夜闭环；UD-3 字面口径的 `isTrusted` 输入取消 AUTO；UD-4 Playwright 仅开发依赖；UD-5 `muted` 初值 `false`。
- **MAY（可替换，但须满足可判定判据）**：几何构造方式、翼尖/尾羽/蹼造型、鱼造型细节、道具造型、音色、HUD 样式、电影镜头机位细节、海面网格分布（`plan.md` §2.2 的 8 行表格），以及代码内部变量命名。
- **CALIBRATION（允许在给定区间内调参，不得出区间）**：`C_D ∈ [1.8,3.0]`（AC-2a）、`DAMP ∈ [0.97,0.995]`（AC-2b）、`NA ∈ [0.8,1.7]`（AC-4b）、`T_lo ∈ [0.35,0.60]`（AC-4c）、星点像素计数 ≥150（AC-3b）。
- **禁止**：为了让 AC 通过而放宽既有 AC 区间；用占位/no-op 模块换"每包可运行"；在模块里私建常量或探针（应进 `js/core/config.js` / `js/debug.js`，只能追加）。

## 3. 实施包 P0–P16（每包 = 一个任务书）

> 下表只是索引；**允许文件集与出口门禁以 `plan.md` §5.1 为准**。通用允许集（可追加，不可改写他人内容）：`index.html`、`js/main.js`、`js/core/config.js`（P1 创建）、`js/debug.js`（P1 创建）、`tests/selfcheck.*`（P2 创建）、`tools/e2e/*`（P0 创建）。

| 包 | 交付物（摘要） | 出口门禁（摘要） |
|---|---|---|
| P0 | `tools/vendor-three.sh`、`tools/vendor/*`、`tools/three-smoke.html`、`tools/e2e/*`、`vendor/three.min.js` + LICENSE + VERSION.txt | `[build]` §5.7 全部 = **PR-2**；冒烟页 `THREE.REVISION==='162'`、非 file 请求 0；`--disable-webgl2` 下能力断言成立（`isWebGL2===false`、VERSION 以 `WebGL 1.0` 开头、非 `WebGL2RenderingContext` 实例）= **PR-3 能力路径**（AMD-P0-001） |
| P1 | `css/style.css`、`js/core/config.js`、`js/render/scene.js`、`js/hud.js`(overlay)、`js/debug.js`、`js/store.js` | 三态 overlay 可复现（noWebGL / vendorMissing / ctxlost 8 s 按钮）；`stats()` 可用 |
| P2 | `js/core/mathx.js`、`tests/selfcheck.html/js`（创建） | mathx/rng；**PR-1** 投影预计值全部落在 AC 区间 |
| P3 | `js/core/input.js` | AC-6e 队列（伪事件）；blur/拖出/hidden 后 `heldSet` 为空 |
| P4 | `js/core/sim.js`、`js/core/rig.js`、`js/render/world.js`、`js/render/camera.js`(mode 0)；main 新增 `newSession`/`initSession`（只接 `rig.initState`） | createState 不引用 scarf/daynight；newSession 后字段有限；AC-6a/6b/6c/6d/6f |
| P5 | `js/render/pelican.js` | AC-1d、`footPedalErr`；S1（只验构图） |
| P6 | `js/core/scarf.js`、`js/core/rig.js`(只追加 toLocal)、`js/render/pelican.js`(围巾、躯干分段、墨镜) | AC-2a/2b/2c + NaN 注入 + 碰撞外置 + PR-8；AC-2d；S7 由 P10 产出 |
| P7 | `js/core/daynight.js`、`js/render/sky.js`、`js/render/scene.js`(灯光/雾) | AC-3d、星星分布；S1/S2 天空部分 |
| P8 | `js/core/oceanmath.js`、`js/render/ocean.js` | AC-4a/4b/4c/4d；`grep -rnE "precision +[lmh][a-z]*p " js/ tests/ index.html` = 0 且 `grep -rn "RawShaderMaterial" js/` = 0（AMD-P8-001 §17.1）；S6、S12 由 P10 产出 |
| P9 | `js/core/fish.js`、`js/render/fishview.js`、`js/hud.js` | AC-5b/**5d**、迁移连续性；AC-5a；S11 |
| P10 | `js/render/camera.js`(5 机位)、`js/core/config.js`(只改 `CFG.CAM_SIDE`，ADR-34) | AC-8b；S3a、S3b、S4a/b/c、S5、**S7**、**S11**、**S13**、**S14**（ADR-33/34：mode 1 改海侧远景，S7/S11/S13 改 mode 4） |
| P11 | `js/core/achievements.js`、`js/hud.js`、`js/store.js` | 14 条成就 + 幂等；刷新持久化；`muted` 初值 false |
| P12 | `js/core/autopilot.js` | AC-12b/12e；AC-12a/12c/12d |
| P13 | `js/audio.js` | AC-9d；AC-9a/9b/9c |
| P14 | `js/core/quality.js`、`js/render/scene.js` | AC-11 时间序列；`burnMs` |
| P15 | `css/style.css`、`index.html`(只删内联样式块，ADR-39)、`js/hud.js`、`js/core/input.js`(按钮绑定) | AC-10（Playwright 触屏）+ 真机（**PR-6**）；S8、S9；`grep -c "<style" index.html` = 0 |
| P16 | 全部文件，只做修复 | §5.2 全 25 条、§5.3 全部；`TODO`/`STUB` grep = 0；M-22 两条 grep = 0；GC 停顿 <5 ms（M-31） |

## 4. 证明门禁（PR-1…PR-12；PR-2/PR-3 已于 2026-10-25 P0 执行，其余未执行）

| PR | 命题 | 方法与判据（摘要） | 出口 |
|---|---|---|---|
| PR-1 | 构图/星星/POV 预计值 | `[selfcheck]` 用 `config` 常量与 §1.3 公式算，落 AC 区间 | **P2 出口** |
| PR-2 | vendor 可构建且 ≤800 KB | §5.7 命令；VERSION.txt 完整 | **P0 出口** |
| PR-3 | r162 在 WebGL1 可回退 | 能力路径：用 `--disable-webgl2` 启动，能力断言成立（`isWebGL2=false`、VERSION 以 WebGL 1.0 开头、不是 WebGL2RenderingContext 实例），渲染成功，并满足 Console 判据；设备支路：**覆盖"有/无 `ANGLE_instanced_arrays`"两种真实 WebGL1 设备**（ADR-20） | 能力路径 **P0 出口**；设备支路 **P16 出口（用户真机）** |
| PR-4 | `contextrestored` 后完全恢复 | lose/restore 各 5 次，无 fatal、画面一致 | 由所属包任务书指定 |
| PR-5 | 移动端 mediump 走逐顶点路径 | 真机；shader 编译通过、S10 可接受 | 由所属包任务书指定 |
| PR-6 | 真机多点触控 | iOS + Android 各 1 台，AC-10 | 由所属包任务书指定 |
| PR-7 | iOS `file://` 的存储与音频 | 真机；不报错；store 只在内存可接受 | 由所属包任务书指定 |
| PR-8 | 围巾校准 | 在 C_Q∈[0.8,1.4] × DAMP∈[0.97,0.995] × v∈{0,4,8,12,16} 内扫描，覆盖二次阻力与躯干椭球碰撞（ADR-22、ADR-23）；AC-2a、2b、2c 必须同时满足；窗口内没有任何一组可行参数时**停下并升级给用户**，不得改阈值 | P6-fix 出口 |
| PR-9 | 性能 | 填表：设备/浏览器/等级/fpsWin/tris/calls | 由所属包任务书指定 |
| PR-10 | 运行时零网络请求 | Network 面板为空（Playwright 统计请求数） | 由所属包任务书指定 |
| PR-11 | 泡沫校准 | 扫描 `NA`、`T_lo` | 由所属包任务书指定 |
| PR-12 | POV 喙根不被近平面裁剪 | S5 中喙根可见 | 由所属包任务书指定 |

**执行状态（2026-10-25，P0 出口 + P1–P4 出口；设备 macOS 15.1 / Apple M4 Pro，浏览器 Playwright 1.48.2 自带 Chromium 130.0.6723.31）**

- **P1–P4 完成（2026-10-25）**：按 `plan.md` §5.1 顺序实施，每包出口门禁实测通过 —— `[selfcheck]` **99/99 PASS**、
  应用页面门禁 **9/9 PASS**、离线 **3/3 PASS**、P0 冒烟复跑 **2/2 PASS**；`grep TODO/STUB`、M-22 两条、`grep precision` 均 0 命中；
  逐文件行数全部在 §3.1 上限内。执行记录见 `packages/P1-P4-execution-result.md`，读数见 `impl-notes.md` §C-4…§C-7。
  `Q-03`、`Q-04` 已由 AMD-P4-001 / ADR-21 裁决：跳跃采用等加速精确积分；道具连续性改为双精度源层 ±1e−6 加 float32 层逐位正确舍入，
  并删除 Float64 镜像。未改任何 AC、M、UD 阈值。删除镜像后需要按 §5.2 第 19 条重跑，重跑通过前 P4 道具门禁为 NOTVERIFIED（`impl-notes.md` §D）。
- **PR-1 PASS（P2 出口）**：用 `config` 常量与 §1.3 公式复算，AC-1a **28.662%**、§1.3 地平线 **39.938%**、
  AC-3a 太阳 ndc **(0.8275, 0.4894)**、AC-3b 月亮 ndc **(0.4161, 0.7327)** / 直径 **4.024%**、starsInView **326**（计划预计 337，
  差 3.3%，AC 判据 ≥250）、AC-8a mode 4 地平线 **15.160%**、AC-8b 喙尖距底 **27.819%**；全部落在 AC 区间内。

- **PR-2 PASS**：`vendor/three.min.js` 671,847 B ≤ 800 KB；`VERSION.txt` 完整；IIFE 校验（以 `var THREE=` 开头、无顶层 `import`/`export`、无 `sourceMappingURL`）通过。
- **PR-3 能力路径 = PASS（2026-10-25 按 AMD-P0-001 / ADR-20 新构造重跑）**：`tools/three-smoke.html` 改为 `CTX_ATTRS` 预创建上下文后传 `WebGLRenderer({canvas, context})`；执行器场景收敛为「默认」+「`--disable-webgl2`」。实测 **2/2 PASS，退出码 0**：WebGL2 场景 `isWebGL2=true`/`glIsWebGL2Context=true`；WebGL1 场景 `isWebGL2=false`、`WebGL 1.0 (OpenGL ES 2.0 Chromium)`、非 `WebGL2RenderingContext` 实例、`ANGLE_instanced_arrays`（`gl.getExtension`/`three.extensions.has` 均 true）、三角面 12、非背景像素 85,547。两场景 **console error = 0、pageerror = 0**（不设白名单），非 file 请求 = 0；WebGL1 场景 1 条预期弃用 warning 已逐条记录（`impl-notes.md` §C-2a）。`--disable-es3-apis` 在 Chromium 130 下不关闭 WebGL2，已按 ADR-20 停用（FAIL 历史保留）。
- **PR-3 设备支路 = NOTVERIFIED（PENDING-USER-HARDWARE，P16 出口）**：目前只有能力屏蔽模拟（单独标注 SIMULATION），不能作为硬件缺失的证明（`handoff.md` H-4）。
- 其余 **PR-1、PR-4…PR-12 未执行**。

**门禁原则**（`adr.md` §3 / `draftadr.md` §3）：PR 一律绑定**实施包出口**，不绑定"批准前必须先完成"。
批准**不**要求先跑完 PR-1…PR-12；反之，任何"已通过"的表述都必须有实测数据（设备、浏览器版本、数值）。

## 5. 停止与升级（`plan.md` §5.6，硬性）

1. 未覆盖的问题 → 在 `impl-notes.md` 追加 `Q-nn`（现象 + 相关 M/AC 编号 + 临时做法）。
2. **必须停下等裁决**的情形：涉及 MUST 条目、色值或构图、成就条件、输入或自动驾驶优先级、或影响任何 AC 的判定。
3. 只涉及 MAY 的，可自行决定，但必须记录理由。
4. "需实测"的项必须附实测数据（设备、浏览器版本、数值）。
5. 本任务附加硬停：**批准前不得开始编码**（2026-10-25 已批准，该前置条件已满足）；涉及 DDL/数据修复/真实外部调用/生产操作 → 停并请求授权；**不得**为通过验收而改写 `plan.md` 的 M/AC。

## 6. 已知残留与观察项（非阻塞，批准时一并裁决）

| # | 项 | 现状 | 建议 |
|---|---|---|---|
| H-1 | §3.1 **标题**仍写"总共约 3800 行" | 紧邻正文已声明作废，唯一口径 = 逐文件上限之和 **5600 行** | 接受（review-3 已判非阻塞） |
| H-2 | §6.2 汇总表曾漏 `AC-5d`、`S14` | **已在本包 `plan.md` §6.2 补全**（仅 2 个索引单元格） | 无需再改 |
| H-3 | B1 的"≤0.5 m/步"措辞 | 该措辞源自本地 review-2 汇总，**不是**原评审主张；模型的反驳（互斥性证明）成立，AC-5d 采用 **0.6 m** | 接受 |
| H-4 | WebGL1 分支要求 `ANGLE_instanced_arrays` | 未实证（只有 SIMULATION） | **PR-3 设备支路必须覆盖两种 WebGL1 设备；P16 出口，用户真机** |
| H-5 | R-10 顺带把围巾锚点上移、颈碰撞球移位 | 属修复副作用 | **PR-8 覆盖新几何** |
| H-6 | `playwright` 锁 `1.48.2` | UD-4 未指定版本 | 批准时确认 |
| H-7 | 正文 §5.6 写 `docs/remote/TASK-002/impl-notes.md` | 规范包就在该目录 | **路径一致，无需映射**：impl-notes 建在 `docs/remote/TASK-002/impl-notes.md` |

## 7. 批准后的工作方式（review-3 建议，本地采纳）

- **冻结 master plan + 按包派生任务书**：master plan 保持唯一权威；每个 P0–P16 任务书只摘录本包依赖、允许文件、接口与出口门禁；
- 任务书只**引用**不可变编号（M/UD/ADR/AC/S/PR/P），不重新解释、不改写；
- 遇到 MUST/验收冲突 → 按 §5.6 升级，不由实施者猜测。
