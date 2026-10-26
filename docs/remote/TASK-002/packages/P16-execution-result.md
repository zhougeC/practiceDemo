# TASK-002 P16 最终门禁执行结果（`packages/P16-execution-result.md`）

> 派生自 **`plan.md`**（含 `AMD-P0-001` / `AMD-P4-001` / `AMD-P8-001` / `AMD-P10-001`，ADR-21…39 已应用）与本轮主 agent 指派。
> 只引用不可变编号（M/UD/ADR/AC/S/PR/P/Q），不重新解释、不改写任何阈值；与 `plan.md` 冲突时以 `plan.md` 为准。
> 工作树 `/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`）；**未提交、未推送**。
> 本轮**只执行门禁、只做比对**：**零代码改动、零阈值改动**（源码哈希见 §1.2，运行前后逐字节一致）。

## 0. 结论（一句话）

在**已稳定、未改动的代码**上重跑两套全量门禁各一次：在线 `PW_HEADLESS=1 node app.mjs` → **exit 0 / 32/32 PASS / 353 s**；
离线 `TASK002_OFFLINE=1 node app.mjs` → **exit 0 / 32/32 PASS / 353 s**；`failures=[]`（两套均空）；
Console error 只有 `p1-vendormissing` 那条**故意**制造的 `ERR_FILE_NOT_FOUND`（由 `expectedResourceErrors=1` 精确计数），
非 file 请求 **0**，warning 每轮 **2 条**且都是已记录的 `Q-02`（`p8-ocean-gl1` + `p9-gl1` 各一条 `WebGL 1 deprecated`）；
selfcheck **271/271**、代码行 **4,770 / 5,600**、30 s 视频**存在且达判据**（在线录制墙钟 33.62 s、容器 37.16 s / 929 帧 / 1280×720）；
14 条成就用隔离证据目录补跑一次，**14/14 真实解锁**。
与 `EVIDENCE-NOTE.md` 和 `P13-P16-execution-result.md` 的既有读数逐项比对：**全部判据值仍在阈值内，无功能回归**；
数值差异全部是渲染/时钟抖动的量级（详见 §4，逐条列出，未做任何平滑或合并）。

## 1. 运行环境与不可变输入

### 1.1 环境

| 项 | 值 |
|---|---|
| 主机 | macOS 15.1 / Apple M4 Pro / arm64 |
| Node | v18.19.0 |
| Playwright | 1.48.2 |
| Chromium（bundled） | 130.0.6723.31（`~/Library/Caches/ms-playwright/chromium-1140`） |
| 页面加载方式 | `file:///Applications/WorkStudio/GitHub/claude-test-opus55/index.html`（非 file 请求判据不变） |
| 证据根目录 | `~/.evidence/task-002/`（本轮新目录：`final-gate/`） |

### 1.2 源码快照（运行前 / 运行后逐字节一致）

`sha256(前 16 位) / 物理行`；运行前后的 `source-hashes-{before,after}.txt` **diff 为空**。

| 文件 | sha256 前 16 | 行 |
|---|---|---|
| `index.html` | `1b644b61712d59d7` | 84 |
| `css/style.css` | `e97cdd4a03794236` | 156 |
| `js/audio.js` | `b799d3bd9cd02b25` | 491 |
| `js/debug.js` | `d7a8e0f2332b8e58` | 580 |
| `js/hud.js` | `2cf69aac10f03948` | 358 |
| `js/main.js` | `6d6600489a233bba` | 368 |
| `js/core/config.js` | `c41b86b8bf52227f` | 432 |
| `js/core/quality.js` | `3640aa5435237a15` | 163 |
| `js/render/camera.js` | `0fea05728c5e35b8` | 411 |
| `js/render/scene.js` | `f5941d37242c3134` | 265 |
| `tests/selfcheck.js` / `.html` | `a8f947a0dbb869a2` / `4dda9d14788783ea` | 1867 / 42 |
| `tools/e2e/app.mjs` | `7da1aae7ff3faf67` | 3449 |
| `tools/e2e/adr34-projection.mjs` | `74791161ba85f454` | 209 |

与 `P13-P16-execution-result.md` §1 记录的哈希**完全一致** → 代码处于该包交付状态，本轮为纯门禁复核。

## 2. 执行记录（真实命令、真实退出码）

| # | 命令 | 退出码 | 墙钟 | 结果 |
|---|---|---|---|---|
| 1 | `cd tools/e2e && PW_HEADLESS=1 node app.mjs` | **0** | **353 s** | `PASS all 32 application scenarios`；`summary={pass:32,fail:0}`；`failures=[]` |
| 2 | `cd tools/e2e && TASK002_OFFLINE=1 PW_HEADLESS=1 node app.mjs` | **0** | **353 s** | `PASS all 32 application scenarios`；`summary={pass:32,fail:0}`；`failures=[]` |
| 3 | `TASK002_ONLY=p11-ach-play PW_HEADLESS=1 TASK002_EVIDENCE_APP=…/final-gate/achplay-rerun node app.mjs` | **0** | **91 s** | 1/1 PASS；**14/14 成就解锁**（补跑用隔离目录，**不覆盖**报告 1） |
| 4 | `node tools/e2e/adr34-projection.mjs` | **0** | 45 s | dx=23/y=0.6 三车道 **47.7 / 66.2 / 75.0%**（与既有记录 47.71/66.20/75.03 一致） |

`app.mjs` 的 `skippedLong` 两套均为 `['p6-scarf-10min','p11-ach-play']` —— 这是脚本按设计跳过的两条长跑用例，
不是失败；其中 `p11-ach-play` 由第 3 行单独复验。

### 2.1 32 个场景逐条结果（在线；离线同名同序，全部 PASS）

`selfcheck`、`build-greps`、`build-lines`、`p1-running`、`p1-nowebgl`、`p1-vendormissing`、`p3-input`、`p4-riding`、
`p1-runtime-retry`、`p1-store-throws`、`p1-ctxlost-8s`、`p5-character`、`p5-framing`、`ac1b-ribbon-diff`、
`ac1b-glasses-geometry`、`p6-scarf-shot`、`p7-sky`、`p8-ocean`、`p8-ocean-gl1`、`p9-fish`、`p9-hud`、`p10-cameras`、
`p10-screens`、`p10-s7`、`p10-s11`、`p11-achievements`、`p12-autopilot`、`p9-gl1`、`p13-audio`、`p14-quality`、
`p15-touch`、`p16-integration`。

**Failures：无。**（两套报告的 `failures` 均为 `[]`，`results[].ok` 全 true。）

### 2.2 Console / Network（§5.4 第 2 条）

| 判据 | 在线 | 离线 | 说明 |
|---|---|---|---|
| 非 file 请求总数 | **0** | **0** | 逐场景断言 `non-file requests: []` |
| error 级 + pageerror 总数 | **1** | **1** | 仅 `p1-vendormissing` 的 `Failed to load resource: net::ERR_FILE_NOT_FOUND`（file://…/vendor/three.min.js）。该场景用 `expectedResourceErrors=1` 精确计数，任何多余 error 仍判失败 |
| 其余 31 个场景 error/pageerror | **0** | **0** | — |
| warning | 2 条 | 2 条 | 仅 `p8-ocean-gl1` 与 `p9-gl1` 的 `THREE.WebGLRenderer: WebGL 1 support was deprecated in r153…`（`Q-02`，既有记录；无新 warning 类别） |

## 3. 关键指标 vs 既有记录（逐项、原值，不做合并）

“既有记录”有两个来源，**它们是不同次运行，数值本身不完全相同**，本文不把它们合并成单一"旧值"：

1. **文档记录**：`EVIDENCE-NOTE.md` + `packages/P13-P16-execution-result.md` §3 的正文数值
   （如 S3b 3232/384/141/84、总 4207；音频 14.57 s；降级 4.515 s；视频 33.57 s / 4,505,739 B）。
   该次运行的 `app-gates.json` 已被单场景跑覆盖，**原始 JSON 不可用**，只剩正文数值。
2. **对照报告**：`~/.evidence/task-002/final-gate/preserved/app-gates-offline.before-rerun.json`
   —— 重跑前备份的上一次全量离线报告原始 JSON（如 S3b 3227/385/141/84、总 4203；音频 14.487 s；
   降级 4.611 s；视频 33.575 s / 4,482,456 B）。

两者之间的差异（例如 S3b 4207 vs 4203）**本身也是运行抖动**，不是文档写错。下表"既有记录"列先给文档值，
差异分析（§4）对被点名指标同时列出两个来源的原值。

### 3.1 判据类（必须一致，全部通过）

| 指标 | 既有记录 | 本轮在线 | 本轮离线 | 结论 |
|---|---|---|---|---|
| selfcheck | 271/271 | **271/271** | **271/271** | 一致 |
| 应用场景 | 32/32 | **32/32** | **32/32** | 一致 |
| 代码行（ADR-31） | 4,770 / 5,600 | **4,770 / 5,600** | **4,770 / 5,600** | 一致 |
| ADR-34 真实相机位置 | `(22.9990, 0.60005, −21.9991)`, FOV 40, near 0.1 | `(22.99902288, 0.60005310, −21.99908534)`, **FOV 40 / near 0.1** | `(22.99902288, 0.60005310, −21.99908534)`, **FOV 40 / near 0.1** | 一致（与对照报告逐分量差 ≤3.91e−7 m） |
| **ADR-34 海面占比（S3a 下半）** | **65.32%**（门槛 ≥40%） | **65.319444%** | **65.319444%** | 一致（逐位相同） |
| ADR-34 车心 ndc | `(0.2326, 0.0344)` | `(0.2326365, 0.0344438)` | `(0.2326365, 0.0344437)` | 一致 |
| ADR-34 车高 px | 94.43（门槛 ≥90） | **94.4294** | **94.4294** | 一致（差 1.8e−5 px） |
| **S3b 合格光斑数** | 4 | **4** | **4** | 一致 |
| **S3b 各光斑差分 px** | 3232 / 384 / 141 / 84 | **3202 / 374 / 141 / 85** | **3204 / 375 / 141 / 85** | 每个 ≥1（判据），差异 −0.9%…+1.2%（§4.2） |
| **S3b 差分总数** | 4207（既有）/ 4203（对照报告） | **4182** | **4179** | 差异 −0.6% / −0.5%（§4.2） |
| **S7 飘带差分 px** | 450 | **450** | **450** | **逐位相同** |
| S7 bbox | `(927,386)–(1083,415)` | **相同** | **相同** | 一致 |
| S7 稳态 camMode / tris / calls | 4 / 40,518 / 52 | **4 / 40,518 / 52** | **4 / 40,518 / 52** | 一致 |
| **音频 BPM 到 144 用时** | 14.57 s（≤26 s） | **14.496 s** | **14.402 s** | 差异 −0.5% / −1.2%（§4.4） |
| 音频 BPM 序列 | 72→132→144 单调 | `72,72,72,132,132,144` | 同 | 一致 |
| 音频解锁状态 | running / ctx running | 同 | 同 | 一致 |
| 仓库音频文件 | 0 | **0** | **0** | 一致 |
| **画质降级用时/等级** | 4.515 s → L1（≤4.85 s） | **4.607 s → L1** | **4.580 s → L1** | 差异 +2.0% / +1.4%（§4.5） |
| **画质恢复用时/等级** | 10.548 s → L2（≥9.5 s） | **10.503 s → L2** | **10.557 s → L2** | 差异 −0.4% / +0.1% |
| L0 应用值 | DPR 0.75 / 12,678 tris / 52 calls / 逐顶点 | **相同** | **相同** | 一致 |
| **触屏按钮数/尺寸** | 9 个：72,72,64×4,56×3 | **9 个：72,72,64×4,56×3** | **相同** | 一致（逐像素 rect 相同） |
| 触屏 s8/s9 迁移差分 | 0 px | **0 px** | **0 px** | 一致 |
| **14 条成就** | 14 行面板；14/14 全流程 | 面板 **14 行**、`x/14` | 同 | **14/14 真实解锁**（§2 第 3 行） |
| **30 s 视频存在/时长** | 33.57 s / 4,505,739 B | **33.62 s 录制 / 4,494,218 B**；容器 **37.16 s / 929 帧 / 1280×720** | **33.597 s / 4,509,362 B**；容器 **37.24 s / 931 帧 / 1280×720** | 差异 +0.15% / −0.25%（§4.7） |
| 视频判据 | ≥28 s、>100 KB、0 error、AUTO 接管后被打断 | **全 PASS**（`apBefore=false, apOn=true, apOff=false`） | 同 | 一致 |
| 性能读数 | fpsWin≈60 / tris 40,518 / calls 52 / L2 / DPR 1 | **59.99999999999997 / 40,518 / 52 / L2 / 1** | **60.00393468424159 / 同** | 一致 |
| ctxlost 8 s 按钮 | 8,011.8 ms | **8,019.2 ms** | **8,022.7 ms** | 差异 +0.09% |
| 离线运行（页面内）| running，0 非 file 请求 | **running / 0** | **running / 0** | 一致 |
| GL1 能力路径 | glVersion 1、非 WebGL2、渲染正常、0 error | **1 / false / 40,518 tris / 0** | 同 | 一致 |
| 构建 grep（TODO/STUB、M-22、GLSL precision、RawShaderMaterial） | 全 0 命中 | **全一致**（`glslPrecision:""`, `rawShader:""`, `literal:"1"`, `valueScan:"0"`） | 同 | 一致 |

### 3.2 ADR-34 独立复算（`adr34-projection.mjs`，本轮重跑）

| 配置 | 既有记录 | 本轮 |
|---|---|---|
| dx=23, y=0.6（现行） | 47.71 / 66.20 / 75.03% | **47.7 / 66.2 / 75.0%** |
| dx=21, y=0.6, lane −2.5 | 26.2% | **26.2%** |
| dx=23, y=1.6, lane −2.5 | 23.8% | **23.8%** |

纯几何脚本（不启动浏览器、不读应用源码），结果与既有记录一致。

## 4. 数值差异清单（逐条原值，未做任何平滑/合并/四舍五入冒充一致）

> **方法**：把两份新报告与备份的既有报告做**全叶子递归差分**（1423 个叶子），并按“同一代码三次独立运行”的
> 抖动分布判定差异性质：`final-gate/deep-diff-*.txt`、`stability.py`。**1423 个叶子里 1128 个三次运行完全相同**；
> 会变的叶子集中在帧时钟、渲染像素统计与 fps 窗口。以下只列主 agent 点名的指标。

### 4.1 ADR-34 海面占比 / 车高 / 车心 ndc — 无实质差异

- `seaLowerPct`：既有 **65.31944444444444** → 本轮在线 **65.31944444444444**、离线 **65.31944444444444**（**逐位相同**）。
- `carPx`：既有 `94.42939933907856` → 在线 `94.4294174967225`、离线 `94.42943678859268`（相对差 **1.9e−7 / 4.0e−7**，远小于 0.01 px 的可显示精度）。
- `ndc.x/y`：相对差 **1.4e−8 / 1.8e−7**。**属相机指数阻尼在浮点末端的收敛残差，非实现变化。**
- `warmPx`（S3a 暖色像素数，**仅作旁证，不作为判据**；ADR-35 已把围巾取色移到 S1）：既有 **88** → 在线 **86**、离线 **86**。
  **−2 px 是真实差异**，但该读数**没有任何断言**（`check()` 全集里未出现）、不参与 PASS/FAIL；
  本轮两轮互相一致（86/86），**根因未定位**（[INFERENCE] 属逐像素颜色阈值在帧相位变化下的边界抖动）。

### 4.2 S3b 路灯差分 — 差异 −0.5%，仍远超每个光斑 ≥1 px 的判据

| 光斑（深度 m） | 既有 | 在线 | 离线 |
|---|---|---|---|
| 25.2 / 25.4 / 25.3 | **3232** | **3202** | **3204** |
| 55.1 / 55.2 | **384** | **374** | **375** |
| 84.9 / 85.0 | **141** | **141** | **141** |
| 114.7 / 114.9 | **84** | **85** | **85** |
| 合计 | **4207 / 4203** | **4182** | **4179** |

**差异性质**：三份报告里路灯本体的 z 坐标整体相差 **0.13–0.14 m**（例：`−18.61` → `−18.75`；离线 `−18.74`），
而 v=8、60 Hz 的一帧位移正是 `8/60 ≈ 0.133 m` —— [INFERENCE] 即“冻结帧落在相邻一帧”。
一帧的路灯偏移会改变光斑圆片被采样的像素集合，因此差分计数在 ±1% 内浮动。深度值也随之一并变化
（25.2→25.4、114.7→114.9），同源。**这是对现象的定量解释，不是实测的帧号对齐**。
**判据（每个合格圆片 diff≥1、总数>0）全部满足，无回归。**

### 4.3 S7 飘带差分 — 完全一致

`ribbonDiffPx` **450 / 450 / 450**，`bbox` 三份完全相同。`steady.scarfAngle` 差 1.5e−13 度、
`scarfLagX` 在 1e−16 量级（浮点零），`scarfResets=0`。**无差异。**

### 4.4 音频 BPM 计时 — 差异 ≤1.2%，远低于 26 s 门槛

既有 **14.57 s**（对照报告 14.487 s）→ 在线 **14.496 s**、离线 **14.402 s**。
序列末尾三点：在线 `(132, 13.984) → (132, 14.237) → (144, 14.493)`；离线 `(132, 13.884) → (132, 14.141) → (144, 14.399)`。
**单调不减、≥140 达成、远快于 26 s。** 差值来自 rpm→bpm 采样点的帧相位。

### 4.5 画质升降计时 — 差异 ≤2%，均在判据窗口内

| 量 | 既有 | 在线 | 离线 | 判据 |
|---|---|---|---|---|
| 降级到 L1 用时 | 4.515 s | **4.607 s** | **4.580 s** | ≤4.85 s |
| 降级时 fpsWin | ≈39 | **39.0000** | **38.3632** | — |
| 恢复 L2 用时 | 10.548 s | **10.503 s** | **10.557 s** | ≥9.5 s |
| 恢复时 fpsWin | 60 | **60.0039** | **60.0000** | — |

降级/升级各是“1.5 s 坏窗口 ×2”“10 s 冷却 + 5 好窗口”的整数窗口边界，抖动上限就是一个 1.5 s 窗口的相位，
实测偏差 ≤0.09 s。**等级切换结果（L2→L1→L2）三份完全一致。**

### 4.6 触屏计数 — 完全一致

9 个按钮，rect 逐像素相同：`left/right` 72×72、`throttle/brake/jump/wing` 64×64、`camNext/mute/achList` 56×56，
全部 `inView=true`；`coarse=true`、`visible=true`；S8/S9 迁移前后差分 **0 px**。**无差异。**

### 4.7 30 s 视频 — 每轮一个新的真实文件（不是同一文件的重报）

| 归属 | 文件 | 字节 | sha256 | 容器时长 | 分辨率 | 帧率 | 帧数 |
|---|---|---|---|---|---|---|---|
| 在线 | `65e40f7da3c908a29dad56b4a24e890a.webm` | 4,494,218 | `16b301f3a0bdc7f84d78973ce42f04ff4baac90f4f155826ebdbdc09685399f3` | **37.16 s** | 1280×720 | 25/1 | **929** |
| 离线 | `109e02223c069f47d58be218212bc6bf.webm` | 4,509,362 | `b6d16423534675da9073ead8e8889f661f0859d1e53828779af07538594124f9` | **37.24 s** | 1280×720 | 25/1 | **931** |

- 判据是**录制墙钟 ≥28 s**：在线 **33.62 s**、离线 **33.597 s**（既有 33.57 s），差 **+0.15% / +0.08%**。
- 容器时长 37.16/37.24 s 比录制墙钟长约 3.5 s —— Playwright 的 `recordVideo` 覆盖 context 生命周期
  （含 `goto` 前的空档与关闭收尾），帧数/时长由容器给出，**两者不可混为一谈**（§3.1 已分别列出）。
- 字节数 4,494,218 / 4,509,362 vs 既有 4,505,739（P13-P16 记录）/ 4,482,456（对照报告）：
  VP8 是可变码率编码，**每次录制字节必然不同**；同一轮的 `timeline` 三项 `apBefore/apOn/apOff` 三份一致。
- **P13-P16 文档记录的 4,505,739 B 仍可在磁盘上核对**：对应
  `video/f6e6b04d0bbdec7e13b5b03e63e60f86.webm`（4,505,739 B、容器 37.24 s、931 帧）；
  对照报告的 4,482,456 B 对应 `video/bb66234a14f87d1532f40ab17d2ace59.webm`（容器 37.04 s、926 帧）。
  即**旧视频文件未被覆盖**，可与文档数值逐一对应。

### 4.8 其他会变但不参与判据的读数（一并列出，避免"看起来都一样"）

| 读数 | 既有 | 在线 | 离线 | 说明 |
|---|---|---|---|---|
| `p4-riding.riding.fps` | 53 | **49.295** | **50.167** | p4 段**没有任何 fps 断言**（已核对 `check()` 全集）；此读数是当时 `stats().fps`。整体性能门禁在 p14/p16，两处都是 60 |
| `S6.foamBands` | 10 | **11** | 10 | 判据 ≥2；每像素亮度极大值计数，随冻结帧相位变化 |
| `S12.maxRowMean` | 0.2364 | **0.3019** | **0.2720** | 判据 ≤3/255；同为逐行像素统计抖动 |
| `ac1b-ribbon-diff.ribbonOnlyPx` | 410 | **427** | **429** | 判据 ≥150；差 +4%…+5% |
| `p5-framing.regions.sea.relief` | 0.6671 | 0.6697 | 0.6699 | 无阈值，构图旁证 |
| `p8-ocean.glsl.maxErr` | 4.5e−7 | 4.48e−7 | 8.17e−7 | 判据为容差；CPU/GPU 波形一致性读数 |
| `p9-gl1.fishMeshErr` | 5.8e−8 | 2.2e−8 | — | 判据为容差 |
| 截图 PNG 字节数 | — | 每轮不同 | 每轮不同 | 见 §5：两次全量运行写同一目录，**同名文件被后一轮覆盖** |

**结论：不存在任何“既有读数在本轮跌破阈值”的情况；上述差异全部是帧相位/像素统计/可变码率编码的量级。**

## 5. 证据清单（manifest）

完整清单：**`~/.evidence/task-002/final-gate/MANIFEST.md`**（含每个文件的 sha256/字节；视频另含容器时长、
分辨率、帧率、帧数；截图另含“磁盘现值 vs 在线报告 vs 离线报告”三列对照）。

### 5.1 本轮新产出的报告与日志

| 文件 | 字节 | sha256 |
|---|---|---|
| `~/.evidence/task-002/implementation/app/app-gates.json`（在线 32 场景） | 59,227 | `91f05604f36ac893399409b450396e351198eaaf98de22f9ddcf1305e9192b27` |
| `~/.evidence/task-002/implementation/app/app-gates-offline.json`（离线 32 场景） | 59,346 | `8dfdc3c4f36375f5b3b6185ccf15e250e52174d4d0c3b27d81483ed04de13e0a` |
| `~/.evidence/task-002/final-gate/achplay-rerun/app-gates.json`（14 成就） | 1,574 | `7443d828f9354c8831e0aaa05636084cf5f2f276038eee9f2590f3926977cbec` |
| `~/.evidence/task-002/final-gate/run-{online,offline,achplay}.log` / `.exit` | 886/894/136 | 见 MANIFEST §A |

**覆盖前的原始证据已备份**（未删除、未改写）：`final-gate/preserved/` 下有 `app-gates.before-rerun.p11-ach-play.json`、
`app-gates-offline.before-rerun.json`、`manifest.before-rerun.{json,md}`。

### 5.2 截图归属（重要，含一处证据损失）

`shot()` 写固定目录 `~/.evidence/task-002/implementation/P9-P12/screens/`，**两次全量运行写同一批文件名**，
且 `manifest.json` 也是每轮结束时**整体重写**。因此：

- **磁盘现值 = 后跑的离线运行的字节**（`manifest.json` 的 `generatedAt = 2026-10-26T00:58:11Z`，与离线运行结束时刻一致）；
- **在线运行的截图哈希只有 13 张留得下来**——即 `app-gates.json` 的 `results[p10-screens].screens[]` 内嵌的那 13 张；
  其余 14 张（S7×5、S11×2、S8-p11、S10、S9/S8/S8/S9-p15 共 5 张）在在线报告里**只留下路径、没有哈希**，
  且在线那轮的 `manifest.json` 已被离线运行覆盖 → **这 14 张的在线哈希本轮不可恢复**。这是证据损失，如实记录。

逐张对照见 MANIFEST §C：

- `P9-P12/screens/` 27 张（S2/S3a/S3b/S4a-c/S5/S6/S7×5/S8×3/S9×3/S10/S11×2/S12/S13/S14）：
  磁盘 27/27 与**离线运行**的 `manifest.json` 一致；其中 13 张同时与离线报告的嵌入哈希一致。
- `app/screens/` 16 张（S1×2/S2/ac1b×2/p1×6/p4/selfcheck/scarf×2）：其中 **14 张**由离线运行本轮写入（mtime 08:52–08:53）；
  **`scarf-ribbon-{with,hidden}.png` 两张是 2026-10-25 13:35 的旧文件**——当前 `app.mjs` 已不再写这两个文件名
  （`grep -c "scarf-ribbon" tools/e2e/app.mjs` = 0），它们**不是本轮的现场证据**，不得当作本轮产物引用。

### 5.3 运行后进程/服务核查

- Playwright/Chromium 测试进程：**0 个残留**（`ps` 无 `ms-playwright`、无 `app.mjs`）。
- 测试期间未启任何本地 Web 服务（全部走 `file://`）。
- 唯一监听的 node 是**与本任务无关的既有进程** `PID 22582 vue-cli-service: serve`（`~/.codex/worktrees/b7e1/trunk/elpis-adminui2`，
  启动于 10-25 18:51，早于本任务），**不是本轮产生，未处理**。

## 6. 与派单要求的偏差 / 需要主 agent 知道的三点

1. **在线运行的截图字节已被离线运行覆盖，且 14 张在线哈希不可恢复。** 这是 `app.mjs` 的既有行为
   （两套运行共用 `EVIDENCE/screens`、`P9-P12/screens` 与同一个 `manifest.json`），不是本轮改动；
   本轮按要求**没有修改代码**去改路径。后果精确地是：
   - 13 张（p10-screens 的 S2/S3a/S3b/S4a-c/S5/S6/S12/S13/S14）——在线哈希内嵌在 `app-gates.json`，**可核对**；
   - 14 张（S7×5、S11×2、S8-p11、S10、S9/S8/S8/S9-p15）——在线报告里**只有路径没有哈希**，
     在线 `manifest.json` 又被离线运行整份重写 → **这 14 张在线轮的哈希本轮无法再提供**。
   - 若要让两套 PNG 并存，需要给其中一轮换 `TASK002_EVIDENCE_*` 目录（属工具改动，需另行授权）。
2. **截图 manifest 的 `setting` 文字有两处与真实机位不符**（既有缺陷，本轮未改，因为改动属于 `tools/e2e` 工具代码）：
   - `S7-side-scarf-v8-p10.png` 写作 `mode=1`，实际 `steady.camMode = 4`（ADR-34/36 已把 S7 改 mode 4）；
   - `S13-wheelie-beak-p10.png` 写作 `mode=1`，实际代码走 `setOrbit(...)` → `PB.camera.setMode(4)`（ADR-34 同样改 mode 4）。
   两张图的**像素证据与判据不受影响**（S7 判的是围巾形态，S13 判的是调试框锚点），但 **manifest 文字是错的**，
   建议下一轮单独修这两条字符串。
3. **`video/` 目录里历史视频累积**（7 个文件，含本轮 2 个）。本轮未删除任何旧文件（删除证据需授权），
   只按字节数把历史文档数值对应到具体文件（见 §4.7）。

## 7. 未做 / NOTVERIFIED（不得表述为 PASS）

| 项 | 状态 | 说明 |
|---|---|---|
| S3a/S3b/S7/S11/S13/S6/S12/S8/S9/S10 的**视觉**判定 | **PENDING-USER-VISION** | 本轮只重跑脚本判据并登记哈希；像素级审美/缺陷判定仍交 `ui-vision` / 用户 |
| AC-9b 听感 | 未验证 | 仅验证链路、BPM 映射、门控、状态机 |
| 真机触屏多点 / 音频解锁（PR-5/PR-6/PR-7） | **PENDING-USER-HARDWARE** | headless 用 CDP 真实触摸事件覆盖 |
| 真实 GPU fps（PR-9） | **PENDING-USER-HARDWARE** | headless 读数 60；集显 ≥55 fps 需真机 |
| PR-3 设备支路（真实 WebGL1 设备） | **PENDING-USER-HARDWARE** | 能力路径（`--disable-webgl2`）本轮再次 PASS |
| AC-2d 10 min 长跑（`p6-scarf-10min`） | 未跑 | 脚本按设计跳过（`skippedLong`），本批不动物理与渲染负载 |
| GC 停顿 <5 ms（M-31） | 未录制 | 需 Performance 面板录制 |
| 离线运行下的**音频解锁** | 未验证 | `TASK002_OFFLINE=1` 只断网，不改变音频子系统 |

## 8. 边界核对

- **无** `git commit` / `git push`（`git status` 仍是既有的 `M .gitignore` + 未跟踪目录，与本轮前一致）。
- **无**代码或阈值改动：运行前后源码哈希 diff 为空（§1.2）。
- **无**付费调用、**无** VPS 操作、**无**系统配置改动、**无**删除既有证据（只新增 `final-gate/` 与备份）。
- TASK-001 工作树 `/Applications/WorkStudio/GitHub/claude-test`：**未写入**（近 20 分钟内 0 个文件变动）。
