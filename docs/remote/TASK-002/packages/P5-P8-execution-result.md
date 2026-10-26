# TASK-002 P5–P8 执行结果（`packages/P5-P8-execution-result.md`）

> 派生自 **`plan.md`**（canonical master plan，含 `AMD-P0-001`、`AMD-P4-001` 修订；规范性正文 sha256
> `089b3595ae50467947bb5aa7ff3efb785aac084498ebfaffe2bc34c8a3778ffd`）。
> 本文件**只引用**不可变编号（M/UD/ADR/AC/S/PR/P），不重新解释、不改写、不新增要求；与 `plan.md` 冲突时以 `plan.md` 为准。
>
> **结论一句话**：P5、P6、P7、P8 按 `plan.md` §5.1 顺序实施完毕并接线；`[selfcheck]` **135/136 PASS**（唯一 FAIL = AC-2b 峰值，见 `Q-06`），
> `[browser]` 应用门禁 **15/15 PASS**（P1–P4 既有 9 个 + P5–P8 新增 6 个；长跑用例 `p6-scarf-10min` 默认跳过、单独执行），非 file 请求 **0**，Console error **0**；
> **AC-2b 的峰值判据实测 0.4837 m 超出 [0.15,0.40]**，已按 §5.6 停止该项并记为 `Q-06`（**未改任何阈值**）；
> **T8 的围巾可见性**是 **MUST 对 MUST 的不可同时满足**（`Q-11`：§1.5 的躯干椭球吞没了 §4.1 的飘带），
> **AC-1b 的墨镜分项**与 **S6/S7/S12** 分别因"追尾机位看不到朝 −Z 的墨镜"和"依赖 P10 的机位"记为
> `Q-09`/`Q-10`（BLOCKED-ON-REVIEW / BLOCKED-ON-P10）。未提交、未推送、无远程调用、无 VPS 操作。

## 1. 每包派生任务（编辑前先派生，逐包执行）

| 包 | 允许文件（`plan.md` §5.1 + 通用允许集） | 出口判据（原文引用） | 涉及编号 |
|---|---|---|---|
| P5 | `js/render/pelican.js` | `[browser]` AC-1d、footPedalErr；`[screenshot]` S1（只验构图，海面待 P8） | AC-1a–1d、§1.4、§1.5、§4.13、M-03、M-04、M-25 |
| P6 | `js/core/scarf.js`、`js/render/pelican.js`（只改围巾部分）；`main.initSession` 追加 `scarf.initState` | `[selfcheck]` AC-2a/2b/2c 与 NaN 注入；`[browser]` AC-2d | AC-2a–2d、§4.1、ADR-07、M-28 |
| P7 | `js/core/daynight.js`、`js/render/sky.js`、`js/render/scene.js`（灯光、雾）；`initSession` 追加 `daynight.initState`；F6 追加 `sample`；F8 追加 `world.setLamps`、`pelican.setNight` | `[selfcheck]` AC-3d、星星分布；`[screenshot]` S1、S2 中的天空部分 | AC-3a–3d、§4.2、§4.2.4、UD-2、ADR-08、ADR-18、M-27 |
| P8 | `js/core/oceanmath.js`、`js/render/ocean.js` | `[selfcheck]` AC-4a/4b/4c/4d；`[build]` `grep -rn "precision" js/ tests/ index.html` = 0；`[screenshot]` S6、S12 | AC-4a–4d、§4.3、M-11、M-12、M-24、M-27、ADR-06/14 |

未越界：`js/core/fish.js`、`autopilot.js`、`achievements.js`、`quality.js`、`js/render/fishview.js`、`js/audio.js`、
`js/render/camera.js` 均**未改动**（后 4 个机位与 `setOrbit` 属 P10）。

## 2. ChangedFiles（sha256 / 字节 / 行数，可复算）

| 文件 | 字节 | 行 | sha256 | 归属包 |
|---|---|---|---|---|
| `js/render/pelican.js` | 28,265 | 632 | `c072b7974ce59e2336959c088607504b8721db50aafc0cc3861299e7c30bd2f0` | P5 创建；P6 追加围巾渲染段（含车架合并为 1 mesh、围巾法线就地累加） |
| `js/core/scarf.js` | 14,628 | 341 | `0a20708081eb18bb162d9c30e45f408e14fb0d1aeba0eea750cbcd29649f0969` | P6 |
| `js/core/daynight.js` | 7,846 | 212 | `f0a7d463a20cb5ca1836f827249b64c0a034bd98d40319d4a81f5a7c94a27b40` | P7 |
| `js/render/sky.js` | 9,367 | 226 | `db49c1fc2106525839ad5853bbef880681762aed9ef912ea9749a7aec7789468` | P7 |
| `js/render/scene.js` | 8,948 | 206 | `3e95598353f9b45931dfd028c4f44a1e04a281baa5dae95dced7cd938f2e98b6` | P1 创建；P7 追加灯光/雾/环境 |
| `js/core/oceanmath.js` | 7,643 | 187 | `70f42cd28915cf3590f8896e63db213b583f96650e5c237878cf1810365784e7` | P8 |
| `js/render/ocean.js` | 12,730 | 290 | `07e1d1fce84490588b2a407ad7325956d3653e5815c5a2de44297a9a4395a1f6` | P8 |
| `js/core/config.js` | 15,599 | 311 | `0b503cb26f9ff8d6802ccdc489d935233c35ef271c2999dda931536e82bd40c2` | P1 创建；P5–P8 追加常量 |
| `js/main.js` | 12,773 | 259 | `9d038851f763cbb6c5693c9a9635995553d5707e14af94f335602db597e70fdc` | P1 创建；P5–P8 追加接线 |
| `js/debug.js` | 9,761 | 224 | `d4e6b473630b3a220d895f932b0d29f9203454634cb813a2e963882066909e9b` | P1 创建；P5–P8 追加钩子与字段 |
| `index.html` | 1,265 | 40 | `427eb0b62c2bf0a9c351380dc59b413f08cbc56eb40ece4224a891912aa9d003` | P1 创建；P5–P8 追加 script 标签 |
| `tests/selfcheck.html` | 1,225 | — | `717b09d9a3736247f47eef753158cd20510d57d12c298d68dca1b0f469d67246` | P2 创建；P5–P8 追加 script 标签 |
| `tests/selfcheck.js` | 47,218 | 868 | `0150db4a143f9019b1160e35a002357fa5e70ff9f04405a092b51240968dbc08` | P2 创建；P5–P8 追加 31 条断言 |
| `tools/e2e/app.mjs` | 62,348 | 1,072 | `22028d4dce8ecad977fe96ab29deb53a5276d4e58753e097ecba51a637c54dd5` | P0/P1 创建；P5–P8 追加 6 个场景 + 长跑用例 1 个 |

复算：`shasum -a 256 <file>`（在 `claude-test-opus55` 根目录）。行数：`wc -l`。

## 3. AppliedChanges

### 3.1 P5 —— `js/render/pelican.js`（新建）

- **自行车**（§1.5 逐项）：轮胎/轮辋 torus（`WHEEL_R=0.34`、`TIRE_R=0.025`）、每轮 12 根辐条（每轮 1 个 `LineSegments`）、
  牙盘（r=0.10、x=+0.05）、曲柄组（组心 `BB±0.11`、`rotation.x = −θ`，使子件踏板落在
  `BB+(±0.11, 0.17cosθ, −0.17sinθ)`）、6 根车架管 + 把立、座垫（顶面中心 (0,0.95,−0.22)）、车把（宽 0.50）。
- **鹈鹕**：躯干椭球（半轴 0.28/0.36/0.50、Rx=+25°）+ 背部覆羽（`#9AA3A8`）、两段颈、头（r=0.16）、
  喙（8 顶点锥台，根宽 0.07 → 尖宽 0.03，尖端 = `CFG.BEAK_TIP_L`）、喉囊椭球、头盔半球（顶点 y=1.98）+ 条纹、
  两片墨镜（0.07×0.045，朝 −Z）+ 镜框、翼（枢轴 ±0.27/1.30/−0.35，长 0.80，展开 0→75°）、
  腿（两段解析 IK，髋 ±0.12/1.00/−0.24，大腿/小腿 0.46，膝朝 −Z）、蹼状三角脚、颈环 torus。
- **每帧**：`root.matrix.fromArray(G.rig.M)`（`matrixAutoUpdate=false`，M-25）→ 曲柄/踏板 → 腿部 IK →
  翼展开 → 轮自转（`mod(S/r, 2π)`）→ blob 阴影（只取 rig 的 x、不随 wheelie/lean 旋转，不透明度
  `0.35·(1−y/1.2)·(1−0.6·night)`）。
- **读数接口**：`S.beakError(G)`（喙尖标记经真实 `matrixWorld`，AC-1d）、`S.beakMeshError(G)`
  （**真实喙网格尖端顶点**，几何索引 4..7 的中点）、`S.footPedalError(G)`（脚网格世界坐标反算局部后与 §1.5 踏板公式比较）、
  `S.headGroup()`（P10 的 POV 隐藏用）、`S.setNight()`（P7 推送）。
- **预算**：角色 + 车 **39 个 mesh / 3,902 三角面**（§2.2 上限 40 / 8,000；浏览器实测）。

### 3.2 P6 —— `js/core/scarf.js`（新建）+ `pelican.js` 围巾部分

- **结构**：2 列 × 13 行 = 26 粒子（`P`/`Q` 各 `Float64Array(78)`），第 0 行钉在 `G.rig.anchorW`。
- **积分**（§4.1 逐行）：子步 `h_s = 1/240`（每固定步 4 子步）；`vel = clampLen((P−Q)·DAMP, 20·h_s)`；
  `acc = (0,−9.8,0) + (0,0,a) + C_D·(wRel − vel/h_s) + flutter`；`Pn = P + clampLen(vel + acc·h_s², 0.05)`。
- **约束**：结构（行距 0.055）、剪切（对角 √(0.055²+0.12²)）、弯曲（隔一行 0.11）、宽度（0.12），
  每子步 6 次迭代、刚度 1（第 0 行视为无限质量），并做 §1.5 两个碰撞球（r=0.30 / 0.07）推出。
- **风场**：`s_w = 0.25+0.75·min(1,v/6)`；`wRel = (s_w(1.2sin0.7t+0.6n1), 0.3s_w n2, v+1.5s_w gust)`；
  `gust = 0.5+0.5 sin(0.37t)sin(1.13t)`；`n1/n2` 用 `PB.mathx.noise1`（种子 3/5）。
- **抖动**：沿带面法向（行方向 × 列方向），`0.9·(row/12)·sin(2π(3+0.35v)t+0.9row)·min(1,v/4)`。
- **测量量**：`angleDeg`（tip−anchorMid 与 (0,−1,0)）、`lagX`（tip.x−anchorMid.x 减去"运动前 1 s 的基线"；
  基线只在锚点横向速度 ≤0.12 m/s 时更新，即变道期间冻结 —— 见 `Q-05`/`Q-06` 的读法）。
- **健康检查**（§4.1）：每个固定步检查全部 P/Q 有限、`|P−Q| ≤ 0.2`、`|P−anchorMid| < 1.5`，失败则 `reset` 并
  `health.scarfResets++`（计数器由 `main.health` 持有，softReset 不清零，M-28）。
- **复位**：方向 `(0,−cos20°, sin20°)`（"下垂 20°"自竖直方向量起，见 `Q-05`）+ 一轮纯位置投影（约束 + 推出，
  不做积分）把中段推到躯干球前侧，`Q=P`。
- **围巾渲染（`pelican.js` 的 P6 追加段）**：26 顶点 / 12×2 三角，`DoubleSide` + Lambert `#D7262E`，
  每帧写 position 后 `computeVertexNormals`，挂在 scene 根下、单位变换（§4.1）。

### 3.3 P7 —— `js/core/daynight.js`、`js/render/sky.js`（新建）+ `scene.js`（灯光、雾）

- **daynight**：`G.env` 的**唯一分配者**；§4.2.2 的 10 行关键帧在 `CFG.DAY.KEYS`（sRGB 十六进制），
  模块加载时一次性转成**线性**三元组（core 不引用 THREE，M-07）；`sample(t,out)` 分段线性插值、只写预分配字段；
  `lightDir(p,out)` 按 §4.2.2 的全相位定义（太阳/月亮仰角各夹到 ≥3°，`[0.16,0.24)`/`[0.74,0.86)` 用 `slerpDir`）；
  `lightColor = 线性色 × 强度`（§4.2.3），`ambient = hemiSky × hemiI`，`nightMix = stars`。
- **sky**：穹顶（半径 1000、`BackSide`、`depthWrite:false`、`fog:false`、`renderOrder=-1`、跟随相机）；
  渐变 `mix(horizon, zenith, pow(max(dir.y,0),0.45))`、地平线以下 `horizon·0.6`；
  日盘 `smoothstep(cos1.5°,cos1.4°,dot)+pow(dot,300)·0.6`、月盘 `smoothstep(cos1.25°,cos1.15°,dot)·(0.85+0.15·vnoise)`、
  月晕 `pow(dot,800)·0.3·uNightMix`；星点 3000（`PB.mathx.starField` 同一份分布，PR-1 同源）、
  大小 1.2–2.8 px、`gl_PointSize` 直接给定（无衰减）、闪烁 `0.75+0.25 sin(2π·m_i·uTwinkleT/60+φ_i)`（`m_i∈{3..12}`）、
  不透明度 = `env.stars`；`uTwinkleT = mod(t,60)`。片元结尾 `#include <tonemapping_fragment>` + `#include <colorspace_fragment>`。
- **scene（灯光、雾）**：`DirectionalLight`（颜色 = `lightColor/lightI`、强度 = `lightI`、位置 = `lightDir×100`）、
  `HemisphereLight`（sky/ground/强度）、`THREE.Fog`（near 140、far 按 §4.10 等级表、颜色 = `env.horizon`）、
  `scene.background` = `env.zenith`；`S.applyEnvironment(env)` 每帧 F8 调用；`S.setFogLevel(l)` 供 P14。

### 3.4 P8 —— `js/core/oceanmath.js`、`js/render/ocean.js`（新建）

- **oceanmath**：4 个波的派生量（`k=2π/L`、`ω=√(g·k)`、`Q=0.125/(k·A)`）；`OCEAN_DISP_GLSL`
  是**顶点与片元两条路径共用的同一份字符串**（含 `oceanAlpha`/`oceanDisp`/`oceanNormal`，常量由 `CFG.OCEAN` 插值生成）；
  CPU 镜像 `phase/disp/normal/foam` 与 GLSL 逐项对应（M-11）；`vnoise256` 的 JS 哈希与 GLSL 同一常数、同 256 周期。
- **ocean**：四档网格（48/80/128/192）与两种材质在 boot **预建**；非均匀网格（x 指数 1.6、z 指数 1.5，近岸/近镜头更密，
  §2.2 允许）；两种材质**共享同一份 uniform 对象**（写一次两边生效）；相位/噪声偏移/泡沫相位在 JS 双精度取模后写 float32（M-27，
  不做 rebase）；光照与泡沫公式按 §4.3 逐行；雾与 `scene.fog` 同源；`S.precompile()` 在 boot 与 `webglcontextrestored` 都执行（§4.11/PR-4）。
- **法线路径**：`L2/L3 且 highp` → 逐像素（`oceanNormal(vWorld.xz, vAlpha)`），否则逐顶点。highp 的判定方式见 `Q-07`
  （按值扫描 `renderer.capabilities`，使 M-12 与 P8 的 `[build]` grep 同时成立）。

### 3.5 接线（通用允许集，只追加）

| 文件 | 追加内容 |
|---|---|
| `index.html` | 按 §3.2 顺序插入 `scarf/daynight/oceanmath/sky/ocean/pelican` 六个 script 标签 |
| `js/core/config.js` | P5/P6/P7/P8 四段常量（§1.5 比例、§4.1 围巾参数、§4.2.2 关键帧 + §4.10 雾表、§4.3 波参数 + 泡沫参数） |
| `js/main.js` | boot：`pelican/sky/ocean.init` + `ocean.precompile`；F5 追加 `scarf.step`；F6 `daynight.sample`；F8 `applyEnvironment/sky/ocean/world/setLamps/pelican.update/setNight`；F13 `debug.assertFrame`；restored 追加 `ocean.precompile`；`initSession` 追加 `scarf.initState`、`daynight.initState`；`freezeTime` 时 `dt=0` |
| `js/debug.js` | `stats()` 追加 `beakErr/footPedalErr/scarfTipAngleDeg/scarfLagX/scarfResets/starsInView/lightDirErr/pixelNormals/frozen`；钩子 `assertFrame/freezeTime/frozen/setPhase` |
| `tests/selfcheck.html` | 追加 `scarf/daynight/oceanmath` 三个 script 标签 |
| `tests/selfcheck.js` | P6/P7/P8 三段用例（31 条新断言） |
| `tools/e2e/app.mjs` | `open()` 增加可选 `viewport`（§5.3 的 1920×1080）；`p1-running` 的天空判据随 P7 更新为"落在 §4.2.2 渐变段上"；新增 6 个场景；长跑用例默认跳过（`TASK002_LONG=1` 或显式 `TASK002_ONLY` 才执行） |

## 4. Verification（真实命令、真实退出码）

环境：macOS 15.1 / Apple M4 Pro / Node v18.19.0 / Playwright 1.48.2 / Chromium 130.0.6723.31 / `file://`。

| 命令 | 退出码 | 结果 |
|---|---|---|
| `cd tools/e2e && PW_HEADLESS=1 node app.mjs` | **1** | **12/12 场景 PASS**；`failures` 仅剩 selfcheck 的 **AC-2b**（见 §4.3，`Q-06`，非本包可修） |
| `PW_HEADLESS=1 TASK002_ONLY=selfcheck node app.mjs` | **0** | `[selfcheck]` **135/136 PASS**（唯一 FAIL = AC-2b 峰值，见 `Q-06`）（唯一 FAIL = AC-2b） |
| `PW_HEADLESS=1 TASK002_ONLY=p6-scarf-10min node app.mjs` | **0** | AC-2d：真实 10 min（**wallMs 600,282**），`scarfResets=0`、`nanResets=0`、`errorsIn10s=0`、`appState=running`、模拟 `t=600.3 s`、`S=9,540 m`、`fpsWin=60` |
| `TASK002_OFFLINE=1 TASK002_ONLY=p1-running,p4-riding,p8-ocean node app.mjs` | **0** | 3/3 PASS（`context.setOffline(true)`），非 file 请求 0 |
| `grep -rnE "TODO\|STUB\|FIXME\|placeholder" js/ tests/selfcheck.js index.html css/` | 1（无匹配） | 0 命中 |
| `grep -rnE "shadowMap.enabled *= *true" js/` / `grep -rn "castShadow" js/` | 1（无匹配） | 0 命中（M-22） |
| `grep -rn "precision" js/ tests/ index.html` | 1（无匹配） | **0 命中**（P8 的 [build] 判据；实现方式见 `Q-07`） |
| `node --check`（全部改动 JS） | 0 | 语法通过 |

### 4.1 `[selfcheck]` 135/136（关键读数见 `impl-notes.md` §C-9）

AC-2a **65.40°**、AC-2b 峰值 **0.4837 m（FAIL，`Q-06`）** / 回落 **0.917 s**、AC-2c **4.72°**、
AC-3d **2.881 °/s**、§4.2.2 关键帧逐项相等、UD-2 闭环最大通道差 **5.0e−6**、星点 <24° 占比 **0.550**、
AC-4a **1.466°**、AC-4b **100%**（≥90%）、AC-4c **17.45%**、AC-4d **1.4e−4 m**、M-27 相位 0 违例。

### 4.2 `[browser]` 15/15（P5–P8 新增 6 个场景）

| 场景 | 关键读数 |
|---|---|
| `p5-character` | AC-1d 喙标记误差 **0**（中立 / lean 0.21 / wheelie 18° / 跳跃顶点 0.8925 m）；**真实喙网格尖端**误差 **2.94e−8 m**；`footPedalErr` **0**（4 状态 + 曲柄 4 相位）；围巾渲染顶点 **78/78 逐位等于 `Math.fround(P)`**（违例 0）；**34 mesh / 3,926 tris**（含围巾；车架 7 段合并为 1 个 mesh 后从 41 降到 34） |
| `p5-framing` | AC-1a 投影跨度 **28.662%**（∈[22,32]）且**截图里头盔顶行 495 与投影行 494.58 相差 0.42 px**；AC-1b 围巾 **415 px**、头盔 **1,306 px**，墨镜两片对相机射线的"到头部球心最近距离"**0.0631 < r=0.16** ⇒ 几何遮挡（`Q-09`）；飘带被躯干椭球吞没 **20/24**（`Q-11`）；AC-1c 四区域亮度 road 0.085 / sand 0.320 / sea 0.921（起伏 0.667）/ sky 0.586 |
| `p6-scarf-shot` | v=**8.0**；夹角 **65.14°**；`scarfLagX` −2.3e−4；`scarfResets` 0；截图 `S7-substitute-mode0-v8.png` |
| `p7-sky` | p=0.5：`starsInView` **326**（≥250）；`lightDirErr` **1.48e−7**（≤1e−6）；`env.stars=1`、`env.lamps=1`；截图 `S2-night.png` |
| `p8-ocean` | `glVersion=2`、逐像素 true、`calls=57`、`tris=39,358`；M-27 相位与双精度公式**逐位相等**（S≈1e4 与 1e7）；`OCEAN_DISP_GLSL` vs CPU 镜像 **8.17e−7 m**（16 采样点 RGBA8 打包回读）；L1 逐顶点与 L2 逐像素两条路径都渲染、`errorsIn10s=0`；截图 `S1-dusk-chase.png` |
| `p8-ocean-gl1` | `--disable-webgl2`：`glVersion=1`、`isWebGL2=false`、`VERSION` 以 `WebGL 1.0` 开头、海面与角色正常绘制、`lightDirErr ≤1e−6`；仅 1 条预期的 r162 WebGL1 弃用 warning |
| `p1-running` | 天空像素落在 §4.2.2 渐变段上（≤12/255）——P7 接入穹顶后按新判据 |

- Console 判据：全部场景 **error = 0、pageerror = 0**（`p1-vendormissing` 的 1 条被测 net error 仍按精确条数登记）；
  warning 1 条（`p8-ocean-gl1` 的 r162 WebGL1 弃用提示，与 `impl-notes.md` §C-2a 同类，不是 error、不是新类别）。
- 非 file 请求：全部 **0**。
- 截图仅作证据，**视觉判定留给 `ui-vision`**。

### 4.3 AC-2b（BLOCKED，`Q-06`）

见 `impl-notes.md` §D `Q-06`：模型与允许的校准区间给出的峰值是 0.438–0.506 m，判据区间是 [0.15,0.40]；
回落判据通过（0.917 s ≤ 1.0 s）。未改阈值、未改模型、未删除断言，selfcheck 如实 FAIL。

### 4.4 AC-2d（真实 10 min，实测读数）

命令：`PW_HEADLESS=1 TASK002_ONLY=p6-scarf-10min TASK002_EVIDENCE_APP=~/.evidence/task-002/implementation/app-ac2d node app.mjs` → **退出码 0**。

| 项 | 实测 |
|---|---|
| 真实墙钟 | **600,215 ms**（`wallMs >= 600000` 断言通过） |
| 变道次数 | **30**（每 20 s 交替 A/D） |
| `scarfResets` / `softResets` | **0 / 0** |
| `nanResets` | **0** |
| `errorsIn10s` | **0** |
| `appState` | `running` |
| 模拟时间 / 路程 | `t = 600.317 s` / `S = 9,540.5 m` |
| `fpsWin` | **60** |
| `tris` / `calls` | 39,382 / 53（与 `p8-ocean` 的读数一致） |
| Console error / warning / 非 file 请求 | **0 / 0 / 0** |

**不做任何时间加速**：判据用的是真实墙钟与页面内的 `health.scarfResets`（会话级计数器，M-28）。

## 5. NotDone / 阻塞项

| 项 | 状态 | 依据 |
|---|---|---|
| AC-2b 峰值判据 | **BLOCKED**（实测 0.4837 m） | `Q-06`：允许的校准区间无法进入 [0.15,0.40]；需裁决（上调上限 / 改 §4.1 迭代数 / 改变道时长） |
| **T8 / §1.6「围巾双面渲染且有明暗变化」** | **BLOCKED（MUST×MUST 冲突）** | `Q-11`：飘带 **20/24**（v=8）、**24/24**（v=0）个粒子落在 §1.5 的躯干椭球内被遮挡；像素分解证明围巾色 **415 px** 中飘带只贡献 **147 px**，其余来自同色颈环 |
| AC-1b 的"墨镜像素"分项 | **BLOCKED-ON-REVIEW** | `Q-09`：S1 追尾机位下两片墨镜对相机射线的最近距离 **0.0631 < 头部球 r=0.16**，被自己的头挡住（围巾 413 px、头盔 1,306 px 两项通过） |
| S6 / S12（P8 的 `[screenshot]` 项） | **BLOCKED-ON-P10** | `Q-10`：需 mode 4 + `setOrbit`；数值等价判据 AC-4a/4d 已通过 |
| S7（P6 的 `[screenshot]` 项） | **BLOCKED-ON-P10** | `Q-10`：需 mode 1；已产出 mode 0 等价机位并明确标注 substitute |
| PR-4 `contextrestored` 完全恢复 | **部分验证** | 已在 restored 路径调用 `ocean.precompile()`；"lose/restore 各 5 次、画面一致"仍属 P16 |
| PR-5 移动端 mediump 逐顶点路径 | **NOTVERIFIED** | 需真机；桌面已实测 L1 逐顶点路径渲染无错误（不等价于 mediump 设备） |
| PR-6/PR-7/PR-3 设备支路 | **NOTVERIFIED** | 需用户真机（P16） |
| P9–P16 | 未实现 | 鱼、5 机位、成就、自动驾驶、音频、画质、触屏布局 |

## 6. 证据位置

- `~/.evidence/task-002/implementation/app/`：`app-gates.json`（P1–P8 全量，含 `skippedLong`）、
  `app-gates-offline.json`、`screens/{S1-dusk-chase,S2-night,S7-substitute-mode0-v8}.png`（1920×1080）
  以及 P1–P4 既有截图。
- `~/.evidence/task-002/implementation/app-ac2d/app-gates.json`（未改最终代码前的 10 min 报告，保留不改写）与
  `app-ac2d-final/app-gates.json`（**最终代码上的 10 min 报告，当前有效证据**）。
- `~/.evidence/task-002/implementation/app-check/`：P5–P8 开发期的一次全量校验（过程证据）。

## 7. 边界核对

- 工作树：`/Applications/WorkStudio/GitHub/claude-test-opus55`，分支 `feature/TASK-002-opus55`；**无** `git commit` / `git push`。
- TASK-001 工作树 `/Applications/WorkStudio/GitHub/claude-test`：未触碰。
- Java 侧（`JavaBasicDemo/`、`redisPractice/`、`pom.xml`、根 `README.md`）：零改动。
- `vendor/`：零改动。
- `plan.md` / `adr.md` / `handoff.md` / `AMD-*.md` / `packages/P0.md` / `packages/P1-P4-execution-result.md`：本轮零改动。
- 无远程 API/模型调用、无 VPS 操作、无系统配置改动。
