# TASK-002 ADR 草案（draftadr）

> **状态：DRAFT — 非 APPROVED；`USER_DECISIONS_RESOLVED`（UD-1…UD-5 已于 2026-10-25 由用户裁决，见 §2）。**
> 本文件**不得**作为冻结依据，也**不得**作为实施授权：UD 已裁决 ≠ 设计已批准。
> 冻结仍需：`review-3` 对 `design-v3.md` 的最终审计 + 用户明确签核（§3）。
> 本文件把 `design-v2.md` §6.1、`response-1.md` 的 USER_DECISIONS 与用户裁决合并记录。

## 0. 来源与效力

| 项 | 值 |
|---|---|
| ADR 表来源 | `design-v2.md` §6.1（ADR-01…ADR-18，模型输出原文，本地未改写） |
| 待裁决项来源 | `response-1.md` §4（UD-1…UD-5，模型输出原文） |
| 用户裁决 | **2026-10-25，用户（zhoucaiwu）逐条裁决 UD-1…UD-5**，裁决值见 §2；裁决已并入 `design-v3.md` |
| 作者 | 远程 Opus 5.5 medium（`session_id=17c5e5a3-2d23-4637-b36d-9af9a7ecbac4`，`--resume`，未 fork） |
| 评审输入 | `review-1.md`（49 条）、`review-2.md`（两份独立静态评审：B1–B3、O-1–O-5、R-1–R-11、X-1–X-5） |
| 未经过 | **`review-3` 最终审计、用户签核**；任何构建或实测（PR-1…PR-12 全部未执行） |
| 可逆性列 | 由设计作者给出，未经实施验证 |

## 1. 已定设计决策（ADR-01…ADR-18）

| ADR | 决策 | 备选 | 否决原因 | 可逆性 |
|---|---|---|---|---|
| 01 | three（版本按 UD-1）+ esbuild@0.24.0 打成 IIFE，只 vendoring three | 官方 UMD、与应用代码合并打包、自研 | UMD 已移除；合并打包需要反复构建；自研没有量化理由 | 高 |
| 02 | WebGL 支持范围**待 UD-1 裁决**；临时默认 r162（WebGL2 优先，WebGL1 回退），兼容性在裁决前视为未满足 | r170 只支持 WebGL2 | 属于用户职权 | 中 |
| 03 | 经典 script + PB 命名空间 | ES module | file:// 下 CORS | 低 |
| 04 | 跑步机世界 | 车辆真实前进 | 精度问题 | 低 |
| 05 | 固定步长，渲染不插值 | 带插值的渲染 | 会引入第二个位置来源 | 中 |
| 06 | 海面法线用有限差分 | 解析导数 | 衰减因子容易漏 | 高 |
| 07 | Verlet 2×13，4 子步，6 次迭代；风场按速度缩放 | 显式弹簧、骨骼摆动 | 稳定性或惯性不足 | 高 |
| 08 | 周期 240 s，经日出回到黄昏（UD-2） | 硬切 | 用户可以选择 | 高 |
| 09 | blob 阴影 | shadowMap | 切画质要重编译 | 中 |
| 10 | 4 级离散画质 + 滞回 | 连续缩放 | 不可测 | 高 |
| 11 | 自动驾驶全有或全无，空闲阈值 6 s | 部分辅助 | 仲裁复杂 | 高 |
| 12 | 活跃集合用"字面"口径（UD-3 临时默认） | 不含无按键的鼠标移动 | 会收窄契约 #12 | 高 |
| 13 | 成就跨会话持久化 | 只在本局有效 | — | 高 |
| 14 | 不做 rebase；着色器周期量由 JS 双精度生成 | 取模 S / 整除波长 | dirZ 投影导致相位跳变 | 高 |
| 15 | rig 单一变换 | 只统一鱼的位置 | 喙与判定不同源 | 中 |
| 16 | 唯一 store | 各模块各写各的 | 丢更新 | 高 |
| 17 | 增量接线：每包可以追加 main 和 index | 预置占位 | 违背"不得有占位" | 高 |
| 18 | 月亮在天空 shader 中绘制 | Sprite | 尺寸口径不一 | 高 |

## 2. 用户裁决（UD-1…UD-5，已裁决）

> **裁决日期：2026-10-25。裁决人：用户（zhoucaiwu）。** 以下为**用户决策**，不是模型建议，也不再是"临时默认"。
> 裁决值已按 §2.1 的落点写入 `design-v3.md`；正文中所有"待 UD-n 裁决""临时默认"的措辞在 v3 中必须消失。

| UD-n | 问题 | **用户裁决（2026-10-25）** | 备选（未被采纳） | 可测代价 | 落点（v3 章节） |
|---|---|---|---|---|---|
| UD-1 | 是否支持只有 WebGL1 的设备（R-C15、Q1） | **支持。three 锁定 `0.162.0`（= r162）：WebGL2 优先、WebGL1 回退；自定义 GLSL 按 M-24 的 ES 1.00 子集写** | r170，只支持 WebGL2，无 WebGL2 时显示提示 | 体积相近（PR-2 实测）；需按 GLSL1 子集写的 shader 3 个（sky、ocean、stars）；测试矩阵多一项 `--disable-es3-apis`；维护上不能用 r163 以后的新 API | §5.7（去占位符）、M-06、§2.3、§4.11、ADR-01/02、§6.3 R6 |
| UD-2 | 昼夜循环经日出回到黄昏（Q2） | **完整闭环：黄昏→暮光→夜→黎明前→日出→回到黄昏，周期 240 s，无硬切** | 夜结束后用 2 s 淡出硬切回黄昏 | 只改关键帧表 | §4.2.1/§4.2.2、ADR-08 |
| UD-3 | "任意输入"的口径（R-C17、Q3） | **字面口径：任何 `isTrusted === true` 的输入（含无按键的 `mousemove`、滚轮、面板上的指针移动）立即取消自动驾驶** | 排除无按键的鼠标移动 | 鼠标轻微晃动也会推迟 AUTO | §4.6.1（去"临时默认"）、§5.2 第 24 条、ADR-12 |
| UD-4 | 是否允许在 Mac 上用 Playwright 自动化 [browser] 和 [screenshot]（R-H24、Q4） | **允许，仅作为构建期开发依赖，不进入交付物；运行时页面仍零网络请求** | 只做人工清单 | 多一个开发依赖；人工方式每轮复核约 40 项 | §5.3 |
| UD-5 | 首次手势后音乐是否默认开启（Q5） | **开启：`store.doc.settings.muted` 初值 `false`** | 默认静音 | 无 | §3.6 store schema、§4.9 |

### 2.1 落点校验方式

| UD | 可执行校验 |
|---|---|
| UD-1 | `grep -n '<UD-1' design-v3.md` 结果为 0；`"three": "0.162.0"` 在 §5.7 恰好出现 1 次；ADR-02 不再含"待裁决" |
| UD-2 | §4.2.1 的阶段划分覆盖 `[0,1)` 且以日出段收尾；ADR-08 不再含"待裁决" |
| UD-3 | §4.6.1 给出可信事件集合的完整枚举（含 `pointermove` 无按键）且不含"临时默认" |
| UD-4 | §5.3 写明 Playwright 为开发期依赖、不进交付物 |
| UD-5 | §3.6 的 `settings{muted,cam}` 初值写明 `muted=false` |

## 3. 冻结前置条件（全部满足后才可改名为 `adr.md` / APPROVED）

> 修订依据：`review-2.md` 的 O-3（冻结门禁自锁）、X-4（"裁决前按临时默认"与"不授权实施"冲突）、X-5（PR 不应阻止实施）。
> 门禁一律绑定到**实施包出口**，不绑定到"批准前必须完成的运行时证明"，否则门禁永远无法满足。

1. **UD-1…UD-5 已裁决**（2026-10-25）并回填到 `design-v3.md` 的对应章节（校验见 §2.1）——**已完成**；
2. **PR-1 是 P2 的出口门禁**（不是冻结前义务）：P2 交付 `js/core/config.js` 与投影 selfcheck 后，用 config 常量算出构图/星星/POV 的预计值并与 AC 区间自洽；
3. **PR-2 / PR-3 是 P0 的出口门禁**（不是冻结前义务）：P0 交付 vendor 产物后给出真实构建证明（体积、sha256、字节数、`--disable-es3-apis` 下的 WebGL1 回退）；
   - 允许在**私有证据目录**做一次性 spike（不入库、不写应用代码）产生体积/回退证据，但**不得**用估计值冒充 PR-2/PR-3；
4. **`review-3`** 逐条核对 `design-v3.md` 是否真正闭合 `review-2.md` 的全部编号（B1–B3、O-1–O-5、R-1–R-11、X-1–X-5），
   并对每条 AMD 做"是否只改措辞"的判定；
5. **用户明确签核**。在此之前 `design-v3.md` 与本文件都保持 DRAFT，且**不构成实施授权**。

## 4. 与 v1 的差异摘要（v2 阶段，保留为历史）

- **ADR 变更**：ADR-01 改为"版本按 UD-1"；ADR-02 改为"支持范围待 UD-1 裁决，临时默认 r162"；
  ADR-07 增加"风场按速度缩放"；ADR-12 改为"字面口径（UD-3 临时默认）"。
- **新增 ADR-14…ADR-18**：不做 rebase（JS 双精度相位）、rig 单一变换、唯一 `store`、
  增量接线（每包可追加 `index.html`/`main.js`）、月亮改由天空 shader 绘制。
- **新增不变量 M-23…M-32**：所有权表、GLSL ES 1.00 兼容子集与 pow 底数、rig、两条 edge 队列、
  JS 相位偏移、会话级 `health`、唯一 `store`、构建锁、稳态零分配、`resumeRunning` 唯一入口。
- **新增验收**：AC-1d、AC-3d、AC-4d、AC-5c、AC-6e、AC-6f、AC-9d、AC-12d、AC-12e。
- **新增章节**：§3.6 所有权与生命周期、§4.13 角色骨架 rig、§5.7 构建锁。
- **取消**：`coyoteT`（平路无被动离地）、`G.S` rebase、`G.health`（移为会话级 `PB.main.health`）。

## 5. v2 → v3 最终变更清单（review-2 闭环 + UD 落点）

> 来源：`response-2.md` §2（模型 CHANGE_LIST，19 个整节替换 + 6 个单行 patch），本地装配并逐条校验（锚点各命中 1 次）。
> `design-v2.md`（77,957 B）→ `design-v3.md`（96,702 B），diffstat **+398 / −209**，97 个 hunk。

### 5.1 逐编号处置（`response-2.md` §1）

| 编号 | 处置 | 落点 |
|---|---|---|
| B1 | ACCEPT（含 1 处有据反驳） | §4.4.2 missed 闭式轨迹（`MISS_XT/MISS_T/MISS_VY0/MISS_G`）+ 最坏起点数值表 + 新增 **AC-5d**；§5.2 第 23 条可判定化。**反驳点**：评审要求"相邻固定步位移 ≤0.5 m"与"0.6 s 内越岸"互斥（lane0 需 30.97 m/s → 0.516 m/步），模型把步长上限定为 **0.6 m** 并在 AC-5d 里写死 |
| B2 | ACCEPT | `createState` 只建纯数据；`rig/scarf/daynight.initState` 分期接线；`newSession` = `createState` + `initSession`，boot 与 softReset 共用；新增 **M-33** |
| B3 | ACCEPT | §4.6.3 区分"新目标筛选 `d∈(6,60)`"与"已锁定目标保留至起跳/捕获/越过"；换目标时 `prevTArr = +∞`；给出"恰好起跳一次"的单调性论证 |
| O-1 | ACCEPT | three 写死 `0.162.0`；§4.11 三段检测（WebGL2 / 仅 WebGL1 / 都没有）；ADR-01/02、M-06、§2.3、§6.3 R6 全部改为已定事实 |
| O-2 | ACCEPT | §5.1 通用允许集新增 `js/core/config.js`、`js/debug.js`（只追加）；`config.js`/`debug.js` 由 P1 创建、`tests/selfcheck.*` 由 P2 创建、`tools/e2e/*` 由 P0 创建 |
| O-3 | NO-CHANGE（本地修） | 设计正文无矛盾句；本地已把门禁改写为"PR-1 = P2 出口、PR-2/PR-3 = P0 出口"（§3） |
| O-4 | ACCEPT | `store.doc.settings.muted` 初值 `false`（§3.6 与 §4.9 各写死一次），手动静音经 `store.update` 持久化 |
| O-5 | ACCEPT | §5.3 写明 `[browser]`/`[screenshot]` 由 Playwright（`1.48.2`，devDependency）执行，人工只做复核，运行时零网络由请求计数断言 |
| R-1 | ACCEPT | §1.1 沙滩上界改为 `SHORE_X`（P-01） |
| R-2 | ACCEPT | §1.4 湿沙带改为 `[SHORE_X−1.5, SHORE_X]`（P-02） |
| R-3 | ACCEPT（部分） | §3.1 正文声明"逐文件上限之和 5600 行为唯一口径，标题中 3800 不再适用"（P-04）；**标题文字未改**（装配器保留标题行），留作 review-3 观察项 |
| R-4 | ACCEPT | §5.5 移动帧率行展开为 `stats().fpsWin`（P-06） |
| R-5 | ACCEPT | AC-6d 的 sim 断言归 P4 `[selfcheck]`；S13 截图归 P10（P4 尚无角色模型），§5.1 与 §5.3 双处写死 |
| R-6 | ACCEPT | §4.7 消歧：模式之间 0.6 s、电影镜头内部机位之间 1.2 s，且不叠加 |
| R-7 | ACCEPT | §4.7 mode 4 新增构图判据（包围盒中心 `abs(ndc) ≤0.2`、地平线距顶 10%–20%，预计 15.2%）+ 新增 **S14** 机位 |
| R-8 | NO-CHANGE（有据） | 24° 密度接缝为已知外观项：S2（mode 0）不可见，mode 4 pitch≥5° 且注视车、接缝只在画面上沿；写入 §6.3 R8 |
| R-9 | ACCEPT（含 1 处有据反驳） | 腿 IK 改为 0.888/0.560（全圆 0.893/0.553）；围巾 sanity 改为三档 63.9°/64.4°/67.9°。**反驳点**：评审的"v=0 应为 6.6°"漏了 z 向阵风——`s_w=0.25` 时 x=0.45、z=0.375，合成 0.586，`atan(2.5·0.586/9.8)=8.50°`，原 8.5° 正确 |
| R-10 | ACCEPT | 判定位置写死为 `tip–anchorMid` 连线；锚点上移至 `(±0.06,1.55,−0.54)`、颈碰撞球移至 `(0,1.68,−0.58) r=0.07`；几何静息角 5.2°；AC-2c 的 20° **未放宽** |
| R-11 | ACCEPT | §3.5 补 `mathx.rng(G)`、各 `initState`、`newSession/initSession`、hud 4 个函数、`world.setLamps`、`pelican.setNight`；Env 由 `daynight.initState` 分配；曲柄参数化写入 §1.5 |
| X-1 | ACCEPT | §3.2 给出 25 个 script 的唯一加载序 |
| X-2 | ACCEPT | `fatal(noWebGL)` 文案内联进 §4.11 |
| X-3 | ACCEPT | §5.2 第 19 条改为"连续越过 1e4/1e7 附近无跳变，`setS` 瞬移不作判据" |
| M-22 | ACCEPT | P16 增加两条 grep（`shadowMap.enabled = true`、`castShadow` 均为 0 命中） |
| M-31 | NO-CHANGE（有据） | 页面内无可靠的逐帧分配计数 API；保留 Performance 录制 GC 停顿 <5 ms 作为读数（Playwright + CDP） |

### 5.2 结构性变更（便于快速定位）

- **新增不变量**：M-33（唯一初始化路径 `newSession`）、M-34（可信事件集合）。
- **新增 AC**：**AC-5d**（missed 轨迹 5 项判据，`[selfcheck]`，读数来源 `fish`）。
- **新增截图机位**：S14（mode 4 构图）。
- **§3.3 语义变更**：`createState` 由"创建含 rig/scarf/env 的完整 G"改为"只建纯数据"，其余字段由 `initState` 填充。
- **§5.1 包序变更**：P1 创建 `config.js`/`debug.js`/`store.js`；P2 创建 `tests/selfcheck.*`；P4 含 `rig.js`/`world.js`/`camera.js(mode 0)`；P0 含 `tools/e2e/*`。
- **§4.11 检测变更**：不再先 `getContext('webgl2')`，改为直接构造 `WebGLRenderer` 并按 `capabilities.isWebGL2` 分三段；WebGL1 需 `ANGLE_instanced_arrays`（PR-3 实证）。
- **删除的措辞**：全部"待 UD-n 裁决""临时默认""按 UD-1 决定""<UD-1：…>"。

### 5.3 未闭合/待 review-3 复核的观察项（本地登记，不构成阻塞）

| # | 观察项 | 建议 |
|---|---|---|
| V-1 | §3.1 **标题**仍写"总共约 3800 行"，正文声明其作废（R-3 只改了正文行） | review-3 决定是否允许本地改标题文字 |
| V-2 | B1 的步长上限由评审建议的 0.5 m 改为 0.6 m（模型给出互斥性证明） | review-3 复核该证明；若接受则 AC-5d 无需再改 |
| V-3 | §4.11 的 WebGL1 分支要求 `ANGLE_instanced_arrays` 扩展（道具 Instanced），未在 PR-3 之前实证 | PR-3 必须覆盖"仅 WebGL1 且无该扩展"与"仅 WebGL1 有该扩展"两种设备 |
| V-4 | R-10 顺带把围巾锚点/颈碰撞球几何上移（属 R-10 修复范围的副作用） | PR-8 参数扫描需覆盖新几何 |
| V-5 | `playwright` 版本写死 `1.48.2`（UD-4 裁决未指定版本） | review-3 确认该锁版本可接受 |
