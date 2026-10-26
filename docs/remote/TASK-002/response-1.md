# TASK-002 响应 1（response-1）：远程 Opus 对两份评审的逐条回应

> 状态：**DRAFT — 未批准**。本文件是远程会话响应的**分节摘录**（裁决矩阵、变更清单、未改章节、
> 用户裁决项、证明义务、细节层级、完整性声明），正文计划见 `design-v2.md`。
> 内容为模型输出原文，本地未改写；原始响应 JSON 保存在私有证据目录（不入库）。

## 元信息

| 项 | 值 |
|---|---|
| 会话 | `--resume 17c5e5a3-2d23-4637-b36d-9af9a7ecbac4`（未 fork） |
| 模型 / effort | `claude-opus-5-5` / `medium` |
| 装配模式 | `MODE=AMENDMENTS` |
| 原始响应 | 94092 B，sha256 `04cdc282e2d8157de03eeebd2cdf26bfbc536ca6f42ac5596e35e3fc6d0a11de` |
| 装配记录 | AMD-01 REPLACE_SECTION target='### 1.1 全局约定（M-01，不可改）' ok=True；AMD-02 REPLACE_SECTION target='### 1.2 契约追溯（12 条）' ok=True；AMD-03 REPLACE_SECTION target='### 1.3 构图（M-02）' ok=True；AMD-04 REPLACE_SECTION target='### 1.5 比例（M-04，单位 m，车辆局部坐标，原点为后轮着地点的正上方路面）' ok=True；AMD-05 REPLACE_SECTION target='### 2.1 强制不变量（MUST）' ok=True；AMD-06 REPLACE_SECTION target='### 2.2 自由裁量（MAY）及约束' ok=True；AMD-07 REPLACE_SECTION target='### 3.1 文件清单（总共约 3800 行应用代码，均为预算上限）' ok=True；AMD-08 REPLACE_SECTION target='### 3.3 状态 schema（`G` 由 `PB.sim.createState(seed)` 创建，归 main 所有，softReset 时整体重建，持久化部分除外）' ok=True；AMD-09 REPLACE_SECTION target='### 3.4 每帧固定顺序（M-08，`main.frame(now)`）' ok=True；AMD-10 REPLACE_SECTION target='### 3.5 主要函数签名（"副作用"一列中，"写 X"指修改 X）' ok=True；AMD-11 NEW_SECTION after='### 3.5 主要函数签名（"副作用"一列中，"写 X"指修改 X）' ok=True；AMD-12 REPLACE_SECTION target='### 4.1 围巾' ok=True；AMD-13 REPLACE_SECTION target='#### 4.2.1 相位' ok=True；AMD-14 REPLACE_SECTION target='#### 4.2.2 关键帧（分段线性插值，颜色在线性空间做 lerp）' ok=True；AMD-15 REPLACE_SECTION target='#### 4.2.3 Env 结构' ok=True；AMD-16 REPLACE_SECTION target='#### 4.2.4 天空渲染' ok=True；AMD-17 REPLACE_SECTION target='### 4.3 海面与碎浪' ok=True；AMD-18 REPLACE_SECTION target='#### 4.4.1 生成' ok=True；AMD-19 REPLACE_SECTION target='#### 4.4.2 唯一的 pose 函数' ok=True；AMD-20 REPLACE_SECTION target='#### 4.4.3 捕获' ok=True；AMD-21 REPLACE_SECTION target='#### 4.5.1 键位' ok=True；AMD-22 REPLACE_SECTION target='#### 4.5.2 运动学（`sim.step`）' ok=True；AMD-23 REPLACE_SECTION target='#### 4.5.3 指针状态机（M-16，每个按钮带 `data-act`）' ok=True；AMD-24 REPLACE_SECTION target='#### 4.6.1 活跃判定（M-15）' ok=True；AMD-25 REPLACE_SECTION target='#### 4.6.2 仲裁（第 3 步，在物理之前执行）' ok=True；AMD-26 REPLACE_SECTION target='#### 4.6.3 决策（每 0.25 s 一次，`command(G)` 每步都会调用）' ok=True；AMD-27 REPLACE_SECTION target='### 4.7 五种镜头' ok=True；AMD-28 REPLACE_SECTION target='### 4.8 十四个成就（M-21）' ok=True；AMD-29 REPLACE_SECTION target='### 4.9 音频' ok=True；AMD-30 REPLACE_SECTION target='### 4.10 画质自适应' ok=True；AMD-31 REPLACE_SECTION target='### 4.11 应用状态与错误（M-13）' ok=True；AMD-32 REPLACE_SECTION target='### 4.12 数值健康检查（M-20）' ok=True；AMD-33 NEW_SECTION after='### 4.12 数值健康检查（M-20）' ok=True；AMD-34 REPLACE_SECTION target='### 5.1 实施包（按顺序执行，每个包只允许修改所列文件）' ok=True；AMD-35 REPLACE_SECTION target='### 5.2 边界情况清单（每条都要在 P16 勾选）' ok=True；AMD-36 REPLACE_SECTION target='### 5.3 视觉证据计划' ok=True；AMD-37 REPLACE_SECTION target='### 5.5 性能预算' ok=True；AMD-38 NEW_SECTION after='### 5.6 未知项升级协议' ok=True；AMD-39 REPLACE_SECTION target='### 6.1 ADR' ok=True；AMD-40 REPLACE_SECTION target='### 6.2 需求、设计、实施包与验收的映射' ok=True；AMD-41 REPLACE_SECTION target='### 6.3 风险与开放问题' ok=True；AMD-42 REPLACE_SECTION target='### 5.4 集成顺序' ok=True；AMD-43 REPLACE_SECTION target='### 2.3 替代方案与取舍' ok=True；标题行改为 v2（仅此一行由本地改写，正文未改） |


## 1. 逐条裁决矩阵（R-C01…R-H31）

| ID | 判定 | 依据（≤150字，含复算要点） | 落地（AMD-id / 章节 / 无） | 影响（§/M/AC/P） | 用户裁决 |
|---|---|---|---|---|---|
| R-C01 | ACCEPT | v1 只在 while 外取一次 snapshot，又在首步调用 consumeEdges，存在别名歧义。改为两条队列：held 快照不含 edges；sim edges 只在 n≥1 的帧取出，并只对首个固定步可见；零步帧不取出 | AMD-09、AMD-10、AMD-21 | §3.4、§3.5、M-26、AC-6e | 否 |
| R-C02 | ACCEPT | 复算 0.24×10000/18=133.33，相位跳 120°，评审正确。整除条件不充分。改由 JS 双精度算每波相位偏移 uPhase[i]=mod(k·dirZ·S+ωt,2π)；噪声改为 256 周期并用 uNoiseOff。取消 rebase | AMD-01、AMD-17 | §1.1、§4.3、M-27、AC-4d | 否 |
| R-C03 | ACCEPT | v1 把 errors 放在会被重建的 G 中，fatal 永远到不了。移到 PB.main.health（会话级），softReset 不碰，只在用户点"重试"时清空 | AMD-08、AMD-11、AMD-31 | §3.3、§3.6、§4.11、M-28 | 否 |
| R-C04 | ACCEPT | Cmd 里没有 UI 字段，属实。新增 UI 边沿队列：每帧 F3 调用 main.dispatchUi，与固定步数无关；payload 含 camSet 的 n；键位表补 Esc | AMD-09、AMD-21 | §3.4、§4.5.1、M-26 | 否 |
| R-C05 | ACCEPT | 复算喙尖：头前缘 z=-0.58，0.5·cos10°=0.492，得 (0,1.663,-1.072)，v1 的 (1.62,-0.70) 是错的。新增 rig：M=T(x,y,0)·Rz(lean)·Rx(wheelie)，判定、渲染、围巾共用 | AMD-04、AMD-20、AMD-33 | §1.5、§4.4.3、§4.13、M-25、AC-1d | 否 |
| R-C06 | ACCEPT | v1 中 caught 分支被 out.z 覆盖，属实。改为各状态独立分支并提前返回；迁移在当步重算；caught 在 0.12 s 内从 p0 插值到喙；missed 用确定的抛物线 | AMD-19、AMD-20 | §4.4.2、§4.4.3、AC-5a | 否 |
| R-C07 | ACCEPT | 相位 G.p 与 cycleWrap 改由 sim.step 在每个固定步内产生；createState 时初始化 G.p 和 G.env；NIGHT_RIDER 读 G.p | AMD-08、AMD-09、AMD-13、AMD-28 | §3.4、§4.2.1、§4.8 | 否 |
| R-C08 | ACCEPT | 每包文件集统一加入 index.html 和 main.js（只追加该包模块的接线），tests/* 也对所有包开放；只接线已存在的模块；AC-6d 的视觉部分移到 P5 | AMD-34、AMD-42 | §5.1、§5.4、ADR-17 | 否 |
| R-C09 | ACCEPT | v1 是 5 m 带宽配 3.5 m 周期，条数取决于相位。改为满强度带 4 m、周期 1.8 m，任意 4 m 窗口至少 floor(4/1.8)=2 个波峰；用 CPU 镜像抽样验证 | AMD-17、AMD-02 | §4.3、AC-4b | 否 |
| R-C10 | ACCEPT | 光晕 pow 的底数可能为负，属实。规定所有 pow 底数用 max(·,0) 或 clamp，并逐一列出 | AMD-16、AMD-17、AMD-05 | §4.2.4、§4.3、M-24 | 否 |
| R-C11 | ACCEPT | quality 收到的是截断后的 dt，>250 ms 判定不可达，属实。改为传 rawDt；升级以"距上次任意等级变化（含启动）≥10 s"为准 | AMD-09、AMD-30 | §3.4、§4.10、AC-11a/b | 否 |
| R-C12 | ACCEPT | 平路场景不存在被动离地，coyote 没有用。删除 coyoteT；起跳成功后清 jumpBufT；只能着地时起跳 | AMD-22、AMD-08 | §4.5.2、AC-6f | 否 |
| R-C13 | ACCEPT | 统一恢复入口 resumeRunning：重置 last/acc，清输入，lastActivity 设为 now，丢弃画质窗口，重算音频门控。visible、restored、重试三条路径都走它 | AMD-31 | §4.11、M-32 | 否 |
| R-C14 | ACCEPT | 车辆检查扩大到全部字段（含 laneFromX/laneToX/laneT/a/jumpBufT/rpm）；resetBike 对每个字段给出确定分支（非有限 v 设为 0）；新增 lastGood 存 t/S | AMD-32 | §4.12、M-20 | 否 |
| R-C15 | USER_DECISION | 支持范围属于用户职权。推荐 three r162（保留 WebGL1 回退），同时规定自定义 GLSL 用 ES1.00 兼容子集；在用户裁决前，兼容性视为未满足 | AMD-05、AMD-39、AMD-38 | ADR-01/02、M-24、UD-1 | 是 |
| R-C16 | ACCEPT | 锁定 three 与 esbuild@0.24.0 的确切版本，提交 lockfile，记录输入/输出 sha256 和体积，超限即停，并给出离线验证步骤 | AMD-38 | §5.7、M-30、P0 | 否 |
| R-C17 | USER_DECISION | v1 的 ADR-12 收窄了契约 #12 的字面含义。推荐默认：任何 isTrusted 输入（含无按键的 mousemove、HUD 操作）都算活跃 | AMD-24、AMD-39 | §4.6.1、ADR-12、UD-3 | 是 |
| R-C18 | ACCEPT | 补齐 lightTerm 唯一式、lightDir(p) 全相位、tArr 改按固定步跨阈值触发、orbit yaw 定义与范围、电影镜头方位参考轴（+Z 起向 +X） | AMD-14、AMD-17、AMD-26、AMD-27 | §4.2.2、§4.3、§4.6.3、§4.7 | 否 |
| R-H01 | ACCEPT | 复算：太阳 p=0.168 穿 −1°，月亮 p=0.22 穿 0°，空洞存在。改为分段 slerp（0.16–0.24、0.74–0.86），仰角下限 3°；最大角速度 16.5°/19.2 s 小于 1°/s | AMD-14 | §4.2.2、AC-3d | 否 |
| R-H02 | ACCEPT | 复算可见立体角占比 0.436/5.845=7.5%，评审正确。星数改为 3000，其中 55% 分布在 4°–24°；判据改为 stats().starsInView≥250（估算 337）；像素计数改为校准项 | AMD-16、AMD-02、AMD-30 | §4.2.4、AC-3b | 否 |
| R-H03 | ACCEPT | 复算 mode0 画面上沿仰角 21.5°，月亮 28° 出框。p=0.5 月亮仰角改为 14°，复算 ndc=(0.42,0.73)；S3 不再判月亮 | AMD-14、AMD-36 | §4.2.2、AC-3b、S2/S3 | 否 |
| R-H04 | PARTIAL | 评审取头盔顶 2.10 无出处；按 §1.5 头盔顶 1.94，算得 30.3%，在带内但余量小。接受改机位：z=6.5、头盔顶 1.98，算得 28.7%，地平线 39.9% | AMD-03、AMD-27、AMD-04 | §1.3、§4.7、AC-1a | 否 |
| R-H05 | PARTIAL | 冲突成立：v=0 时 atan(2.5·2.34/9.8)=30.8°。接受侧风按 s_w(v) 缩放；拒绝把闭式公式当验收：闭式只做 sanity（v=0 为 8.5°，v=8 为 63.9°–67.9°），验收靠 selfcheck 实际模拟 | AMD-12、AMD-02 | §4.1、AC-2a/2c | 否 |
| R-H06 | ACCEPT | 同 R-C05：判定点改为 rig.beakW；复算抬轮 18° 时喙尖为 (1.913,-0.506)；high 鱼悬停高度改为 2.65，使只抬轮不跳够不到（2.363<2.47） | AMD-33、AMD-19、AMD-20 | M-25、AC-1d、AC-5c | 否 |
| R-H07 | ACCEPT | 围巾状态移入 G.scarf；锚点由 rig.compute 在同一固定步、早于 scarf.step 写入；softReset 由 createState 一并重建 | AMD-08、AMD-09、AMD-11 | §3.3、§3.4、§3.6 | 否 |
| R-H08 | ACCEPT | 同 R-C04；另外规定成就面板打开时不吞动作键，只拦截 Esc 和 L | AMD-21、AMD-09 | §4.5.1、§3.4 | 否 |
| R-H09 | ACCEPT | ctxlost 超过 8 s 未收到 restored 时显示"重新加载"按钮；restored 后 3 帧内再抛异常直接进 fatal(runtime) | AMD-31、AMD-35 | §4.11、§5.2 | 否 |
| R-H10 | ACCEPT | 同 R-C03；nanResets 不直接计入阈值，但 10 s 内 ≥20 次记一次合成错误 nan-storm | AMD-31、AMD-32 | §4.11、§4.12 | 否 |
| R-H11 | ACCEPT | 复算属实：每步重发会把一次变道拖到 2.4 s。改为只在 laneT===1 且 lane≠laneGoal 时发 ±1；加 selfcheck 0.33–0.38 s | AMD-26、AMD-02 | §4.6.3、AC-12e | 否 |
| R-H12 | ACCEPT | 补齐自行车零件坐标、腿长和解析 IK（髋到最低踏板 0.893≤0.92 可达）、鱼的尺寸与色值；造型细节降为 MAY，配可判定判据 | AMD-04、AMD-06 | §1.5、§2.2 | 否 |
| R-H13 | ACCEPT | mix 因子值域确为 [0.25,1.25]。加 clamp；lightTerm=uAmbient+uLightColor·max(N·L,0) 只定义一处，泡沫复用 | AMD-17 | §4.3 | 否 |
| R-H14 | PARTIAL | 接受阈值与目标面积不匹配；评审的 4% 用的是高斯近似，不严格。不采纳评审给的数，改为 T_lo 初值 0.45、在 [0.35,0.60] 内用 CPU 镜像校准到 10–20% | AMD-17、AMD-02 | §4.3、AC-4c | 否 |
| R-H15 | ACCEPT | 9.0≠10.5，属实。取路面 9.0 m：边线 ±3.75，路肩到 ±4.5，沙滩从 4.5 起，SHORE_X=15.9286 | AMD-01 | §1.1 | 否 |
| R-H16 | PARTIAL | 接受不整除的问题；拒绝"波长整除 2700"方案：dirZ 投影仍导致非整数周期（同 R-C02）。采用 JS 相位偏移 | AMD-17、AMD-01 | §4.3、M-27 | 否 |
| R-H17 | ACCEPT | 新增 PB.store 作为唯一读写点，用 update(fn) 合并写；best 移出 G | AMD-11、AMD-28、AMD-07 | §3.6、M-29 | 否 |
| R-H18 | ACCEPT | audio 不再读 app.state；改为 main 计算 gate 后调用 audio.setGate(bool)；quality 由 main 调 discardWindow | AMD-10、AMD-29 | §3.5、§4.9 | 否 |
| R-H19 | ACCEPT | 补 boot/createState/softReset/teardown 签名，以及所有单例的 owner | AMD-10、AMD-11 | §3.5、§3.6 | 否 |
| R-H20 | ACCEPT | resumeRunning 中 lastActivity 设为 now；明确接受 <12 fps 时的时间膨胀（每帧最多推进 5/60 s） | AMD-24、AMD-31、AMD-09 | §4.6.1、M-09、AC-12d | 否 |
| R-H21 | ACCEPT | 关键帧表展开全部显式值；月亮改由天空 shader 绘制，角直径 2.4°，与太阳机制一致 | AMD-14、AMD-16 | §4.2.2、§4.2.4 | 否 |
| R-H22 | ACCEPT | 补齐虚线 3/12 m、棕榈 25 m、路灯 30 m、回收公式（取模天然无缝）、影斑尺寸、ground 与 camFloor 分段式（max 连续，无 0.22 m 跳变） | AMD-01、AMD-04 | §1.1、§1.5 | 否 |
| R-H23 | ACCEPT | HUD 写死 7 项；stats() 字段清单写死；所有 AC 读数都能找到同名字段 | AMD-04、AMD-36 | §1.5、§5.3 | 否 |
| R-H24 | ACCEPT | 每项检查标注类型；DOM 接线不得标 selfcheck；store 与输入逻辑可注入桩；是否用 Playwright 交用户裁决 | AMD-34、AMD-10 | §5.1、UD-4 | 部分（UD-4） |
| R-H25 | ACCEPT | 计数器移到会话级 main.health；补 PB.debug.unlockAch(id) | AMD-11、AMD-36 | AC-2d、AC-7 | 否 |
| R-H26 | ACCEPT | 定义 stats()，含 fps、tris、calls、starsInView 等；S6 写死 yaw=-90°、pitch=35°、dist=14（复算泡沫带在视轴上方 15.3°–17.6°，FOV 半角 25°，在画内） | AMD-36、AMD-02 | §5.3、AC-3c/4c | 否 |
| R-H27 | ACCEPT | 复算 BPM 72→140 最多 6 次小节边界 14.7 s，加初始等待 3.3 s 和加速 7.2 s，取 ≤26 s；降级最坏 4.5 s，AC-11a 改为 ≤4.5 s | AMD-02 | AC-9b、AC-11a | 否 |
| R-H28 | ACCEPT | 墨镜改用亮度判据加邻域对比；三个部件分别给最小像素数 | AMD-02 | AC-1b | 否 |
| R-H29 | ACCEPT | P0 加入 tools/three-smoke.html；grep 作用域写死为 js/ tests/ index.html | AMD-34 | P0、P8 | 否 |
| R-H30 | ACCEPT | 签名改为 out 参数；预算规则：稳态帧只允许事件对象分配，≤10 个/帧 | AMD-10、AMD-37 | §3.5、§5.5、M-31 | 否 |
| R-H31 | PARTIAL | 确认这是对"AC-5a 同义反复"的误编号引用。v1 的"f.pose 等于 f.pose"确实是同义反复；但检查网格 matrixWorld（含父级）不是。AC-5a 改为四项：网格世界坐标、捕获步连续性、喙标记、S11 | AMD-02 | AC-5a | 否 |

## 2. 定论式变更清单

| AMD-id | 变更点 | 类型 | 理由 | 是否触及原 12 契约 |
|---|---|---|---|---|
| AMD-01 | 路宽 9.0；SHORE_X=15.9286；ground/camFloor 分段式；山崖降为 12 m；取消 rebase；道具回收公式 | 数值 | R-H15、R-H22、R-C02 | 否 |
| AMD-02 | AC 全表加入类型、读数来源、失败处置；新增 AC-1d、3d、4d、5c、6e、6f、9d、12d、12e | AC | §D.12 | 否 |
| AMD-03 | 追尾机位 z 改为 6.5；新增投影公式；天体角直径改为 5.0% / 4.0% | 数值 | R-H04、R-H03 | 否 |
| AMD-04 | 自行车、腿 IK、鱼、道具、阴影、HUD 的数值规格 | 数值 | R-H12、R-H22、R-H23 | 否 |
| AMD-05 | 新增 M-23 至 M-32；修订 M-09、M-12 | 契约 | 多条 | 否 |
| AMD-06 | 每项 MAY 给出可判定判据 | 文档 | R-H12 | 否 |
| AMD-07 | 新增 rig、oceanmath、store、debug、tools 文件 | 所有权 | R-H17、R-H29 | 否 |
| AMD-08 | 补全 G schema；health 与 best 移出 G；删除 coyote | 所有权 | R-H07、R-C03 | 否 |
| AMD-09 | 帧序 F0–F14：UI 边沿、sim 边沿、rig、rawDt | 顺序 | R-C01、R-C04、R-C07、R-C11 | 否 |
| AMD-10 | 签名改为 out 参数；补全生命周期 API；音频门控 | 所有权 | R-H18、R-H19、R-H30 | 否 |
| AMD-11 | 新增 §3.6 所有权表 | 所有权 | §D.1 | 否 |
| AMD-12 | 风场按速度缩放；AC 改由实际模拟判定 | 数值 | R-H05 | 否 |
| AMD-13 | 相位与 cycleWrap 由 sim 产生 | 顺序 | R-C07 | 否 |
| AMD-14 | 关键帧显式化；月亮 0.50 改为 14°；lightDir 全相位 | 数值 | R-H01、R-H03、R-H21 | 否 |
| AMD-15 | Env 增加 ambient 与周期量字段 | 所有权 | R-H13 | 否 |
| AMD-16 | 月亮改由 shader 绘制；星星 3000 颗分层分布；pow 底数 clamp | 数值 | R-H02、R-H21、R-C10 | 否 |
| AMD-17 | 相位偏移；lightTerm；clamp；泡沫周期 1.8 m；crest 阈值校准 | 数值 | R-C02、R-C09、R-H13、R-H14 | 否 |
| AMD-18 | 生成改用 G.rng | 数值 | 确定性 | 否 |
| AMD-19 | pose 按状态分支；high 鱼悬停 2.65 | 契约 | R-C06、R-H06 | 否 |
| AMD-20 | 判定点改为 rig.beakW；当步重算；跨越判定 | 契约 | R-C05、R-C06 | 否 |
| AMD-21 | 键位加 Esc；UI 队列；edge 合并规则 | 顺序 | R-C04、R-H08 | 否 |
| AMD-22 | 删除 coyote；起跳清缓冲 | 数值 | R-C12 | 否 |
| AMD-23 | 指针自检与修复；clearAll 触发点 | 契约 | §6 缺陷类别 | 否 |
| AMD-24 | 活跃集合改为字面口径（UD-3） | 契约 | R-C17、R-H20 | 是，按 UD-3 |
| AMD-25 | 仲裁步骤显式化 | 顺序 | R-C18 | 否 |
| AMD-26 | 变道仅在 laneT===1 时发出；起跳按跨阈值触发 | 数值 | R-H11、R-C18 | 否 |
| AMD-27 | 机位数值；方位参考轴；POV 位置改为 (0,1.85,−0.47) | 数值 | R-H04、R-C18、B 评审 P10 行 | 否 |
| AMD-28 | 成就改用 G.p 与 store | 所有权 | R-C07、R-H17 | 否 |
| AMD-29 | 音频门控；BPM 时限 | 所有权 | R-H18、R-H27 | 否 |
| AMD-30 | 画质改用 rawDt；升级计时基准；星星数 | 数值 | R-C11 | 否 |
| AMD-31 | resumeRunning；ctxlost 8 s 出口；会话级错误计数 | 契约 | R-C13、R-H09、R-H10 | 否 |
| AMD-32 | NaN 检查扩到全部字段，回退确定 | 契约 | R-C14 | 否 |
| AMD-33 | 新增 §4.13 rig | 所有权 | R-C05、R-H06、R-H07 | 否 |
| AMD-34 | 实施包文件集、接线规则、检查类型 | 实施包 | R-C08、R-H24、R-H29 | 否 |
| AMD-35 | 边界清单扩到 25 条 | AC | 多条 | 否 |
| AMD-36 | debug 钩子、stats 字段、写死机位的截图 | AC | R-H23、R-H25、R-H26 | 否 |
| AMD-37 | 性能预算的测量方法；mesh 上限 40 | 数值 | R-H26、R-H30 | 否 |
| AMD-38 | 构建锁 | 实施包 | R-C16 | 否 |
| AMD-39 | ADR 更新，新增 ADR-14 至 ADR-18 | 文档 | — | 否 |
| AMD-40 | 映射矩阵 | 文档 | — | 否 |
| AMD-41 | 风险更新 | 文档 | — | 否 |
| AMD-42 | 集成顺序 | 实施包 | R-C08 | 否 |
| AMD-43 | 取舍表更新（版本、相位） | 文档 | R-C15 | 否 |

## 3. 未改动章节

- 第 0 步：细节层级判断（未改）
- §1.4 色值（未改；鱼的色值新增在 §1.5）
- §1.6 最低可接受视觉 vs 目标视觉（未改，T1–T8 保留）
- §3.2 加载与命名空间（未改）
- §4.4.4 计分（未改）
- §4.5.4 触屏布局（未改；面板 × 按钮的路由见 §4.5.1）
- §5.6 未知项升级协议（未改）

## 4. 需用户裁决项

| UD-n | 问题 | 推荐默认 | 备选 | 可测代价 | 不裁决时的临时默认 |
|---|---|---|---|---|---|
| UD-1 | 是否支持只有 WebGL1 的设备（R-C15、Q1） | three r162：WebGL2 优先，WebGL1 回退；自定义 GLSL 按 M-24 写 | r170，只支持 WebGL2，无 WebGL2 时显示提示 | 体积相近（PR-2 实测）；需按 GLSL1 子集写的 shader 有 3 个（sky、ocean、stars）；测试矩阵多一项 `--disable-es3-apis`；维护上不能用 r163 以后的新 API | 按 r162 实施；兼容性在裁决前视为未满足 |
| UD-2 | 昼夜循环经日出回到黄昏（Q2） | 经日出回到黄昏 | 夜结束后用 2 s 淡出硬切回黄昏 | 只改关键帧表 | 经日出回到黄昏 |
| UD-3 | "任意输入"的口径（R-C17、Q3） | 字面口径：任何 isTrusted 输入，含无按键的鼠标移动 | 排除无按键的鼠标移动 | 字面口径下，鼠标轻微晃动也会推迟 AUTO | 字面口径 |
| UD-4 | 是否允许在 Mac 上用 Playwright 自动化 [browser] 和 [screenshot]（R-H24、Q4） | 允许，只作为构建期开发依赖，不进入交付物 | 只做人工清单 | 多一个开发依赖；人工方式每轮复核约 40 项 | 人工清单加 impl-notes 记录 |
| UD-5 | 首次手势后音乐是否默认开启（Q5） | 开启 | 默认静音 | 无 | 开启 |

## 5. 证明义务（BUILD-PROOF / 实测）

| PR-n | 命题 | 方法（命令/断言/截图） | 判据 | 失败处置 |
|---|---|---|---|---|
| PR-1 | 构图预计值：AC-1a 28.7%、地平线 39.9%、太阳 ndc (0.83,0.49)、月亮 ndc (0.42,0.73)、starsInView 337、POV 喙尖 27.8% | [selfcheck] 用 config 常量和 §1.3 的公式计算 | 各值落在对应 AC 区间内 | 修改常量前先升级 |
| PR-2 | vendor 可以构建，且 ≤800 KB | BUILD-PROOF：§5.7 中的命令 | VERSION.txt 完整 | 按 §5.7 处理超限 |
| PR-3 | r162 在 WebGL1 上能回退 | BUILD-PROOF：Chrome `--disable-es3-apis` 启动后打开 index.html | 正常渲染，stats().appState 为 running | 升级给 UD-1 |
| PR-4 | contextrestored 后完全恢复 | [browser] loseContext/restoreContext 各 5 次 | 无 fatal，画面一致 | 改为恢复后重建材质 |
| PR-5 | 移动端 mediump 时走逐顶点路径 | 真机 | shader 编译通过，S10 可接受 | 升级 |
| PR-6 | 真机多点触控 | iOS 与 Android 各 1 台 | AC-10 | 修接线 |
| PR-7 | iOS file:// 下的存储与音频 | 真机 | 不报错，store 只在内存时可接受 | 记录为已知限制 |
| PR-8 | 围巾校准 | [selfcheck] 在 AC-2a/2b 的参数区间内扫描 | 有参数组合满足 | 升级 |
| PR-9 | 性能 | 待填表：设备、浏览器、等级、fpsWin、tris、calls | 满足 §5.5 | 降低默认等级，升级 |
| PR-10 | 运行时零网络请求 | [browser] Network 面板 | 为空 | 修 |
| PR-11 | 泡沫校准 | [selfcheck] AC-4b/4c 扫描 NA、T_lo | 落在区间内 | 升级 |
| PR-12 | POV 喙根不被近平面裁剪 | [screenshot] S5 | 喙根可见 | 把 near 调到 0.03 |

## 6. 细节层级（MUST / MAY / CALIBRATION）

**MUST（写死）**

| 维度 | 位置 | 消费者 |
|---|---|---|
| 坐标、单位、布局 | §1.1 | PR-1、AC-1a |
| 构图 | §1.3 | PR-1、S1 |
| 色值 | §1.4 | AC-1b |
| 比例与锚点 | §1.5 | AC-1d、footPedalErr |
| G schema | §3.3 | selfcheck |
| 帧序 | §3.4 | AC-6e、§5.2 第 21 条 |
| 签名 | §3.5 | P 包检查 |
| 所有权 | §3.6 | §5.2 第 22 条 |
| 围巾结构与风场 | §4.1 | AC-2 |
| 关键帧与 lightDir | §4.2 | AC-3d |
| 波参数、相位、光照、泡沫式 | §4.3 | AC-4 |
| 鱼的状态机 | §4.4 | AC-5 |
| 输入 | §4.5 | AC-6、AC-10 |
| 自动驾驶 | §4.6 | AC-12 |
| 机位 | §4.7 | AC-8 |
| 成就 | §4.8 | AC-7 |
| 音频门控与 BPM | §4.9 | AC-9 |
| 画质 | §4.10 | AC-11 |
| 状态与错误 | §4.11 | §5.2 第 5–7、15、20 条 |
| 健康检查 | §4.12 | §5.2 第 9 条 |
| rig | §4.13 | AC-1d |
| 构建锁 | §5.7 | P0 |

**MAY（自由裁量）**：见 §2.2。每项都附了可判定的替代判据，替换后必须满足判据。

**CALIBRATION（校准）**

| 量 | 初值 | 允许区间 | 校准流程 | 失败处置 |
|---|---|---|---|---|
| C_D | 2.5 | [1.8, 3.0] | selfcheck 扫描，满足 AC-2a/2c | 升级 |
| DAMP | 0.985 | [0.97, 0.995] | 满足 AC-2b | 升级 |
| NA（泡沫噪声幅度） | 1.2 | [0.8, 1.7] | 满足 AC-4b | 升级 |
| T_lo（波峰泡沫阈值） | 0.45 | [0.35, 0.60] | 满足 AC-4c | 升级 |
| 星星像素计数 | — | ≥150 | 在 S2 上做阈值化计数 | 人工复核，不改 N |
| AC-1b 取色 | — | 见 AC-1b | 人工复核 | 升级 |
| 帧率、三角面 | — | §5.5 | PR-9 | 降低默认等级 |

**保真度说明**：
- MUST 规定了"做成什么"，每一条都有一个断言或截图作为消费者；
- MAY 只放开"怎么造"，并用判据封住可替换的边界；
- CALIBRATION 中的量不能由闭式公式保证，只能在区间内用 selfcheck 或实测确定，超出区间就升级，不允许实施者自行改目标。

## 7. 完整性声明

MISSING: 无
（49 条裁决已全部给出；43 个 AMD 都是完整的整节正文。PR-1 至 PR-12 中的数值全部是纸面复算或待构建、待实测的结果，没有一项声称已经验证。）
