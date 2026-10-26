# TASK-002 响应 2（response-2）：远程 Opus 对 review-2 的逐条回应与 v3 修订清单

> 状态：**DRAFT — 未批准**。本文件是 `design-v3.md` 的配套裁决记录：逐条回应 `review-2.md` 的 24 个编号、
> 列出全部修订块、声明完整性。模型原文，本地未改写（仅机械装配与格式归并）。
> 原始 JSON 不入库（私有证据目录）。

## 元信息

| 项 | 值 |
|---|---|
| 任务 / 阶段 | TASK-002 / `DESIGN_V3` |
| 会话 | `--resume 17c5e5a3-2d23-4637-b36d-9af9a7ecbac4`（未 fork） |
| 模型 / effort | `claude-opus-5-5` / `medium` |
| 提示词 sha256 | `12250219eec8aa3dd8d7ca85c41dd31f94bc094be41dad2e0a6adb2b21398f4e` |
| 响应 sha256 | `33909c3fd5c564ebfd9348aa01292966e71fe4ef4f511ae1ea0ed94ab43f6ac9`（67468 B） |
| 装配 | `design-v2.md` + 19 个 REPLACE_SECTION + 6 个单行 PATCH → `design-v3.md` |

## 1. 逐条裁决（RESPONSE）

B1 | ACCEPT | 原 missed 轨迹在 0.8 s 内最远到 x=8.65，到不了海岸线，属实。改为闭式轨迹（x 线性推进 0.62 s 后停住，y 用 1.5a−9a²），最坏起点 0.574 s 越过海岸线，a=0.8 时 x≥17.43、y≤−1.66。评审给的"相邻步位移 ≤0.5 m"与"0.6 s 内越过"不能同时成立：lane0 要在 0.6 s 内走 18.58 m，平均 30.97 m/s，即每步至少 0.516 m。因此步长上限定为道路相对 0.6 m，实际最坏 0.564 m。新增 AC-5d
B2 | ACCEPT | createState 只建纯数据；rig、scarf、daynight 各提供 initState；boot 与 softReset 都走同一个 newSession→initSession；P4 的 createState 不引用 scarf 和 daynight；P6、P7 各自往 initSession 追加调用
B3 | ACCEPT | 区分"新目标筛选"和"已锁定目标保留"：已锁定目标保留到捕获、越过或消失为止；换目标时 prevTArr 重置为 +∞。tArr 逐步单调下降并穿过 0.357，加上 jumpedFor 门闩，保证每条鱼恰好起跳一次。初选时 tArr 最小为 (6−1.072)/16=0.308，大于 0.15
O-1 | ACCEPT | three 写死为 0.162.0；检测改为三段（WebGL2 成功 / 只有 WebGL1 / 都没有）；ADR-01/02、M-06、§2.3、§6.3 全部改为已定事实，正文不再有版本占位符
O-2 | ACCEPT | config.js 和 debug.js 加入每包允许集，只能追加；config.js 改由 P1 创建；tests/* 由 P2 创建；tools/e2e/* 由 P0 创建
O-3 | NO-CHANGE | 正文中 PR-1 只出现在 P2 行，PR-2 只出现在 P0 行，没有矛盾的句子；本轮按 O-1 把 PR-3 也明确放进 P0 行，与本地处置一致
O-4 | ACCEPT | §3.6 的 store schema 和 §4.9 都写死 settings.muted 初值为 false；用户手动切换后经 store 持久化
O-5 | ACCEPT | §5.3 写明 [browser] 和 [screenshot] 由 Playwright 执行，Playwright 只是开发依赖，不进交付物；人工只做复核；页面运行时零网络请求由 Playwright 统计请求数断言
R-1 | ACCEPT | 沙滩上界改为 SHORE_X，并注明以 ground(x) 为准
R-2 | ACCEPT | §1.4 的湿沙带改写为 [SHORE_X−1.5, SHORE_X]
R-3 | ACCEPT | 以逐文件上限之和 5600 行为唯一口径；标题中的"约 3800 行"不能改标题，在正文中声明作废
R-4 | ACCEPT | 移动帧率一行展开为具体读数 stats().fpsWin
R-5 | ACCEPT | AC-6d 的模拟断言归 P4 的 selfcheck；S13 截图归 P10（P4 还没有角色模型），在 §5.1 和 §5.3 写死
R-6 | ACCEPT | 模式之间切换用 0.6 s，电影镜头内部机位之间用 1.2 s
R-7 | ACCEPT | mode 4 新增构图判据：车包围盒中心 abs(ndc)≤0.2，地平线距顶 10%–20%（复算 15.2%），对应 S14
R-8 | NO-CHANGE | §4.2.4 本轮冻结，且此项可选。明确接受 24° 处的密度接缝：主判据 S2（mode 0）中看不到；mode 4 的 pitch≥5° 且注视车，相机向下看，接缝只在画面上沿；记为已知外观项
R-9 | ACCEPT | ① 腿：最低踏板 0.888、最高 0.560，全圆最大 0.893、最小 0.553，已改正；② 围巾 v=0 时 8.5° 保留，s_w=0.25 下侧风 0.45 与阵风 0.375 合成 0.586，atan(2.5·0.586/9.8)=8.50°，评审的 6.6° 漏了 z 向阵风；③ 改为三档：无阵风无侧风 63.9°、无阵风有侧风 64.4°、最大 67.9°
R-10 | ACCEPT | 判定位置写死为 tip–anchorMid 连线。复算发现原锚点 (1.42,−0.49) 下垂时会穿过躯干碰撞球，所以锚点上移到 (±0.06,1.55,−0.54)，颈碰撞球移到 (0,1.68,−0.58) r=0.07；几何静息角 5.2°；AC-2c 的 20° 不放宽
R-11 | ACCEPT | §3.5 补 mathx.rng(G)、各 initState、newSession/initSession、hud 4 个函数、world.setLamps、pelican.setNight；Env 由 daynight.initState 分配；曲柄参数化写入 §1.5
X-1 | ACCEPT | §3.2 给出最终的 25 个 script 的唯一加载序，并写明各包按该序插入
X-2 | ACCEPT | noWebGL 文案直接写进 §4.11
X-3 | ACCEPT | §5.2 第 19 条改为：连续推进越过 1e4 和 1e7 附近时无跳变，指向 AC-4d；setS 瞬移不作为判据
M-22 | ACCEPT | P16 加两条 grep：`shadowMap.enabled *= *true` 和 `castShadow` 在 js/ 下都为 0
M-31 | NO-CHANGE | 页面内没有可靠的逐帧分配计数 API；保留 Performance 录制中 GC 停顿 <5 ms 作为读数，由 Playwright 通过 CDP 录制

## 2. 变更清单（CHANGE_LIST）

AMD-01 | AC-2a,AC-2c,AC-5d,AC-8a,AC-12c,B1,R-7,R-10,O-5 | 重写 §1.2：新增 AC-5d（NEW_AC）；AC-2a/2c 写死测量位置与 sanity 值；AC-8a 增加 S14；AC-12c 改用可信事件集合；去掉表格内竖线
AMD-02 | R-9,R-10,R-11,M-04 | 重写 §1.5：腿可达距离改正；曲柄参数化；颈环与围巾锚点上移；颈碰撞球移位
AMD-03 | O-1,UD-1..5,M-06,M-22,B2,UD-3 | 重写 §2.1：M-06 写死 r162；M-22 增加 grep 消费者；新增 M-33（唯一初始化路径）、M-34（可信事件集合）；用户裁决约束表
AMD-04 | X-1 | 重写 §3.2：给出唯一 script 加载序
AMD-05 | B2 | 重写 §3.3：createState 只建纯数据；rig/scarf/env 由 initState 填充
AMD-06 | B2,R-11 | 重写 §3.5：补 initState、newSession、initSession、rng、hud、setLamps、setNight
AMD-07 | B2,O-4 | 重写 §3.6：初始化顺序、写者与时机；muted:false
AMD-08 | R-9,R-10 | 重写 §4.1：锚点引用、sanity 三档、静息角估算、AC 测量位置
AMD-09 | B1 | 重写 §4.4.2：missed 闭式轨迹、证明与数值表
AMD-10 | UD-3 | 重写 §4.6.1：可信事件全枚举，同帧断开
AMD-11 | B3 | 重写 §4.6.3：目标保留、prevTArr 重置、恰好一次的论证
AMD-12 | R-6,R-7 | 重写 §4.7：过渡时长消歧；mode 4 构图判据
AMD-13 | O-1,X-2 | 重写 §4.11：三段检测与内联文案
AMD-14 | O-2,B2,R-5,M-22,UD-4 | 重写 §5.1：通用允许集；分期 initState 接线；PR-3 并入 P0；P16 grep
AMD-15 | B1,X-3,UD-3 | 重写 §5.2：第 19、23、24 条可判定化
AMD-16 | O-5,R-5,R-7 | 重写 §5.3：Playwright、S14、S13 归属、glVersion
AMD-17 | O-1,UD-4 | 重写 §5.7：three 0.162.0 与 playwright 版本锁；WebGL1 冒烟
AMD-18 | O-1,UD-2,UD-3 | 重写 §6.1：ADR 改为已定事实
AMD-19 | O-1 | 重写 §6.3：R6 改为必须完成；删去待裁决措辞
P-01 | R-1 | §1.1 沙滩上界改为 SHORE_X
P-02 | R-2 | §1.4 湿沙带区间统一
P-03 | O-1 | §2.3 渲染库行写死 r162
P-04 | R-3 | §3.1 行数口径
P-05 | O-4,UD-5 | §4.9 写入 muted 初值与持久化
P-06 | R-4 | §5.5 去掉"同上"

## 3. 完整性声明（COMPLETENESS）

COMPLETE
