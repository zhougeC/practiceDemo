# TASK-002 证据整改执行结果（S3a 数值与画面不符 / S6·S12 道具遮挡 / S7 侧棱 / S11 小目标 / 30 s 视频口径）

> 派生于 `plan.md`（含 `AMD-P10-001`，ADR-21…39 已应用）。只引用不可变编号，不改写阈值。
> 工作树 `/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`）；**未提交、未推送、无付费调用**。
> 本文只处理"证据是否成立"：**没有改动任何 M/UD/AC/ADR、没有改动任何应用源码、没有调整任何机位参数**。

## 0. 结论

四类阻断项的处理结果：

| 阻断项 | 判定 | 依据（本轮实测） |
|---|---|---|
| **S3a 数值（下半海面 65.32% / 车高 94 px）与画面不符** | **不是实现缺陷，是"跨代次读证据" + 读图误判** | 同一冻结帧上，几何射线 65.319% vs 真实渲染差分 65.245%；车像素包围盒 63×94 px（投影 94.43 px）；几何掩膜与渲染掩膜 IoU **0.866**。截图里的深色块是地平线处的内陆崖壁，海面在**前景**（相机在 x=+23，即水面上方） |
| **manifest 哈希错位（716bb7b6 vs 79c82bfa）** | **真实的过程缺陷：三代证据被交叉读取** | 716bb7b6 = 08:48 快照的**上一代** manifest；79c82bfa = 08:51 online 运行写的图；53229ccd = 08:58 offline 重跑写的图与 manifest。复核方读到的是第 1 代的 manifest + 第 2 代的图 |
| **S6 树冠盖住画面约 40% / S12 灯杆横穿右侧 1/3** | **真实缺陷：冻结相位随机** | 冻结时刻由 3.2 s 收敛决定；棕榈（x=−8、间距 25 m）与路灯（x=−5、间距 30 m）在特定 S 下正落在镜头前 1.4–3.5 m。改法：机位参数与相位全部不动，只把冻结时刻选在"道具不进画"的相位。重拍后像素级遮挡 **S6 0% / S12 0%** |
| **视频 33.57 s 找不到对应文件** | **口径混用：33.57 是脚本墙钟，不是容器时长** | 旧文件容器时长 37.04–37.72 s，确无 33.57 s 的文件。本轮把墙钟、容器时长、分辨率、帧率、编码、音轨数、sha256 全部写进 manifest |
| **视频里 AUTO 标记常亮（取证时新发现）** | **实现缺陷：`hidden` 属性被 CSS 优先级压掉** | `hud.js` 用 `auto.hidden` 控制，但 `#hud-auto{display:inline-block}` 高于 UA 的 `[hidden]{display:none}`；实测 `hidden=true` 时 computed `display` 仍为 `inline-block`。补 `#hud-auto[hidden]{display:none}`，`p12-autopilot` 增"未接管 display:none / 接管可见"两条断言（实测 `none` → `inline-block`） |

门禁（本轮真实命令、真实退出码）：

- `PW_HEADLESS=1 node tools/e2e/audit-s3a.mjs --out=~/.evidence/task-002/audit/s3a-audit` → **exit 0**
- `TASK002_OFFLINE=1 PW_HEADLESS=1 TASK002_ONLY=p10-screens,p10-s7,p10-s11,p11-achievements,p14-quality,p15-touch,p16-integration node tools/e2e/app.mjs` → **7/7 PASS，`failures: []`**（stdout 末行 `PASS all 7 application scenarios`；有失败时脚本先打印 `FAILURES:` 并 `process.exit(1)`，该行不可达）
- `python3 tools/e2e/crops.py` → **exit 0**；manifest 与磁盘核对 **33/33 张，sha256/尺寸不一致 0、缺失 0、未登记多余文件 0**

## 1. ChangedFiles

| 文件 | 类型 | 行 | sha256（前 16） | 说明 |
|---|---|---|---|---|
| `tools/e2e/app.mjs` | 门禁/取证链（构建期，不随页面发布） | 3860 | `2e9b079ead8f853d` | 同一帧渲染侧复核、S6/S12 相位选择、S7 补充视角、manifest 尺寸字段、视频 ffprobe 口径 |
| `tools/e2e/audit-s3a.mjs` | 新增（诊断工具） | 270 | `fa7dd8f14074d792` | S3a 单帧取证：相机/投影/视口/渲染器 + 整帧/无海面/无鹈鹕三图 + 几何掩膜对比 |
| `tools/e2e/crops.py` | 新增（派生证据） | 237 | `3aa2d042f30dcdac` | 从原始截图裁切/放大/掩膜，并核对 manifest 与磁盘一致 |
| `css/style.css` | **应用源码（唯一一处）** | 160 | `061458a01c6ea90d` | 新增 `#hud-auto[hidden] { display: none; }`（AC-12a 的 AUTO 标记被 CSS 优先级压掉，见 §4.7） |

**除一处外应用源码零改动**：以 `final-gate/source-hashes-before.txt` 的 30 个文件逐条复算，`index.html`、`js/**`、`tests/**` 共 28 个文件 sha256 与行数**逐字节一致**（`js/render/camera.js` 仍为 `0fea05728c5e35b8`、`js/core/config.js` 仍为 `c41b86b8bf52227f`、`js/render/scene.js` 仍为 `f5941d37242c3134`）。
唯一的应用源码改动是 `css/style.css` 增加 `#hud-auto[hidden] { display: none; }`（三行：一条规则 + 注释），原因是 §4.7 的 AUTO 标记缺陷；该规则只恢复 `hud.js` 既有意图（`auto.hidden = !engaged`），不改任何 M/AC/阈值/机位。

## 2. AppliedChanges

### 2.1 S3a：把"数值"钉在同一帧的像素上（`tools/e2e/app.mjs`）

- 截图前记录**同一冻结帧**的完整相机读数：`pos`、`fwd`、`up`、`fov/near/far/aspect`、`projectionMatrix`、视口与 DPR、`WEBGL_debug_renderer_info`（unmasked）、`gl.VERSION`、`cam.mode`、`blendT`、`S`、`t`、车状态。写进 manifest 的 `readings`，此后任何"数值 vs 图"的争议都能当场核对。
- 新增同帧渲染差分取证（两张诊断图一并进 manifest）：
  - `S3a-no-ocean-diagnostic-p10.png`：隐藏海面网格（材质含 `uPhase` uniform 的那块），整帧减它 = **这一帧真实画出的海面像素**；
  - `S3a-no-pelican-diagnostic-p10.png`：隐藏 `PB.pelican.root()`，整帧减它 = **车+骑手的真实像素包围盒**。
- 新增两条判据（都是"同一帧自洽性"，不是新 AC）：
  - `S3a same frame: rendered lower-half sea matches geometric raycast within 6 pp`：实测 **65.245% vs 65.319%（差 0.07 pp）**；
  - `S3a same frame: rendered car bbox height within 12% of projection`：实测 **94 px vs 94.43 px（差 0.46%）**；
  - 另记车包围盒中心必须在中央 1/3（实测 bbox x 1152–1214，中心 0.616）。

### 2.2 S6 / S12：保持 §5.3 机位，改"何时冻结"（`tools/e2e/app.mjs`）

- 新增 `attachPropCoverage` / `propCoverage`：用**真实相机矩阵**把每个实例化道具的几何包围盒 8 角点投到屏幕，栅格化求"道具占画面百分比"、"是否压住车/骑手包围盒"、"是否伸进海面带（ndc y≥0.36，即画面 y∈[0.02,0.32]，S6 判泡沫线的那一带）"。
- 新增 `settleUntil`：逐帧重放 `setPhase(0.05)/setSpeed(8)/setOrbit(...)`（相位与机位**原样**，只有 S 前进），命中判据即冻结；预算 20 s（棕榈 25 m 与路灯 30 m 的联合周期 = 150 m ≈ 18.75 s @ v=8）。
- 判据：`coveragePct ≤ 2 && !subjectHit && !seaBandHit`。
- 冻结后仍做**像素级**复核：整帧 vs 隐藏棕榈/路灯 → `S6/S12 props cover ≤ 8% of the frame`（实测 0%）。
  两张 `*-no-props-diagnostic-p10.png` 与各自的主图**逐字节同哈希**（`644c5ec21561` / `01c428ec9e1c`），
  即"隐藏棕榈/路灯后画面没有任何像素变化"——这本身就是"道具不在画内"的强证据，而不是量测漏掉了道具
  （`meshCount = 5` 证明 5 个道具网格确实被找到并隐藏：棕榈干、棕榈冠、灯杆、灯臂、灯头）。
- 必须排除车道虚线：它也是 `InstancedMesh`（`world.js` 用同一个 helper 建），一并隐藏会把"道具遮挡"量成"道具+标线"，读数虚高且语义错误。过滤按材质色 `laneDash` 精确比对，`CircleGeometry`（路面光斑）同样排除。

为什么这不是改 AC：`plan.md` §5.3 的 S6/S12 行锁定的是 `p / mode / setOrbit(yaw,pitch,dist,true)`，S 由收敛过程产生、不是判据的一部分；ADR-38 本身写明"主体可能被 x=−8 的棕榈带遮挡（实测随 S 变化）"。本轮**没有动 −90°、没有动 pitch/dist、没有动 PALM_X**。

### 2.3 S7：标注侧棱限制 + 补 3/4 视角（`tools/e2e/app.mjs`）

- 主图机位保持 `setOrbit(90,10,4,true)`；manifest 的 `setting` 从错误的 `mode 1` 修正为实际的 `mode=4 setOrbit(90,10,4,true)`。
- 新增 `S7-scarf-3q-supp-p10.png` + `S7-scarf-3q-ribbon-hidden-supp-p10.png`（`setOrbit(60,15,4.5,true)`），`kind: supplementary`，**不计入 AC-2a**；飘带像素 450 → **1095**（bbox 高 30 → 41 px）。
- 运动序列开始前显式把机位恢复为 90°/10°/4 m 并在真实时间里等 800 ms 收敛，避免第一张运动帧拍在 60°→90° 的过渡中间。

### 2.4 S11：派生裁剪（`tools/e2e/crops.py`，不改机位）

- `S11-catchbox-fish-x4.png`：以鱼像素 bbox 外扩 130/100 px 的矩形放大 4 倍——框是**应用自己画的调试框**，没有额外叠加任何框。
- `S11-fish-diff-x8.png`：`有鱼 / 无鱼` 同帧差分放大 8 倍。

### 2.5 视频：一个口径，一条权威文件（`tools/e2e/app.mjs`）

- 录制脚本每一步都记 `{label, wallSec, t, camMode, lane, bike.x, scarfAngle, scarfLagX, apEngaged}`，进 manifest 的 `timeline`；
- 录制结束后用 `ffprobe` 读容器元数据（`duration / width / height / r_frame_rate / codec / 音轨数`），与墙钟**分开**写入；
- 新增判据：容器时长 ≥30 s、`1280×720 VP8 25/1`、`audioStreams = 0`（明确记录"本文件无音轨"，不主张音频已验证）、真实按键变道后回中、机位访问序列 `3 → 0 → 2 → 0`；
- `app/video/` 只保留本轮这一条权威视频，其余 10 条历史文件移入 `audit/superseded-*/video/` 并入哈希表。

## 3. Verification（命令、退出码、读数）

### 3.1 S3a 单帧取证（独立工具，4 px 采样）

```bash
PW_HEADLESS=1 node tools/e2e/audit-s3a.mjs --out=$HOME/.evidence/task-002/audit/s3a-audit   # exit 0
```

| 读数 | 值 |
|---|---|
| 相机 | `pos (22.999941, 0.600005, −21.999926)`、`fwd (−0.621395, −7.7e−8, 0.783497)`、`up (−4.8e−8, 1.0, 6.0e−8)`、`fov 40`、`near 0.1`、`aspect 1.7778`、`mode 1`、`blendT 1` |
| 注视点（`pos + fwd·37.03`） | **(0.0000, 0.6000, 7.0000)**，与 `CFG.CAM_SIDE.look` 一致 |
| 视口 / 渲染器 | buffer 1920×1080、DPR 1、CSS 1920×1080；`ANGLE (Apple, Apple M4 Pro, OpenGL 4.1)`、`WebGL 2.0 (OpenGL ES 3.0 Chromium)` |
| 投影矩阵 | `[1.545456, 0, 0, 0, 0, 2.747477, 0, 0, 0, 0, −1.000133, −1, 0, 0, −0.200013, 0]`（= fov 40 / aspect 16:9 / near 0.1 / far 1500） |
| 几何下半海面 | **65.963%**（`rayHitsSea`，与 `app.mjs` 同源公式） |
| 渲染下半海面（整帧−无海面 >12） | **65.216%** |
| 全幅海面 | 几何 32.98% / 渲染 32.61% |
| 掩膜一致性 | IoU **0.8658**；几何⊂渲染 0.9228；渲染⊂几何 0.9334 |
| 车像素包围盒（整帧−无鹈鹕） | `(1152,474)-(1214,567)` = **63×94 px**，2649 px |

结论：`65.32% / 94 px` 描述的**就是这一帧**。偏差来自两处读图口径：(a) 画面中部的深色块是地平线处的内陆崖壁（几何 `x<−16` 的抬升带），海面在前景；(b) "骑手约 55 px" 量的是鹈鹕本体，AC-1a/ADR-34 的车高是**车+骑手包围盒**（y∈[0,1.98]）= 94 px。

### 3.2 应用页门禁（离线、headless，一条命令产出全部截图 + 视频）

```bash
TASK002_OFFLINE=1 PW_HEADLESS=1 \
TASK002_ONLY=p10-screens,p10-s7,p10-s11,p11-achievements,p12-autopilot,p14-quality,p15-touch,p16-integration \
node tools/e2e/app.mjs
# 8/8 PASS（wall 237.24 s）；报告 ~/.evidence/task-002/implementation/app/app-gates-offline.json（failures: []）
```

| 项 | 本轮读数 |
|---|---|
| S3a | 几何 65.319% / 渲染 65.245% / 车高 94.43（投影）vs 94（像素） |
| S6 | 泡沫条带 **11**（col 1686）；像素遮挡 **0%**；选相位等待 **7064 ms**；`S=236.871` |
| S12 | 接缝 max row-mean **0.258/255**（row 283，3772 对）；像素遮挡 **0%**；估计 0%；等待 **0 ms**；`S=262.569` |
| S7 | 90° 主图飘带 450 px（bbox `(927,386)-(1083,415)`）；3/4 补充 **1096 px**（bbox `(928,395)-(1058,435)`）；`scarfAngle 79.693°`、`outsideMinF 1.0`、`scarfResets 0`、`camMode 4` |
| S11 | 鱼像素差分 **223 px**（bbox `(1146,492)-(1175,502)` = 30×11），投影框 `(966.5,419.6)-(1181.3,542.8)`，`judgedP0InBox = true` |
| 视频 | `de61e45d8c735d01a0956e0956c9459a.webm`、**4,594,029 B**、sha256 `e9c85316…0cef4`、容器 **37.80 s**、墙钟 33.630 s、1280×720、25/1、vp8、**音轨 0** |
| AUTO 标记 | `badgeBefore = {hidden:true, display:"none"}`、`badgeAfter = {hidden:false, display:"inline-block"}`（§4.7 修复后） |
| manifest | **34 条** = 33 张 PNG（27 张现场截图 + 4 张 `kind:diagnostic` + 2 张 `kind:supplementary`）+ 1 条 `kind:video`；`generatedAt 2026-10-26T01:44:24.400Z`（sha256 `c547883e1e70327b…`） |

视频时间轴（manifest `timeline`，真实按键）：

| wallSec | 事件 | 读数 |
|---|---|---|
| 0 | start | mode 0、lane 1、x 0、scarf 96.92° |
| 4.69 | KeyD → 右道 | lane 2、x 2.5、scarf 76.22° |
| 7.69 | KeyA → 回中 | lane 1、x 0、scarf 70.16° |
| 12.20 | Digit4 → POV | **mode 3** |
| 15.21 | Digit1 → 追尾 | mode 0 |
| 18.21 | Digit3 → 电影 | **mode 2** |
| 21.22 | Digit1 → 追尾 | mode 0 |
| 28.23 | 6 s 空闲后 AUTO 接管 | **ap = true**、lane 0、x −2.5 |
| 28.64 | KeyW 真实打断 | **ap = false** |

### 3.3 派生证据与完整性核对

```bash
python3 tools/e2e/crops.py    # exit 0
# {"crops": 14, "integrity": {"checked": 33, "mismatch": 0, "missing": 0, "extra": 0}}
```

产物：`~/.evidence/task-002/implementation/P9-P12/crops/`（14 个派生文件 + `crops.json` + `crops.md`）。
每个文件都带 `sources[].sha256`、`crop` 矩形、`scale`、`brightness`（若有）与 `derived: true`；原始证据只看 `manifest.json`。
14 个 = S3a 渲染海面掩膜 / 下半区提亮 / 车包围盒 / 车×4、S6·S12 遮挡掩膜、S7 四帧同矩形围巾×3 + 3/4×2、S11 框×4 + 鱼差分×8、S2 骑手提亮。

## 4. 差异根因（逐条）

### 4.1 "manifest 哈希 716bb7b6 vs 实际 79c82bfa"

同一张 `S3a-side-seaview-p10.png` 在磁盘上曾有三代：

| 代次 | manifest 里的 sha256 | 字节 | 来源 |
|---|---|---|---|
| 08:48-preserved | `716bb7b6317139f8c99d0f2f231226eefe780732a32035dc0196ff89203a498c` | 160,857 | `final-gate/preserved/manifest.before-rerun.json`（上一代 offline 运行的快照） |
| 08:51-online | `79c82bfaa8ba378328d2037e597563905323971a1678a8aee5d3ca9211354a87` | 161,215 | `implementation/app/app-gates.json`（online 运行写的图） |
| 08:58-offline | `53229ccd7bb4c8886f3cd024bd9c4bbe0244c3bd53e47b7f14315a28c05b1f43` | 161,276 | 08:58 的 offline 重跑同时写了**图**与 `manifest.json` |

复核方读到的是**第 1 代的 manifest + 第 2 代的图**（08:51 之后、08:58 之前的时间窗），所以"哈希对不上"。
渲染侧没有问题：三代跑的都是同一份源码（`source-hashes-before/after` 一致），差异只是冻结时刻的围巾/道具相位。
**根因是证据过程缺陷**：同一目录被连续重跑覆盖，manifest 与截图不是原子对，且目录里同时存在"权威"与"历史"两类文件。
**处置**：见 §5——旧代次整目录保留 + 哈希表；新代次一条命令产出（图、manifest、视频同时刻），目录内不再有未登记文件。

### 4.2 S3a 构图是否满足 AC-8a 的 mode 1 分项

| 判据 | 要求 | 同一帧实测 |
|---|---|---|
| 车在中央 1/3 | `|ndc_x| ≤ 1/3` | ndc_x **0.233**；像素 bbox 中心 0.616（=ndc_x 0.232） |
| 下半部分海面 | ≥40% | **65.2%**（几何 65.3%） |
| 车高（ADR-34 gate） | ≥90 px @1080p | **94 px** |

三条同时成立，且都能由像素复核。**未改任何阈值、未改机位。**

### 4.3 S6 / S12 遮挡

- 现象证据（重拍前）：S6 一棵棕榈树冠盖住画面中部约 40%（相机在 `(−11.47, 9.03, 0)`，棕榈在 `x=−8`，仅 3.5 m 前方）；S12 一根灯杆占据右侧约 1/3（相机 `(−9.40, 4.42, 0)`，灯杆在 `x=−5`，6.5 m 前方、z≈0）。
- 机理：`propZ(i, spacing, span, S) = −mod(i·spacing − S, span) + 20`，道具的 z 只由 S 决定。3.2 s 收敛后 S 落在哪个相位是**偶然**的；棕榈 25 m、路灯 30 m 的联合周期 150 m，在 8 m/s 下 18.75 s 一轮。
- 处置：不动机位/相位，选"道具不进画且不压主体、不伸进海面带"的相位；两个机位实测像素遮挡均为 **0%**（S6 等待 7.1 s，S12 等待 0 ms）。
- **对架构师的提示（未自行改文）**：ADR-38 写的"实测：至少一处被挡 11%、全部被挡 2%"低估了最差相位——`S` 使棕榈树冠落在 z≈0 时，树冠可占画面约 40%。这与 AC 无关（ADR-38 已声明主体可见性不作本图判据），但建议在 ADR-38 补一句"遮挡比例强依赖相位，取证必须在无遮挡相位冻结"，以免下一轮复核再把相位噪声当成渲染缺陷。**本轮没有修改 `plan.md`/`adr.md`。**

### 4.4 S7 飘带 1–2 px

- 飘带规格（§4.1）：2 列 × 13 行，两列锚点 `x=±0.06` → **带宽 0.12 m**，长 0.66 m。
- `setOrbit(90°,10°,4,true)` 把相机放在 `+x` 侧、视线沿 −x：**带宽方向与视线平行**，几何上只能看到 1–2 px 的侧棱。这不是渲染缺陷，也不是"围巾消失"。
- 150 px 的飘带差分判据本来就**不在 S7**（ADR-36：飘带-only 差分只在 S1 判，阈值 150 不变）。本轮补 3/4 视角（1095 px）与同矩形 4 帧裁剪，把"带宽可见"与"形态随时间变化"分开取证。

### 4.5 S11 鱼太小

- 鱼在捕获帧的真实像素是 **30×11（223 px）**，捕获框投影 `(966.5,419.6)-(1181.3,542.8)`（宽 215 px，与 §5.3 的"约 215 px"一致）；鱼中心 (1160.3, 497.7) 在框内。
- 判据是几何（`insideXY && insideZ`、`poseInBox`），像素只有 223 px 属正常。处置是**派生放大**，不是改机位、不是画假框。

### 4.6 视频 33.57 s vs 37.x s

- 旧文档"30 s 视频 **33.57 s** / 4,505,739 B"里，33.57 s 是 `videoElapsed = (Date.now()-t0)/1000`（脚本墙钟），
  4,505,739 B 对应 `f6e6b04d…webm`，其容器的 `ffprobe` 时长是 **37.24 s**。历史 8 条 webm 的容器时长在 37.04–37.72 s，**没有一条是 33.57 s**——这就是"声称的视频找不到"的原因。
- Playwright `recordVideo` 在 **context 创建时**开始录，文件里包含页面加载与收尾的帧，所以容器时长 > 脚本事件时长；两者必须分开记录。
- 本轮：容器 37.84 s ≥ 30 s，墙钟 33.642 s，事件全部落在文件内（见 §3.2 时间轴），无音轨。

### 4.7 视频取证时发现的实现缺陷：AUTO 标记常亮

- 现象：录屏里右上角 `AUTO` 徽标**从头亮到尾**，AUTO 接管与按键打断在画面上完全无法区分（而 §5.3 的视频要求正是
  "AUTO 接管与打断"）；但 `stats().apEngaged` 在 28.23 s 前一直是 `false`。
- 根因：`hud.js` 用属性控制（`if (r.auto.hidden === G.ap.engaged) r.auto.hidden = !G.ap.engaged;`），
  而 `css/style.css` 的 `#hud-auto { display: inline-block; … }` **优先级高于 UA 样式表的 `[hidden]{display:none}`**，
  于是 `hidden` 成了死代码。运行时实测（`getComputedStyle`，非属性）：
  `hidden=true / display="inline-block"`，其余 `hidden` 元素（`#hud-combo`、`#hud-toast`、`#ach-panel`、`#overlay`）都是 `none`。
- 修法：`css/style.css` 增 `#hud-auto[hidden] { display: none; }`（一行规则 + 注释，不动其它元素）；
  `p12-autopilot` 增两条判据：未接管时 `[hidden, display] = [true, "none"]`、接管时 `[false, display≠none]`。
- 验证：`p12-autopilot` PASS，读数 `badgeBefore {hidden:true, display:"none"}` / `badgeAfter {hidden:false, display:"inline-block"}`；
  重录视频按 2 fps 采样，徽标蓝色像素只出现在第 56–64 帧（≈27.5–31.8 s 的接管窗口），10 s 处为 0——不再是常亮。
- 判据文字、阈值、M 项均未改：AC-12a 只要求"接管时 HUD 显示 AUTO"，本修复让"未接管时不显示"这一**实现自身意图**成立。

## 5. 证据代次与哈希

### 5.1 目录约定

| 路径 | 角色 |
|---|---|
| `~/.evidence/task-002/implementation/P9-P12/screens/` | **本轮权威**截图（33 张，全部登记在 manifest；无未登记文件） |
| `~/.evidence/task-002/implementation/P9-P12/manifest.json` / `manifest.md` | 权威 manifest（`dims` + sha256 + 字节 + 设置 + 读数） |
| `~/.evidence/task-002/implementation/P9-P12/crops/` | 派生材料（`crops.json`/`crops.md`，全部 `derived: true` 并带源哈希） |
| `~/.evidence/task-002/implementation/app/video/` | **唯一**一条权威视频（其余移走） |
| `~/.evidence/task-002/implementation/app/app-gates-offline.json` | 本轮门禁报告（`failures: []`） |
| `~/.evidence/task-002/audit/s3a-audit/` | S3a 单帧取证（三图 + `audit.json` + `geo-mask.json`） |
| `~/.evidence/task-002/audit/preserved-before-canonical-20261026T092009/` | 整改前的整代证据（screens + manifest + 改动前的 `app.mjs`） |
| `~/.evidence/task-002/audit/superseded-<ts>/` | 被取代的历史视频与陈旧截图（`S3-side-night-p10.png`） |
| `~/.evidence/task-002/audit/evidence-hash-table.csv` | 全代次哈希表（141 行：5 个代次 × 文件） |

### 5.2 关键文件 旧 → 新

| 文件 | 08:48 代 | 08:51 代 | 08:58 代（保留） | **本轮权威** |
|---|---|---|---|---|
| `S3a-side-seaview-p10.png` | `716bb7b63171` | `79c82bfaa8ba` | `53229ccd7bb4` | **`6451fa93b05e`** |
| `S6-foam-orbit-p10.png` | `ac09c72f7171` | `3933e6f21b31` | `1ab5dad8f29e` | **`d0b643c046a7`** |
| `S12-shore-highlight-p10.png` | `49269d34df1c` | `3148a9f2f35c` | `d97dda38e0c6` | **`5adb225d48d9`** |
| `S7-side-scarf-v8-p10.png` | `62e18c9d372b` | —（未产出） | `7dcbbb9cc687` | **`79491d8d145c`** |
| `S11-fish-catchbox-p10.png` | `951fff12f9ca` | —（未产出） | `951fff12f9ca` | **`951fff12f9ca`** |
| `S2-night-moon-p10.png` | `ddf38b1f5370` | `f94e04b70f28` | `c0cc8e3c5812` | **`c79b6a48d6fd`** |
| 视频 | — | `f6e6b04d…`（4,505,739 B / 37.24 s） | `109e0222…`（4,509,362 B / 37.24 s） | **`de61e45d…`（4,594,029 B / 37.80 s）** |

除 `S11` 外，各图哈希**逐轮不同**：冻结帧的相位（围巾/道具随真实时间演化）不是逐字节确定性的，所以"哈希是否相同"不能当成"是否重拍"的判据；判据是 manifest 的 `generatedAt` + 同轮其它文件 + 场景日志。

`S11-fish-catchbox-p10.png` 三轮同哈希属预期：捕获帧由固定步判定，画面是确定性的；"是否重拍"由 manifest 的 `generatedAt` 与同轮其它文件共同证明，不看单图哈希。

### 5.3 manifest 计数

`manifest.json` 共 **34** 条 = **33 张 PNG + 1 条视频**。PNG 里 27 张是现场截图，`kind: diagnostic` 4 条（S3a 无海面 / S3a 无鹈鹕 / S6 无道具 / S12 无道具），`kind: supplementary` 2 条（S7 的 3/4 视角与同帧无飘带）。
每条都带 `dims`（如 `1920x1080`、`390x844`、`1280x720`）与设置/读数；`crops.py` 逐条核对磁盘 sha256 与像素尺寸，本轮 0 不一致。

## 6. NotDone / 限制

| 项 | 状态 | 说明 |
|---|---|---|
| 音频是否"已随视频验证" | **不主张** | `recordVideo` 只录画面；本轮视频 `audioStreams = 0`。音频链路（P13 WebAudio、手势解锁）需在真机/真实点击下另行取证，不能用这条静音视频冒充 |
| S2 骑手可读性 | **设计限制，未改** | p=0.50 的关键帧（M-03：主光 #9FB4FF/0.38、半球光 0.25）决定骑手是剪影；AC-3b/3c 判的是星星计数、月盘直径与高光列，不判骑手亮度。改亮度会动 M-03 的获批色值，超范围 |
| S6/S12 机位角 | **未改** | 保持 ADR-38 的 `−90°`；本轮只改冻结相位。ADR-38 的"11%/2%"表述建议补"随 S 变化，取证须选无遮挡相位"（见 §4.3，已提请，未改文） |
| S11 背景棕榈干 | **保留** | 捕获帧里 `x=−8` 的棕榈树干在框的背景层（深度上在鱼之后），不遮挡鱼；改相位会改变捕获时刻，收益不足 |
| 应用源码/机位/阈值 | **仅一处 CSS 修复** | 28 个源码文件逐字节未变；`css/style.css` 仅加 `#hud-auto[hidden]`（§4.7）。机位、阈值、M 项、AC 文字零改动 |
| 提交与推送 | **未做** | 按要求不 commit/push；`git status` 仍是工作树未提交状态 |
| 真机项 | **待用户** | PR-3/PR-5/PR-6/PR-7/PR-9（移动端、iOS `file://` 触屏与音频解锁、localStorage、真实 GPU fps） |

## 7. 复核建议（给 ui-vision）

按这个顺序看最小充分证据：

1. `crops/S3a-rendered-sea-mask.png`（红=这一帧真实画出的海面）→ `crops/S3a-car-bbox.png`（绿框=车+骑手真实像素，94 px）→ 需要时再看 `crops/S3a-lower-half-bright.png`（提亮 ×2.6，仅为看清夜间海面细节）。
2. `S6-foam-orbit-p10.png` / `S12-shore-highlight-p10.png`（本轮已无棕榈/灯杆入画）；`crops/S6-prop-occlusion-mask.png`、`crops/S12-prop-occlusion-mask.png` 给出"道具覆盖像素 = 0"。
3. `crops/S11-catchbox-fish-x4.png` + `crops/S11-fish-diff-x8.png`。
4. `crops/S7-side-scarf-v8-p10-scarf-x3.png` 与 `crops/S7-motion-*.png`（同一矩形，可直接看形态变化）+ `crops/S7-scarf-3q-supp-x2.png`（带宽可见；**supplementary，不计 AC**）。
5. 视频：`~/.evidence/task-002/implementation/app/video/de61e45d8c735d01a0956e0956c9459a.webm`（37.80 s、1280×720、25 fps、无音轨；`AUTO` 徽标只在接管窗口出现，见 §4.7）。
