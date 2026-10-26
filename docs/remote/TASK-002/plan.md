# TASK-002 实施计划（plan.md，canonical master plan）

> 状态：**APPROVED**（用户于 2026-10-25 批准，原话「批准计划，可以开始实施」；UD-1…UD-5 同日已批准）。
> 本文件是 TASK-002 的**唯一权威计划**。正文（本行以下、`---` 之后）是 `design-v3.md` 规范性正文的**逐字副本**，
> 仅两处非规范索引单元格被补全（§6.2 的 AC-5d、S14，见下方"打包记录"）。
> 本文件已于 2026-10-25 获批并冻结：规范性正文此后不可改写；P0 任务书见 `packages/P0.md`，执行记录见 `packages/P0-execution-result.md`。
>
> **配套文件**：`adr.md`（ADR-01…19 + UD-1…UD-5，均 APPROVED）、`handoff.md`（移交入口）、`review-3.md`（最终门禁评审）、
> 同目录的逐字历史快照（非规范）：`design-v1/v2/v3`、`review-1/2`、`response-1/2`、`draftadr`、`task.md`。

| 项 | 值 |
|---|---|
| 文件角色 | **canonical master plan**（唯一权威；编号 M/UD/ADR/AC/S/PR/P 的含义以本文件为准） |
| 批准状态 | **APPROVED**（2026-10-25，用户；UD-1…UD-5 同日已批准） |
| 任务 / 阶段 | TASK-002 / `IMPLEMENTING_P0`（批准 2026-10-25） |
| 基线 BASE_SHA | `2263425df8bd074f3c5e0d8f15e695e4f6c709e0` |
| 来源快照 | `design-v3.md`（sha256 `452ba330c9824af366293b134918c9c1f15b4e407eea3f751bac872d4c3edede`，96,702 B） |
| 会话 / 模型 | `--resume 17c5e5a3-2d23-4637-b36d-9af9a7ecbac4` / `claude-opus-5-5` / effort `medium` |
| 最终评审 | `review-3.md`（静态门禁：`READYFORUSERAPPROVAL`，无阻塞；置信度 0.87） |
| 打包记录 | **规范性正文与 `design-v3.md` 的差异仅 2 行**（§6.2 两处索引单元格：AC-5d、S14），其余字节完全一致；本文件顶部元信息块为本地重写，不属于正文 |
| 批准日期 / 原话 | 2026-10-25（用户 zhoucaiwu）：「批准计划，可以开始实施」 |
| 原始 plan sha256（批准前） | `71c51565d767f569aaabebfa2a2ff868e5628e43a1a7dac300896239587ce717`（96,974 B） |
| 规范性正文 sha256（批准后不可变） | `4771b9b4d8715a21c8e9beb68df9457b0314914a506b992c43f0708c90352aa2`（95,198 B；自 `# TASK-002 设计 v3：` 行至 EOF） |
| 元数据哈希链 | 见 `impl-notes.md` §A：每份文档 original_sha256 → metadata_diff_sha256 → new_sha256 |

---

# TASK-002 设计 v3：鹈鹕海岸公路 3D 页面（v2 + review-2 修订 + 用户裁决落点）

> 这份设计只基于 BASE `2263425`。我只用了一次 Glob 核对环境：BASE 里唯一的前端相关文件是 `README.md`，没有 html、js、css，和 §4.8 说的一致。
> 我在只读模式下运行，没有 Write 工具，所以计划文件没有写，设计全文直接在这里输出。我没有修改任何文件。
> 文中的编号（§x.y、M-xx、ADR-xx、P-xx、AC-xx）都固定不变，评审时可以直接按编号引用。

---

## 第 0 步：细节层级判断

要让能力较弱的模型只看这份文档就能做出同样的东西，下面这些维度**必须写死（MUST）**：

| 维度 | 原因 |
|---|---|
| D1 坐标系、单位、轴向、车道编号 | 各子系统共用。一旦有一处不一致（例如符号反了），就会出现"渲染位置和判定位置不同源"这类缺陷 |
| D2 所有数值常量（集中在 `CFG`） | 能力弱的模型会自己编数，导致和视觉判据对不上 |
| D3 每帧执行顺序 | 输入、自动驾驶仲裁、物理、捕获、渲染之间的时序缺陷，都源自顺序没有定义 |
| D4 状态机（app 三态、输入、指针、镜头、音频、画质） | §6 中 9 类缺陷是状态机缺了某条转移 |
| D5 接口签名与状态 schema | 防止实施者私造重复状态，例如鱼的位置存两份 |
| D6 着色器 uniform 表和"同一函数"规则 | 防止顶点和片元不一致 |
| D7 14 个成就的精确条件 | 原契约只说"14 个"，不写死就无法验收 |
| D8 色值表、比例表、构图判据 | 避免视觉验收只能靠主观判断 |
| D9 错误分类与恢复路径 | 防止"永久 fatal" |
| D10 文件边界和依赖方向 | 让 core 模块可以在没有 WebGL 的环境下自检 |

下面这些**可以由实施者自由裁量（MAY）**，详见 §2.2：几何体的具体构造（只要满足比例和配色）、音色细节（只要满足链路和 BPM 映射）、HUD 的 CSS 样式、调试面板布局、道具摆放的随机细节、代码内部的变量命名。

---

## 1. 功能追溯与视觉规格

### 1.1 全局约定（M-01，不可改）

- 单位：米、秒；代码中角度一律用弧度（表格里的 ° 只为可读）。速度单位 m/s，HUD 显示 km/h。
- 坐标系为 three.js 右手系：+Y 向上，前进方向 −Z，海在 +X 一侧，陆地和山崖在 −X 一侧。
- 跑步机模型：车辆始终位于 z=0。`G.S` 是累计路程（JS double，单调递增），`G.t` 是模拟时间（JS double）。静止物体的视图坐标为 `z = −(s_obj − G.S)`。**不做 rebase**（ADR-14）。
- 着色器只接收 JS 端取模后的周期量（M-27）：`uPhase[i]`、`uNoiseOff`、`uFoamPhase`、`uTwinkleT`。着色器不得接收 S 或 t 的原值。
- 道具回收：第 i 个实例的 `z_i = −(mod(i·spacing − G.S, span)) + 20`，其中 `span = count·spacing`，`mod(a,m) = a − m·floor(a/m)`。z 从 +20 连续变化到 −(span−20)，只在镜头背后 20 m 处回绕。
- 横向布局（x，单位 m）：

| 区段 | x 范围 | 高度 y |
|---|---|---|
| 山崖 | x < −16 | `min((−16−x)·0.6, 12)` |
| 草地 | −16 ≤ x < −4.5 | 0 |
| 沥青路面（总宽 9.0） | −4.5 ≤ x ≤ 4.5 | 0 |
| 边线（实线，宽 0.15） | x = ±3.75 | — |
| 路肩（沥青） | 3.75 < \|x\| ≤ 4.5 | — |
| 车道中心 | lane0 = −2.5（陆侧）、lane1 = 0、lane2 = +2.5（海侧） | — |
| 车道虚线 | x = ±1.25 | — |
| 沙滩 | 4.5 < x ≤ SHORE_X（以 `ground(x)` 为准） | `−0.07·(x−4.5)` |
| 平均海平面 | — | `SEA_Y = −0.8` |
| 海岸线 | `SHORE_X = 4.5 + 0.8/0.07 = 15.928571`（config 中计算得到） | — |
| 湿沙带 | [SHORE_X−1.5, SHORE_X] | — |
| 海面网格 | x ∈ [13, 900]，z ∈ [−900, 80] | — |

- 地面高度：`ground(x)` = 山崖式（x<−16）；0（−16≤x≤4.5）；`−0.07(x−4.5)`（4.5<x≤SHORE_X）；`SEA_Y`（x>SHORE_X）。
- 相机下限：`camFloor(x) = max(ground(x) + 0.4, SEA_Y + 0.8)`。两个连续函数取 max，结果连续。

### 1.2 契约追溯（12 条）

类型标记：`[selfcheck]` 在 tests/selfcheck.html 中跑纯逻辑；`[browser]` 由 Playwright 驱动 Chromium，用 `PB.debug` 断言或读数（UD-4，2026-10-25 已裁决）；`[screenshot]` 按 §5.3 写死的机位由 Playwright 截图并用脚本判定；`[build]` 构建或命令行检查；`[calib]` 校准项。
测量者：实施者执行，评审复核。凡标注"预计"的数值，都由 PR-1 的投影 selfcheck 用 config 常量算出，不是实测。
写法约定：`abs()` 为绝对值，`dist(a,b)` 为欧氏距离。

| AC | 契约 | 判据 | 类型 | 读数来源 | 失败处置 |
|---|---|---|---|---|---|
| AC-1a | 1 | 后轮着地点到头盔顶的竖直像素跨度占画面高度 22%–32%（预计 28.7%）。条件：wheelie=0、y=0、lean=0、v=8 稳态 3 s。不计围巾、阴影、翼 | [selfcheck]+[screenshot S1] | PR-1 投影；S1 | 截图与预计值相差 >2pp 时按渲染缺陷排查，不调机位 |
| AC-1b | 1 | 三项全部满足才 PASS。(i) 飘带（S1）：同一冻结帧真实渲染两次，第二次只把飘带 mesh 设为不可见（`PB.debug.setRibbonVisible(false)`），两帧 RGB 差的 L1 >30 且第一帧满足 H∈[345°,15°]、S≥0.5、V≥0.25 的像素 ≥150 个（颈环不计入）；(ii) 头盔（S1）：像素 ≥150 个，满足 H∈[205°,235°]、S≥0.4；(iii) 墨镜（S4a）：用同样的差分（`PB.debug.setGlassesVisible(false)`），差异像素中 L<0.12 的 ≥20 个，且 6 px 内有 L>0.35 的羽毛像素。**L 的定义**：PNG 的 sRGB 编码亮度 `L=(0.2126R+0.7152G+0.0722B)/255`，与同一 AC 中的 H/S/V 同口径；阈值 0.12 与 0.35 不变（ADR-37） | [screenshot]（脚本判定 + 人工复核） | S1（i、ii）；S4a（iii，P10） | 升级（§5.6），不得改色值或阈值 |
| AC-1c | 1 | S1 中路、沙、海、天四个区域都可见 | [screenshot] | S1 | 修渲染 |
| AC-1d | 1/5 | 中立、lean=0.21、wheelie=18°、跳跃顶点四种状态下，dist(beakMarker.worldPos, G.rig.beakW) ≤0.02 m | [browser] | `stats().beakErr` | 修 rig 或 pelican 层级 |
| AC-2a | 2 | v=8 恒定，模拟 10 s，后 5 s 内 tip–anchorMid 连线与 (0,−1,0) 夹角的平均值 ∈ [55°,85°]；sanity 值 81.3°–84.0°（二次律）不用于验收 | [selfcheck][calib] | scarf 模拟 | 在 C_Q∈[0.8,1.4] m⁻¹ 内校准（ADR-22） |
| AC-2b | 2 | 一次变道中，尾端横向滞后峰值 ∈ [0.15,0.40] m，1.0 s 内回到 abs(lag)≤0.05 | [selfcheck][calib] | `stats().scarfLagX` | 在 DAMP∈[0.97,0.995] 内校准 |
| AC-2c | 2 | 从 newSession（含 scarf.reset）起以 v=0 运行 8 s。对照运行用相同初值、windScale=0。取后 5 s 内每一步，比较两次运行同一时刻的 tip–anchorMid 方向，夹角最大值 ≤20°。两次运行都走真实的 PB.sim.step + PB.scarf.step，各自只读自己的 G.scarf（ADR-24） | [selfcheck] | scarf 模拟 | 按 PR-8 校准，不放宽 20° |
| AC-2d | 2 | 连续运行 10 min，会话级 `health.scarfResets == 0` | [browser] | `stats().scarfResets` | 记录复位前状态，升级 |
| AC-3a | 3 | S1 中太阳圆盘完全在画面内（预计 ndc=(0.83,0.49)） | [selfcheck]+[screenshot] | PR-1；S1 | 修 sky 方向 |
| AC-3b | 3 | S2 中 `starsInView ≥ 250`（预计 337）；像素计数 ≥150 为 [calib]；月盘完全在画面内（预计 ndc=(0.42,0.73)），直径占画面高 3%–6%（预计 4.0%）。直径定义：以预计质心为中心、3 倍预计半径为窗口，L_bg 取 2.5–3 倍半径环带内亮度的中位数，L_pk 取窗口内亮度最大值，统计 L ≥ (L_bg+L_pk)/2 且与质心连通的面积 A，直径 = 2·sqrt(A/π)（ADR-32） | [browser]+[screenshot] | `stats().starsInView`；S2 | 先复核 PR-1 |
| AC-3c | 3 | 每帧 ocean.uLightDir、DirectionalLight 方向、G.env.lightDir 三者分量差 ≤1e-6；S2 中高光路径最亮列与月亮投影 x 相差 ≤5% 画面宽 | [browser]+[screenshot] | `stats().lightDirErr`；S2 | 修赋值来源 |
| AC-3d | 3 | 整个周期内 lightDir 的角速度 ≤15°/s（按 1/60 s 采样） | [selfcheck] | daynight | 修分段 |
| AC-4a | 4 | CPU 镜像：x∈[13,40] 内，相距 0.05 m 的相邻法线夹角 ≤3°；S12 冻结时间，无接缝 | [selfcheck]+[screenshot] | oceanmath；S12 | 修 oceanDisp |
| AC-4b | 4 | 32 个 z 截面 × 45 个时刻（覆盖 4.5 s）：d∈[0,4] 内 shoreFoam>0.5 的局部极大值 ≥2 个，在 ≥90% 的样本中成立 | [selfcheck]+[screenshot S6] | oceanmath | 在 NA∈[0.8,1.7] 内校准 |
| AC-4c | 4 | x∈[30,200] 区域内，crestFoam>0 的面积占比 ∈ [10%,20%] | [selfcheck][calib] | oceanmath | 在 T_lo∈[0.35,0.60] 内校准 |
| AC-4d | 4 | S∈{9999.999, 1e6, 1e7}：S 与 S+1e-3 处的位移差 ≤0.01 m | [selfcheck] | oceanmath | 修相位偏移 |
| AC-5a | 5 | (i) 每个渲染帧：鱼网格 matrixWorld 平移与 f.pose 相差 ≤1e-4；(ii) 捕获步：迁移后的 f.pose 等于判定用的 alive pose；(iii) 等同 AC-1d；(iv) S11 中鱼位于调试捕获框内 | [browser]+[selfcheck]+[screenshot] | `stats().fishMeshErr` | 修 fishview 或 fish |
| AC-5b | 5 | 合成序列的计分符合 §4.4.4 | [selfcheck] | fish | 修计分 |
| AC-5c | 5 | high 鱼：对所有 wheelie∈[0,18°]、abs(lean)≤0.21、y=0 及任意 bob 相位都不可捕获；跳跃时存在可捕获时刻 | [selfcheck] | rig+fish | 修 §4.4.2 常数 |
| AC-5d | 5 | missed 轨迹。采样：lane∈{0,1,2} × high∈{否,是} × bob 相位 16 个 × 迁移时 alive 年龄 ∈{0.1,0.3,0.5,0.7,0.9,1.5,3.0} s，按 1/60 s 步进。全部满足：越过 SHORE_X 的时刻 a_cross≤0.6；x 单调不减；所有 a≥0.75 的步 y≤SEA_Y；移除步（首个 a≥0.8）x≥SHORE_X+0.5 且 y≤SEA_Y−0.2；相邻步道路相对 (x,y) 位移 ≤0.6 m | [selfcheck] | fish | 修 §4.4.2 常数 |
| AC-6a | 6 | 同时 held W 和 S 时，v 严格递减直到 0 | [selfcheck] | sim | 修优先级 |
| AC-6b | 6 | 一次变道在 21±1 步内使 laneT 到达 1 | [selfcheck] | sim | 修 sim |
| AC-6c | 6 | 跳跃最高 0.893±0.03 m，滞空 0.714±0.03 s | [selfcheck] | sim | 修 sim |
| AC-6d | 6 | held T 时 wheelie 在 ≤0.35 s 内到达 0.314 并保持（P4 selfcheck 判定）；视觉证据为 S13（P10 产出） | [selfcheck]+[screenshot S13] | sim | 修 sim |
| AC-6e | 6 | 同一 edge 序列在每帧 0/1/3/5 步下执行，每个 edge 恰好产生一次请求；零步帧不丢失 | [selfcheck] | input+sim | 修队列 |
| AC-6f | 6 | 起跳后第 1–5 步再按跳，不会注入新的 vy | [selfcheck] | sim | 修 sim |
| AC-7 | 7 | 14 条用合成 G 逐条触发，每条只发一次 achievement 事件；`unlockAch` 后刷新页面仍为已解锁；store 只在内存时不抛异常 | [selfcheck]+[browser] | achievements、store | 修 |
| AC-8a | 8 | 各机位满足 §4.7 构图判据：mode 0 用 S1，mode 1 用 S3a，mode 2 用 S4a/b/c，mode 3 用 S5，mode 4 用 S14 | [screenshot]+[selfcheck PR-1] | §5.3 | 修 camera |
| AC-8b | 8 | POV 往返 20 次：headGroup 隐藏时 dHead<0.9，显示时 dHead>0.6，每帧断言；POV 中喙尖在离画面底边 22%–34% 处（预计 27.8%） | [browser]+[selfcheck] | `stats().headVisErr` | 修 camera |
| AC-9a | 9 | 运行时页面发出的非 file:// 请求数为 0（Playwright 请求计数）；仓库中没有音频文件 | [browser]+[build] | Playwright 请求日志 | 修 |
| AC-9b | 9 | setSpeed(4) 稳态后 held W：bpm 单调不减，≤26 s 内到达 140 | [browser] | `stats().bpm` | 修调度 |
| AC-9c | 9 | 页面 hidden 后下一帧 `audioState==='suspended'` | [browser] | `stats().audioState` | 修门控 |
| AC-9d | 9 | 门控矩阵（gate×unlocked×muted）的运行判定正确 | [selfcheck] | audio.shouldRun | 修 audio |
| AC-10 | 10 | 双指同按 ◀，抬起一指后仍为 held，抬起两指才释放；拖出按钮、系统打断时都会释放 | [browser]（Playwright 触屏模拟 + 真机 PR-6） | `stats().ptrMapSize`、`stats().heldSet` | 修接线 |
| AC-11a | 11 | burnMs=25 后 ≤4.5 s 降一级 | [selfcheck]+[browser] | `stats().level` | 修 quality |
| AC-11b | 11 | 距上一次任意等级变化（含启动）≥10 s 才会升级 | [selfcheck] | quality | 修 quality |
| AC-11c | 11 | 60 s 内等级变化 ≤2 次；含 >250 ms 原始帧的窗口被丢弃 | [selfcheck] | quality | 修 quality |
| AC-12a | 12 | 无输入 6 s 后 apEngaged=true，HUD 显示 AUTO | [browser] | `stats().apEngaged` | 修 autopilot |
| AC-12b | 12 | 任意动作 held 10 s，期间不会 engage | [selfcheck]+[browser] | autopilot | 修 autopilot |
| AC-12c | 12 | 处于 AUTO 时，§4.6.1 集合内每一类事件（键盘、指针移动含无按键、滚轮、触摸、组合输入；Playwright 注入，isTrusted 为真）都在下一个渲染帧的 F4 断开 | [browser] | `stats().apEngaged` | 修 input 或 autopilot |
| AC-12d | 12 | 页面重新可见后 6 s 内不会 engage | [browser] | `stats().apEngaged` | 修 resumeRunning |
| AC-12e | 12 | 自动驾驶单次变道耗时 ∈ [0.33,0.38] s；对 high 鱼，在 16 个决策相位 × v∈{8,10,12,16} 下都恰好起跳一次 | [selfcheck] | autopilot | 修 §4.6.3 |

### 1.3 构图（M-02）

- 追尾镜头：FOV 55°（竖直）；相机相对车 `(0, 2.4, 6.5)`；注视点 `(x, 1.3, −4)`，下俯角 5.98°。
  - 地平线在画面高度的 39.9% 处（从上往下，预计值），判据 38%–45%；
  - 主体占画面高度预计 28.7%（判据见 AC-1a）；
  - 道路消失点水平方向在中心 ±10% 以内；
  - 地平线上海面所占宽度 ≥25%（几何上为右半幅）。
- 投影公式（PR-1 使用）：相机前向 `f = (0, −sinθ, −cosθ)`，上向 `u = (0, cosθ, −sinθ)`。`ndc_y = (d·u)/(d·f)/tan(FOV/2)`，`ndc_x = d_x/(d·f)/(tan(FOV/2)·aspect)`。
- 太阳水平方向 `normalize(0.60, 0, −0.80)`，月亮水平方向 `normalize(0.35, 0, −0.94)`。
- 角直径：太阳 3.0°（画面高度的 5.0%），月亮 2.4°（4.0%）。计算方式为 `2·tan(r)/(2·tan(27.5°))`。

### 1.4 色值（M-03，sRGB 十六进制，代码中通过 `THREE.Color` 转为线性空间）

| 对象 | 色值 |
|---|---|
| 鹈鹕主体羽毛 | `#F4F1EA` |
| 鹈鹕背部与翼 | `#9AA3A8` |
| 喙与喉囊 | `#F2A33A` |
| 腿 | `#E07B39` |
| 眼睛（墨镜内，不可见） | — |
| **围巾** | **`#D7262E`**（固定） |
| 头盔主体 / 条纹 | `#2F6FDE` / `#FFFFFF` |
| 墨镜镜片 / 镜框 | `#111114`（spec 高）/ `#1E1E22` |
| 车架 | `#1F7A8C` |
| 轮胎 / 轮辋 | `#1A1A1A` / `#C8CCD0` |
| 沥青 | `#3A3D42` |
| 车道虚线 | `#F2F2E6` |
| 边线 | `#E8C547` |
| 沙（干 / 湿） | `#D9C08F` / `#B89F70`（湿沙带 x ∈ [SHORE_X−1.5, SHORE_X]，见 §1.1） |
| 草地 | `#6E7F45` |
| 山崖 | `#5E6B4A` |
| 棕榈干 / 叶 | `#8A6A45` / `#2F7D3A` |
| 路灯杆 / 灯头（夜） | `#6B6F75` / emissive `#FFD58A` |
| 海（黄昏 深 / 浅） | `#1E4D6B` / `#3C8DA3` |
| 海（夜 深 / 浅） | `#06182B` / `#0E3046` |
| 泡沫 | `#F4F8FA` |

天空的关键帧色值见 §4.2.2。

### 1.5 比例（M-04，单位 m，车辆局部坐标，原点为后轮着地点的正上方路面）

本节所有局部坐标都经 rig 矩阵 `G.rig.M` 变换到世界（M-25，§4.13）。表中坐标为 MUST；几何构造方式为 MAY（§2.2）。

**自行车**（管径 0.018，车架色 `#1F7A8C`）

| 部件 | 规格 |
|---|---|
| 后轴 / 前轴 | (0,0.34,0) / (0,0.34,−1.05) |
| 轮 | 半径 0.34；胎管半径 0.025 `#1A1A1A`；轮辋 `#C8CCD0`；每轮辐条 ≥12 根（每轮 1 个 LineSegments） |
| 中轴 BB | (0,0.30,−0.42)；曲柄长 0.17；牙盘半径 0.10，x=+0.05 |
| 曲柄参数化 | θ = `G.bike.crank`，绕局部 X 轴：右踏板 = BB + (0.11, 0.17·cosθ, −0.17·sinθ)；左踏板 = BB + (−0.11, 0.17·cos(θ+π), −0.17·sin(θ+π))。θ=0 时右踏板在最高点；θ 增大时，右踏板从最高点向前（−Z）转动 |
| 车架 | 立管 BB→(0,0.88,−0.24)；上管 (0,0.86,−0.27)→(0,0.86,−0.93)；下管 BB→(0,0.70,−0.92)；后下叉 BB→后轴；后上叉 后轴→(0,0.86,−0.25)；前叉 (0,0.70,−0.92)→前轴 |
| 座垫 | 顶面中心 (0,0.95,−0.22)，长 0.26 |
| 车把 | 中心 (0,1.02,−0.98)，宽 0.50；把立 (0,0.86,−0.93)→车把中心 |

**鹈鹕**（色值见 §1.4）

| 部件 | 规格 |
|---|---|
| 躯干 | 椭球中心 (0,1.15,−0.38)，半轴 (0.28,0.36,0.50)，Rx=+25°（前端抬高） |
| 颈 | 两段，半径 0.06：(0,1.40,−0.62)→(0,1.62,−0.66)→(0,1.75,−0.48) |
| 头 | 中心 (0,1.75,−0.42)，半径 0.16 |
| 喙 | 根 (0,1.75,−0.58)，尖 `BEAK_TIP_L = (0,1.663,−1.072)`；根宽 0.07，尖宽 0.03 |
| 喉囊 | 椭球中心 (0,1.64,−0.82)，半轴 (0.05,0.07,0.20) |
| 头盔 | 半球，中心 (0,1.79,−0.42)，半径 0.19，顶点 y=1.98 |
| 墨镜 | 两片 0.07×0.045×0.012，中心 (±0.07,1.765,−0.583)，朝 −Z；每片八个角到头心 (0,1.75,−0.42) 的距离都 ≥0.16，且 y ≤ 1.79（头盔沿以下） |
| 翼 | 枢轴 (±0.27,1.30,−0.35)，单翼长 0.80，展开角 0→75°（绕 z 轴向外） |
| 腿 | 髋 (±0.12,1.00,−0.24)；大腿 0.46，小腿 0.46；膝朝 −Z 弯；脚点等于同侧踏板点（两段解析 IK）；脚为蹼状三角 0.12 |

**IK 可达性校验**（用本表常量复算）：
- 髋相对 BB 的偏移为 (0.01, 0.70, 0.18)，在 yz 平面内距 BB 0.7228。
- 髋到最低踏板 0.888，到最高踏板 0.560。
- 在整个曲柄圆上，髋到踏板的最大距离为 0.893（≤ 大腿 + 小腿 = 0.92），最小距离为 0.553（≥ 0）。因此 IK 恒有解。
- 要求 `stats().footPedalErr ≤ 0.01`。

**其他**

| 项 | 规格 |
|---|---|
| 颈环 | torus 中心 (0,1.55,−0.65)，R 0.11，管半径 0.035 |
| 围巾锚点 | (±0.06,1.55,−0.54)（颈环后缘） |
| 碰撞体 | 躯干：与渲染躯干同一组常量的椭球（中心 (0,1.15,−0.38)，半轴 (0.28,0.36,0.50) 各加 ε=0.005，Rx=+25°），用 `PB.rig.toLocal` 转到 rig 局部坐标后判定，参数从渲染常量派生，不另存；渲染躯干的经向、纬向分段都 ≥24（弦高 ≤0.0043 < ε）。颈：球 (0,1.68,−0.58) r=0.07（锚点到颈球心 0.149 > 0.07） |
| 鱼 | 椭球半轴 (0.03,0.05,0.16)；尾鳍三角 0.10×0.08；背 `#6F8FA6`，腹 `#E9F1F5`，眼 `#111114`。alive 悬停时鼻朝 +Z；跃出和 missed 时鼻沿道路相对速度方向 `normalize(Δx, Δy, Δz − G.bike.v·h)` |
| 道具：棕榈 | 20 棵，spacing 25 m（span 500），x=−8；高 6+2·hash(i) |
| 道具：路灯 | 16 根，spacing 30 m（span 480），x=−5.0，杆高 6.0，灯臂 1.5 m 伸向 +X；灯下路面光斑为半径 2.5 的加色圆片，亮度 = world.setLamps 的入参 |
| 道具：虚线 | 长 3 m，周期 12 m，宽 0.12，每条线 50 段（span 600） |
| blob 阴影 | 椭圆 0.7×1.6 m，中心局部 (0,0.01,−0.52)，不随 wheelie 旋转（只取 rig 的 x，lean=0）；不透明度 `0.35·(1−y/1.2)·(1−0.6·night)`，night 由 pelican.setNight 设定，初值 0 |
| 雾 | 线性，near 140；far 由画质等级决定（§4.10）；颜色为 env.horizon |
| HUD（MUST 7 项） | 速度 km/h、得分、鱼数、combo（≥2 时显示 ×n）、AUTO 标记、成就 x/14、当前镜头名；另有静音图标状态 |

### 1.6 最低可接受视觉 vs 目标视觉

- **最低可接受（L0 画质时允许）**：低多边形图元，颜色符合 §1.4，Gerstner 位移可见，有星点、日月圆盘、雾。
- **目标视觉（L1 以上验收必须全部满足）**：
  - T1 鹈鹕 smooth shading，喉囊形体可辨；
  - T2 海面日/月高光路径；
  - T3 岸边推进泡沫线 + 波峰泡沫；
  - T4 夜间路灯 emissive，路面有假光斑（叠加圆形贴片）；
  - T5 车底有 blob 阴影；
  - T6 星星闪烁；
  - T7 天空地平线有渐变带；
  - T8 围巾双面渲染且有明暗变化。

  只交付最低标准，视为**未通过**。

---

## 2. 不变量与自由裁量

### 2.1 强制不变量（MUST）

**沿用 v1 的条目（编号与含义不变）**

- M-01 坐标、单位、跑步机（§1.1，不做 rebase）
- M-02 构图（§1.3）
- M-03 色值（§1.4）
- M-04 比例（§1.5）
- M-05 只用经典 `<script src>`；禁用 module、fetch、XHR、`import()`；页面运行时不发任何网络请求
- M-06 three 以 IIFE 全局 `THREE` 的形式 vendored，npm 精确版本 `0.162.0`（r162）；WebGL2 优先、WebGL1 回退（UD-1，2026-10-25 已裁决）
- M-07 `js/core/*` 不得引用 THREE，不得访问 DOM（`input.attach` 除外）；store 通过注入使用
- M-08 帧序（§3.4）
- M-09 固定步长 H=1/60，每帧最多 5 步，dt 上限 0.1 s；帧率 <12 fps 时接受时间膨胀（每帧最多模拟 5/60 s），acc 清零
- M-10 鱼的位置只由 `fish.pose` 计算，渲染不插值、不加偏移
- M-11 海面法线只能对 `oceanDisp` 做有限差分
- M-12 GLSL 中不得出现 precision 语句，禁用 RawShaderMaterial；`capabilities.precision !== 'highp'` 时海面强制走逐顶点路径
- M-13 app 三态互斥，只有一个 overlay
- M-14 刹车优先于油门
- M-15 活跃集合（§4.6.1）
- M-16 指针按 id 映射，按动作计数
- M-17 hidden、blur、pagehide、ctxlost、fatal 时清空输入
- M-18 音频只经 main 的门控（§4.9）
- M-19 DPR 重算时机（§4.10）
- M-20 数值健康检查（§4.12）
- M-21 14 个成就（§4.8）
- M-22 不用 shadowMap。消费者：P16 的 [build] 检查，`grep -rnE "shadowMap.enabled *= *true" js/` 与 `grep -rn "castShadow" js/` 结果都为 0

**v2 新增**

| 编号 | 内容 | 消费者 |
|---|---|---|
| M-23 | 所有权表（§3.6）：每个字段和单例只有一个写者 | P16 静态审查 |
| M-24 | 自定义 GLSL 是 GLSL ES 1.00 写法（`gl_FragColor`、`texture2D`、常量循环界，不用 `in`/`out`、整数位运算、`texelFetch`）；这是 r162 下的唯一写法；所有 pow 的底数先 max(·,0) 或 clamp | [build] grep；PR-3 |
| M-25 | rig 唯一变换 `M = T(x,y,0)·Rz(lean)·Rx(wheelie)`；判定、渲染根节点、围巾锚点、POV 相机都用它 | AC-1d |
| M-26 | 两条 edge 队列：sim edges 只对首个固定步可见；UI edges 在每帧 F3 消费 | AC-6e |
| M-27 | 着色器的周期量由 JS 双精度取模生成 | AC-4d |
| M-28 | `PB.main.health` 是会话级计数器，softReset 不触碰 | AC-2d、§5.2 第 22 条 |
| M-29 | `PB.store` 是唯一的持久化读写点 | AC-7 |
| M-30 | 构建锁（§5.7） | P0 |
| M-31 | 稳态帧不新建对象，只允许事件对象（≤10 个/帧） | P16 Performance 录制（GC 停顿 <5 ms） |
| M-32 | `resumeRunning` 是回到 running 的唯一入口 | §5.2 第 5、6、15 条 |

**v3 新增**

| 编号 | 内容 | 消费者 |
|---|---|---|
| M-33 | 唯一初始化路径：`boot` 与 `softReset` 都只调用 `PB.main.newSession()`（= `sim.createState` + `main.initSession`）；createState 只建纯数据，不调用其他模块 | [selfcheck] newSession 后 §3.3 全部字段存在且有限；P4–P16 每包 Console 零错误 |
| M-34 | 可信事件集合（§4.6.1）是取消自动驾驶的唯一判据来源 | AC-12c |

**用户裁决约束**（2026-10-25 已裁决，与 M 条目同级）

| UD | 约束 | 落点 |
|---|---|---|
| UD-1 | 支持只有 WebGL1 的设备；three `0.162.0`；WebGL2 优先、WebGL1 回退；GLSL ES 1.00 | M-06、M-24、§4.11、§5.7、ADR-01/02 |
| UD-2 | 完整昼夜闭环：黄昏→暮光→夜→黎明前→日出→黄昏，周期 240 s，无缝无硬切 | §4.2、ADR-08 |
| UD-3 | 字面口径：任何 `isTrusted === true` 的用户输入（含无按键 mousemove、滚轮、HUD/面板上的指针移动）都立即取消自动驾驶 | §4.6.1、M-34、ADR-12 |
| UD-4 | 构建期允许用 Playwright 驱动 Chromium 执行 [browser]/[screenshot]；只作开发依赖，不进交付物 | §5.3、§5.7 |
| UD-5 | 首次手势解锁后音乐默认开启：`store.doc.settings.muted` 初值 `false` | §3.6、§4.9 |

### 2.2 自由裁量（MAY）及约束

| 项 | 允许 | 替换后仍须满足的可判定判据 |
|---|---|---|
| 几何构造 | Lathe、Capsule、合并 BufferGeometry 等 | §1.5 中锚点坐标误差 ≤0.01；尺寸 ±10%；鹈鹕 + 车 ≤40 个 mesh、≤8k 三角面 |
| 鹈鹕翼尖、尾羽、蹼的形状 | 任意 | 收翼时翼不穿过车把（目视 S1）；颜色符合 §1.4 |
| 鱼的造型细节 | 任意 | 尺寸、颜色、朝向符合 §1.5；整条鱼 ≤300 三角面 |
| 道具造型 | 任意 | 数量、间距、x 坐标、高度符合 §1.5；必须用 Instanced |
| 音色 | 振荡器类型、包络 | §4.9 的链路、BPM 映射、音量上限；AC-9b |
| HUD 样式 | 任意 CSS | §1.5 的 7 项全部显示；触屏按钮 ≥56 CSS px |
| 电影镜头 | 机位细节 | 3 个镜头、每个 8 s、过渡 1.2 s，满足避障；包围盒中心 \|ndc\| ≤0.7 |
| 海面网格分布 | 非均匀网格 | 每级顶点数 ≤ §4.10 的上限 |

### 2.3 替代方案与取舍

| 子系统 | 选择 | 备选 | 理由 |
|---|---|---|---|
| 渲染库 | vendored three `0.162.0`（r162，WebGL2 优先、WebGL1 回退；UD-1，2026-10-25 已裁决），esbuild@0.24.0 打成 IIFE | 官方 UMD（r160 起已移除）、与应用代码合并打包、自研、r170 | 应用代码改动不需要重新构建；自研没有量化理由；r170 不支持 WebGL1 |
| 围巾 | Verlet 带状网格 + 按速度缩放的风场 | 显式弹簧、骨骼摆动 | 稳定，能体现惯性和滞后 |
| 昼夜 | 关键帧 + 全相位 lightDir | 天文公式 | 可直接对应截图验收 |
| 海面 | Gerstner + 有限差分法线 + JS 相位偏移 | Water 示例（需要贴图文件）、FFT | 不依赖外部资源，相位连续 |
| 音频 | 振荡器 + 噪声 + lookahead 调度 | AudioWorklet | file:// 下 `addModule` 受限 |
| 画质 | 4 级离散 + 滞回 | 连续缩放 | 可测 |

## 3. 文件、模块与接口契约

### 3.1 文件清单（总共约 3800 行应用代码，均为预算上限）

行数按"代码行"计：非空、且不是纯注释的行（JS 去掉 `/* */` 块内的行和以 `//` 开头的行；HTML、CSS 去掉注释行和空行）。门禁：应用代码（不含 tests、tools、vendor）的代码行合计 ≤5600。逐文件上限是分配目标，超出时在 impl-notes 记录原因，不单独判失败（ADR-31）。标题中的"约 3800 行"不再适用。

**v1 已有的文件**

| 文件 | 行数上限 | 说明 |
|---|---|---|
| index.html | 140 | — |
| css/style.css | 200 | — |
| js/core/config.js | 240 | 含派生常量，如 SHORE_X |
| js/core/mathx.js | 140 | — |
| js/core/input.js | 300 | — |
| js/core/sim.js | 300 | 含 createState、healthCheck、resetBike |
| js/core/fish.js | 220 | — |
| js/core/scarf.js | 220 | — |
| js/core/daynight.js | 180 | — |
| js/core/autopilot.js | 180 | — |
| js/core/achievements.js | 220 | — |
| js/core/quality.js | 130 | — |
| js/render/scene.js | 240 | — |
| js/render/sky.js | 200 | — |
| js/render/ocean.js | 260 | — |
| js/render/world.js | 260 | — |
| js/render/pelican.js | 360 | — |
| js/render/fishview.js | 100 | — |
| js/render/camera.js | 300 | — |
| js/audio.js | 300 | — |
| js/hud.js | 260 | — |
| js/main.js | 320 | — |
| tests/selfcheck.html | — | — |
| tests/selfcheck.js | 600 | — |
| vendor/three.min.js、vendor/three.LICENSE、vendor/VERSION.txt | — | 构建期产物 |

**v2 新增**

| 文件 | 行数上限 | 职责 |
|---|---|---|
| js/core/rig.js | 120 | §4.13 |
| js/core/oceanmath.js | 120 | 波参数常量、`OCEAN_DISP_GLSL` 字符串、CPU 镜像 `disp`、`foam` |
| js/store.js | 90 | 唯一的 localStorage 读写者 |
| js/debug.js | 200 | `PB.debug` 钩子与 `stats()` |
| tools/vendor-three.sh | — | 构建期 |
| tools/vendor/package.json、tools/vendor/package-lock.json | — | 版本锁 |
| tools/three-smoke.html | 40 | P0 冒烟页 |

**依赖方向**：`config ← mathx ← core/* ← (store) ← render/*、audio、hud、debug ← main`。
- render 层只读 G；例外是 camera 写 `G.cam`。
- audio 和 quality 不读 main 的状态，由 main 推送门控。

### 3.2 加载与命名空间

每个文件都是 `(function (PB) { 'use strict'; … })(window.PB = window.PB || {});`。不写类层级，全部是纯函数加普通对象。模块只在调用时引用 `PB.x`，加载期不互相调用。

`index.html` 最终的 script 顺序（唯一权威，各包把自己的文件插入到对应位置）：

1. vendor/three.min.js
2. js/core/config.js
3. js/core/mathx.js
4. js/core/input.js
5. js/core/sim.js
6. js/core/rig.js
7. js/core/fish.js
8. js/core/scarf.js
9. js/core/daynight.js
10. js/core/oceanmath.js
11. js/core/autopilot.js
12. js/core/achievements.js
13. js/core/quality.js
14. js/store.js
15. js/render/scene.js
16. js/render/sky.js
17. js/render/ocean.js
18. js/render/world.js
19. js/render/pelican.js
20. js/render/fishview.js
21. js/render/camera.js
22. js/audio.js
23. js/hud.js
24. js/debug.js
25. js/main.js

`main.js` 最后加载，在 `DOMContentLoaded` 时调用 `PB.main.boot()`。`tests/selfcheck.html` 按同一顺序只加载第 2–14 项和 `tests/selfcheck.js`。

### 3.3 状态 schema（`G` 由 `PB.sim.createState(seed)` 创建，归 main 所有，softReset 时整体重建，持久化部分除外）

G 只含"一局"状态。`PB.main.newSession()` 每次都新建 G：先调用 `PB.sim.createState(seed, opts{camMode})` 建纯数据，再调用 `PB.main.initSession(G)` 按 §3.6 的顺序调用各模块的 initState。

**createState 建立的纯数据字段**（不调用任何模块）：

```
G.t 0 s；G.S 0 m；G.p 0 [0,1)；G.cycle 0 int（floor(t/240)）
G.lastGood {t:0, S:0}
G.rng uint32（mulberry32 状态，初值 seed）；只经 PB.mathx.rng(G) 读取并推进
G.bike = { x 0 [-3,3]、y 0 [0,1.5]、vy 0、v 0 [0,16]、a 0、
           lane 1 int{0,1,2}、laneFromX 0、laneToX 0、laneT 1 [0,1]、lastLaneReqT -9、
           airborne false、jumpBufT 0 [0,0.12]、wheelie 0 [0,0.314]、wing 0 [0,1]、
           crank 0 [0,2π)、lean 0 [-0.21,0.21]、rpm 0 }
G.fish []（长度 ≤6；元素结构 { id, lane, s, tSpawn, high, state:'alive'|'caught'|'missed', tState,
          p0{x,y,z}, pose{x,y,z,yaw,scale}, prevZ }）
G.fishSeq 0；G.nextFishS 40
G.score = { points 0、catches 0、combo 0、lastCatchT -99 }
G.stats = { nightRideT 0、speedHighT 0、wheelieT 0、camUsed [0,0,0,0,0]、apCatches 0 }
G.ap = { engaged false、nextDecT 0、targetId -1、laneGoal 1、prevTArr +Infinity、jumpedFor -1、nextDriftT 8 }
G.cam = { mode（opts.camMode，默认 0）、blendT 1、headHidden false、
          orbit{yaw 0.6109、pitch 0.3142、dist 9、lastInteractT -99、frozen false}、cineShot 0、cineT 0 }
G.events []（每帧末清空）
```

**由 initState 创建的字段**（createState 不创建这些键）：

| 字段 | 填充者 | 内容 |
|---|---|---|
| G.rig | `PB.rig.initState(G)`（P4 起） | `{ M: Float64Array(16)（列主序）、beakW{x,y,z}、anchorW:[{x,y,z},{x,y,z}]、torsoW、neckW、headW、prevBeakZ }`；随后 compute 一次，`prevBeakZ = beakW.z` |
| G.scarf | `PB.scarf.initState(G)`（P6 起） | `{ P: Float64Array(78)、Q: Float64Array(78)、tip{x,y,z}、lagX 0、angleDeg 0 }`；随后调用 reset |
| G.env | `PB.daynight.initState(G)`（P7 起） | 分配 Env（§4.2.3），随后 `sample(G.t, G.env)` |

读者只能在其填充者所属包或更晚的包中接线，因此任何已接线的读者读到的键都已存在。`G.health`、`G.score.best` 不在 G 中（§3.6）。

### 3.4 每帧固定顺序（M-08，`main.frame(now)`）

```
F0  if app.state !== 'running': hud.updateOverlay(app); return（rAF 仍在 ctxlost 状态下继续；fatal 时停）
F1  rawDtMs = now − last；last = now；dt = min(rawDtMs/1000, 0.1)
F2  input.snapshot(nowSec, inp)            // held、anyHeld、activity 脉冲（读后清除）；不含 edges
F3  input.takeUiEdges(uiQ)；main.dispatchUi(uiQ)
    // 每帧都执行，与固定步数无关；按入队顺序：
    //   camNext/camSet → camera.setMode
    //   mute → audio.setMuted + store.update
    //   achList → hud.toggleAchList
    //   esc → 若面板打开则关闭
F4  autopilot.arbitrate(G, inp, nowSec)    // 先断开，再判断是否接管
F5  acc += dt；n = 0
    if acc >= H: input.takeSimEdges(simE)   // 只在至少会执行 1 步时才取出；否则留在队列中
    while acc >= H && n < 5:
       E = (n === 0) ? simE : EMPTY
       cmd = G.ap.engaged ? autopilot.command(G, H, cmd) : input.toCommand(inp, E, G, cmd)
       sim.step(G, cmd, H)      // bike、t、S、p；跨周期时推 cycleWrap；jumpBufT 递减
       rig.compute(G)           // 写 G.rig
       fish.step(G, H)          // 生成 → alive pose → 判定 → 迁移 → 当步重算 pose
       scarf.step(G, H)         // 锚点读 G.rig
       achievements.step(G, H)  // 读 G.p、G.bike
       sim.healthCheck(G, main.health)
       acc −= H；n++
    if n === 5 && acc >= H: acc = 0（接受时间膨胀）
F6  daynight.sample(G.t, G.env)
F7  achievements.onEvents(G)；audio.onEvents(G.events)；hud.onEvents(G.events)；main.updateBest(G)
F8  sky.update；ocean.update（含 uPhase 等）；world.update；pelican.update（root.matrix = G.rig.M；围巾顶点）；fishview.update
F9  camera.update(G, dt)                   // 含 POV 头部可见性与 camUsed 计时
F10 audio.update(G, dt)
F11 lvl = quality.sample(rawDtMs, nowSec)；if lvl !== null: scene.applyQuality(lvl)
F12 hud.update(G)（DOM 节流到 10 Hz）
F13 renderer.render；if debug: debug.assertFrame(G)（AC-1d、AC-3c、AC-5a、AC-8b）
F14 G.events.length = 0
F1–F14 包在 try/catch 中 → main.onFrameError(e)（§4.11）
```

### 3.5 主要函数签名（"副作用"一列中，"写 X"指修改 X）

| 签名 | 返回 | 副作用 |
|---|---|---|
| `PB.main.boot()` | void | 检测（§4.11）、创建单例、`store.load`、`newSession`、注册监听、启动 rAF |
| `PB.main.newSession()` | void | `G = sim.createState(seed, {camMode: store.doc.settings.cam})`；`initSession(G)`；boot 与 softReset 的唯一初始化路径（M-33） |
| `PB.main.initSession(G)` | void | 按 §3.6 顺序调用已接线模块的 initState |
| `PB.main.softReset()` | void | `newSession()`；fishview 全部隐藏 |
| `PB.main.resumeRunning(reason)` | void | 见 §4.11 |
| `PB.main.teardown()` | void | pagehide 时：store.flush、clearAll |
| `PB.main.dispatchUi(q)` | void | 见 F3 |
| `PB.main.onFrameError(e)` | void | 见 §4.11 |
| `PB.main.updateBest(G)` | void | 超过 best 时调用 store.update |
| `PB.mathx.rng(G)` | [0,1) 浮点 | 推进 G.rng（mulberry32）；§4.4.1 与 §4.6.3 中的 rng() 都指它 |
| `PB.sim.createState(seed, opts)` | G | 无；只建纯数据（M-33） |
| `PB.sim.step(G, cmd, h)` | void | 写 bike、t、S、p、cycle，推事件 |
| `PB.sim.healthCheck(G, health)` | bool | 失败时 resetBike 等，并写 health |
| `PB.sim.resetBike(G)` | void | §4.12 |
| `PB.sim.cadenceRpm(v)` | `v·60/(2.136·2.8)` | 无 |
| `PB.rig.initState(G)` | void | 创建 G.rig 并 compute |
| `PB.rig.compute(G)` | void | 写 G.rig |
| `PB.rig.toWorld(G, localXYZ, out)` | out | 无 |
| `PB.input.attach(win, doc, canvas, touchRoot)` | void | 注册监听（含 §4.6.1 的捕获监听） |
| `PB.input.snapshot(nowSec, out)` | out `{held{throttle,brake,left,right,jump,wing}, anyHeld, activity}` | 清除 activity 脉冲 |
| `PB.input.takeUiEdges(outArr)`、`PB.input.takeSimEdges(outArr)` | outArr | 把队列移入 outArr 后清空队列 |
| `PB.input.toCommand(inp, edges, G, out)` | Cmd `{throttle, brake, laneDelta∈[−2,2], jumpPress, wing}` | 写 `G.bike.lastLaneReqT` |
| `PB.input.clearAll(reason)` | void | 清键、指针映射、计数、两条队列；释放 capture |
| `PB.input.activityAt()`、`PB.input.markActivity(nowSec)` | number、void | markActivity 写 lastActivity |
| `PB.fish.pose(f, G, out)` | out | 唯一的鱼位置计算 |
| `PB.fish.step(G, h)` | void | 写 G.fish、G.score、事件 |
| `PB.scarf.initState(G)` | void | 创建 G.scarf 并 reset |
| `PB.scarf.reset(G)`、`PB.scarf.step(G, h)` | void | 写 G.scarf |
| `PB.daynight.initState(G)` | void | 分配 G.env（Env 的唯一分配者）并 sample |
| `PB.daynight.sample(t, out)` | out(Env) | 只写 out |
| `PB.daynight.lightDir(p, out)` | out | 无 |
| `PB.autopilot.arbitrate(G, inp, now)`、`PB.autopilot.command(G, h, out)` | void、Cmd | 写 G.ap |
| `PB.achievements.init(storeApi)`、`step(G, h)`、`onEvents(G)`、`unlock(id, G)`、`isUnlocked(id)` | 依函数 | 只经 storeApi 写 |
| `PB.store.load()` | doc | 读 localStorage；缺省时 doc 用 §3.6 初值 |
| `PB.store.update(fn)`、`PB.store.flush()` | void | 唯一写 localStorage |
| `PB.store.persistent` | bool | — |
| `PB.quality.create(level, nowSec)`、`sample(rawMs, nowSec)`、`discardWindow(nowSec)`、`force(l, nowSec)` | 等级或 null | 写控制器内部状态 |
| `PB.scene.init(canvas)` | `{renderer, scene, glVersion}`，或抛出 `NoWebGLError` | — |
| `PB.scene.applyQuality(l)`、`PB.scene.resize()` | void | 重算 DPR |
| `PB.world.setLamps(x)` | void | 设路灯亮度 0..1，初值 0 |
| `PB.pelican.setNight(x)` | void | 设阴影夜间因子 0..1，初值 0 |
| `PB.camera.update(G, dt)`、`PB.camera.setMode(i, G)` | void | 写 G.cam、G.stats.camUsed |
| `PB.audio.unlock()`、`setGate(open)`、`setMuted(b)`、`onEvents(e)`、`update(G, dt)` | void | 控制 AudioContext |
| `PB.audio.shouldRun(gate, unlocked, muted)` | bool | 纯函数 |
| `PB.hud.updateOverlay(app)` | void | 只写 #overlay |
| `PB.hud.onEvents(evts)` | void | toast 入队 |
| `PB.hud.update(G)` | void | 写 HUD DOM（10 Hz） |
| `PB.hud.toggleAchList()`、`PB.hud.closeAchList()` | void | 面板显隐 |
| `PB.debug.*` | §5.3 | 只在 `?debug=1` 时挂载 |

### 3.6 所有权与生命周期（M-23）

**`initSession(G)` 的固定调用顺序**：
1. `rig.initState(G)`（P4 接线）
2. `scarf.initState(G)`（P6 追加；scarf 依赖 G.rig.anchorW）
3. `daynight.initState(G)`（P7 追加）

boot 与 softReset 都只经 `newSession()` 到达这里（M-33）。

| 字段 / 单例 | 唯一写者 | 创建时机 | 写入步 | 读者 | softReset |
|---|---|---|---|---|---|
| G.t、G.S、G.p、G.cycle、G.lastGood、G.bike | sim | createState | F5 | 全部 | 随 newSession 重建 |
| G.rng | mathx.rng | createState | F5 | fish、autopilot | 重建 |
| G.rig | rig | rig.initState | initState / F5 | fish、scarf、pelican、camera、autopilot、debug | 重建 |
| G.scarf | scarf | scarf.initState | initState / F5 | pelican、debug | 重建 |
| G.fish、G.fishSeq、G.nextFishS、G.score | fish | createState | F5 | fishview、hud、achievements、autopilot | 重建 |
| G.stats（camUsed 除外） | achievements | createState | F5 / F7 | achievements、debug | 重建 |
| G.stats.camUsed | camera | createState | F9 | achievements | 重建 |
| G.ap | autopilot | createState | F4 / F5 | fish（只读 engaged）、hud | 重建 |
| G.cam | camera | createState（mode 取自 store） | F3 / F9 | render | 重建（mode 取自 store） |
| G.env | daynight | daynight.initState（唯一分配者） | initState / F6 | render、audio、main（setLamps、setNight） | 重建 |
| G.events | 生产者 push；main 清空 | createState | F5 / F14 | F7 消费者 | 重建 |
| input 内部状态 | input | boot | 事件回调、F2、F3、F5 | main | 不变 |
| PB.main.app `{state, ctxLostAt, postRestoreFrames, last, acc, glVersion}` | main | boot | 状态转移时 | hud、debug | 不变 |
| PB.main.health `{errors[], nanResets, scarfResets, softResets, nanWindow[]}` | main；sim.healthCheck 经参数写入 | boot | F5 / onFrameError | debug | 不变；只在用户重试时清空 errors |
| renderer、scene、相机对象、各 mesh | scene 及各 render 模块 | boot | F8–F13 | — | 不变 |
| audio 单例 | audio | 首次手势 | 门控 | main | 不变 |
| quality 控制器 | quality | boot | F11 | scene | 不变 |
| store.doc | store | boot（load） | update | achievements、hud、main | 不变 |

**store.doc 的初值**（localStorage 中无记录或解析失败时使用）：
`{v:1, ach:{}, best:{points:0, distance:0}, settings:{muted:false, cam:0}}`。
- `muted:false` 按 UD-5（2026-10-25 已裁决）。
- 用户手动静音或切换镜头后，经 `store.update` 写入并持久化；下次加载时沿用。

## 4. 关键子系统契约

### 4.1 围巾

- **结构**：颈环为刚体 mesh（参数见 §1.5），挂在 rig 下，不参与模拟。飘带 2 列 × 13 行：第 0 行固定在 `G.rig.anchorW`，即 §1.5 中的锚点 (±0.06,1.55,−0.54)；行距 0.055 m，总长 0.66 m。
- **坐标系**：跑步机视图坐标。纵向惯性加虚拟加速度 `(0, 0, +G.bike.a)`。
- **积分**：子步 `h_s = 1/240`（每个固定步 4 个子步）：
  ```
  vel  = clampLen((P − Q)·DAMP, 20·h_s)          // DAMP = 0.985
  u    = wRel·windScale − vel/h_s                // windScale 默认 1，只有 AC-2c 的对照运行传 0
  acc  = (0, −9.8, 0) + (0, 0, a) + C_Q·‖u‖·u + flutter·windScale   // C_Q = 1.0 m⁻¹，二次气动阻力（ADR-22）
  Pn   = P + clampLen(vel + acc·h_s², 0.05)
  Q = P；P = Pn
  ```
  约束：结构、剪切、弯曲（隔一行），每子步迭代 6 次，刚度 1；每次迭代的最后一步按 §1.5 的碰撞体把第 1–12 行粒子投到体外（第 0 行是固定点，不投影；ADR-23）。
- **风场**：
  ```
  s_w  = 0.25 + 0.75·min(1, v/6)
  wRel = ( s_w·(1.2·sin(0.7t) + 0.6·n1(t)),  0.3·s_w·n2(t),  v + 1.5·s_w·gust(t) )
  gust(t) = 0.5 + 0.5·sin(0.37t)·sin(1.13t) ∈ [0,1]
  ```
  n1、n2 是以 t 为输入的 1D 值噪声，晶格间距 2 s，值域 [−1,1]，种子分别为 3 和 5。
- **抖动**：`flutter = N_rib·0.9·(row/12)·sin(2π(3 + 0.35v)t + 0.9·row)·min(1, v/4)`。
- **测量量**（写入 G.scarf，selfcheck 和 stats 都读它们）：
  - `anchorMid` = 两锚点中点；
  - `angleDeg` = (tip − anchorMid) 与 (0,−1,0) 的夹角，tip 为第 12 行两粒子的中点；
  - `lagX` = tip.x − anchorMid.x − 该段运动前 1 s 的 lagX 均值。
- **sanity**（二次律 `θ_ss ≈ atan(C_Q·abs(wRel_h)²/9.8)`，只作参考，不用于验收；本行之下两条按线性律给出的数值已作废，以此处为准）：v=0 时 ≤2.0°；v=8 时，无阵风为 81.3°，均值风况为 82.7°，最大阵风加侧风为 84.0°（C_Q=1.0）。
  - v=0：s_w=0.25，横风上限 0.45，z 向阵风上限 0.375，合成 0.586，得 ≤ atan(0.1494) = 8.5°；
  - v=8：无阵风无侧风时 abs(wRel_h)=8.0，得 63.9°；无阵风、最大侧风 1.8 时为 8.2，得 64.4°；最大阵风加最大侧风时为 9.669，得 67.9°。
- **几何静息估算**（v=0、无风，忽略带宽）：
  - 自锚点竖直下垂会穿过躯干球，所以飘带先沿前侧切线下行：切角 7.9°，切线长 0.412；
  - 再贴球面弧 0.042；
  - 剩余 0.206 竖直下垂；
  - tip 约在 (y 0.894, z −0.60)，tip–anchorMid 夹角 5.2°。

  静息加风场的上限远低于 AC-2c 的 20°。
- **流动校验**：v=8、θ=64° 时，从锚点出发的流线与躯干球心的最近距离为 0.299，约等于半径 0.30，基本不受遮挡。AC-2a 由实际模拟判定（PR-8）。
- **验收**：AC-2a/2b/2c 都在 selfcheck 中用实际模拟判定，判定位置是 tip–anchorMid 连线。
- **健康检查**：每个固定步检查全部 P、Q 有限，`|P − Q| ≤ 0.2`，`|P − anchor| < 1.5`。任一失败：调用 `scarf.reset(G)`，`main.health.scarfResets++`。`scarf.reset` 的定义：第 r 行第 c 列粒子 `P = anchorW[c] + r·0.055·d`，其中 `d = (0, −cos20°, +sin20°) = (0, −0.93969, 0.34202)`（跑步机视图坐标，从竖直向下方向朝 +Z 偏 20°）；随后执行一次碰撞投影，再令 Q = P（ADR-29）。
- **渲染**：26 个顶点，DoubleSide，Lambert，颜色 `#D7262E`；每帧写入 position 后 `computeVertexNormals`；挂在 scene 根下，单位变换。

### 4.2 昼夜与天空

#### 4.2.1 相位

- `sim.step` 每个固定步执行：`G.t += h`；`c = floor(G.t/240)`；若 `c > G.cycle`，则 `G.cycle = c` 并推入 `cycleWrap` 事件；`G.p = G.t/240 − c`。
- 阶段划分：黄昏 [0,0.18)、暮光 [0.18,0.32)、夜 [0.32,0.72)、黎明前 [0.72,0.90)、日出回到黄昏 [0.90,1)。
- `PB.debug.setPhase(p)` 设置 `G.t = G.cycle·240 + p·240`，不会产生 cycleWrap。

#### 4.2.2 关键帧（分段线性插值，颜色在线性空间做 lerp）

| p | 太阳仰角 | 月亮仰角 | zenith | horizon | 主光颜色 / 强度 | 半球光 sky / ground / 强度 | 星星 | 路灯 | specPow / specI |
|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 10° | −10° | #3B4C86 | #FFB26B | #FFB070 / 2.2 | #F4A57A / #4A3B3A / 0.6 | 0 | 0 | 120 / 1.2 |
| 0.12 | 2° | −8° | #2B3A67 | #F28C4B | #FF8A4A / 1.6 | #F4A57A / #4A3B3A / 0.5 | 0 | 0 | 90 / 1.4 |
| 0.20 | −3° | −2° | #1A2148 | #9C4A5E | #B05A60 / 0.5 | #6A4A70 / #1A1418 / 0.35 | 0.3 | 1 | 60 / 0.5 |
| 0.30 | −12° | 8° | #070D26 | #1B2A4E | #9FB4FF / 0.30 | #1A2550 / #05060A / 0.25 | 1 | 1 | 400 / 0.6 |
| 0.50 | −20° | 14° | #050A1E | #14223F | #9FB4FF / 0.38 | #1A2550 / #05060A / 0.25 | 1 | 1 | 400 / 0.7 |
| 0.70 | −12° | 8° | #070D26 | #1B2A4E | #9FB4FF / 0.30 | #1A2550 / #05060A / 0.25 | 1 | 1 | 400 / 0.6 |
| 0.80 | −8° | −2° | #121A3E | #3D2F5A | #8090D0 / 0.25 | #1A2550 / #05060A / 0.28 | 0.8 | 1 | 200 / 0.4 |
| 0.90 | −3° | −8° | #24305E | #6B3F6E | #C07070 / 0.6 | #6A4A70 / #1A1418 / 0.35 | 0.2 | 0.5 | 80 / 0.6 |
| 0.95 | 3° | −10° | #33457A | #F2A65A | #FFA060 / 1.6 | #F4A57A / #4A3B3A / 0.5 | 0 | 0 | 90 / 1.3 |
| 1.00 | 10° | −10° | #3B4C86 | #FFB26B | #FFB070 / 2.2 | #F4A57A / #4A3B3A / 0.6 | 0 | 0 | 120 / 1.2 |

- **天体方向**：`dir(h, e) = (cos e·h.x, sin e, cos e·h.z)`，h 取 §1.3 的水平方向。sunDir 和 moonDir 用表中未截断的仰角，供天空 shader 绘制圆盘。
- **主光方向** `lightDir(p)`（全相位定义）：
  - `S = dir(h_sun, max(e_sun, 3°))`，`Mn = dir(h_moon, max(e_moon, 3°))`；
  - p∈[0,0.16) 取 S；
  - [0.16,0.24) 取 `slerp(S, Mn, smoothstep(0,1,(p−0.16)/0.08))`；
  - [0.24,0.74) 取 Mn；
  - [0.74,0.86) 取 `slerp(Mn, S, smoothstep(0,1,(p−0.74)/0.12))`；
  - [0.86,1) 取 S。
- 两个方向的最大夹角为 16.5°，最大角速度小于 1°/s，满足 AC-3d。
- **一致性**：DirectionalLight、ocean.uLightDir、天空 shader 都从同一个 G.env 赋值（AC-3c）。

#### 4.2.3 Env 结构

```
{ p, sunDir:vec3, moonDir:vec3, lightDir:vec3, lightColor:Color（线性 × 强度）, lightI,
  hemiSky, hemiGround, hemiI, ambient:Color（= hemiSky × hemiI，供海面使用）,
  zenith, horizon, stars:0..1, lamps:0..1, specPow, specI, nightMix（= stars）,
  fogNear 140, fogFar（来自画质等级）,
  uPhase:Float32Array(4), uNoiseOff, uFoamPhase, uTwinkleT }
```
所有字段都是预分配对象，`sample()` 只做写入（M-31）。周期量由 ocean 模块按 §4.3 计算后写入。

#### 4.2.4 天空渲染

- **穹顶**：球半径 1000，BackSide，`depthWrite:false`，`fog:false`，每帧跟随相机位置。
- **uniform**：uZenith、uHorizon、uSunDir、uMoonDir、uSunColor（vec3）、uMoonColor（#DCE6FF 线性）、uNightMix、uTwinkleT（仅星星材质使用）。
- **渐变**：`mix(uHorizon, uZenith, pow(max(dir.y, 0.0), 0.45))`；`dir.y < 0` 时取 `uHorizon·0.6`。
- **太阳**：`smoothstep(cos(1.5°), cos(1.4°), max(dot(dir, uSunDir), 0.0))·uSunColor`，加光晕 `pow(max(dot(dir, uSunDir), 0.0), 300.0)·0.6`。
- **月亮**：同一个 shader 绘制。圆盘为 `smoothstep(cos(1.25°), cos(1.15°), max(dot(dir, uMoonDir), 0.0))`，乘以 `(0.85 + 0.15·vnoise(dir·40.0))`；光晕 `pow(max(dot, 0.0), 800.0)·0.3·uNightMix`。
- **星星**：Points，N=3000，种子 7。
  - 分布：55% 的仰角在 [4°,24°] 内均匀分布；45% 满足 sin e 在 [sin24°,1] 内均匀；方位角均匀。
  - 生成后用种子 11 做 Fisher–Yates 打乱，使 drawRange 的前缀是均匀子集。
  - 大小 1.2–2.8 px，`sizeAttenuation:false`。
  - 闪烁：`0.75 + 0.25·sin(2π·m_i·uTwinkleT/60 + φ_i)`，m_i 为 {3..12} 中的整数，`uTwinkleT = mod(t, 60)`。
  - 不透明度为 env.stars。
- **starsInView**（debug）：用当前相机的视锥测试星点方向，计数结果写入 `stats()`；只做几何判断，不计山崖遮挡。
- PR-1 预计 S2 的计数为 337。

### 4.3 海面与碎浪

- **网格**：x∈[13,900]，z∈[−900,80]，网格本身静止。
- **波参数**（`js/core/oceanmath.js` 中的 WAVES 常量，是 GLSL 与 CPU 镜像的唯一来源）：

| i | dir（归一化前） | A (m) | L (m) |
|---|---|---|---|
| 0 | (−0.97, 0.24) | 0.30 | 18 |
| 1 | (−0.93, −0.37) | 0.16 | 9.5 |
| 2 | (−0.80, 0.60) | 0.08 | 5.3 |
| 3 | (−0.99, 0.10) | 0.035 | 2.7 |

  派生量：`k = 2π/L`，`ω = √(9.8k)`，`Q = 0.125/(k·A)`，每波 Q·k·A = 0.125。

- **相位（M-27）**：JS 每帧计算 `uPhase[i] = mod(k_i·dirZ_i·G.S + ω_i·G.t, 2π)`（双精度）。着色器中 `θ_i = k_i·(dirX_i·x + dirZ_i·z) − uPhase[i]`，x、z 是网格世界坐标。
- **近岸衰减**：`α(x) = mix(0.25, 1.0, smoothstep(SHORE_X, SHORE_X + 12, x))`。
- **`oceanDisp(x, z)`**：
  ```
  dx = α·Σ Q_i·A_i·dirX_i·cos θ_i
  dz = α·Σ Q_i·A_i·dirZ_i·cos θ_i
  dy = α·Σ A_i·sin θ_i
  ```
  - 法线：`N = normalize(cross(P(x, z+ε) − P(x, z−ε), P(x+ε, z) − P(x−ε, z)))`，`P = (x, SEA_Y, z) + oceanDisp`，ε = 0.08。
  - L2/L3 且 `capabilities.precision === 'highp'` 时逐像素计算，否则逐顶点计算。
  - 两条路径共用 `OCEAN_DISP_GLSL`，boot 时预编译。
- **光照**（唯一定义）：
  ```
  lightTerm = uAmbient + uLightColor·max(dot(N, uLightDir), 0.0)
  fresnel   = 0.02 + 0.98·pow(1.0 − max(dot(N, V), 0.0), 5.0)
  m         = clamp(smoothstep(−0.2, 0.3, dy)·(1.0 − smoothstep(SHORE_X, SHORE_X + 30.0, x)) + 0.25, 0.0, 1.0)
  base      = mix(uDeep, uShallow, m)
  refl      = mix(uHorizon, uZenith, clamp(R.y, 0.0, 1.0))
  spec      = pow(max(dot(R, uLightDir), 0.0), uSpecPow)·uSpecI·uLightColor
  color     = mix(base·lightTerm, refl, fresnel) + spec
  ```
- **泡沫**：
  ```
  d         = x − SHORE_X
  band      = smoothstep(−0.3, 0.0, d)·(1.0 − smoothstep(4.0, 6.5, d))
  shoreFoam = band·smoothstep(0.6, 0.9, 0.5 + 0.5·sin(2π(d/1.8 + uFoamPhase) + NA·vnoise256(0.15x, 0.15z − uNoiseOff)))
              // NA 初值 1.2，校准区间 [0.8,1.7]
  h         = dy/(α·0.575)
  crestFoam = smoothstep(T_lo, T_lo + 0.35, h)          // T_lo 初值 0.45，校准区间 [0.35,0.60]
  foam      = clamp(shoreFoam + crestFoam, 0.0, 1.0)·uFoamOn
  final     = mix(color, uFoamColor·max(lightTerm, vec3(0.08)), foam)
  ```
  - `uFoamPhase = mod(t/4.5, 1)`；`uNoiseOff = mod(0.15·S, 256)`；vnoise256 是晶格周期为 256 的值噪声。
  - 任意 4 m 窗口内至少含 floor(4/1.8) = 2 个波峰；AC-4b 用 CPU 镜像验证。
- **雾与色彩空间**：uFogColor、uFogNear、uFogFar 与 scene.fog 同源；片元结尾 `#include <tonemapping_fragment>` 和 `#include <colorspace_fragment>`。
- **uniform 表**：

| 名称 | 类型 | 更新时机 |
|---|---|---|
| uPhase | float[4] | F8 每帧 |
| uNoiseOff | float | F8 每帧 |
| uFoamPhase | float | F8 每帧 |
| uLightDir | vec3 | F8 每帧 |
| uLightColor | vec3 | F8 每帧 |
| uAmbient | vec3 | F8 每帧 |
| uZenith、uHorizon | vec3 | F8 每帧 |
| uDeep、uShallow | vec3 | F8 每帧，按 nightMix 在黄昏与夜两组之间 lerp |
| uSpecPow、uSpecI | float | F8 每帧 |
| uFogColor、uFogNear、uFogFar | vec3 / float / float | F8 每帧 |
| uWaves | vec4[4] | 初始化 |
| uShoreX、uSeaY | float | 初始化 |
| uFoamColor | vec3 | 初始化 |
| uFoamOn | float | 画质变化时 |
| T_lo、NA | float | 初始化（config） |

- **CPU 镜像**：`PB.oceanmath.disp(x, z, phases, out)` 和 `foam(x, z, phases, foamPhase, noiseOff)`，只用于 selfcheck 和 debug 统计，公式逐项对应 GLSL。

### 4.4 抓鱼

#### 4.4.1 生成

- 每个固定步：若 `G.S ≥ G.nextFishS` 且 alive 数 <6，就生成一条：
  - `lane = floor(rng()·3)`；
  - `s = G.S + 70`；
  - `high = rng() < 0.2`；
  - `tSpawn = G.t`，`id = G.fishSeq++`；
  - 立即调用 pose，`prevZ = pose.z`。
- 生成后 `G.nextFishS += 25 + 20·rng()`。静止时不会生成。
- debug：`spawnFish(lane, high, dist)` 令 `s = G.S + dist`。

#### 4.4.2 唯一的 pose 函数

```
fish.pose(f, G, out):
  a = G.t − f.tState
  if f.state === 'caught':
     b = G.rig.beakW；u = smoothstep(0, 1, a/0.12)
     out.x = lerp(f.p0.x, b.x, u)；out.y = lerp(f.p0.y, b.y − 0.05, u)；out.z = lerp(f.p0.z, b.z, u)
     out.scale = 1 − smoothstep(0.15, 0.4, a)；return out
  if f.state === 'missed':
     Dx = max(MISS_XT − f.p0.x, 0.5)                 // MISS_XT = SHORE_X + 1.5 = 17.428571
     out.x = f.p0.x + Dx·min(a/MISS_T, 1)            // MISS_T = 0.62
     out.y = f.p0.y + MISS_VY0·a − 0.5·MISS_G·a²     // MISS_VY0 = 1.5，MISS_G = 18
     out.z = −(f.s − G.S)
     out.scale = 1；return out
  // alive
  a = G.t − f.tSpawn
  laneX = (f.lane − 1)·2.5
  hoverY = (f.high ? 2.65 : 1.55) + 0.18·sin(2π·1.3·a + f.id)
  if a < 1.0: u = a；out.x = lerp(18, laneX, 1 − (1−u)²)；out.y = lerp(−0.8, hoverY, u) + 4.8·u·(1−u)
  else:       out.x = laneX + 0.15·sin(2π·0.6·a)；out.y = hoverY
  out.z = −(f.s − G.S)；out.scale = 1；return out
```
- MISS_XT、MISS_T、MISS_VY0、MISS_G 写入 config。missed 轨迹是闭式、确定性的，不调用 rng；位置的唯一来源仍是 pose（M-10）。
- 进入 alive 以外的状态时，`tState = G.t`，`p0` 取迁移前的 alive pose。
- 移除时机：caught 的鱼在 a≥0.4 时移除；missed 的鱼在 a≥0.8 时移除。
- 朝向：跃出和 missed 时，鼻沿道路相对速度 `normalize(Δx, Δy, Δz − G.bike.v·h)`（相邻两步 pose 之差）；alive 悬停时朝 +Z。

**missed 轨迹的证明**（起点范围：alive pose 满足 p0.x ∈ [−2.65, 18]，p0.y ∈ [−0.8, 2.90]，其中 2.90 是跃出段加 bob 的最大值）：
1. **x 单调不减**：Dx > 0，且 min(a/0.62, 1) 不减。
2. **越过海岸线**：若 p0.x ≥ SHORE_X，则 a_cross = 0；否则 a_cross = 0.62·(SHORE_X − p0.x)/Dx。该式随 p0.x 减小而增大，最坏情况 p0.x = −2.65 时为 0.62·18.5786/20.0786 = 0.574 ≤ 0.6。
3. **移除时的 x**：x(0.8) = max(17.4286, p0.x + 0.5) ≥ 17.4286 ≥ SHORE_X + 0.5 = 16.4286。
4. **y 入海**：a > 0.0833 后 y′ = 1.5 − 18a < 0，y 单调减。y(0.75) = p0.y − 3.9375 ≤ −1.0375 ≤ SEA_Y；y(0.8) = p0.y − 4.56 ≤ −1.66 ≤ SEA_Y − 0.2。
5. **步长**（道路相对 x、y，h = 1/60）：a < 0.62 时 abs(vx) ≤ 20.0786/0.62 = 32.385，abs(vy) ≤ 9.66，合成速度 ≤ 33.80 m/s，即每步 ≤ 0.564 m；a ≥ 0.62 时 vx = 0，abs(vy) ≤ 12.9，即每步 ≤ 0.215 m。
   z 方向随道路移动（v·h ≤ 0.267 m），不计入道路相对位移。
   评审要求的"每步 ≤0.5 m"与"0.6 s 内越过"互斥：lane0 必须以平均 ≥30.97 m/s 移动，即每步 ≥0.516 m。因此上限定为 0.6 m（AC-5d）。

**最坏起点数值表**（用本节常量计算）：

| 起点 p0 | a=0.2 (x, y) | a=0.4 (x, y) | a=0.6 (x, y) | a=0.8 (x, y) |
|---|---|---|---|---|
| lane0 low (−2.65, 1.37) | (3.827, 1.310) | (10.304, 0.530) | (16.781, −0.970) | (17.429, −3.190) |
| lane0 high (−2.65, 2.83) | (3.827, 2.770) | (10.304, 1.990) | (16.781, 0.490) | (17.429, −1.730) |

lane0 high 在 a=0.75 时 y = −1.108 ≤ SEA_Y；两行的 a_cross 均为 0.574。

#### 4.4.3 捕获

`fish.step` 对每条 alive 的鱼依次执行：

1. `pose(f, G, f.pose)`；
2. 用 `b = G.rig.beakW` 判定：
   ```
   |f.pose.x − b.x| < 0.9  且  |f.pose.y − b.y| ≤ 0.45  且
   ( |f.pose.z − b.z| < 1.0  或  (f.prevZ − G.rig.prevBeakZ)·(f.pose.z − b.z) ≤ 0 )
   ```
3. 命中时：`p0 = f.pose` 的拷贝，`state = 'caught'`，`tState = G.t`，推入 catch 事件 `{fishId, air, wheelie: G.bike.wheelie ≥ 0.1745, auto: G.ap.engaged}`，然后**当步重算** pose（u=0，结果等于 p0）；
4. 未命中且（`f.pose.z > 3` 或 `G.t − tSpawn > 14`）时：`state = 'missed'`，`p0` 取当前 pose，当步重算 pose，推入 miss 事件；
5. `f.prevZ = f.pose.z`。

所有鱼处理完后，`G.rig.prevBeakZ = b.z`。

非 alive 的鱼每步只做 `pose(f, G, f.pose)` 和移除检查。fishview 只读 f.pose，不做插值（M-10）。

**high 鱼的可达性**（AC-5c）：
- 只抬轮：喙尖最高 1.913 + 0.45 = 2.363，小于 high 鱼最低点 2.47，够不到；
- 跳跃：喙尖最高 1.663 + 0.893 = 2.556，与鱼的高度差 ≤0.45 的窗口长 0.31–0.55 s，可以抓到。

#### 4.4.4 计分

- 每抓一条 `base = 10`。空中抓到（`airborne`）+5，抬轮抓到（`wheelie ≥ 10°`）+5。
- combo：`G.t − lastCatchT ≤ 4` 时 `combo++`，否则 `combo = 1`。
- 倍率 `min(1 + 0.25·(combo−1), 2.0)`。
- 得分 `points += floor((base + bonus)·倍率)`。
- 自动驾驶抓到的鱼照常计分，事件中标记 `auto:true`。

### 4.5 输入与控制

#### 4.5.1 键位

| e.code | 动作 | 队列 |
|---|---|---|
| KeyW / ArrowUp | throttle | held |
| KeyS / ArrowDown | brake | held |
| KeyA / ArrowLeft | left | held + sim edge |
| KeyD / ArrowRight | right | held + sim edge |
| Space | jump | held + sim edge |
| KeyT | wing | held |
| KeyC | camNext | UI edge |
| Digit1–Digit5 | camSet{n:0–4} | UI edge |
| KeyM | mute | UI edge |
| KeyL | achList | UI edge |
| Escape | esc | UI edge |

- 屏幕按钮：🎥 → camNext，🔊 → mute，🏆 → achList，面板 × → esc。这些在 pointerdown 时入 UI 队列，不计入 ptrCount。
- `e.isComposing` 时忽略。Space、方向键、Escape 要 `preventDefault`。
- `e.repeat` 时不入任何队列，但仍计为活跃。
- 成就面板打开时，动作键照常生效，游戏不暂停。
- sim edge 的合并（在 toCommand 中）：
  - `laneDelta = clamp(#right − #left, −2, 2)`；
  - 只要有 jump edge，`jumpPress = true`。

#### 4.5.2 运动学（`sim.step`）

- **纵向**（M-14）：
  ```
  brake    → a = −9
  throttle → a = 4·(1 − v/16)
  否则      → a = −(0.4 + 0.004v²)
  v = clamp(v + a·h, 0, 16)；S += v·h
  ```
- **变道**：`laneDelta ≠ 0` 时，`target = clamp(lane + laneDelta, 0, 2)`。若 target ≠ lane，则：
  `laneFromX = x`，`laneToX = (target − 1)·2.5`，`lane = target`，`laneT = 0`，`lastLaneReqT = t`，推入 laneChange 事件。
  每步 `laneT = min(1, laneT + h/0.35)`，`x = lerp(laneFromX, laneToX, smoothstep(0, 1, laneT))`。
- **倾斜**：`lean = damp(lean, −0.21·clamp(dx/h/7.1, −1, 1), 12, h)`，其中 `damp(c, t, k, h) = c + (t − c)(1 − e^{−kh})`。
- **held 重复**（在 toCommand 中）：left/right 中恰好一个 held，`laneT === 1`，且 `t − lastLaneReqT ≥ 0.45` 时，发出 ±1。
- **跳跃**：
  - jumpPress 时 `jumpBufT = 0.12`；
  - 每步 `jumpBufT = max(0, jumpBufT − h)`；
  - `!airborne && jumpBufT > 0` 时：`vy = 5.0`，`airborne = true`，`jumpBufT = 0`，推入 jump 事件；
  - 空中（等加速精确积分，ADR-21）：先 `y += vy·h − 7·h²`（即 `−½·14·h²`），再 `vy −= 14h`；`y ≤ 0` 时 `y = 0`，`vy = 0`，`airborne = false`，推入 land 事件；
  - 没有 coyote 机制。按住 Space 不会连跳。
- **抬轮 / 展翅**：
  - wing held：wheelie 以 1.05 rad/s 趋向 0.314，wing 以 4/s 趋向 1；
  - 松开：wheelie 以 1.6 rad/s 回落，wing 以 3/s 回落。
- **踏频**：`rpm = cadenceRpm(v)`；`crank = mod(crank + 2π·rpm/60·h, 2π)`。

#### 4.5.3 指针状态机（M-16，每个按钮带 `data-act`）

```
ptrMap: Map<pointerId, act>    ptrCount: {act: int}
pointerdown(btn): if ptrMap.has(id) return
                  try btn.setPointerCapture(id)
                  ptrMap.set(id, act)；ptrCount[act]++；markActivity
                  若 act 是 left/right/jump：入 sim edge 队列
pointerup / pointercancel / lostpointercapture(id):
                  if !ptrMap.has(id) return
                  act = ptrMap.get(id)；ptrMap.delete(id)
                  ptrCount[act] = max(0, ptrCount[act] − 1)；markActivity
held(act) = keyHeld(act) || ptrCount[act] > 0
```
- 每帧 F2 做自检：若 `Σ ptrCount ≠ ptrMap.size`，从 ptrMap 重建计数，并 `health.nanResets++`（记为"输入修复"）。
- 画布上的 `orbitPtrs: Map<id, {x, y}>`：一指 orbit，两指 pinch，wheel 缩放；清理路径与按钮相同。
- clearAll 的触发：blur、visibilitychange→hidden、pagehide、webglcontextlost、进入 fatal、resumeRunning。clearAll 对所有 id 调用 `releasePointerCapture`（包在 try/catch 中）。
- 按钮设置 `tabindex=-1`，`touch-action:none`；contextmenu 用 `preventDefault`。

#### 4.5.4 触屏布局

- 左下角：◀ ▶，各 72 px。
- 右下角 2×2 网格：▲（油门）、▼（刹车）、JUMP、WINGS(T)，各 64 px。
- 右上角：🎥（切换镜头）、🔊（静音）、🏆（成就）。
- 显示条件：`matchMedia('(pointer:coarse)')` 为真，或者第一次收到 `pointerType === 'touch'` 事件之后。键盘输入始终并存。
- viewport 设置 `width=device-width, initial-scale=1, user-scalable=no`。

### 4.6 自动驾驶

#### 4.6.1 活跃判定（M-15）

**可信事件集合**（M-34；UD-3 字面口径，2026-10-25 已裁决）：
- `input.attach` 在 window 上以 `{capture: true, passive: true}` 注册下列监听，所以 HUD 或面板调用 stopPropagation 也拦不住它们。
- 事件满足 `e.isTrusted === true` 才计入；`isTrusted` 为 false 的程序合成事件一律不计。
- 事件位置不限：画布、触屏按钮、HUD、成就面板、overlay 均计入。

| 类别 | 事件类型 | 判定条件 |
|---|---|---|
| 键盘 | keydown、keyup | 所有按键，包括修饰键单按和 repeat |
| 组合输入 | compositionstart、compositionupdate、compositionend | 全部计入（keydown 在 isComposing 时只计活跃，不入队列，§4.5.1） |
| 指针（鼠标、笔、触屏） | pointerdown、pointerup、pointermove、pointercancel | pointermove 无论是否按键都计入 |
| 滚轮 | wheel | 全部计入 |
| 触摸 | touchstart、touchmove、touchend | 全部计入（兼容不发 pointer 事件的旧 WebView） |

不计入：focus、blur、visibilitychange、resize、scroll、deviceorientation、devicemotion、gamepad（本设计不轮询 gamepad）。

**处理流程**：
- 每个可信事件执行 `lastActivity = nowSec`，并置 activity 脉冲。
- 浏览器在两次 rAF 回调之间分发事件，帧内不会插入事件；所以 F2 读到的脉冲就涵盖了上一帧之后的全部可信事件，F4 在本帧物理之前断开（AC-12c）。
- 判定式：
  ```
  userActive = activity || anyHeld || ptrMap.size > 0 || orbitPtrs.size > 0 || (now − lastActivity) < 6.0
  ```
- `resumeRunning` 中调用 `markActivity(now)`，所以页面重新可见后 6 s 内不会进入 AUTO（AC-12d）。

#### 4.6.2 仲裁（第 3 步，在物理之前执行）

在 F4 执行（v1 的"第 3 步"），位于 F5 物理之前：

1. 若 `userActive && G.ap.engaged`：执行 disengage——`engaged = false`，`targetId = −1`，`prevTArr = ∞`，`jumpedFor = −1`。本帧所有固定步都使用手动 cmd。
2. 若 `!userActive && !G.ap.engaged && app.state === 'running'`：执行 engage——`engaged = true`，`apCatches = 0`，`nextDecT = G.t`。

没有部分接管：要么全部手动，要么全部自动。

#### 4.6.3 决策（每 0.25 s 一次，`command(G)` 每步都会调用）

**目标保留**（每步先执行）：

当 `targetId ≠ −1` 时，只要以下任一条件成立，就释放目标：
- 该鱼不在 G.fish 中；
- 该鱼的 `state ≠ 'alive'`；
- `pose.z > G.rig.beakW.z`（已越过喙）。

释放时：`targetId = −1`，`prevTArr = +Infinity`，`nextDecT = G.t`（下一步立即重选）。

**只要目标未被释放，就不重选**。已锁定的目标不受 `d ∈ (6,60)` 过滤，d ≤ 6 时也保留。

**选新目标**（仅当 `targetId === −1` 且 `G.t ≥ nextDecT` 时执行，然后 `nextDecT = G.t + 0.25`）：
- 在 alive、`pose.z ≤ G.rig.beakW.z` 且 `d = f.s − G.S ∈ (6, 60)` 的鱼中，按 d 升序找第一条满足 `abs(f.lane − lane)·0.35 ≤ d/max(v, 1)` 的鱼；
- 找到后设 `targetId`、`laneGoal = f.lane`，并令 `prevTArr = +Infinity`。重置为 +∞ 的目的是：不让上一个目标的 tArr 参与本目标的跨阈值判断，同时让"初次选中"分支能被识别；
- 没有目标时，在 `G.t ≥ nextDriftT` 时令 `laneGoal = floor(PB.mathx.rng(G)·3)`，然后 `nextDriftT = G.t + 6 + 4·PB.mathx.rng(G)`。

**每步输出 cmd**：
- 变道：`laneDelta = sign(laneGoal − lane)`，**仅当** `laneT === 1 && laneGoal ≠ lane` 时非零，否则为 0。
- 速度：有目标时，`v < 9.5` 则 throttle，`v > 11` 则 brake；没有目标时，以 8 m/s 为目标，误差超过 ±0.5 时修正。
- 跳跃（目标为 high 鱼时每步执行）：
  ```
  tArr = (G.rig.beakW.z − f.pose.z)/max(v, 0.5)
  fire = (jumpedFor ≠ targetId) 且 ( (prevTArr === +Infinity 且 0.15 < tArr ≤ 0.357)
                                     或 (prevTArr ≠ +Infinity 且 prevTArr > 0.357 ≥ tArr) )
  若 fire：jumpPress = true，jumpedFor = targetId
  每步结束前：prevTArr = tArr
  ```
- `wing = false`。

**恰好起跳一次的论证**：
- 选中时 d > 6，且 v ≤ 16，所以首个 tArr ≥ (6 − 1.072)/16 = 0.308 > 0.15。
  - 若首个 tArr ≤ 0.357，走"初次"分支，立即起跳；
  - 否则目标被保留到越过喙（此时 tArr < 0）。tArr 序列从大于 0.357 的值开始、到小于 0 结束，必然存在第一个满足 tArr_k ≤ 0.357 的步 k，且 tArr_{k−1} > 0.357；此时跨阈值分支成立。
- prevTArr 只在换目标时重置，所以第 k 步之前不会被别的值干扰；jumpedFor 门闩保证同一目标不会第二次起跳。因此与决策相位无关，恰好起跳一次。
- 刹车可能让 tArr 暂时回升，但门闩已闭合，不会重复起跳。
- 相邻两条鱼的间距 ≥ 25 m，在 v ≤ 16 时时间间隔 ≥ 1.56 s，大于滞空 0.714 s，所以起跳不会落在空中而丢失。
- 由 AC-12e 的 selfcheck 覆盖。

### 4.7 五种镜头

**公共规则**：
- 阻尼：`p = damp(p, target, k, dt)`。
- 过渡时长：**模式之间**切换（setMode）在 0.6 s 内用 smoothstep 混合位置、slerp 朝向、lerp FOV；**电影镜头内部**机位 A→B→C 之间的切换用 1.2 s 混合，规则相同。两者不叠加：模式切换进行中不推进 cineT。
- 避障最后执行：`y ≥ camFloor(x)`；x ∈ [−15, 60]；追尾镜头离车 ≥2.5。
- 方位角 φ 和 yaw 都从 +Z 轴起，向 +X 方向为正，绕车的竖直轴量。

| # | 名称 | 位置 | 注视点 | FOV | k | near | 构图判据 |
|---|---|---|---|---|---|---|---|
| 0 | 追尾 | 车 + (0, 2.4, 6.5) | (x, 1.3, −4) | 55 | 6 / 10 | 0.1 | §1.3、AC-1a（S1） |
| 1 | 侧视（海侧远景，ADR-34） | (x + 23, 0.6, z − 22) | (x, 0.6, z + 7) | 40 | 4 | 0.1 | 车在中央 1/3；画面下半部分 ≥40% 是海面（S3a）。`0.6` 是**世界绝对高度**（`camFloor(x>0)=SEA_Y+0.8=0`，合法且不被避障抬升）；1080p/FOV 40 实测下半海面 **47.7% / 66.2% / 75.0%**（车道 −2.5/0/+2.5），车包围盒中心 ndc_x = 0.233、车高 94.4 px、整车不出画（AMD-P10-001 §5.5、R-11） |
| 2 | 电影 | 见下方三个镜头 | 车 + (0, 1.0, 0) | 见镜头 | 3 | 0.1 | 车包围盒中心 abs(ndc) ≤0.7（S4a/b/c） |
| 3 | POV | `rig.M·(0, 1.85, −0.47)`，朝向 = rig 旋转后的 (0,0,−1) | 前方 | 70 | 刚性 | 0.05 | 喙尖在离底边 22%–34% 处（预计 27.8%）；喙根深度 0.11 > near（S5） |
| 4 | 自由 / 环绕 | 车 + (0,1,0) + dist·(cos pitch·sin yaw, sin pitch, cos pitch·cos yaw) | 车 + (0, 1.0, 0) | 50 | 8 | 0.1 | 默认 yaw 35°、pitch 18°、dist 9 时：车包围盒中心 abs(ndc_x) 与 abs(ndc_y) ≤0.2；地平线距画面顶 10%–20%（预计 15.2%，由 tan18°/tan25° = 0.697 得出）；海面在画面右半（S14） |

far 一律为 1500。

**电影镜头**（参数 `u = cineT/8`）：
- A：车 + (1.8, 0.6, lerp(−6, −3.5, u))，FOV 45；
- B：φ = lerp(120°, 60°, u)，半径 9，高 lerp(4, 7, u)，FOV 50；
- C：车 + (12, 1.5, 2)，注视车 + (0, 1.0, −1)，FOV 35。

**自由镜头**：
- yaw 在 (−π, π] 内回绕；pitch ∈ [5°, 75°]；dist ∈ [3, 25]。
- 拖拽 0.3°/px；滚轮或捏合使 dist 乘 1.1 的幂。
- 无交互 3 s 后，以 6°/s 自动环绕；`orbit.frozen` 为真时不自动环绕。

**POV 头部可见性**：`dHead = |camPos − G.rig.headW|`。dHead < 0.6 时隐藏 headGroup（头、头盔、墨镜），dHead > 0.9 时显示。喙组始终可见。

**camUsed**：当前 mode 在 F9 每帧累加 dt。

### 4.8 十四个成就（M-21）

- `unlock(id, G)`：若已解锁就返回；否则 `storeApi.update(d => d.ach[id] = Date.now())`，`storeApi.flush()`，推入 achievement 事件。
- 已解锁集合存在 store.doc 中，softReset 不会重新锁上。
- 条件在 `step`（每个固定步）或 `onEvents`（F7）中评估，可安全重复调用。

| id | 名称 | 精确条件 |
|---|---|---|
| FIRST_CATCH | 初次入囊 | 第 1 个 catch 事件 |
| FISH_10 | 渔获十条 | catch 事件后 `G.score.catches ≥ 10` |
| FISH_50 | 海岸渔王 | catch 事件后 `G.score.catches ≥ 50` |
| COMBO_5 | 连击五 | catch 事件后 `combo ≥ 5` |
| AIR_CATCH | 空中截击 | catch 事件且 air 为真 |
| WHEELIE_CATCH | 抬头吞鱼 | catch 事件且 wheelie 为真（≥10°） |
| SPEED_DEMON | 风驰 | v ≥ 15 时 `speedHighT += h`，否则清零；`speedHighT ≥ 3.0` |
| DIST_1K | 一公里 | `G.S ≥ 1000` |
| DIST_5K | 五公里 | `G.S ≥ 5000` |
| NIGHT_RIDER | 夜骑者 | `G.p ∈ [0.32, 0.72)` 且 v ≥ 3 时 `nightRideT += h`；`nightRideT ≥ 30` |
| FULL_CYCLE | 日夜轮回 | 收到 cycleWrap 事件 |
| LONG_WHEELIE | 独轮秀 | wheelie ≥ 0.26 且 v ≥ 4 时 `wheelieT += h`，否则清零；`wheelieT ≥ 3.0` |
| CAMERA_TOUR | 导演 | 5 个镜头的 camUsed 都 ≥ 1.0 |
| AUTO_FISHER | 自动渔夫 | catch 事件且 auto 为真时 `apCatches++`；`apCatches ≥ 3`（engage 时清零） |

- **提示**：toast 队列，每条显示 3.5 s，同屏 1 条，进出各 0.3 s。
- **列表**：14 行，每行显示状态、名称、提示文本、解锁时间；顶部 x/14；Esc 或 L 关闭。
- **持久化**：只经 PB.store（key 为 `pelicanBike.v1`）。localStorage 不可用时 `persistent = false`，只在内存中保存。
- **重置**：面板上的按钮，先 `confirm()`，再 `store.update(d => d.ach = {})`。

### 4.9 音频

- **解锁**：第一次 isTrusted 的 pointerdown、keydown、touchend 或 click 时，创建 `AudioContext || webkitAudioContext` 并调用 `resume()`。创建失败则 `state = 'unavailable'`，静音按钮禁用。
- **门控**（M-18）：main 计算 `gate = (app.state === 'running') && !document.hidden`，并在状态变化、可见性变化、resumeRunning 时调用 `audio.setGate(gate)`。
  - `shouldRun(gate, unlocked, muted) = gate && unlocked && !muted`；
  - 为真时 `ctx.resume()`，为假时 `ctx.suspend()`。audio 不读 app。
- **链路**：
  ```
  sources → musicBus(0.45) / sfxBus(0.8) / ambBus(0.5)
          → master(0.6) → DynamicsCompressor(thr −18, ratio 4) → destination
  ```
  噪声为代码生成的 2 s AudioBuffer。
- **调度器**：setInterval 25 ms，lookahead 0.12 s，16 分音符；只在 `ctx.state === 'running'` 时调度；恢复后 `nextNoteTime = currentTime + 0.05`。
- **BPM**：`target = clamp(2·round(rpm/2), 72, 144)`。只在小节边界应用，每小节变化 ≤12。从 72 到 140 最多需要 6 次边界，耗时 ≤18.1 s。
- **编排**：

| 声部 | 规则 |
|---|---|
| kick | 第 0/4/8/12 步，v≥1 时才有；正弦 120→45 Hz，0.12 s |
| hat | 第 2/6/10/14 步；v≥8 时所有奇数步加奏（0.4）；噪声经 HP 7 kHz |
| bass | 第 0/3/8/11 步，弹根音；锯齿波经 LP 800 Hz |
| pad | 和弦进行 Am–F–C–G，两个三角波失谐 ±6 cent；LP 截止 `lerp(2200, 900, nightMix)` |

- **环境声**：
  - 风：带通中心 `400 + 40v` Hz，增益 `min(0.25, 0.02 + 0.0025v²)`；
  - 海浪：LP 500 Hz，增益 0.08，LFO 周期 4.5 s。
- **音效**：catch 880→1320 Hz，0.18 s；jump 300→600 Hz；land 低频冲击；laneChange 噪声 whoosh；achievement 大三和弦琶音。
- 静音：`store.doc.settings.muted` 初值为 `false`，首次手势解锁后音乐默认开启（UD-5，2026-10-25 已裁决）；用户按 M 或 🔊 后，master 增益置 0 并经 shouldRun 挂起，同时 `store.update` 持久化，下次加载沿用。
- `stats().bpm` 和 `stats().audioState` 由 audio 提供。

### 4.10 画质自适应

| 级别 | DPR 上限 | 海面网格 | 法线 | 泡沫 | 星星 drawRange | 雾 far |
|---|---|---|---|---|---|---|
| L3 | 2.0 | 192×192 | 逐像素（需 highp） | 开 | 3000 | 420 |
| L2 | 1.5 | 128×128 | 逐像素（需 highp） | 开 | 3000 | 420 |
| L1 | 1.0 | 80×80 | 逐顶点 | 开 | 2000 | 360 |
| L0 | 0.75 | 48×48 | 逐顶点 | 关 | 1200 | 300 |

- 初始等级：粗指针设备 L1，其他 L2。`lastChangeT = boot 时刻`。
- **窗口**：1.5 s，以 rawDtMs 计算平均 fps。以下窗口丢弃：含 >250 ms 原始帧的、调用过 `discardWindow` 的、距上次变化 <2 s 的。
- **降级**：连续 2 个有效窗口 fps < 45，降一级；最坏 4.5 s。
- **升级**：连续 5 个有效窗口 fps > 57，且 `now − lastChangeT ≥ 10`，升一级。
- **防振荡**：升级后 10 s 内又降级，则 60 s 内禁止升级。
- **DPR**：`min(devicePixelRatio, cap)`，在 resize、applyQuality、`matchMedia(resolution)` 的 change 回调中重算。尺寸为 0 时跳过。
- 网格和材质在 boot 时预建，并预编译。道具数量不随画质变化。

### 4.11 应用状态与错误（M-13）

```
boot → running | fatal(noWebGL | vendorMissing)
running ⇄ ctxlost
running → fatal(runtime)
ctxlost → fatal(runtime)（只在恢复后 3 帧内再抛错时）
fatal(runtime) → running（只能由"重试"触发）
```

| 状态 | overlay 文案 | 音频门 | 输入 | 循环 |
|---|---|---|---|---|
| running | 隐藏 | 按 §4.9 | 正常 | 运行 |
| ctxlost | "图形上下文丢失，正在等待恢复…"；8 s 后追加按钮[重新加载] | 关 | clearAll | rAF 空转 |
| fatal(noWebGL) | "此浏览器/设备不支持 WebGL，无法显示 3D 场景。请使用新版 Chrome/Safari/Edge 或启用硬件加速。"（无按钮） | 不创建 | 不响应 | 停 |
| fatal(vendorMissing) | "缺少 vendor/three.min.js，无法启动。请确认该文件与 index.html 一起完整复制。"（无按钮） | 不创建 | 不响应 | 停 |
| fatal(runtime) | "运行出错：" + 错误摘要（≤120 字符），按钮[重试]和[重新加载] | 关 | clearAll | 停 |

**检测顺序**（UD-1，2026-10-25 已裁决；构造方式见 ADR-20；结果写入 `app.glVersion`，并由 `stats().glVersion` 暴露）：
1. `typeof THREE === 'undefined'` → fatal(vendorMissing)。
2. 应用自己预创建上下文。属性 `CTX_ATTRS = {alpha:false, depth:true, stencil:true, antialias:true, premultipliedAlpha:true, preserveDrawingBuffer:false, powerPreference:'default', failIfMajorPerformanceCaveat:false}`，与 r162 默认值一致，写入 config。依次调用 `canvas.getContext('webgl2', CTX_ATTRS)`、`canvas.getContext('webgl', CTX_ATTRS)`、`canvas.getContext('experimental-webgl', CTX_ATTRS)`，取第一个非 null 的结果为 `gl`。三者都为 null → fatal(noWebGL)。应用不拦截、不过滤任何 console 输出。
3. 在 try 中执行 `new THREE.WebGLRenderer({canvas, context: gl, antialias: true})`；抛错 → fatal(noWebGL)。
   - **WebGL2**：`gl instanceof WebGL2RenderingContext` 且 `capabilities.isWebGL2 === true` → glVersion = 2，进入 running。
   - **只有 WebGL1**：`isWebGL2 === false`。若 `renderer.extensions.has('ANGLE_instanced_arrays')` 为假，则 fatal(noWebGL)；否则 glVersion = 1，进入 running。功能、画质等级、AC 与 WebGL2 相同，shader 统一按 M-24 编写。r162 此时会输出 1 条 WebGL1 弃用 warning，属于预期，不是 error。
   - `instanceof` 与 `isWebGL2` 的结果互相矛盾 → fatal(runtime)。

**`resumeRunning(reason)`**（唯一入口，M-32），依次执行：
1. `last = performance.now()`，`acc = 0`；
2. `input.clearAll(reason)`，`input.markActivity(nowSec)`；
3. `quality.discardWindow(nowSec)`；
4. 隐藏 overlay；
5. 计算门控并调用 `audio.setGate(gate)`。

调用者只有三处：visible 且 state 为 running、`webglcontextrestored`、重试。

- **hidden**：clearAll，音频门关，discardWindow；不改变 state。
- **ctxlost**：`preventDefault()`；`state = 'ctxlost'`，`ctxLostAt = now`；overlay 每帧检查 `now − ctxLostAt ≥ 8 s`，满足时显示按钮。
  - restored 时：预编译两种海面材质，`state = 'running'`，`postRestoreFrames = 3`，调用 `resumeRunning('restored')`；
  - 处于 fatal 时，忽略 ctxlost 和 restored 事件。
- **`onFrameError(e)`**：
  - `health.errors.push(now)`，删除 10 s 之前的记录；
  - 若 `postRestoreFrames > 0` 或 `errors.length ≥ 3`：进入 fatal(runtime)；
  - 否则：`softReset()`（即 `newSession()`），`health.softResets++`，继续运行；
  - `postRestoreFrames` 每帧递减。
- **重试**：`softReset()`，`health.errors = []`，`state = 'running'`，`resumeRunning('retry')`，重启 rAF。
- **重新加载**：`location.reload()`。

### 4.12 数值健康检查（M-20）

`sim.healthCheck(G, health)` 每个固定步执行：

- **车辆**：以下字段必须全部是有限值：x、y、vy、v、a、laneFromX、laneToX、laneT、wheelie、wing、crank、lean、jumpBufT、rpm；并且满足 `|x| ≤ 3`、`y ∈ [−0.01, 1.5]`、`v ∈ [0, 16]`、`laneT ∈ [0, 1]`、lane 是 {0,1,2} 中的整数。
  任一失败时调用 `resetBike`：
  ```
  lane      = 合法 ? lane : 1
  x         = laneFromX = laneToX = (lane − 1)·2.5；laneT = 1
  y = 0；vy = 0；airborne = false；jumpBufT = 0
  v         = isFinite(v) ? clamp(v, 0, 8) : 0
  a = 0；wheelie = 0；wing = 0；lean = 0
  crank     = isFinite(crank) ? mod(crank, 2π) : 0
  rpm       = cadenceRpm(v)
  lastLaneReqT = G.t
  ```
  然后 `health.nanResets++`。
- **鱼**：pose 中任一分量非有限，直接从数组删除，`nanResets++`。
- **围巾**：按 §4.1。
- **G.t / G.S**：非有限时恢复为 `G.lastGood` 的值，并 `throw` 合成错误，交给 onFrameError。
- **nan-storm**：`health.nanWindow` 记录时间戳；10 s 内 ≥20 次，`throw` 合成错误 `'nan-storm'`。
- 健康通过时，更新 `G.lastGood = {t, S}`。


### 4.13 角色骨架 rig（M-25）
- **变换**：`M = T(x, y, 0)·Rz(lean)·Rx(wheelie)`。
  - `Rx(θ)`：y' = y·cosθ − z·sinθ，z' = y·sinθ + z·cosθ（θ>0 时前端抬起）；
  - `Rz(φ)`：x' = x·cosφ − y·sinφ。
- **`rig.compute(G)`**：写 M；用 `toWorld` 把下列局部点变换到世界坐标：
  - beakW ← BEAK_TIP_L；
  - anchorW ← 围巾锚点；
  - torsoW、neckW ← 碰撞球中心；
  - headW ← (0, 1.75, −0.42)。
- **复算样例**（供 selfcheck）：
  - 中立：beakW = (x, 1.663 + y, −1.072)；
  - wheelie = 18°：beakW = (x, 1.913, −0.506)；
  - lean = 0.21：beak.x 偏移 −0.347。
- **渲染**：pelicanRoot 设 `matrixAutoUpdate = false`，`matrix.fromArray(G.rig.M)`；所有子件使用 §1.5 的局部坐标；在 BEAK_TIP_L 处放一个 Object3D 作为 beakMarker（AC-1d）。
- POV 相机、围巾锚点、捕获判定都使用同一个 G.rig。

## 5. 实施包与集成

### 5.1 实施包（按顺序执行，每个包只允许修改所列文件）

**通用允许集**（每个包除了表中文件外，还可以修改以下文件，但都**只能追加本包需要的内容**，不得改写其他包写入的字段、常量或行）：
- `index.html`：按 §3.2 的顺序插入本包的 script 标签与 DOM；
- `js/main.js`：追加本包模块在 boot、initSession、帧序中的调用行；
- `js/core/config.js`：P1 创建，后续只追加常量；
- `js/debug.js`：P1 创建，后续只追加钩子与 stats 字段；
- `tests/selfcheck.html`、`tests/selfcheck.js`：P2 创建，后续只追加本模块的用例；
- `tools/e2e/*`：P0 创建，后续只追加本包的 Playwright 用例。

**其他规则**：
- 只接线已存在的模块，不允许出现占位或 no-op。
- 每个包完成时，页面都必须能在 `file://` 下运行，并满足 §5.4 第 2 条的 Console 判据（由 Playwright 断言）。

| P | 新增或修改的文件 | 完成后可运行的功能 | 检查项 |
|---|---|---|---|
| P0 | tools/vendor-three.sh、tools/vendor/package.json、tools/vendor/package-lock.json、tools/three-smoke.html、tools/e2e/package.json、tools/e2e/package-lock.json、tools/e2e/run.mjs、vendor/three.min.js、vendor/three.LICENSE、vendor/VERSION.txt | 冒烟页能渲染一个立方体 | [build] §5.7 全部（PR-2）；[browser] three-smoke.html 中 `THREE.REVISION === '162'`，非 file 请求数为 0；[browser] 冒烟页按 §4.11 的方式预创建上下文；Chromium 用 `--disable-webgl2` 启动后打开冒烟页，下列能力断言全部成立：`isWebGL2 === false`、`gl.getParameter(gl.VERSION)` 以 `WebGL 1.0` 开头、`!(gl instanceof WebGL2RenderingContext)`、三角面 = 12、非背景像素 > 0，并满足 §5.4 第 2 条的 Console 判据（PR-3 能力路径；判据只看能力读数，不看 flag 名，ADR-20）。PR-3 的设备支路（没有 `ANGLE_instanced_arrays` 的真实 WebGL1 设备、移动端 WebGL1 设备）在 P16 出口关闭，P0 阶段状态为 PENDING-USER-HARDWARE，不阻塞 P1 |
| P1 | css/style.css、js/core/config.js（创建）、js/render/scene.js、js/hud.js（只做 overlay）、js/debug.js（创建）、js/store.js | 天空色清屏；三态 overlay；`stats()` 可用 | [browser] 用 `--disable-webgl` 启动显示 noWebGL 文案；改名 vendor 文件显示 vendorMissing 文案；`loseContext` 后 8 s 出现按钮；glVersion 有读数 |
| P2 | js/core/mathx.js、tests/selfcheck.html（创建）、tests/selfcheck.js（创建） | 同 P1 | [selfcheck] mathx 与 rng；PR-1 投影（AC-1a、3a、3b、8a mode 4、8b 的预计值） |
| P3 | js/core/input.js | 键盘、指针、可信事件状态出现在 stats() | [selfcheck] AC-6e 队列（伪事件对象）；[browser] blur、拖出按钮、hidden 后 heldSet 为空 |
| P4 | js/core/sim.js、js/core/rig.js、js/render/world.js、js/render/camera.js（只做 mode 0） | 可以骑行，道具循环；main 新增 newSession、initSession（只调用 rig.initState） | [selfcheck] createState 不引用 scarf 和 daynight；newSession 后 §3.3 中的字段存在且有限；AC-6a/6b/6c/6d/6f（跳跃按 §4.5.2 等加速精确积分）；rig 样例；[browser] §5.2 第 19 条的道具部分（三档 S、双精度源层与 float32 层双层判据、回绕判定；ADR-21） |
| P5 | js/render/pelican.js | 角色可见，踩踏与倾斜正确 | [browser] AC-1d、footPedalErr；[screenshot] S1（只验构图，海面待 P8） |
| P6 | js/core/scarf.js、js/core/rig.js（只追加 toLocal）、js/render/pelican.js（围巾部分、躯干分段数、墨镜位置） | 围巾飘动；main.initSession 追加 `scarf.initState` | [selfcheck] AC-2a/2b/2c、NaN 注入、碰撞外置；[browser] AC-2d；S7 由 P10 产出（§5.3），P6 出口不以 S7 判定 |
| P6-fix | js/core/scarf.js、js/core/rig.js（只追加 toLocal）、js/render/pelican.js（围巾部分、躯干分段数、墨镜位置）、js/core/config.js（追加 C_Q/TORSO_EPS/RESET_DIR，删除 C_D 使用点）、js/debug.js（追加 setRibbonVisible/setGlassesVisible/scarfOutsideMinF）、tests/selfcheck.js、tools/e2e/* | 二次阻力律、椭球碰撞、复位方向、墨镜几何、飘带/墨镜可见性钩子 | [selfcheck] `scarf.quadDrag.AC2a`、`scarf.quadDrag.AC2b.peakAndSettle`、`scarf.AC2c.windInducedVsControl`、`scarf.collider.outsideTorso.v{0,8,16}`、`scarf.reset.direction`、`rig.toLocal.roundTrip`、`pelican.glasses.cornersOutsideHead`、`PR8.sweep`；[browser] `AC-1b-i-ribbonOnly-S1`、`AC-1b-ii-helmet-S1`、`AC-2d-10min-rerun`（AMD-P8-001 §7） |
| P7 | js/core/daynight.js、js/render/sky.js、js/render/scene.js（灯光、雾） | 昼夜循环；main.initSession 追加 `daynight.initState`；F6 追加 sample；F8 追加 `world.setLamps(G.env.lamps)`、`pelican.setNight(G.env.nightMix)` | [selfcheck] AC-3d、星星分布；[screenshot] S1、S2 中的天空部分 |
| P8 | js/core/oceanmath.js、js/render/ocean.js | 海面与泡沫 | [selfcheck] AC-4a/4b/4c/4d；[build] `grep -rnE "precision +[lmh][a-z]*p " js/ tests/ index.html` 结果为 0，且 `grep -rn "RawShaderMaterial" js/` 结果为 0；S6、S12 由 P10 产出（§5.3），P8 出口不以它们判定 |
| P8-fix | js/render/ocean.js（只改 detectHighp）、tools/e2e/*（build 用例） | 精度探测改为字面读 capabilities 的精度字段（ADR-30） | [build] `grep -rnE "precision +[lmh][a-z]*p " js/ tests/ index.html` = 0 且 `grep -rn "RawShaderMaterial" js/` = 0；[browser] L1（逐顶点）与 L2（逐像素）两条路径复跑通过（AMD-P8-001 §17.1） |
| P9 | js/core/fish.js、js/render/fishview.js、js/hud.js | 抓鱼、计分、HUD | [selfcheck] AC-5b/5c/5d、迁移连续性；[browser] AC-5a；S11 由 P10 产出（Q-12），P9 出口不以 S11 判定 |
| P10 | js/render/camera.js、js/core/config.js（只改 `CFG.CAM_SIDE` 的 offset/look，ADR-34）、js/debug.js（只追加 `forceLamps`）、tests/selfcheck.js、tools/e2e/* | 5 种镜头（mode 1 为海侧远景） | [selfcheck] 构图数学，含 ADR-34 的三条车道下半海面 ≥40% 与车高、ADR-33 的海面占比上界复算；[browser] AC-8b；[screenshot] S3a、S3b、S4a/b/c、S5、S13（AC-6d 的视觉证据在此产出，因为 P4 还没有角色模型）、S14、S7、S11（Q-12：mode 1 属本包，P9 只负责实现鱼与 HUD） |
| P11 | js/core/achievements.js、js/hud.js、js/store.js | 成就系统 | [selfcheck] 14 条与幂等（store 用桩）；[browser] 刷新后持久化、store 只在内存、muted 初值为 false |
| P12 | js/core/autopilot.js | 自动驾驶 | [selfcheck] AC-12b/12e；[browser] AC-12a/12c/12d |
| P13 | js/audio.js | 音频 | [selfcheck] AC-9d；[browser] AC-9a/9b/9c |
| P14 | js/core/quality.js、js/render/scene.js | 画质自适应 | [selfcheck] AC-11 时间序列；[browser] burnMs |
| P15 | css/style.css、index.html（只删除 P9/P11/P12 追加的内联 `<style>` 块）、js/hud.js、js/core/input.js（只改按钮绑定） | 触屏；HUD/toast/成就面板的样式从 index.html 内联块原样追加到 css/style.css（不改写 P1 规则；选择器集合交集为 0，见 AMD-P10-001 §5.8） | [browser] Playwright 触屏模拟 AC-10；真机 AC-10（PR-6）；[build] `grep -c "<style" index.html` = 0；[screenshot] S8、S9 迁移前后差分像素数 0 |
| P16 | 全部文件，只做修复 | 交付 | §5.2、§5.3 全部；[build] `grep -rn "TODO" js/` 与 `grep -rn "STUB" js/` 结果为 0；M-22 的两条 grep 结果为 0；Performance 录制 GC 停顿 <5 ms（M-31）；PR-3 设备支路（用户真机，与 PR-5、PR-6 同批）：没有 `ANGLE_instanced_arrays` 的真实 WebGL1 设备进入 fatal(noWebGL) 且显示 §4.11 文案；有该扩展的移动端 WebGL1 设备进入 running 且 glVersion = 1 |

### 5.2 边界情况清单（每条都要在 P16 勾选）

1. 按住 A 10 s，期间不进入 AUTO。
2. 指针拖出按钮，或被系统打断（lostpointercapture），按钮不会卡住。
3. 双指按同一按钮，抬起一指仍为 held。
4. 按住按键时 Alt-Tab，回来后不卡键。
5. 隐藏 30 s 后回来：首帧不补跑物理，输入为空，6 s 内不进入 AUTO。
6. `loseContext` 后 `restoreContext`：overlay 只有一层，音频门关闭，恢复后走 resumeRunning。
7. 处于 fatal 时切到 hidden 再切回 visible，音频不恢复。
8. 冻结时间时，近岸高光连续（S12）。
9. `injectNaN('bike' | 'scarf' | 'fish' | 'laneT' | 'laneToX')` 后 1 步内自愈，之后不再重复复位。
10. 跨不同 DPR 的显示器、浏览器缩放时，DPR 重算。
11. POV 往返 20 次，从不出现无头鹈鹕。
12. 移动端 mediump 回退时海面走逐顶点路径并能编译（PR-5）。
13. 同时按 W 和 S，速度递减。
14. high 鱼只能靠跳跃抓到（AC-5c）；摆动时判定与画面一致。
15. 10 s 内用 `throwOnce()` 注入 3 次异常，进入 fatal；点"重试"后恢复，计数重新开始。
16. localStorage 抛异常时不报错，`persistent = false`。
17. 输入法组合输入、Space 滚动页面、长按菜单、双击缩放都被屏蔽。
18. 窗口最小化（尺寸为 0）时不报错。
19. 分别 `setS(9999.0)`、`setS(999990.0)`、`setS(9999990.0)`，每档以 v=16 连续骑行 150 帧，越过 1e4、1e6、1e7 附近：海面位移满足 AC-4d；道具（P4 起）与鱼（P9 起，只判 alive 与 missed 帧）按同一结构判定（ADR-21）：① 双精度源层：用 §1.1（鱼用 §4.4.2）公式由 S_k、S_{k−1} 重算 z_src，非回绕帧 `abs(Δz_src − ΔS) ≤ 1e−6`；② float32 层：从真实 instanceMatrix（鱼为 mesh.matrixWorld）回读 z_inst，每个样本 `z_inst === Math.fround(z_src)`，非回绕帧 `abs(Δz_inst − ΔS) ≤ ½·ulp32(z_src,k) + ½·ulp32(z_src,k−1) + 1e−6`，其中 `ulp32(x) = 2^(floor(log2 abs(x)) − 23)`（x=0 取 2^−149）；③ 回绕帧当且仅当 `floor((i·spacing − S)/span)` 在 k−1 与 k 之间变化，此时要求 `abs(Δz_src − (ΔS − span)) ≤ 1e−6` 且 `z_src,k−1 + ΔS > 20`；回绕帧以外，凡违反 ② 上界者判为跳变（FAIL）。写矩阵与测试重算都调用同一个 `PB.world.propZ`；测试不读任何镜像状态。`setS` 瞬移本身不作为判据。
20. `loseContext` 且不恢复：8 s 后出现[重新加载]。
21. 零步帧中按下的 D：下一帧执行变道，只执行一次。
22. softReset 之后，`health.errors`、`scarfResets` 仍然保留。
23. 捕获后 0.4 s 内鱼与喙的距离 ≤ 插值剩余量，z 不沿道路漂移；missed 的鱼满足 AC-5d：a ≤ 0.6 时 x ≥ SHORE_X，移除步 x ≥ SHORE_X + 0.5 且 y ≤ SEA_Y − 0.2。
24. 处于 AUTO 时，分别注入无按键 mousemove、wheel、HUD 上的 pointermove、keydown、touchstart、compositionstart，每一种都在下一帧断开（AC-12c，UD-3 字面口径）。
25. 成就面板打开时，WASD 仍然生效，Esc 关闭面板。

### 5.3 视觉证据计划

**执行方式**（UD-4，2026-10-25 已裁决）：
- `[browser]` 和 `[screenshot]` 由 `tools/e2e/run.mjs` 用 Playwright 驱动 Chromium 执行：以 `file://` 打开 `index.html?debug=1`，调用 `PB.debug` 钩子，读取 `stats()`，截图，并用脚本判定像素规则。
- 人工只做复核，不作为主判据。
- Playwright 只是 `tools/e2e/` 下的开发依赖，不进入交付物。
- 每次运行都统计页面请求，非 `file://` 请求数必须为 0（AC-9a），所以页面运行时零网络请求的要求不变。
- 真机项（PR-5、PR-6、PR-7）仍然人工执行，读数记录在 impl-notes。

**debug 钩子**（只在 `?debug=1` 时挂载）：
`setPhase(p)`、`freezeTime(b)`、`setCamera(i)`、`setCineShot(k, t)`、`setOrbit(yaw, pitch, dist, frozen)`、`setSpeed(v)`、`setS(S)`、`spawnFish(lane, high, dist)`、`pauseOnEvent(type)`、`setWheelie(rad)`、`burnMs(ms)`、`forceQuality(l)`、`forceLamps(x)`（只把路灯亮度冻结为 x，下一次 `forceLamps(null)` 恢复 `G.env.lamps` 驱动；S3b 用）、`injectNaN(target)`、`throwOnce()`、`loseContext()`、`restoreContext()`、`unlockAch(id)`、`showDebugShapes(b)`、`stats()`。

**`stats()` 字段**：fps、fpsWin、level、dpr、tris、calls、appState、glVersion、p、t、S、v、a、x、y、vy、lane、laneT、wheelieDeg、wingAmt、rpm、bpm、apEngaged、idleSec、heldSet、ptrMapSize、ptrCountSum、orbitPtrs、scarfTipAngleDeg、scarfLagX、scarfResets、nanResets、softResets、errorsIn10s、starsInView、fishAlive、beakErr、fishMeshErr、lightDirErr、headVisErr、footPedalErr、audioState、muted、storePersistent。

**截图通用条件**：1920×1080，L2，`freezeTime(true)`，HUD 隐藏，v=8 稳态 3 s，lane 1。

| 编号 | 设置 | 判据 | 产出包 |
|---|---|---|---|
| S1 | p=0.05，mode 0 | AC-1a、AC-1b(i)(ii)、AC-1c、AC-3a、T2、T8 | P5（构图）、P8（完整）、P6 修复后重拍 |
| S2 | p=0.50，mode 0 | AC-3b、AC-3c、T4、T6 | P7（天空）、P8（完整） |
| S3a | p=0.50，mode 1 | 车在中央 1/3；画面下半部分 ≥40% 是海面（AC-8a 的 mode 1 分项）。围巾取色只在 S1 判（ADR-35）；路灯改由 S3b 判 | P10（ADR-33；机位见 ADR-34） |
| S3b | p=0.50，mode 0 | 路灯亮：同一冻结帧用 `PB.debug.forceLamps(0)` 与 `forceLamps(1)` 各渲染一次，差分像素 L1>30（沿用 AC-1b(i) 的差分口径）。判据锚在**路面光斑圆片**（半径 2.5 m）：凡圆片完整落在画框内、且圆心深度 < 雾 near（140 m）的，都必须在圆片内出现差分像素（mode 0 + lane 1 下最差 S 仍有 4 个圆片、最小直径 37 px）；灯头投影框只作补充证据（远处框仅 3–6 × 1–3 px，单像素判据不稳） | P10（ADR-33；锚点选择见 AMD-P10-001 §5.2） |
| S4a/b/c | p=0.15，mode 2，`setCineShot(0/1/2, 4)` | 车包围盒中心 abs(ndc) ≤0.7；S4a 另判 AC-1b(iii) | P10 |
| S5 | p=0.05，mode 3 | AC-8b 中的喙位置；看不到头盔 | P10 |
| S6 | p=0.05，mode 4，`setOrbit(−90°, 35°, 14, true)` | 泡沫线 ≥2 条可见。主体可能被 x=−8 的棕榈带遮挡（实测随 S 变化：至少一处被挡 11%、全部被挡 2%），主体可见性不作本图判据（ADR-38） | P10（P8 时 mode 4 尚不存在；ADR-28） |
| S7 | p=0.05，mode 4，`setOrbit(90°, 10°, 4, true)`，v=8 稳态 10 s | 围巾形态（数值以 AC-2a 为准）。飘带-only 差分像素只在 S1 判（AC-1b(i)，阈值 150 不变），本图不重复判（ADR-36）。机位由 ADR-34 从 mode 1 改为 mode 4：海侧远景下围巾精确投影只有 31.1 px²，像素判据必失败；mode 4 下为 426.3 px² | P10（ADR-28、ADR-34） |
| S8 | `unlockAch('FIRST_CATCH')` 后打开列表 | toast 与列表 | P11 |
| S9 | 390×844，DPR 3 模拟，p=0.05，mode 0 | 按钮完整，不遮挡车 | P15 |
| S10 | `forceQuality(0)`，p=0.05，mode 0 | 最低视觉 | P14 |
| S11 | `spawnFish(1, false, 30)`，`pauseOnEvent('catch')`，mode 4，`setOrbit(90°, 15°, 12, true)`，`showDebugShapes` | 鱼在捕获框内（捕获框在画内、宽约 215 px） | P9 实现 + P10 产出（与 ADR-28 同构；用户 2026-10-25 批准，Q-12。机位由 ADR-34 从 mode 1 改为 mode 4：海侧远景下车只有约 94 px 高，捕获框不可读） |
| S12 | p=0.05，mode 4，`setOrbit(−90°, 20°, 10, true)` | 近岸高光无接缝。主体可能被 x=−8 的棕榈带遮挡（实测：至少一处被挡 4%、全部被挡 4%），主体可见性不作本图判据（ADR-38） | P10（ADR-28） |
| S13 | `setWheelie(0.314)`，mode 4，`setOrbit(90°, 10°, 4, true)`，`showDebugShapes` | 喙标记与捕获球重合；AC-6d 的视觉证据（骑手高约 612 px，调试框可读） | P10（唯一归属；机位由 ADR-34 从 mode 1 改为 mode 4） |
| S14 | p=0.05，mode 4，`setOrbit(35°, 18°, 9, true)` | §4.7 mode 4 判据（AC-8a） | P10 |

另外由 Playwright 录一段 30 s 视频：变道时的围巾、POV 切换、AUTO 接管与打断。

### 5.4 集成顺序

按 P0→P16 依次进行。每包完成时：

1. selfcheck 全部 PASS；
2. 用 `file://` 打开 index.html，满足 Console 判据：error 级消息数为 0，pageerror 数为 0，不设白名单，不做过滤；warning 允许，但要逐条记入 impl-notes（文本、来源文件、场景），出现以前没有记录过的 warning 类别时，按 §5.6 追加一条 Q-nn；Network 中非 file 请求数为 0；
3. 该包的 [browser] 和 [screenshot] 检查项逐条记录在 `docs/remote/TASK-002/impl-notes.md` 中，包括读数和截图文件名；
4. 只接线已存在的模块。

### 5.5 性能预算

| 项 | 值 | 测量 |
|---|---|---|
| 桌面帧率 | 集显在 L2 下 ≥55 fps | `stats().fpsWin`，填入 PR-9 表 |
| 移动帧率 | 中端机在 L1 下 ≥30 fps | `stats().fpsWin`，填入 PR-9 表 |
| 三角面 | L3 ≤150k，L0 ≤50k | `stats().tris` |
| draw call | ≤100 | `stats().calls` |
| 鹈鹕 + 车 | ≤40 个 mesh，≤8k 三角面 | 静态计数 |
| 包体 | 应用 JS + CSS ≤180 KB；vendor ≤800 KB | §5.7 |
| JS 堆 | <120 MB | DevTools Memory |
| 分配（M-31） | 稳态帧只允许事件对象（≤10 个/帧），其余接口都用 out 参数 | Performance 录制，GC 停顿 <5 ms |

### 5.6 未知项升级协议

实施中遇到本设计没有覆盖的问题时：
1. 在 `docs/remote/TASK-002/impl-notes.md` 中追加一条 `Q-nn`，写明现象、相关的 M 或 AC 编号、临时做法。
2. 如果涉及 MUST 条目、色值或构图、成就条件、输入或自动驾驶优先级，或者影响验收：**停下来，等用户或评审裁决**，不要自行改动。
3. 只涉及 MAY 的问题，可以自己决定，但要记录理由。
4. "需实测"的项目必须附实测数据（设备、浏览器版本、数值）。

---


### 5.7 构建锁（M-30）

- **版本**（UD-1，2026-10-25 已裁决）：
  - `tools/vendor/package.json` 的 dependencies 写确切版本：`"three": "0.162.0"`、`"esbuild": "0.24.0"`；提交 package-lock.json；
  - `tools/e2e/package.json` 的 devDependencies 写确切版本：`"playwright": "1.48.2"`；提交 package-lock.json；浏览器用 `npx playwright install chromium` 安装（UD-4）；
  - 记录 Node 主版本。
- **命令**（`tools/vendor-three.sh`，只在 Mac 联网时执行）：
  ```
  cd tools/vendor && npm ci
  npx --no-install esbuild node_modules/three/build/three.module.js \
      --bundle --format=iife --global-name=THREE --minify --target=es2018 \
      --legal-comments=none --outfile=../../vendor/three.min.js
  cp node_modules/three/LICENSE ../../vendor/three.LICENSE
  ```
- **VERSION.txt** 记录：three 版本（0.162.0）、esbuild 版本、node 版本、输入 three.module.js 的 sha256、输出的 sha256 和字节数、完整命令。
- **[build] 检查**：
  - 输出 ≤800 KB；
  - `grep -c sourceMappingURL vendor/three.min.js` 结果为 0；
  - 输出以 `var THREE=` 开头，不含顶层 `import` 或 `export`。
- **[browser] 冒烟**（P0，PR-2、PR-3；构造方式与 §4.11 相同，即预创建上下文）：
  - `tools/three-smoke.html` 在默认 Chromium 中 `THREE.REVISION === '162'`、`isWebGL2 === true`，且 `gl instanceof WebGL2RenderingContext`；
  - 在 `--disable-webgl2` 下：`isWebGL2 === false`，`gl.getParameter(gl.VERSION)` 以 `WebGL 1.0` 开头，`!(gl instanceof WebGL2RenderingContext)`，三角面 = 12，非背景像素 > 0；`renderer.extensions.has('ANGLE_instanced_arrays')` 的读数记入 P0 证据；
  - 两个场景都满足 §5.4 第 2 条的 Console 判据；判据只看能力读数，不看 flag 名（ADR-20）。
- **体积超限**：停下并升级（§5.6）。备选方案是改用自定义入口，只导出用到的符号以便 tree-shake，这需要评审批准。
- **离线验证**：
  1. 删除 `tools/vendor/node_modules` 和 `tools/e2e/node_modules`；
  2. 断网；
  3. 双击 `index.html`；
  4. 满足 §5.4 第 2 条的 Console 判据，`THREE.REVISION` 为 '162'，DevTools Network 中没有非 file 请求。
- **最终提交**：
  - vendor/ 下三个文件；
  - tools/vendor-three.sh、tools/vendor/package.json、tools/vendor/package-lock.json、tools/three-smoke.html；
  - tools/e2e/package.json、tools/e2e/package-lock.json、tools/e2e/run.mjs。
  - 不提交任何 node_modules，也不提交 Playwright 浏览器。交付页面不引用 tools/ 下的任何文件。

## 6. 决策记录与风险

### 6.1 ADR

| ADR | 决策 | 备选 | 否决原因 | 可逆性 |
|---|---|---|---|---|
| 01 | three `0.162.0`（r162）+ esbuild@0.24.0 打成 IIFE，只 vendoring three（UD-1，2026-10-25 已裁决） | 官方 UMD、与应用代码合并打包、自研、r170 | UMD 已移除；合并打包需要反复构建；自研没有量化理由；r170 不支持 WebGL1 | 中 |
| 02 | 支持只有 WebGL1 的设备：WebGL2 优先、WebGL1 回退，GLSL ES 1.00（UD-1，2026-10-25 已裁决） | 只支持 WebGL2 | 用户已裁决支持 WebGL1 | 中 |
| 03 | 经典 script + PB 命名空间 | ES module | file:// 下 CORS | 低 |
| 04 | 跑步机世界 | 车辆真实前进 | 精度问题 | 低 |
| 05 | 固定步长，渲染不插值 | 带插值的渲染 | 会引入第二个位置来源 | 中 |
| 06 | 海面法线用有限差分 | 解析导数 | 衰减因子容易漏 | 高 |
| 07 | Verlet 2×13，4 子步，6 次迭代；风场按速度缩放 | 显式弹簧、骨骼摆动 | 稳定性或惯性不足 | 高 |
| 08 | 周期 240 s，完整闭环：黄昏→暮光→夜→黎明前→日出→黄昏，无缝（UD-2，2026-10-25 已裁决） | 硬切回黄昏 | 用户已裁决 | 高 |
| 09 | blob 阴影 | shadowMap | 切画质要重编译 | 中 |
| 10 | 4 级离散画质 + 滞回 | 连续缩放 | 不可测 | 高 |
| 11 | 自动驾驶全有或全无，空闲阈值 6 s，单一目标 | 部分辅助 | 仲裁复杂 | 高 |
| 12 | 活跃集合用字面口径：任何 isTrusted 输入（含无按键 mousemove）都取消自动驾驶（UD-3，2026-10-25 已裁决） | 排除无按键的鼠标移动 | 会收窄契约 #12 | 高 |
| 13 | 成就跨会话持久化 | 只在本局有效 | — | 高 |
| 14 | 不做 rebase；着色器周期量由 JS 双精度生成 | 取模 S / 整除波长 | dirZ 投影导致相位跳变 | 高 |
| 15 | rig 单一变换 | 只统一鱼的位置 | 喙与判定不同源 | 中 |
| 16 | 唯一 store；muted 初值 false（UD-5，2026-10-25 已裁决） | 各模块各写各的 | 丢更新 | 高 |
| 17 | 增量接线：通用允许集只能追加；分期 initState，经唯一的 newSession | 预置占位 | 违背"不得有占位" | 高 |
| 18 | 月亮在天空 shader 中绘制 | Sprite | 尺寸口径不一 | 高 |
| 19 | [browser]/[screenshot] 由 Playwright 执行，只作开发依赖（UD-4，2026-10-25 已裁决） | 只做人工清单 | 不可复现 | 高 |
| 20 | PR-3 的 WebGL1 验证改为：Chromium 用 `--disable-webgl2` 启动，判据为能力断言（isWebGL2=false、VERSION 以 WebGL 1.0 开头、不是 WebGL2RenderingContext 实例），不看 flag 名；应用和冒烟页都预创建上下文（webgl2 → webgl → experimental-webgl，属性与 r162 默认一致），再传给 `WebGLRenderer({context})`；Console 判据为 error 和 pageerror 都是 0，warning 只记录。UD-1 的用户裁决原文（含"测试矩阵多一项 `--disable-es3-apis`"）不改，其中的 flag 名由本条取代，取代的只是测试方法（AMD-P0-001，2026-10-25） | 保留 `--disable-es3-apis`；两个 flag 同时用；让 three 自己 getContext，再白名单过滤 console.error | `--disable-es3-apis` 在 Chromium 130 下不关闭 WebGL2，结果是假通过；同时用两个 flag 时生效的只有 `--disable-webgl2`，判据仍依赖 flag 语义；白名单过滤会掩盖真实的上下文创建错误 | 高 |
| 21 | AMD-P4-001（2026-10-25）。① 跳跃：修订前 §4.5.2 为一阶离散（`vy −= 14h; y += vy·h`），在 H=1/60 下最高点为 0.8517，截断误差 v0·h/2 = 0.0417，大于 AC-6c 半宽 0.03；修订后为等加速精确式（`y += vy·h − ½gh²; vy −= gh`），逐步点等于解析解，最高点 0.8925、滞空 0.7167；v0、g、H、AC-6c 都不变。② 道具和鱼的连续性：修订前把 ±1e−6 套到所有层，但 float32 在 abs(z) ≥ 256 时单值误差可达 1.5e−5，这个要求物理上不可达；修订后 ±1e−6 只保留在双精度源层，float32 层要求逐位等于 `Math.fround(z_src)`（正确舍入，是 float32 能给出的最严判据），逐帧上界为逐端点 ½ulp32 之和加 1e−6，回绕由源公式中的 floor 变化唯一判定；删除测试用的 Float64 镜像，改为公式重算并回读真实矩阵。两项都没有放宽判据：第一项的判据原值不变，第二项把不可达的要求换成了表示精度下最严的要求 | 保留一阶离散并放宽 AC-6c；减小 H；保留镜像；常数阈值 1e−4 | 放宽 AC-6c 违反授权；减小 H 违反 M-09；镜像是第二来源，测不到绘制路径；1e−4 没有推导依据，正确的全局上界是 2^−15 | 高 |
| 22 | 围巾阻力律从线性 C_D·(wRel−vel/h_s) 改为二次 C_Q·‖u‖·u，u=wRel−vel/h_s；校准窗口 C_Q∈[0.8,1.4] m⁻¹，初值 1.0（AMD-P8-001） | 保留线性律；提高迭代或子步；把 C_D 调出窗口；缩短变道时长；缩短飘带 | 线性律在窗口内 0/90 例达标，且 Re≈6e4 属二次阻力区；增加迭代、子步不收敛；C_D 出窗会让 AC-2a 或 v=0 失败；变道时长被 AC-6b、AC-12e 锁死；缩短飘带触及 M-04 | 高 |
| 23 | 躯干碰撞体改为与渲染躯干同参数的椭球（外扩 0.005 m），用 rig.toLocal 判定，在每次迭代最后投影，固定行除外 | 保留碰撞球；锚点后移到 z≥+0.20；收窄躯干 | 碰撞球严格位于渲染椭球内部，飘带必然被吞没（已形式化证明）；后移锚点会脱离颈环；收窄躯干后 min f 仍为 0.217 | 中 |
| 24 | AC-2c 改为测风致偏转：与 windScale=0 的同初值对照运行比较同一时刻的 tip 方向，阈值 20° 不变 | 保留"与竖直方向夹角"；放宽到 80° | 有躯干碰撞时竖直下垂路径不可容许（任一竖直线都进入椭球），所以以竖直为参照的判据不可达；放宽阈值违反授权。对照运行是两次独立的真实运行，不是影子状态 | 中 |
| 25 | AC-1b(i) 改为飘带-only：对同一帧做真实渲染差分（只隐藏飘带），并满足取色规则，≥150 px | 继续数整幅图中的围巾色像素 | 同色颈环单独就有 268 px，判据会被顶替而失去意义 | 高 |
| 26 | 墨镜几何改为中心 (±0.07,1.765,−0.583)，八个角都在头球外、头盔沿以下 | 保持原位 | 原镜片中心距头心 0.1564 < 0.16，38% 埋在头里 | 高 |
| 27 | AC-1b 的墨镜分项迁到 S4a（P10），用差分判定 | 留在 S1；迁到 S5 | S1 在后方，朝 −Z 的镜片几何上不可见（0%）；S5 时头部整组隐藏 | 高 |
| 28 | S6、S7、S12 改由 P10 产出并判定；P6、P8 出口只凭 selfcheck；substitute 图标记为不计入 | 在 P6、P8 中补做 mode 1、mode 4 | mode 1、mode 4 属于 P10 的文件集，提前实现会越界 | 高 |
| 29 | scarf.reset 方向写死为 d=(0,−cos20°,+sin20°)，复位后投影再令 Q=P | "沿 +Z 拉直后下垂 20°"（距竖直 70°） | 后一种读法下 AC-2c 为 51.6°，与 AC-2c 互斥 | 高 |
| 30 | 精度探测改为 capabilities.precision === 'highp'；[build] 只匹配 GLSL 的 precision 语句，另加 RawShaderMaterial 为 0 | 保留按值扫描 | 按值扫描依赖巧合，且与 M-12 的字面不一一对应 | 高 |
| 31 | 行数按代码行计；门禁为合计 ≤5600；逐文件上限只作分配目标 | 按物理行计；拆分 pelican.js | 物理行把 AGENTS.md 强制的注释算进复杂度预算；v3 的 P-04 已经把合计定为唯一口径 | 高 |
| 32 | AC-3b 月盘直径按半高阈值下的连通面积换算等效直径 | 固定阈值 L≥230 | 固定阈值依赖曝光，不可复算 | 高 |
| 33 | S3 拆为 S3a（mode 1 构图：车在中央 1/3、下半 ≥40% 海面）与 S3b（mode 0 用 `forceLamps(0/1)` 差分判「路灯亮」）；现行 mode 1 机位的海面占比严格上界为 8.84%（均海面）/ 15.91%（波谷，最宽松），S3a 的机位由 ADR-34 解决（AMD-P10-001） | 保持一张 S3 判三项 | 灯头对全部 z 与全部 S 都不入画（2,880 次投影，0 命中）；p=0.50 时任意法线 V≤0.186<0.25；三项不可能在同一帧同时成立 | 高 |
| 34 | mode 1 机位改到海侧远景：位置 (车x+23, 0.6, 车z−22)、注视点 (车x, 0.6, 车z+7)，**0.6 为世界绝对高度**（`camFloor(x>0)=0`），FOV 40 / k 4 / near 0.1 不变；`CFG.CAM_SIDE` 与 camera.js 的 mode 1 分支显式列入 P10 文件集；S7、S11、S13 改用 mode 4 固定环绕（用户 2026-10-26 批准"海侧远景，保留海面占比"；AMD-P10-001） | 保留陆侧机位，改写海面判据 | 陆侧机位的海面上限为 8.84%/15.91%，改写判据等于降低期望；dx=21 在车道 −2.5 只有 26.2%；y 若读作"车中心+0.6"（=1.6）则车道 −2.5 变 23.8% | 中 |
| 35 | 夜间（p=0.50）不判围巾取色，取色只在 S1（AC-1b(i)）判；色值 `#D7262E` 与 V≥0.25 都不变（AMD-P10-001） | 改色值或降低 V 阈值 | r162 `BRDF_Lambert = RECIPROCAL_PI·diffuse` 下任意法线 V≤0.186；改色值违反 M-03，降阈值违反授权 | 高 |
| 36 | S7 只判围巾形态；飘带-only 差分像素只在 S1 判（阈值 150 不变），避免同一 AC 在两处重复计分（AMD-P10-001） | 在 S7 保留 ≥150 px | 同一判据重复出现会掩盖 S1 的真实读数；且 ADR-34 的海侧机位下 S7 的围巾投影只有 31.1 px²，届时像素判据必失败 | 高 |
| 37 | AC-1b 中的 L 定义为 PNG 的 sRGB 编码亮度 `(0.2126R+0.7152G+0.0722B)/255`，阈值 0.12 与 0.35 不变（用户 2026-10-26 批准"批准上述测量与取证调整"；AMD-P10-001） | 按线性光亮度 | 同一 AC 的 H/S/V 都按 sRGB 编码取值，L 必须同口径；`tools/e2e/app.mjs` 的 `lum()` 已是该口径，`#111114` 的 sRGB 亮度 0.0675 正是阈值 0.12 设定时的依据 | 高 |
| 38 | S6、S12 保留 −90° 环绕，并注明主体可能被 x=−8 的棕榈带遮挡、不作本图判据；默认环绕 yaw 仍为 35°；`PALM_X` 不变（AMD-P10-001） | 把这两张图改到 +90° 海侧 | +90° 系列全幅海面实测 0.0%，岸线区域完全出画，无法判近岸泡沫/高光；`PALM_X` 是 M-04 不能改 | 高 |
| 39 | HUD 样式原样迁入 css/style.css 并删除 index.html 的内联块；index.html 显式列入 P15 文件集（AMD-P10-001） | 保留内联样式 | 违背 P15 的文件归属；index.html 原本只允许追加，删除需要显式授权；选择器交集为 0 保证不改写 P1 规则 | 高 |

### 6.2 需求、设计、实施包与验收的映射

| 契约 | 设计 | 实施包 | 验收 |
|---|---|---|---|
| 1 | §1.3–1.5、§4.13 | P5 | AC-1a–1d、S1 |
| 2 | §4.1 | P6 | AC-2a–2d、S7 |
| 3 | §4.2 | P7 | AC-3a–3d、S1–S3b |
| 4 | §4.3 | P8 | AC-4a–4d、S6、S12 |
| 5 | §4.4、§4.13 | P9 | AC-5a–5d、S11 |
| 6 | §4.5 | P3、P4 | AC-6a–6f |
| 7 | §4.8 | P11 | AC-7、S8 |
| 8 | §4.7 | P10 | AC-8a/8b、S1、S3a–S5、S7、S11、S14 |
| 9 | §4.9 | P13 | AC-9a–9d |
| 10 | §4.5.3–4.5.4 | P3、P15 | AC-10、S9 |
| 11 | §4.10 | P14 | AC-11a–11c |
| 12 | §4.6 | P12 | AC-12a–12e |
| task §6 缺陷类别 | M-10 至 M-32 | P3、P8、P10、P13、P16 | §5.2 第 1–25 条 |

### 6.3 风险与开放问题

- **R1** vendor 体积，以及 esbuild 打包 three 0.162.0 后能否得到 IIFE：PR-2，P0 出口门禁。
- **R2** `webglcontextrestored` 后 ShaderMaterial 能否完全恢复：PR-4。
- **R3** iOS 在 file:// 下的 localStorage 与音频解锁：PR-7。
- **R4** POV 近平面：喙根深度 0.11，复算已通过；真机需复核（PR-1、PR-12）。
- **R5** 全局名冲突：只暴露 `window.PB`。
- **R6** r162 的 WebGL1 回退行为：PR-3 必须完成（用户已批准支持 WebGL1，UD-1，2026-10-25 已裁决）。能力路径（`--disable-webgl2` + 能力断言，ADR-20）是 P0 出口门禁；设备支路（没有 `ANGLE_instanced_arrays` 的真实 WebGL1 设备、移动端 WebGL1 设备）是 P16 出口门禁，需要用户真机，关闭前为 NOTVERIFIED。
- **R7** 时间膨胀：<12 fps 时慢放，这是有意接受的语义（M-09）。
- **R8** 星星在 24° 处有 2.3 倍的密度接缝：已知外观项，S2 中不可见，接受（review-2 R-8）。
- 开放问题：无。UD-1 至 UD-5 已于 2026-10-25 全部裁决，见 §2.1 用户裁决约束。
