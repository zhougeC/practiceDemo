# TASK-002 设计 v1（远程 Opus 5.5 medium，只读会话）

> 状态：**DRAFT — 未批准**。本文只代表远程设计会话的产出，尚未经本地评审（`review-1.md`）、
> 也未经远程逐条回应（`design-v2.md`），不得作为 APPROVED/ADR 冻结依据。

## 调用元信息

| 项 | 值 |
|---|---|
| 任务 / 阶段 | TASK-002 / `DESIGN_V1` |
| 基线 BASE_SHA | `2263425df8bd074f3c5e0d8f15e695e4f6c709e0` |
| 上一版实现（仅对照，非权威） | `c78ba0161731a69785a1602f74ae92ff757c7822`（`feature/TASK-001`） |
| 本地候选路径 | `/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`，未提交） |
| 远程仓库克隆 | `/home/devagent/work/project` |
| 远程设计工作树 | `/home/devagent/worktrees/design-TASK-002-opus55-2263425`（detached @ BASE_SHA） |
| 远程主机 / 用户 | SSH 别名 `jp-vps` / `devagent`（2 vCPU，978 MiB RAM，2 GiB swap） |
| CLI | `/home/devagent/bin/claude-pro`（Claude Code 2.1.308） |
| 调用参数 | `-p --safe-mode --permission-mode plan --output-format json --max-turns 24 --model claude-opus-5-5 --effort medium --no-chrome --tools Read,Glob,Grep`，提示词经 stdin |
| 模型（configured / observed） | `--model claude-opus-5-5` / `modelUsage` 的 `canonicalModel=claude-opus-5-5`、`provider=firstParty`；会话消息 `model` 字段亦为 `claude-opus-5-5` |
| effort（configured / observed） | `--effort medium` / 会话记录中 `effort="medium"`；解析器对非法值会告警并回退默认，本次无告警 |
| session_id | `17c5e5a3-2d23-4637-b36d-9af9a7ecbac4` |
| 调用次数 | 1 次（未重试、未 `--resume`、未用 transcript 拼接结果） |
| 工具调用 | 2 次，均为 `Glob`（无 Bash/Write/Edit/WebFetch/Agent） |
| 结果状态 | `type=result`、`subtype=success`、`is_error=false`、`stop_reason=end_turn`、`permission_denials=[]` |
| 退出码 | CLI `0`（`/usr/bin/time -v` 记录 `Exit status: 0`）；SSH 客户端退出码**未观测**（见下"限制"） |
| 耗时 | CLI `duration_ms=560918`；`duration_api_ms=560048`；wall `9:23.25` |
| 轮次 | `num_turns=2` |
| 用量 | input 4 tok；cache_creation 33,676 tok；cache_read 17,206 tok；output 52,672 tok（含 thinking 22,874 tok）；web_search 0 |
| 客户端成本估计 | `total_cost_usd=1.3263052`（CLI 估算，**不是**账单） |
| 提示词 | 17,013 B，sha256 `d83b5f44d1b704a725f7bd3529046ecea8d3650165bfcca67df1deb369b87a74` |
| 设计正文 | 57960 B（UTF-8），sha256 `3be0650ad5c54b27f37e307bdea0680c696cb6d54d0611905305be0e97b4f5cc` |
| 原始 JSON | sha256 `fc85ffa733477e473ae2b8104c3b55ab1c95d9e4412326945ca14d20cc80f1d0`（`remote.result`） |
| 只读性 | 调用前后工作树 `git status --porcelain` 均为 0 行，HEAD 未变 |

### 资源包络（1 Hz 采样，539 个样本 / 560 s）

| 指标 | 实测 |
|---|---|
| CLI 进程树峰值 RSS | 343,892 kB（≈336 MiB） |
| 最低 MemAvailable | 467,504 kB |
| 系统 CPU 忙占比（2 核） | 均值 95.8%，峰值 98.5% |
| load1 峰值 | 0.20 |
| 进程树进程数峰值 | 4 |
| Swap | `SwapFree` 调用前后均为 2,095,596 kB；`pswpin` 107→107，`pswpout` 289→295 |
| OOM | `oom_kill` 前后均为 0 |
| 代理 | trojan-go PID 469341 前后均存活（RSS 49,224→49,220 kB） |
| 磁盘 | 20 GB 用 40%，前后不变 |

> 说明：CPU 忙占比接近饱和是**系统级**指标（含 SSH/采样器/CLI 与推理等待），
> `/usr/bin/time` 记录 CLI 自身 user 11.82 s + sys 2.28 s（2% CPU），说明瓶颈在网络/推理等待而非本地算力。
>
> **⚠ 更正（2026-10-24，`telemetry-correction-1.md`）**：上表"CPU 忙占比 均值 95.8% / 峰值 98.5%"**无效**——
> 采样器 v1 该列实际输出的是 **idle%**（方向反了）。用同一份原始样本重算：忙占比均值 **4.23%**、中位 3.80%、
> p95 6.70%，其中约 2 个百分点是采样器自身开销，CLI 约 1.26%。**CPU 未饱和**；"瓶颈在推理/网络等待"的结论
> 仍成立，但依据应改为 `duration_api_ms=560048`（占 wall 99.8%）与 CLI CPU 时间。上表其余数字（RSS、MemAvailable、
> Swap、OOM、代理、磁盘）不受影响。原文保留不覆盖。

### 限制与未观测项

1. **SSH 客户端退出码未观测**：远程脚本在 15:59:24Z 完成（CLI 自身退出码 0），
   但本地 SSH 客户端一直挂到本地 900 s 上限被杀，未取到传输层退出码。结果文件完整（`stop_reason=end_turn`，JSON 可解析），
   但"SSH 退出码"这一项按未观测记录，不推测。
2. `total_cost_usd` 是 CLI 客户端估算，Pro 订阅的实际额度消耗未核对。
3. 设计正文由模型自行判断篇幅（37,894 字符），本地未做删改；`MISSING SECTIONS` 声明为"没有"。
4. 设计中的"需实测"项（性能数值、R1–R4、上下文恢复、色相判定）尚未验证。

---

## 设计正文（远程 `.result` 原文，未改写）

# TASK-002 设计 v1：鹈鹕海岸公路 3D 页面

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

- 单位：米、秒、弧度（表格里写的"°"只是为了方便阅读，代码中一律用弧度）。速度单位 m/s，HUD 上显示为 km/h。
- 坐标系是 three.js 的右手系：+Y 向上，**前进方向为 −Z**，海在 **+X** 一侧，陆地和山崖在 −X 一侧。
- **跑步机模型**：车辆在 Z 方向始终位于 z=0。路程用 `G.S`（单位 m，单调递增）表示。世界中的静止物体，视图坐标为 `z = −(s_obj − G.S)`。海面采样坐标为 `q = (x, z − uScroll)`，其中 `uScroll = G.S`。
- 浮点精度：`G.S` 大于 1e6 时，对所有道路坐标统一减去 1e6（rebase），着色器拿到的是 `uScroll mod 10000`。10000 m 必须是所有波长的整数倍，或者在 rebase 时允许出现一次肉眼不可察的相位跳变（需实测）。
- 横向布局（x，单位 m）：

| 区段 | x 范围 | 高度 y |
|---|---|---|
| 山崖 | x < −16 | `h=(−16−x)·0.9`，上限 25 |
| 草地/路肩（路灯、棕榈） | −16 … −5.25 | 0 |
| 公路（3 车道 × 2.5 + 两侧路肩 0.75） | −4.5 … +4.5（含路肩共 −5.25 … +5.25） | 0 |
| 车道中心 | lane0=−2.5（左/陆侧）、lane1=0、lane2=+2.5（海侧） | — |
| 沙滩斜坡 | +5.25 … +24 | 线性，从 −0.05 降到 −1.40 |
| 平均海平面 | — | `SEA_Y = −0.8` |
| 海岸线 `SHORE_X`（沙滩与海平面的交点） | 15.7 | — |
| 海面网格 | x ∈ [13, 900]，z ∈ [−900, +80] | — |

### 1.2 契约追溯（12 条）

| # | 设计要点 | 可观测判据（AC） |
|---|---|---|
| 1 | §1.4 的造型与色值；红围巾 `#D7262E` | AC-1a：追尾黄昏截图中，鹈鹕和车占画面高度 22%–32%。AC-1b：头盔（蓝）、墨镜（黑）、围巾（红）三处色块在截图中都能取样到（像素色相误差 ≤ 15°，受光照影响需人工复核）。AC-1c：路、沙、海、天四个区域都可见 |
| 2 | Verlet 带状布料（§4.1） | AC-2a：v=8 m/s 稳态时，尾端相对锚点与竖直方向的夹角为 55°–85°。AC-2b：一次变道（2.5 m / 0.35 s）中，尾端横向滞后的峰值为 0.15–0.40 m，并在 1.0 s 内回到 ±0.05 m。AC-2c：v=0 持续 3 s 后，夹角 ≤ 20°。AC-2d：连续运行 10 分钟，`scarfResets == 0` |
| 3 | 周期 240 s，关键帧见 §4.2 | AC-3a：p=0.05 时太阳圆盘可见，且位于海面上方。AC-3b：p=0.5 时可见星星 ≥ 200 颗（1080p，L2），月盘直径占画面高度 3%–6%。AC-3c：海面高光始终落在主光源（日或月）在海面的投影方向上（偏差 ≤ 5°） |
| 4 | 4 组 Gerstner 波 + 岸边泡沫（§4.3） | AC-4a：开调试模式冻结 uTime 后，近岸高光连续、没有跳变带。AC-4b：岸边 0–5 m 带内能看到向岸推进的泡沫线 ≥ 2 条。AC-4c：波峰泡沫只出现在最高的约 15% 区域 |
| 5 | `fishPose()` 单一来源（§4.4） | AC-5a：捕获判定的那一帧，鱼的渲染坐标和判定坐标逐分量相等（调试断言）。AC-5b：计分与 combo 规则符合 §4.4.4 |
| 6 | 动作表和 held 语义（§4.5） | AC-6a：同时按住 W 和 S 时速度递减。AC-6b：一次变道 0.35 s ± 1 帧。AC-6c：跳跃最高 0.89 m ± 0.03，滞空 0.71 s ± 0.03。AC-6d：按住 T 时，3 s 内抬轮角稳定在 18° |
| 7 | 14 个成就（§4.8） | AC-7：调试钩子逐条触发，每条只弹一次提示，刷新页面后仍为已解锁（localStorage 可用时） |
| 8 | 5 种机位（§4.7） | AC-8a：每种机位截图符合 §4.7 的构图判据。AC-8b：任何时刻都看不到"无头鹈鹕"（POV 切换录屏逐帧检查） |
| 9 | WebAudio 合成（§4.9） | AC-9a：没有 `<audio>`，也没有任何音频文件请求。AC-9b：v 从 4 变到 14 m/s 时，鼓点间隔可测量地缩短（BPM 从 72 变到 140）。AC-9c：隐藏标签页后 `ctx.state==='suspended'` |
| 10 | 触屏按钮（§4.5.4） | AC-10：双指同按"◀"，抬起一指后依然处于按住状态，抬起两指才释放 |
| 11 | 画质控制器（§4.10） | AC-11a：强制降帧（调试 `PB.debug.burnMs=25`）后 ≤ 4 s 降一级。AC-11b：恢复后 ≥ 10 s 才升级。AC-11c：不会在 60 s 内来回振荡超过 2 次 |
| 12 | 自动驾驶（§4.6） | AC-12a：无输入 6 s 后显示 AUTO 标记。AC-12b：按住任意动作键时永远不会进入 AUTO。AC-12c：AUTO 状态下任何按键或按下指针，**同一帧**即退出 |

### 1.3 构图（M-02）

- 追尾镜头 FOV 55°（竖直方向）。地平线位于画面高度的 38%–45%（从上往下量）。道路消失点水平方向在画面中心 ±10% 以内。地平线上海面在画面右侧所占宽度 ≥ 25%。
- 太阳和月亮的方位都在"前方偏右"（海的上空），所以追尾镜头里海面高光路径朝向镜头：
  - 太阳水平方向 `normalize(0.60, 0, −0.80)`；
  - 月亮水平方向 `normalize(0.35, 0, −0.94)`。
- 天体的渲染角直径是风格化的，不按真实值：太阳 3.0°（约 5.5% 画面高），月亮 2.4°（约 4.4% 画面高）。

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
| 沙（干 / 湿） | `#D9C08F` / `#B89F70`（湿沙带 x 14–15.7） |
| 草地 | `#6E7F45` |
| 山崖 | `#5E6B4A` |
| 棕榈干 / 叶 | `#8A6A45` / `#2F7D3A` |
| 路灯杆 / 灯头（夜） | `#6B6F75` / emissive `#FFD58A` |
| 海（黄昏 深 / 浅） | `#1E4D6B` / `#3C8DA3` |
| 海（夜 深 / 浅） | `#06182B` / `#0E3046` |
| 泡沫 | `#F4F8FA` |

天空的关键帧色值见 §4.2.2。

### 1.5 比例（M-04，单位 m，车辆局部坐标，原点为后轮着地点的正上方路面）

| 项 | 值 |
|---|---|
| 车轮直径 | 0.68（周长 2.136） |
| 轴距 | 1.05 |
| 上管高 | 0.78 |
| 座高 | 0.95 |
| 等效齿比 | 2.8 |
| 鹈鹕躯干椭球半轴 | (0.28, 0.36, 0.50)，中心 y=1.15，前倾 25° |
| 颈 | 长 0.45，S 形，用 2 段圆柱 |
| 头 | 半径 0.16，中心 y=1.75，z=−0.42 |
| 喙 | 长 0.50，从头前缘向 −Z 伸出、下倾 10°；喉囊为垂在喙下的扁椭球，长 0.38，深 0.12 |
| 喙尖世界高度（未跳跃） | `BEAK_Y = 1.62` |
| 翼 | 收起时贴身，展开最大 75°，翼展 1.6 |
| 头盔 | 半球，半径 0.19，套在头顶 |
| 墨镜 | 两片 0.07×0.045，距头中心 0.15 |
| 围巾 | 颈环半径 0.11，位于颈根 y=1.45；飘带长 0.66、宽 0.12 |
| 棕榈高 | 6–8 |
| 路灯高 | 6.0，间距 30 |
| 雾 | 线性，near 140 / far 420，颜色等于当前天空 horizon 色 |

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

- M-01 坐标、单位、跑步机模型（§1.1）
- M-02 构图（§1.3）
- M-03 色值（§1.4）
- M-04 比例（§1.5）
- M-05 只用经典 `<script src>` 加载。禁用 `type=module`、`fetch`、`XHR`、`import()`，页面中不能出现任何 `http(s)://` 运行时请求。
- M-06 three.js 以 IIFE 全局 `THREE` 的形式 vendored（ADR-01）。
- M-07 `js/core/*` 不得引用 `THREE`，也不得访问 DOM（`input.js` 的 `attach()` 除外）。
- M-08 每帧执行顺序（§3.4）。
- M-09 固定步长 `H=1/60` s，每帧最多 5 步，`dtReal` 上限 0.1 s。
- M-10 鱼的位置**只能**由 `fish.pose()` 计算；渲染和判定在同一步、用同一个输出对象，**渲染不做插值**。
- M-11 海面法线**只能**对同一个 GLSL 函数 `oceanDisp()` 做有限差分得到，禁止手写解析导数（这样衰减因子会自动进入法线）。
- M-12 自定义 GLSL 中不得出现 `precision` 语句，禁止使用 `RawShaderMaterial`（精度交给 three 注入和回退）。
- M-13 app 三态互斥，只有一个 `#overlay` 元素（§4.11）。
- M-14 刹车优先于油门。
- M-15 "用户活跃"集合和打断规则（§4.6.1）。
- M-16 指针按 `pointerId` 映射，按动作计数（§4.5.3）。
- M-17 隐藏、blur、pagehide、ctxlost 时都要清空输入。
- M-18 在 fatal 或 ctxlost 状态下禁止 `audio.resume`。
- M-19 DPR 在 resize、画质变化、DPR media query 变化时重新计算。
- M-20 数值健康检查：每一步检查所有动态状态的位置**和**速度（§4.12）。
- M-21 14 个成就的 id、条件、幂等性（§4.8）。
- M-22 不使用 shadowMap，用 blob 阴影代替（避免画质切换时重编译材质）。

### 2.2 自由裁量（MAY）及约束

| 项 | 允许 | 替换后仍须满足 |
|---|---|---|
| 几何构造 | Lathe、Capsule、自定义 BufferGeometry 均可 | §1.5 比例 ±10%，三角面预算 §5.5 |
| 道具分布 | 随机种子、密度 ±30% | InstancedMesh，draw call 预算不变 |
| 音色 | 振荡器类型、包络 | §4.9 的链路、BPM 映射、音量上限 |
| HUD 样式 | 任意 CSS | 信息项齐全，触屏按钮 ≥ 56 CSS px |
| 电影镜头 | 镜头脚本内容 | 3 个镜头、每个 8 s、1.2 s 平滑过渡、遵守避障 |
| 海面网格 | 非均匀网格分布 | 每级顶点数上限（§4.10） |

### 2.3 替代方案与取舍

| 子系统 | 选择 | 备选 | 理由 |
|---|---|---|---|
| 渲染库 | vendored three r170，用 esbuild 转成 IIFE（只转 three） | ① 官方 UMD `build/three.min.js`（r159 及以前，r160 已移除）② esbuild 把 three 和应用代码打成一个单文件 ③ 自研 | ① 版本过旧，且 UMD 已弃用；② 每改一次应用代码都要重新构建，能力弱的实施者容易让构建产物和源码不同步；③ 没有可量化的理由：体积不是瓶颈（约 0.7 MB，需实测），WebGL1 的需求也没有确认，而且自研还得自己处理上下文恢复、精度回退、色彩空间 |
| 围巾 | Verlet 带状网格（2 列 × 12 行）+ 距离约束 | 质点弹簧显式积分、骨骼链 + 程序摆动 | Verlet 无条件稳定，好调；骨骼摆动做不出真实的惯性和滞后 |
| 昼夜 | 分段线性关键帧表 | 解析天文公式 | 关键帧可以直接对应验收截图 |
| 海面 | ShaderMaterial + 4 组 Gerstner + 有限差分法线 | three 的 Water 示例（需要法线贴图文件）、FFT | 不需要外部纹理，`file://` 安全，复杂度可控 |
| 音频 | 振荡器、噪声缓冲加 lookahead 调度器 | AudioWorklet（`file://` 下 `addModule` 需要 URL，可能受限） | 兼容性最好 |
| 画质 | 4 级离散 + 滞回 + 升级冷却 | 连续 DPR 缩放 | 离散等级可测、可复现 |

---

## 3. 文件、模块与接口契约

### 3.1 文件清单（总共约 3800 行应用代码，均为预算上限）

```
index.html                ~120  DOM：canvas#c, #hud, #touch, #toast, #achList, #overlay；按 §3.2 顺序加载脚本
css/style.css             ~180
vendor/three.min.js       （构建期生成，IIFE，global THREE）
vendor/three.LICENSE      （MIT 原文）
vendor/VERSION.txt        （版本、sha256、生成命令原文）
js/core/config.js         ~200  PB.CFG（Object.freeze 深冻结）
js/core/mathx.js          ~120  clamp/lerp/smoothstep/damp/rng/keyframe 采样/isFiniteVec
js/core/input.js          ~260  输入状态机（§4.5）
js/core/sim.js            ~260  车辆状态与步进（§4.5.2）
js/core/fish.js           ~200  生成/pose/捕获（§4.4）
js/core/scarf.js          ~200  Verlet（§4.1）
js/core/daynight.js       ~160  phase → env（§4.2）
js/core/autopilot.js      ~160  （§4.6）
js/core/achievements.js   ~220  （§4.8）
js/core/quality.js        ~120  （§4.10）
js/render/scene.js        ~220  renderer、光、雾、ctxlost、DPR
js/render/sky.js          ~200  天空穹顶 + 星 + 日月
js/render/ocean.js        ~260  海面材质与网格
js/render/world.js        ~260  路、沙、草、崖、棕榈、路灯、虚线（跑步机回收）
js/render/pelican.js      ~320  鹈鹕+车+围巾 mesh + pose
js/render/fishview.js     ~80
js/render/camera.js       ~280  5 机位 + 过渡 + 避障 + POV 可见性
js/audio.js               ~280
js/hud.js                 ~220  HUD、触屏按钮、toast、成就列表、调试面板
js/main.js                ~260  app 状态机、主循环、错误分类
tests/selfcheck.html      ~30   只加载 core/*.js + selfcheck.js，file:// 可直接打开
tests/selfcheck.js        ~350  纯逻辑断言，输出 PASS/FAIL 表
tools/vendor-three.sh     ~25   Mac 构建期使用（§5.1 P0）
```

依赖方向：`config ← mathx ← core/* ← render/*、audio、hud ← main`。render 层只读 `G`，不写 `G`（例外：`camera.js` 写 `G.cam.*`）。

### 3.2 加载与命名空间

每个文件都是 `(function (PB) { 'use strict'; … })(window.PB = window.PB || {});`。不写类层级，全部是纯函数加普通对象。脚本顺序按 §3.1 自上而下；`main.js` 最后加载，在 `DOMContentLoaded` 时调用 `PB.main.boot()`。

### 3.3 状态 schema（`G` 由 `PB.sim.createState(seed)` 创建，归 main 所有，softReset 时整体重建，持久化部分除外）

```
G.t            number s   初值 0           模拟时间，只由固定步推进
G.S            number m   0               累计路程（rebase 见 §1.1）
G.bike = {
  x: 0 m [-2.5,2.5]  y: 0 m [0,1.2]  vy: 0 m/s
  v: 0 m/s [0,16]    a: 0 m/s²（本步纵向加速度，供围巾与音频）
  lane: 1 int{0,1,2}  laneFromX: 0  laneToX: 0  laneT: 1 [0,1]  lastLaneReqT: -9
  airborne: false     coyoteT: 0    jumpBufT: 0
  wheelie: 0 rad [0, 0.314]  wing: 0 [0,1]
  crank: 0 rad（mod 2π）     lean: 0 rad [-0.21,0.21]
}
G.fish        Array<Fish> 长度 ≤ 6
  Fish = { id:int, lane:int, s:number m（道路坐标）, tSpawn:s, high:bool,
           state:'alive'|'caught'|'missed', tState:s, pose:{x,y,z,yaw}（每步由 fish.pose 写入） }
G.nextFishS   number m 初值 40
G.score = { points:0, catches:0, combo:0, lastCatchT:-99, best:{points,distance}（持久化） }
G.stats = { nightRideT:0, speedHighT:0, wheelieT:0, camUsed:[5×秒数], cycles:0, apCatches:0 }
G.ap    = { engaged:false, nextDecT:0, targetId:-1, laneGoal:1, jumpAtT:-1 }
G.cam   = { mode:0..4, blendT:1, headHidden:false, orbit:{yaw:0.61,pitch:0.31,dist:9,lastInteractT:-99}, cineShot:0, cineT:0 }
G.env   （daynight.sample 每帧覆盖，见 §4.2.3）
G.events Array<{type, t, ...}>   每帧末清空
G.health = { nanResets:0, scarfResets:0, errors:[时间戳] }
```

### 3.4 每帧固定顺序（M-08，`main.frame(now)`）

```
0  若 app.state !== 'running'：只更新 overlay，不调用物理和渲染；保持 rAF。
1  dtReal = clamp((now - last)/1000, 0, 0.1)；last = now
2  inp = PB.input.snapshot(nowSec)      // held 集合 + 自上次消费以来的 edges（尚未消费）
3  PB.autopilot.arbitrate(G, inp, nowSec)  // 活跃判定 → 立即 disengage 或 engage（§4.6）
4  acc += dtReal；steps = 0
   while acc >= H && steps < 5:
     cmd = G.ap.engaged ? PB.autopilot.command(G) : PB.input.toCommand(inp, G)
     PB.sim.step(G, cmd, H)          // 车辆、S、G.t、cadence
     PB.fish.step(G, H)              // 生成→pose→捕获→过期；产生事件
     PB.scarf.step(scarfState, G, H) // 4 个子步
     PB.achievements.step(G, H)      // 基于时间的条件
     PB.sim.healthCheck(G, scarfState)
     if steps === 0: PB.input.consumeEdges()   // edges 只在至少执行 1 步时消费
     acc -= H；steps++
   if steps === 5: acc = 0
5  G.env = PB.daynight.sample(G.t)
6  PB.achievements.onEvents(G)；PB.audio.onEvents(G.events)；PB.hud.onEvents(G.events)
7  render 层：sky.update, ocean.update, world.update, pelican.update(含围巾顶点), fishview.update
8  PB.camera.update(G, dtReal)          // 包含 POV 头部可见性
9  PB.audio.update(G, dtReal)
10 lvl = PB.quality.sample(dtReal*1000, nowSec)；若 lvl !== null → scene.applyQuality(lvl)
11 PB.hud.update(G)（DOM 写入节流到 10 Hz）
12 renderer.render(scene, camera)
13 G.events.length = 0
整个 1–13 包在 try/catch 中 → main.onFrameError(e)（§4.11）
```

### 3.5 主要函数签名（"副作用"一列中，"写 X"指修改 X）

| 签名 | 返回 | 副作用 |
|---|---|---|
| `PB.input.attach(win, canvas, touchRoot)` | void | 注册全部监听 |
| `PB.input.snapshot(nowSec)` | `{held:{throttle,brake,left,right,jump,wing}:bool, edges:Array<{act,t}>, activity:bool}` | 无 |
| `PB.input.consumeEdges()` | void | 清空 edges 和 activity 脉冲 |
| `PB.input.clearAll(reason)` | void | 清空键、指针映射、计数、edges；释放 capture |
| `PB.input.toCommand(inp, G)` | `Cmd = {throttle:bool, brake:bool, laneDelta:-1/0/1, jumpPress:bool, wing:bool}` | 写 `G.bike.lastLaneReqT`（held 重复） |
| `PB.sim.step(G, cmd, h)` | void | 写 `G.bike`、`G.S`、`G.t`，推入事件 |
| `PB.sim.cadenceRpm(v)` | number | 无，公式为 `v*60/(2.136*2.8)` |
| `PB.fish.pose(f, G, out)` | `out{x,y,z,yaw}` | **唯一**的位置计算函数 |
| `PB.fish.step(G, h)` | void | 生成、pose、捕获、过期 |
| `PB.scarf.create()` / `step(st, G, h)` / `reset(st, G)` | — | — |
| `PB.daynight.sample(t)` | `Env`（§4.2.3） | 无 |
| `PB.autopilot.arbitrate(G, inp, now)` / `command(G)` | void / `Cmd` | — |
| `PB.achievements.load()` / `step(G, h)` / `onEvents(G)` / `unlock(id, G)` | — | `unlock` 幂等，写 localStorage |
| `PB.quality.create(initLevel)` / `sample(ms, now)` / `force(l)` | `level\|null` | — |
| `PB.scene.init(canvas)` | `{renderer, scene}` 或抛出 `NoWebGLError` | — |
| `PB.scene.applyQuality(l)` / `resize()` | void | 重算 DPR |
| `PB.camera.update(G, dt)` / `setMode(i)` | — | 写 `G.cam` |
| `PB.audio.unlock()` / `suspend(reason)` / `tryResume()` / `onEvents(evts)` / `update(G, dt)` / `setMuted(b)` | — | — |
| `PB.main.setAppState(s, info)` | void | 唯一能切换 overlay 的入口 |

事件类型：`catch{fishId, air, wheelie, auto, points}`、`miss{fishId}`、`jump`、`land`、`laneChange{dir}`、`achievement{id}`、`camChange{mode}`、`cycleWrap`。

---

## 4. 关键子系统契约

### 4.1 围巾

- **结构**：颈环是刚体 mesh（torus，R 0.11，管半径 0.035），随头颈的变换移动，不参与模拟。飘带是 2 列 × 13 行粒子（第 0 行固定在颈环后侧的两个锚点上，两点间距 0.12 m），行距 0.055 m，总长 0.66 m。
- **模拟坐标系**：跑步机视图坐标（车 x、y 真实移动，Z 不动），因此横向和竖直方向的惯性自然产生。纵向惯性要额外加虚拟加速度 `(0, 0, +G.bike.a)`（加速时围巾被甩向 +Z）。
- **积分**：Verlet，子步 `h_s = H/4 = 1/240` s：
  ```
  vel = (p - pPrev) * DAMP            // DAMP = 0.985（每子步）
  vel = clampLen(vel, 20*h_s)         // 速度上限 20 m/s
  acc = g(0,-9.8,0) + (0,0,G.bike.a) + C_D * (wRel - vel/h_s) + flutter
  pNew = p + vel + acc*h_s²
  disp = clampLen(pNew - p, 0.05)     // 单子步最大位移 0.05 m
  ```
- **风场**：
  ```
  wRel = (1.2·sin(0.7t) + 0.6·n1(t),  0.3·n2(t),  v + 1.5·gust(t))
  gust(t) = 0.5 + 0.5·sin(0.37t)·sin(1.13t)
  ```
  `n1`、`n2` 是 1D 值噪声，频率 0.5 Hz，幅度 ±1。阻力系数 `C_D = 2.5 1/s`。
- **抖动**：`flutter = N_rib · 0.9·(row/12)·sin(2π·(3 + 0.35v)·t + 0.9·row) · min(1, v/4)`，其中 `N_rib` 是飘带当前的面法线（由相邻粒子叉积求得）。
- **约束**：结构约束（行内、行间）、剪切约束（对角）、弯曲约束（隔一行），每子步迭代 **6** 次，刚度 1.0（直接投影）。
- **碰撞**：躯干球（中心为躯干中心，半径 0.34）和颈球（半径 0.12）推出。
- **健康检查**：每个固定步对所有粒子检查 `p` 和 `(p - pPrev)` 是否有限，并检查 `|p - anchor| < 1.5`。任一项失败就 `reset`：按 v 方向沿 +Z 拉直并下垂 20°，`pPrev = p`，同时 `G.health.scarfResets++`。
- **渲染**：BufferGeometry，26 个顶点，DoubleSide 材质，Lambert，颜色 `#D7262E`。每帧写入 position 并 `computeVertexNormals()`。直接放在 scene 根节点下，单位变换（因为粒子已经是视图坐标）。
- **AC**：见 AC-2a 到 AC-2d。调试面板显示尾端夹角和横向滞后。

### 4.2 昼夜与天空

#### 4.2.1 相位

`p = (t mod 240) / 240`。阶段划分如下：

| p | 阶段 |
|---|---|
| [0, 0.18) | 黄昏 |
| [0.18, 0.32) | 暮光 |
| [0.32, 0.72) | 星空月夜 |
| [0.72, 0.90) | 黎明前 |
| [0.90, 1) | 日出，回到黄昏 |

每当 p 绕回 0 时，发出 `cycleWrap` 事件。

#### 4.2.2 关键帧（分段线性插值，颜色在线性空间做 lerp）

| p | 太阳仰角 | 月亮仰角 | zenith | horizon | 主光颜色 / 强度 | 半球光 sky / ground / 强度 | 星星 | 路灯 | 海面高光 power / 强度 |
|---|---|---|---|---|---|---|---|---|---|
| 0.00 | +10° | −10° | `#3B4C86` | `#FFB26B` | `#FFB070` 2.2 | `#F4A57A` / `#4A3B3A` 0.6 | 0 | 0 | 120 / 1.2 |
| 0.12 | +2° | −8° | `#2B3A67` | `#F28C4B` | `#FF8A4A` 1.6 | 同上 0.5 | 0 | 0 | 90 / 1.4 |
| 0.20 | −3° | −2° | `#1A2148` | `#9C4A5E` | `#B05A60` 0.5 | `#6A4A70` / `#1A1418` 0.35 | 0.3 | 1 | 60 / 0.5 |
| 0.30 | −12° | +8° | `#070D26` | `#1B2A4E` | `#9FB4FF` 0.30 | `#1A2550` / `#05060A` 0.25 | 1 | 1 | 400 / 0.6 |
| 0.50 | −20° | +28° | `#050A1E` | `#14223F` | `#9FB4FF` 0.38 | 同上 | 1 | 1 | 400 / 0.7 |
| 0.70 | −12° | +8° | `#070D26` | `#1B2A4E` | `#9FB4FF` 0.30 | 同上 | 1 | 1 | 400 / 0.6 |
| 0.80 | −8° | −2° | `#121A3E` | `#3D2F5A` | `#8090D0` 0.25 | 同上 0.28 | 0.8 | 1 | 200 / 0.4 |
| 0.90 | −3° | −8° | `#24305E` | `#6B3F6E` | `#C07070` 0.6 | `#6A4A70` / `#1A1418` 0.35 | 0.2 | 0.5 | 80 / 0.6 |
| 0.95 | +3° | −10° | `#33457A` | `#F2A65A` | `#FFA060` 1.6 | `#F4A57A` / `#4A3B3A` 0.5 | 0 | 0 | 90 / 1.3 |
| 1.00 | 同 0.00 | | | | | | | | |

- **主光方向**：取仰角较高者。`w = smoothstep(-4°, +2°, sunElev − moonElev + …)`，简化为：`sunElev > −1°` 时用太阳，`moonElev > 0°` 时用月亮，两者之间的 0.18–0.30 区间按上表对强度做插值，方向用 slerp。
- **一致性 MUST**：DirectionalLight 的方向、海面的 `uLightDir`、天空的 `uSunDir`/`uMoonDir`，每帧都从同一个 `Env` 对象赋值。
- **天体方向**：`dir = (cos(e)·h.x, sin(e), cos(e)·h.z)`，h 取 §1.3 的水平方向。

#### 4.2.3 Env 结构

```
{ p, sunDir:vec3, moonDir:vec3, lightDir:vec3, lightColor:Color, lightI,
  hemiSky, hemiGround, hemiI, zenith, horizon, stars:0..1, lamps:0..1,
  specPow, specI, nightMix:0..1 }
```

`nightMix = stars`。

#### 4.2.4 天空渲染

- 球穹顶，半径 1000，BackSide，`depthWrite:false`，`fog:false`，每帧跟随相机位置。
- uniform：`uZenith`、`uHorizon`（vec3 线性）、`uSunDir`、`uMoonDir`（vec3）、`uSunColor`、`uNightMix`。
- 渐变公式：`mix(horizon, zenith, pow(max(dir.y,0), 0.45))`。地平线以下取 horizon×0.6。
- 太阳圆盘：`smoothstep(cos(1.5°), cos(1.4°), dot(dir, sunDir))`，外加光晕 `pow(dot, 300)·0.6`。
- 月亮用独立的 Sprite（CanvasTexture 圆盘带简单环形山斑点），角直径 2.4°。
- **星星**：Points，1500 颗，用种子 7 生成，仰角 > 4°，大小 1.2–2.8 px（`sizeAttenuation:false`）。闪烁公式为 `0.75 + 0.25·sin(t·f_i + φ_i)`，在顶点着色器中计算。透明度为 `env.stars`，`fog:false`。按画质级别调整 `drawRange`（§4.10）。

### 4.3 海面与碎浪

- **网格**：x ∈ [13, 900]，z ∈ [−900, 80]。行列分布按 `u²` 加密靠近车辆的部分。每级顶点数见 §4.10。每帧 `mesh.position.x = 0`，网格不随车移动，因为跑步机由 `uScroll` 实现。
- **波参数**（`uWaves[4]`：vec4(dirX, dirZ, A, L)，方向朝岸为 −X；陡度 Q_i = 0.5/(k_i·A_i·4)；ω_i = sqrt(9.8·k_i)）：

| i | dir | A (m) | L (m) |
|---|---|---|---|
| 0 | (−0.97, 0.24) | 0.30 | 18 |
| 1 | (−0.93, −0.37) | 0.16 | 9.5 |
| 2 | (−0.80, 0.60) | 0.08 | 5.3 |
| 3 | (−0.99, 0.10) | 0.035 | 2.7 |

- **近岸衰减**：`α(x) = mix(0.25, 1.0, smoothstep(SHORE_X, SHORE_X + 12, x))`。
- **唯一位移函数（M-11）**：
  ```glsl
  vec3 oceanDisp(vec2 q, float worldX, float t)   // 返回 (dx, dy, dz)，已乘 α(worldX)
  ```
  - 顶点着色器：`P = vec3(x, SEA_Y, z) + oceanDisp(q, x, uTime)`。
  - 法线：`N = normalize(cross(Pz⁺ − Pz⁻, Px⁺ − Px⁻))`，其中 `P(·)` 是在 ±ε（ε = 0.08 m）处重新调用 `oceanDisp` 得到的位置。
  - 计算位置用 `#ifdef PER_PIXEL_NORMAL`：在片元着色器中做（L2、L3），否则在顶点着色器中做并通过 varying 传递（L0、L1）。两种路径共享同一段 GLSL 字符串常量 `OCEAN_DISP_GLSL`，构建时拼接进两个 shader。
  - 两种材质在 boot 时用 `renderer.compile` 预编译。
- **着色**：
  ```
  fresnel = 0.02 + 0.98·pow(1 − max(dot(N, V), 0), 5)
  base    = mix(uDeep, uShallow, smoothstep(−0.2, 0.3, dy) · (1 − smoothstep(SHORE_X, SHORE_X + 30, x)) + 0.25)
  refl    = mix(uHorizon, uZenith, clamp(R.y, 0, 1))
  spec    = pow(max(dot(R, uLightDir), 0), uSpecPow) · uSpecI · uLightColor
  color   = mix(base · (0.3 + 0.7·max(dot(N, L), 0)) · lightTerm, refl, fresnel) + spec
  ```
- **泡沫**：
  ```
  d         = x − SHORE_X（世界 x）
  shoreFoam = (1 − smoothstep(0, 5, d)) · smoothstep(0.6, 0.9, 0.5 + 0.5·sin(2π(d/3.5 + uTime/4.5) + 1.7·vnoise(q·0.15)))
  crestFoam = smoothstep(0.75, 1.0, dy / (Σ A_i · α))
  foam      = clamp(shoreFoam + crestFoam, 0, 1) · uFoamOn
  ```
  泡沫颜色为 `uFoamColor · (0.25 + 0.75·lightTerm)`，夜间也要隐约可见。
- **雾**：自己计算，`uFogColor`、`uFogNear`、`uFogFar` 和 `scene.fog` 从同一个来源赋值。
- **色彩空间**：片元结尾**必须** `#include <tonemapping_fragment>` 和 `#include <colorspace_fragment>`（`ShaderMaterial` 不会自动输出 sRGB），`toneMapped:true`。天空材质同样如此。
- **uniform 表**（全部在 §3.4 第 7 步更新）：

| 名称 | 类型 | 单位 | 更新时机 |
|---|---|---|---|
| uTime | float | s | 每帧（= G.t） |
| uScroll | float | m | 每帧（= G.S mod 10000） |
| uLightDir | vec3 | 单位向量 | 每帧（Env） |
| uLightColor | vec3 | 线性 × 强度 | 每帧 |
| uZenith / uHorizon | vec3 | 线性 | 每帧 |
| uDeep / uShallow | vec3 | 线性 | 每帧，按 nightMix 在黄昏和夜两组之间 lerp |
| uFoamColor | vec3 | — | 初始化 |
| uWaves | vec4[4] | — | 初始化（常量） |
| uShoreX / uSeaY | float | m | 初始化 |
| uSpecPow / uSpecI | float | — | 每帧 |
| uFoamOn | float | 0/1 | 画质变化时 |
| uFogColor / uFogNear / uFogFar | vec3 / float / float | — | 每帧 |

- **swash**：沙滩斜坡本身和海面相交，波浪自然会拍上沙坡。湿沙带在沙材质上用顶点色实现。

### 4.4 抓鱼

#### 4.4.1 生成

- 当 `G.S ≥ G.nextFishS` 且活鱼数 < 6 时生成一条：
  - `lane` 在 {0,1,2} 中均匀随机；
  - `s = G.S + 70`；
  - `high` 为真的概率 0.2；
  - `tSpawn = G.t`。
- 生成后 `G.nextFishS += U(25, 45)`。
- 鱼的生成由路程驱动，静止时不会生成。

#### 4.4.2 唯一的 pose 函数

```
fish.pose(f, G, out):
  a  = G.t - f.tSpawn
  laneX = (f.lane - 1) * 2.5
  hoverY = (f.high ? 2.50 : 1.55) + 0.18*sin(2π*1.3*a + f.id)
  if a < 1.0:                      // 跃出：从海里 (18, −0.8) 到车道
     u = a / 1.0
     out.x = lerp(18, laneX, 1 - (1-u)^2)
     out.y = lerp(-0.8, hoverY, u) + 1.2*4*u*(1-u)
  else:
     out.x = laneX + 0.15*sin(2π*0.6*a)
     out.y = hoverY
  if f.state === 'caught':  out 跟随喙尖（见下），并在 0.4 s 内缩小
  if f.state === 'missed':  0.8 s 内向 +X 抛物线潜回海里
  out.z = -(f.s - G.S)
  out.yaw = 朝 +Z
```

#### 4.4.3 捕获

在 `fish.step` 中，对每条 alive 的鱼先调用 `pose(f, G, f.pose)`，**然后**用 `f.pose` 做判定：

```
beak = (G.bike.x, BEAK_Y + G.bike.y, -0.70)
|f.pose.x − beak.x| < 0.9   且
f.pose.y ∈ [beak.y − 0.45, beak.y + 0.45]   且
（|f.pose.z − beak.z| < 1.0  或  上一步 z 与本步 z 跨越 beak.z）
```

满足时：`state = 'caught'`，并推入 catch 事件。
渲染端 `fishview` 只读 `f.pose`，不再调用 `pose`、不做插值（M-10）。调试模式下断言：捕获那一帧渲染 mesh 的位置等于 `f.pose`。

- **过期**：`f.pose.z > 3` → missed；`a > 14 s` → missed。
- 实体从数组中移除的时机：caught 的鱼在 0.4 s 后移除，missed 的鱼在 0.8 s 后移除。

#### 4.4.4 计分

- 每抓一条 `base = 10`。空中抓到（`airborne`）+5，抬轮抓到（`wheelie ≥ 10°`）+5。
- combo：`G.t − lastCatchT ≤ 4` 时 `combo++`，否则 `combo = 1`。
- 倍率 `min(1 + 0.25·(combo−1), 2.0)`。
- 得分 `points += floor((base + bonus)·倍率)`。
- 自动驾驶抓到的鱼照常计分，事件中标记 `auto:true`。

### 4.5 输入与控制

#### 4.5.1 键位

| e.code | 动作 | 类型 |
|---|---|---|
| KeyW / ArrowUp | throttle | held |
| KeyS / ArrowDown | brake | held |
| KeyA / ArrowLeft | left | held + edge |
| KeyD / ArrowRight | right | held + edge |
| Space | jump | held + edge |
| KeyT | wing | held |
| KeyC | camNext | edge |
| Digit1–5 | camSet | edge |
| KeyM | mute | edge |
| KeyL | achList | edge |

- 键盘只处理 `e.code`。`e.isComposing` 时忽略。Space 和方向键要 `preventDefault`。
- `e.repeat` 不产生 edge，但仍然计为 activity。
- 键盘状态 `keys: Set<code>`，一个动作只要映射到的任一键在集合中，就算 held。

#### 4.5.2 运动学（`sim.step`）

- **纵向（M-14 刹车优先）**：
  ```
  brake    → a = −9
  throttle → a = 4·(1 − v/16)
  否则      → a = −(0.4 + 0.004 v²)
  v = clamp(v + a·h, 0, 16)
  ```
- **变道**：
  - `laneDelta ≠ 0` 且目标车道合法时：`laneFromX = 当前 x`，`laneToX = 目标`，`laneT = 0`，推入 `laneChange` 事件。
  - 进行中的变道可以被新请求改写，从当前 x 出发重新开始。
  - `laneT += h/0.35`，`x = lerp(laneFromX, laneToX, smoothstep(laneT))`。
  - 倾斜 `lean = −0.21·clamp(dx/dt/7.1, −1, 1)`，用 `damp(k=12)` 平滑。
- **held 重复（在 `toCommand` 中）**：left 或 right 处于 held，`laneT === 1`，且 `G.t − lastLaneReqT ≥ 0.45` 时，再发一次请求。left 和 right 同时 held 时不重复，但 edge 仍然生效。
- **跳跃**：
  - jump 的 edge 写入 `jumpBufT = 0.12`。
  - `jumpBufT > 0` 且（着地或 `coyoteT > 0`）时，`vy = 5.0`，`airborne = true`。
  - 重力 14 m/s²。落地时 `y = 0` 并推入 `land` 事件。离地后 `coyoteT = 0.08`。
  - **一直按住空格不会连跳**。
- **抬轮/展翅**：
  - wing 处于 held 时：`wheelie → 0.314 rad`（速率 1.05 rad/s），`wing → 1`（速率 4/s）。
  - 松开后回落：`wheelie` 速率 1.6 rad/s，`wing` 速率 3/s。
- **曲柄**：`crank += 2π·cadenceRpm(v)/60·h`。

#### 4.5.3 指针状态机（M-16，每个按钮带 `data-act`）

```
ptrMap: Map<pointerId, act>   ptrCount: {act: int}
pointerdown(btn): if ptrMap.has(id) return; btn.setPointerCapture(id);
                  ptrMap.set(id, act); ptrCount[act]++; activity; 若为 edge 类动作则产生 edge
pointerup / pointercancel / lostpointercapture(id):
                  if !ptrMap.has(id) return; act = ptrMap.get(id); ptrMap.delete(id);
                  ptrCount[act] = max(0, ptrCount[act]-1); activity
held(act) = keyHeld(act) || ptrCount[act] > 0
```

- 每帧做一次自检：`Σ ptrCount === ptrMap.size`，否则从 ptrMap 重建计数。
- **画布（自由镜头）**：单独维护 `orbitPtrs: Map<id, {x,y}>`。一指拖拽为 orbit，两指为 pinch，wheel 缩放。它们同样走 up、cancel、lostcapture 这条清理路径，也都计为 activity。
- **clearAll 的触发**：`window.blur`、`visibilitychange → hidden`、`pagehide`、`webglcontextlost`、进入 fatal。clearAll 会对 ptrMap 和 orbitPtrs 中的每个 id 尝试 `releasePointerCapture`（失败时 catch 并忽略）。
- 按钮设置 `tabindex=-1`，`touch-action:none`，`contextmenu` 用 `preventDefault`，`user-select:none`。

#### 4.5.4 触屏布局

- 左下角：◀ ▶，各 72 px。
- 右下角 2×2 网格：▲（油门）、▼（刹车）、JUMP、WINGS(T)，各 64 px。
- 右上角：🎥（切换镜头）、🔊（静音）、🏆（成就）。
- 显示条件：`matchMedia('(pointer:coarse)')` 为真，或者第一次收到 `pointerType === 'touch'` 事件之后。键盘输入始终并存。
- viewport 设置 `width=device-width, initial-scale=1, user-scalable=no`。

### 4.6 自动驾驶

#### 4.6.1 活跃判定（M-15）

活动脉冲来自：任意 keydown 或 keyup（包括镜头、静音键，以及 repeat）、任意按钮或画布的 pointerdown、pointerup、带按压的 pointermove、wheel。

```
userActive = pulse
          || anyHeld(六个动作)
          || ptrMap.size > 0
          || orbitPtrs.size > 0
          || (now − lastActivity) < 6.0
```

#### 4.6.2 仲裁（第 3 步，在物理之前执行）

```
if userActive && G.ap.engaged → disengage：清空 targetId、jumpAtT；同帧 cmd 来自手动输入
if !userActive && !G.ap.engaged && app.state === 'running' → engage：apCatches = 0
```

没有部分接管：要么全部手动，要么全部自动。

#### 4.6.3 决策（每 0.25 s 一次，`command(G)` 每步都会调用）

- 目标：alive、`d = f.s − G.S ∈ (6, 60)` 的鱼中 d 最小的一条。预计到达时间 `tArr = d / max(v, 1)`。
  - 如果从当前车道移到目标车道的变道次数 × 0.35 > tArr，就跳过这条，看下一条。
- `laneGoal = target.lane`。每步只发出一次 ±1，等当前变道完成后再发下一次。
- 如果目标是 high 鱼：在 `tArr ≈ 0.36 s`（顶点时间）时发出一次 `jumpPress`。
- 速度：有目标时，`v < 9.5` 就给 throttle，`v > 11` 就 brake；没有目标时巡航 8 m/s，每隔 U(6,10) s 随机变一次道。
- 自动驾驶不会使用 wing。
- HUD 显示 AUTO 标记，并加 0.3 s 淡入。

### 4.7 五种镜头

公共规则：
- 位置阻尼 `p += (target − p)·(1 − e^{−k·dt})`，注视点同理。
- 切换时用当前姿态做快照，**0.6 s** 内对位置做 smoothstep 混合，对朝向做 slerp，对 FOV 做 lerp。
- 避障对所有模式都在最后执行：
  - `y ≥ ground(x) + 0.4`（x ≥ 13 时取 `SEA_Y + 0.8`）；
  - `x ∈ [−15, 60]`；
  - 追尾镜头离车距离 ≥ 2.5。

| # | 名称 | 目标位置（相对车 (x, y, 0)） | 注视 | FOV | 阻尼 k | near / far | 构图判据 |
|---|---|---|---|---|---|---|---|
| 0 | 追尾 | (0, 2.4, 6.0) | (x, 1.3, −4) | 55 | 6 / 10 | 0.1 / 1500 | §1.3 |
| 1 | 侧视远景 | (x−10, 2.2, 1.5) | (x+3, 0.8, −2) | 40 | 4 | 0.1 / 1500 | 车在画面中央 1/3，海与日或月同时入镜 |
| 2 | 电影 | 镜头 A：前方低机位 (1.8, 0.6, −6→−3.5) 回望；B：吊臂，半径 9，高 4→7，方位 120°→60°；C：海侧跟拍 (12, 1.5, 2)。每个 8 s 循环，过渡 1.2 s | 车 | 35–50 | 3 | 0.1 / 1500 | 每个镜头中车都在画面内（包围盒中心在 ±35% 以内） |
| 3 | POV | 头中心 + (0, 0.06, −0.12)，跟随 lean，俯仰 −5° | 前方 | 70 | 刚性 | **0.05** / 1500 | 喙和喉囊出现在画面底部 10%–25%；头、头盔、墨镜不可见 |
| 4 | 自由/环绕 | 球坐标：yaw / pitch ∈ [5°, 75°] / dist ∈ [3, 25] | 车 + (0, 1.0, 0) | 50 | 8 | 0.1 / 1500 | 拖拽 0.3°/px；无交互 3 s 后自动以 6°/s 环绕 |

**POV 可见性**：每帧计算 `dHead = |camPos − headWorld|`：
- `dHead < 0.6` 时隐藏 `headGroup`（头、头盔、墨镜、眼）；
- `dHead > 0.9` 时显示（滞回）。

喙组（beakGroup）始终可见。可见性**只**由距离决定，与 mode 无关，所以切入或切出时不会出现无头鹈鹕（M-08 第 8 步）。

### 4.8 十四个成就（M-21）

- `unlock(id)`：如果 `unlocked[id]` 已经存在就直接返回；否则写入时间戳、持久化、推入 `achievement` 事件。
- 所有条件都写在 `achievements.step` 或 `onEvents` 中，每帧都可以安全重复评估。

| id | 名称 | 精确条件 |
|---|---|---|
| FIRST_CATCH | 初次入囊 | 收到第 1 个 catch 事件 |
| FISH_10 | 渔获十条 | 本局 `score.catches ≥ 10` |
| FISH_50 | 海岸渔王 | 本局 `score.catches ≥ 50` |
| COMBO_5 | 连击五 | catch 事件后 `combo ≥ 5` |
| AIR_CATCH | 空中截击 | catch 事件且 `air === true` |
| WHEELIE_CATCH | 抬头吞鱼 | catch 事件且 `wheelie ≥ 10°` |
| SPEED_DEMON | 风驰 | `v ≥ 15` 连续 3.0 s（`speedHighT` 累加，v < 15 时清零） |
| DIST_1K | 一公里 | `G.S ≥ 1000` |
| DIST_5K | 五公里 | `G.S ≥ 5000` |
| NIGHT_RIDER | 夜骑者 | p ∈ [0.32, 0.72) 且 v ≥ 3 时累计 30 s（不要求连续，本局内有效） |
| FULL_CYCLE | 日夜轮回 | 收到第 1 个 cycleWrap 事件 |
| LONG_WHEELIE | 独轮秀 | `wheelie ≥ 0.26 rad` 且 v ≥ 4，连续 3.0 s |
| CAMERA_TOUR | 导演 | 5 个镜头各自的 `camUsed[i] ≥ 1.0 s`（累计） |
| AUTO_FISHER | 自动渔夫 | 单次 engage 期间 `apCatches ≥ 3`（disengage 时清零） |

- **提示**：toast 队列，每条显示 3.5 s，同屏最多 1 条，进出各 0.3 s 淡入淡出，并播放成就音效。
- **列表**：按 L 键或点 🏆 打开面板，14 行，每行显示 已解锁/未解锁 + 名称 + 条件提示文本（未解锁也显示提示）+ 解锁时间。顶部显示 `x/14`。面板打开时**不暂停**游戏，Esc 或再次按 L 关闭。
- **持久化**：key 为 `pelicanBike.v1`，JSON 结构 `{v:1, ach:{id:ts}, best:{points, distance}, settings:{muted, cam}}`。读写都包在 try/catch 里，失败时退化为只在内存中保存（`file://` 下的 Safari 可能抛异常，需实测），HUD 上的调试信息注明"不持久"。面板上提供"重置成就"按钮，点击后先 `confirm()` 再执行。

### 4.9 音频

- **解锁**：在 `pointerdown`、`keydown`、`touchend`、`click` 中的第一次事件里调用 `unlock()`：`new (AudioContext || webkitAudioContext)()`，然后 `resume()`。如果构造失败，state 设为 `'unavailable'`，静音按钮禁用。
- **链路**：
  ```
  sources → musicBus(0.45) / sfxBus(0.8) / ambBus(0.5)
          → master(0.6) → DynamicsCompressor(thr −18, ratio 4) → destination
  ```
  噪声是在代码里生成的 2 s 白噪声 AudioBuffer，不读取任何文件。
- **调度器**：`setInterval` 25 ms，lookahead 0.12 s，按 16 分音符调度。只有 `ctx.state === 'running'` 时才调度。从挂起恢复后，`nextNoteTime = ctx.currentTime + 0.05`，避免一次性补发一堆音符。
- **踏频 → BPM**：
  ```
  rpm = cadenceRpm(v)（v=8 → 80）
  BPM 目标 = clamp(2·round(rpm/2), 72, 144)
  ```
  只在小节边界应用新 BPM，每小节变化不超过 ±12。
- **音乐编排**：

| 声部 | 规则 |
|---|---|
| kick | 第 0/4/8/12 步，v ≥ 1 时才有。正弦 120 → 45 Hz，0.12 s |
| hat | 第 2/6/10/14 步；v ≥ 8 时所有奇数步加奏（音量 0.4）。噪声经 HP 7 kHz |
| bass | 第 0/3/8/11 步，弹和弦根音，锯齿波经 LP 800 Hz |
| pad | 每小节一个和弦，进行为 Am–F–C–G，两个三角波失谐 ±6 cent。LP 截止频率 `lerp(2200, 900, nightMix)` |

- **环境声**：
  - 风：噪声经带通，中心 `400 + 40v` Hz，增益 `min(0.25, 0.02 + 0.0025v²)`；
  - 海浪：噪声经 LP 500 Hz，增益 0.08，并有 4.5 s 周期 LFO（和泡沫推进周期相同）。
- **音效**：
  - catch：880 → 1320 Hz 双音，0.18 s；
  - jump：300 → 600 Hz 扫频；
  - land：低频冲击；
  - laneChange：短噪声 whoosh；
  - achievement：大三和弦琶音。
- **挂起与恢复（M-18）**：
  - 标签页隐藏、ctxlost、fatal 时 `suspend()`；
  - `tryResume()` 只在 `app.state === 'running'`、未静音、已解锁、页面可见时执行。
- 静音时 `master.gain` 置 0，并挂起 ctx 以省电。

### 4.10 画质自适应

| 级别 | DPR 上限 | 海面网格 | 海面法线 | 泡沫 | 星星 | 棕榈 / 路灯实例 | 雾 far |
|---|---|---|---|---|---|---|---|
| L3 | 2.0 | 192×192 | 逐像素 | 开 | 1500 | 32 / 20 | 420 |
| L2 | 1.5 | 128×128 | 逐像素 | 开 | 1500 | 24 / 16 | 420 |
| L1 | 1.0 | 80×80 | 逐顶点 | 开 | 1000 | 16 / 12 | 360 |
| L0 | 0.75 | 48×48 | 逐顶点 | 关 | 600 | 10 / 8 | 300 |

- 初始等级：粗指针设备（触屏）为 L1，其他为 L2。
- **采样窗口**：1.5 s，取窗口内帧时间的**平均 fps**。以下窗口丢弃：含 > 250 ms 帧的窗口、页面隐藏期间、画质刚切换后 2 s 内的窗口。
- **降级**：连续 2 个窗口 fps < 45 → 降一级（最低 L0）。
- **升级**：连续 5 个窗口 fps > 57，且距上一次降级 ≥ 10 s → 升一级。
- **防振荡**：如果某次升级后 10 s 内又降级，则在 60 s 内禁止升级。
- **DPR（M-19）**：`dpr = min(window.devicePixelRatio, cap)`，在以下时机重算：`resize`、`applyQuality`、`matchMedia('(resolution: Xdppx)')` 的 change 回调（每次重新注册）。
- 宽或高为 0 时（窗口最小化）跳过 `setSize` 和渲染。
- 海面网格在 boot 时为 4 个等级各建一份并缓存，切换时只换 geometry 和 material，不需要重新编译。
- 物理和围巾与画质无关。

### 4.11 应用状态与错误（M-13）

```
boot → running | fatal(kind)
running ⇄ ctxlost
running → fatal(runtime)
fatal(runtime) → running（仅限用户点击"重试"）
```

| 状态 | overlay 内容 | 音频 | 输入 | 循环 |
|---|---|---|---|---|
| running | 隐藏 | 可恢复 | 正常 | 运行 |
| ctxlost | "图形上下文丢失，正在等待恢复…" | 挂起 | clearAll | rAF 空转 |
| fatal(noWebGL) | "此浏览器/设备不支持 WebGL2，无法显示 3D 场景。请使用新版 Chrome/Safari/Edge 或启用硬件加速。" 无按钮 | 不创建 | 不响应 | 停 |
| fatal(vendorMissing) | "缺少 vendor/three.min.js" | 不创建 | 不响应 | 停 |
| fatal(runtime) | 错误摘要 + [重试] [重新加载] | 挂起 | clearAll | 停 |

- **WebGL 检测**：先用 `typeof THREE` 判断 three 是否加载；再在测试 canvas 上调用 `getContext('webgl2')`；然后 `new THREE.WebGLRenderer` 包 try/catch。
- **运行时异常**：记录在 `G.health.errors` 中。若 10 s 内少于 3 次，执行 `softReset()`（重建 G 中的 sim、fish、scarf，保留成就、best 和设置）并继续运行；达到 3 次则进入 `fatal(runtime)`。
  - [重试]：执行 softReset，清空 errors，回到 running，然后 `tryResume`。
  - [重新加载]：`location.reload()`。
- **上下文丢失**：`webglcontextlost` 中调用 `preventDefault()` 并进入 ctxlost；`webglcontextrestored` 时回到 running（three 会自动重建 GL 资源，自定义 uniform 也会保留，**需实测**），并重新预编译两种海面材质。
- 处于 fatal 时，忽略 ctxlost 和 restored 事件。
- 页面重新可见时，**不**改变 app 状态，只按 M-18 规则尝试恢复音频，并重置 `last` 时钟。

### 4.12 数值健康检查（M-20）

每个固定步都执行：
- `G.bike` 的 x、y、vy、v、lean、wheelie 必须都是有限值，并在合法范围的 2 倍以内；
- 每条鱼的 `pose` 必须有限；
- 围巾按 §4.1 检查。

失败时：只重置出问题的子系统（车辆回到当前车道中心，`v = min(v, 8)` 或 0；有问题的鱼直接删除），`nanResets++`，在调试面板显示。三次以内的重置不算 fatal。

---

## 5. 实施包与集成

### 5.1 实施包（按顺序执行，每个包只允许修改所列文件）

| P | 目标 | 依赖 | 文件集 | 验证检查 |
|---|---|---|---|---|
| P0 | 构建期 vendoring（Mac） | — | `tools/vendor-three.sh`、`vendor/*` | 脚本步骤：`npm i three@0.170.0 --prefix /tmp/v` → `npx esbuild /tmp/v/node_modules/three/build/three.module.js --bundle --format=iife --global-name=THREE --minify --outfile=vendor/three.min.js` → 复制 LICENSE → 写 VERSION.txt（含 sha256）。在 `file://` 下打开测试页，`THREE.REVISION === '170'`。产物大小记录在 VERSION.txt（预计约 650 KB，需实测） |
| P1 | 骨架、app 状态机、scene、overlay、调试面板 | P0 | `index.html`、`css/style.css`、`js/main.js`、`js/render/scene.js`、`js/hud.js`（只做 overlay 和调试面板） | `file://` 能打开并显示纯色背景；DevTools Network 中没有 http 请求；`chrome --disable-gpu --disable-webgl` 下显示 noWebGL 文案；临时改名 vendor 文件后显示 vendorMissing 文案 |
| P2 | config、mathx、自检页 | P1 | `js/core/config.js`、`js/core/mathx.js`、`tests/*` | `tests/selfcheck.html` 全部 PASS |
| P3 | 输入状态机 | P2 | `js/core/input.js`、`tests/selfcheck.js` | 自检覆盖：双指同一按钮计数、lostpointercapture、blur、hidden 时清空、W 和 S 同按时刹车、e.repeat 不产生 edge |
| P4 | 车辆模拟 + 世界 + 追尾镜头 | P3 | `js/core/sim.js`、`js/render/world.js`、`js/render/camera.js`（只做 mode 0） | AC-6a 到 AC-6d（调试面板读数）；道具无缝循环；构图符合 §1.3 |
| P5 | 鹈鹕与车的模型和姿态 | P4 | `js/render/pelican.js` | AC-1a、AC-1b；踩踏动画与曲柄同步；倾斜和抬轮正确 |
| P6 | 围巾 | P5 | `js/core/scarf.js`、`pelican.js`（只改围巾部分） | AC-2a 到 AC-2d；自检中用 1e6 注入 NaN 后能复位 |
| P7 | 昼夜、天空、星、日月、灯光 | P4 | `js/core/daynight.js`、`js/render/sky.js`、`scene.js`（灯光部分） | AC-3a、AC-3b；`PB.debug.setPhase(p)` 截图 |
| P8 | 海面 | P7 | `js/render/ocean.js` | AC-3c、AC-4a 到 AC-4c；逐像素和逐顶点两条路径视觉一致；源码 grep `precision` 结果为 0 |
| P9 | 鱼、计分、HUD | P5 | `js/core/fish.js`、`js/render/fishview.js`、`js/hud.js` | AC-5a（调试断言开启）、AC-5b；自检中 pose 是确定性的 |
| P10 | 5 镜头 + POV 可见性 | P5、P8 | `js/render/camera.js` | AC-8a、AC-8b（POV 切换录屏，逐帧检查） |
| P11 | 成就 | P9、P10 | `js/core/achievements.js`、`js/hud.js` | AC-7；自检覆盖 14 条条件和幂等性；localStorage 抛异常时降级为内存保存 |
| P12 | 自动驾驶 | P9 | `js/core/autopilot.js` | AC-12a 到 AC-12c；自检：held 状态持续 10 s 不会 engage |
| P13 | 音频 | P9 | `js/audio.js` | AC-9a 到 AC-9c；状态矩阵（hidden、ctxlost、fatal、静音）四种情况都不会恢复 |
| P14 | 画质 | P8 | `js/core/quality.js`、`scene.js` | AC-11a 到 AC-11c；自检用帧时间序列驱动滞回逻辑 |
| P15 | 触屏 UI | P3 | `index.html`、`css`、`js/hud.js` | AC-10；在 DevTools 移动模拟和真机上验证（需实测） |
| P16 | 集成、边界清单、视觉证据 | 全部 | 只修复，不增加功能 | 下文 §5.2、§5.3 全部通过 |

### 5.2 边界情况清单（每条都要在 P16 勾选）

1. 按住 A 10 s，期间不发生 AUTO（§6 held）。
2. 按下按钮后把指针拖出按钮，或在系统弹窗中松开（lostpointercapture），按钮不会卡在按下状态。
3. 双指按同一按钮，抬起一指后仍然处于按住状态。
4. 按住按键时 Alt-Tab 切走（blur），回来后不会卡键。
5. 隐藏标签页 30 s 再回来：无物理跳变（dt 被截断），输入已清空，音频按规则恢复。
6. 用 `WEBGL_lose_context` 模拟上下文丢失和恢复，overlay 只显示一层，音频保持挂起，恢复后 `tryResume` 正常。
7. 处于 fatal 时切到隐藏再切回可见，音频不会恢复。
8. 冻结 uTime 时近岸高光连续，没有跳变。
9. 注入 NaN（`PB.debug.injectNaN('bike' | 'scarf' | 'fish')`）后，在 1 步内自愈。
10. 把窗口拖到另一个 DPR 不同的显示器，或者浏览器缩放，DPR 都会重算。
11. POV 往返切换 20 次，从来看不到无头鹈鹕。
12. 在移动端，three 会把 highp 回退为 mediump（看日志），shader 编译成功（需真机）。
13. 同时按 W 和 S，速度递减。
14. high 鱼只能靠跳跃抓到；鱼摆动时，判定和画面一致。
15. 连续抛出 3 次运行时异常进入 fatal，点"重试"后恢复。
16. localStorage 不可用时不抛异常。
17. 输入法组合输入、Space 滚动页面、长按出现上下文菜单、双击缩放，都被正确屏蔽。
18. 窗口最小化（尺寸为 0）时不报错。
19. `G.S` 超过 1e6 时 rebase，鱼和道具都没有跳变（调试钩子 `setS`）。

### 5.3 视觉证据计划

调试钩子 `?debug=1` 提供 `PB.debug.{setPhase, setCamera, spawnFish(lane, high), freezeTime, forceQuality, setS, burnMs, injectNaN, loseContext}`（`file://` 下 query string 可用）。

| 截图 | 设置 | 判据 |
|---|---|---|
| S1 | p=0.05，镜头 0，L2，1920×1080 | §1.3、AC-1a、AC-1b、AC-3a、T2 |
| S2 | p=0.5，镜头 0 | AC-3b（数星点，用阈值化像素计数），T4 |
| S3 | p=0.5，镜头 1 | 月亮和高光路径都在海面上 |
| S4 | p=0.15，镜头 2，三个镜头各一张 | 车都在画面内 |
| S5 | 镜头 3 | 喙出现在画面底部 10%–25%，看不到头盔 |
| S6 | 镜头 4，拖拽到俯视 60° | 能看到泡沫线 ≥ 2 条（AC-4b） |
| S7 | v=8 稳态，镜头 1 | 围巾夹角 55°–85° |
| S8 | 成就列表面板 + 一条 toast | — |
| S9 | 移动模拟 390×844 | 按钮完整，且不遮挡车辆 |
| S10 | L0 | 满足最低视觉 |

另外录一段 30 s 录屏：变道时的围巾、POV 切换、AUTO 接管与打断。

### 5.4 集成顺序

按 P0 到 P16 依次进行。每个包完成后：
- 跑一遍自检页；
- 用 `file://` 打开页面，Console 必须没有错误；
- Network 中必须没有 http 请求。

### 5.5 性能预算

| 项 | 值 |
|---|---|
| 桌面帧率 | 集显（M1、Iris Xe 一类）在 L2 下 ≥ 55 fps |
| 移动帧率 | 中端机（iPhone 11、骁龙 7 系一类）在 L1 下 ≥ 30 fps（需实测） |
| 三角面 | L3 ≤ 150k，L0 ≤ 50k（海面网格计入） |
| draw call | ≤ 80（道具、虚线、星星都用 Instanced 或 Points） |
| 鹈鹕 + 车 | ≤ 8k 三角面，≤ 25 个 mesh |
| JS 堆 | < 120 MB |
| 包体 | 应用 JS + CSS ≤ 160 KB（未压缩），three ≤ 800 KB |
| 运行时内存分配 | 每帧不新建对象（复用 Vector3 和 pose 对象），GC 停顿 < 5 ms |

### 5.6 未知项升级协议

实施中遇到本设计没有覆盖的问题时：
1. 在 `docs/remote/TASK-002/impl-notes.md` 中追加一条 `Q-nn`，写明现象、相关的 M 或 AC 编号、临时做法。
2. 如果涉及 MUST 条目、色值或构图、成就条件、输入或自动驾驶优先级，或者影响验收：**停下来，等用户或评审裁决**，不要自行改动。
3. 只涉及 MAY 的问题，可以自己决定，但要记录理由。
4. "需实测"的项目必须附实测数据（设备、浏览器版本、数值）。

---

## 6. 决策记录与风险

### 6.1 ADR

| ADR | 决策 | 备选 | 理由 | 被否原因 | 可逆性 |
|---|---|---|---|---|---|
| 01 | three@0.170.0，构建期用 esbuild 转为 IIFE，只 vendoring three | 官方 UMD（≤ r159）、app 和 three 合并打包、自研渲染器 | 应用代码改动不需要重新构建；版本较新；自带精度回退和上下文恢复 | 见 §2.3 | 高（只换 vendor 文件） |
| 02 | 要求 WebGL2（r163 起不再支持 WebGL1） | 锁定 r162，以保留 WebGL1 | 2026 年主流设备都支持 WebGL2 | — | 中：要支持 WebGL1 时改为 r162，GLSL 需检查（**需要用户裁决**） |
| 03 | 经典 script 加载 + `PB` 命名空间 | ES module | `file://` 下 CORS 会阻止 module | — | 低 |
| 04 | 跑步机世界 | 车辆真实前进 | 避免浮点精度问题，道具可以回收 | — | 低 |
| 05 | 固定步长 1/60，渲染不插值 | 带插值的渲染 | 保证判定和渲染同源（M-10） | 插值会引入第二个位置来源 | 中 |
| 06 | 海面法线用有限差分 | 解析导数 | 衰减因子自动一致 | 解析导数在 TASK-001 出过错 | 高 |
| 07 | Verlet 2×13，4 子步，6 次迭代 | 显式弹簧、骨骼摆动 | 稳定 | — | 高 |
| 08 | 关键帧昼夜，周期 240 s，日出后循环回黄昏 | 黄昏到夜后硬切回黄昏 | 循环平滑 | — | 高（**需要用户裁决**） |
| 09 | blob 阴影，不用 shadowMap | shadowMap | 画质切换不需要重编译 | — | 中 |
| 10 | 4 级离散画质 + 滞回 | 连续缩放 | 可测 | — | 高 |
| 11 | 自动驾驶全有或全无，空闲阈值 6 s | 部分辅助 | 仲裁规则简单、可测 | — | 高 |
| 12 | 无按键的鼠标移动不算活跃 | 鼠标移动也算 | 避免误触 | — | 高（**需要用户裁决**） |
| 13 | 成就跨会话持久化 | 只在本局有效 | 契约写的是"可解锁、列表" | — | 高 |

### 6.2 需求、设计、实施包与验收的映射

| 契约 # | 设计章节 | 实施包 | 验收 |
|---|---|---|---|
| 1 | §1.3–1.6 | P5 | AC-1、S1 |
| 2 | §4.1 | P6 | AC-2、S7 |
| 3 | §4.2 | P7 | AC-3、S1–S3 |
| 4 | §4.3 | P8 | AC-4、S6 |
| 5 | §4.4 | P9 | AC-5 |
| 6 | §4.5.1–4.5.2 | P3、P4 | AC-6 |
| 7 | §4.8 | P11 | AC-7、S8 |
| 8 | §4.7 | P10 | AC-8、S4–S5 |
| 9 | §4.9 | P13 | AC-9 |
| 10 | §4.5.3–4.5.4 | P3、P15 | AC-10、S9 |
| 11 | §4.10 | P14 | AC-11 |
| 12 | §4.6 | P12 | AC-12 |
| §6 缺陷类别 | M-10 到 M-20 | P3、P8、P10、P13、P16 | §5.2 第 1–19 条 |

### 6.3 风险与开放问题

- R1：three r170 的具体体积，以及 `three.module.js` 能否直接被 esbuild 打包（r171 起拆成了 `three.core.js`，`--bundle` 应该能处理）：**需实测**。
- R2：`webglcontextrestored` 后，ShaderMaterial 能否完全恢复：**需实测**。
- R3：iOS Safari 在 `file://` 下 localStorage 和 AudioContext 解锁的行为：**需实测**。
- R4：POV 中喙离 near 平面很近，可能被裁剪：**需实测**，必要时把 near 调到 0.03。
- R5：命名风险：`PB`、`G` 都是全局名，可能和浏览器扩展冲突。缓解办法是只暴露 `window.PB`，`G` 留在闭包里。
- **需要用户裁决**：
  - Q1：是否必须支持 WebGL1 设备（ADR-02）。
  - Q2：昼夜循环中"日出回到黄昏"能否接受（ADR-08）。
  - Q3：无按键的鼠标移动是否算"任意输入"（ADR-12）。
  - Q4：是否允许在 Mac 上用 Playwright 做自动截图验收（本设计默认人工截图加自检页）。
  - Q5：音乐是否在首次手势后默认开启（本设计默认开启）。

---

`MISSING SECTIONS`：没有。第 0 步到第 6 节全部覆盖了。

需实测的项目有：§5.5 的性能数值、R1 到 R4、AC-1b 中受光照影响的色相判定、§4.11 的上下文恢复行为。这些都已经标注出来，等实施阶段补上数据。