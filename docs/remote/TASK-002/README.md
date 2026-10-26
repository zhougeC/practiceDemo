# TASK-002 本地状态（`plan.md` **APPROVED** 2026-10-25；实施 P0 执行中）

> 更新时间：2026-10-25（本地时间）。本目录既保存 TASK-002 的协作材料，**也是唯一权威规范包所在目录**（`plan.md` / `adr.md` / `handoff.md` / `review-3.md`）。
> 不含原始证据日志（日志在私有目录）。本目录所在工作树是**唯一候选实施工作树**：`/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`，未提交、未推送）。

## 当前阶段

| 阶段 | 状态 |
|---|---|
| `DESIGN_V1`（远程 Opus 5.5 medium，单次只读） | **完成**，见 `design-v1.md` |
| `LOCAL_REVIEW`（两份独立静态评审） | **完成**，见 `review-1.md`（49 条：R-C01…R-C18、R-H01…R-H31） |
| `DESIGN_V2`（同一会话 `--resume` 逐条回应） | **完成**，见 `design-v2.md`（`MODE=AMENDMENTS`，43 个整节替换）+ `response-1.md` |
| `LOCAL_REVIEW_2`（第二轮，两份互不通气的静态评审） | **完成**，见 `review-2.md`（24 条：B1–B3、O-1–O-5、R-1–R-11、X-1–X-3、M-22/M-31） |
| 用户裁决 UD-1…UD-5 | **已裁决**（2026-10-25，用户 zhoucaiwu），记录在 `draftadr.md` §2 |
| `DESIGN_V3`（同一会话 `--resume`，最后一轮修订） | **完成**，见 `design-v3.md`（19 个整节替换 + 6 个单行 patch）+ `response-2.md` |
| `FINAL_STATIC_GATE`（对 v3 的最终审计） | **完成**，见 `review-3.md`（`READYFORUSERAPPROVAL`，无阻塞，置信度 0.87） |
| 规范包打包（`plan.md`/`adr.md`/`handoff.md`/`review-3.md`） | **完成**（见 §规范包）；全局计划 **APPROVED**（2026-10-25） |
| ADR | **当前口径 = `adr.md`**（ADR-01…19 + UD-1…UD-5，均 **APPROVED** 2026-10-25）；`draftadr.md` 降级为历史草案（非规范） |
| 用户批准（全局计划） | **APPROVED**（2026-10-25，用户原话：「批准计划，可以开始实施」） |
| 实施 P0–P16 | **P0 完成**（PR-2 PASS、PR-3 能力路径 PASS、设备支路 PENDING-USER-HARDWARE）；**P1–P4 完成**（selfcheck 99/99、应用门禁 8/8、离线 3/3、PR-1 PASS）。执行记录：`packages/P0-execution-result.md`、`packages/P1-P4-execution-result.md`；P5 起未开始 |
| 应用实现（`index.html` 等） | **P1–P4 已实现**：`index.html`、`css/style.css`、`js/core/{config,mathx,input,sim,rig}.js`、`js/{store,hud,debug,main}.js`、`js/render/{scene,world,camera}.js`、`tests/selfcheck.{html,js}`、`tools/e2e/{app,png}.mjs`；P5 起（角色/围巾/昼夜/海面/鱼/机位/成就/自动驾驶/音频/画质/触屏）未开始 |
| 提交 / 推送 | **未执行**（按指令） |

## 文件

| 文件 | 作用 | 字节 | sha256（前 8） |
|---|---|---|---|
| `plan.md` | **canonical master plan**（唯一权威；正文 = `design-v3.md` 逐字副本，仅 §6.2 两处索引补全；**APPROVED 2026-10-25**） | 97,547 | `4c272bda` |
| `adr.md` | **ADR-01…19 + UD-1…UD-5**（当前口径；不含 v2 草案表；**APPROVED 2026-10-25**） | 6,688 | `5d6ddec3` |
| `handoff.md` | 移交入口（非规范）：MUST/MAY、P0–P16、PR 门禁、停止条件 | 10,648 | `81a92175` |
| `review-3.md` | 最终静态门禁评审逐字原文 + provenance（`READYFORUSERAPPROVAL`） | 6,095 | `af1128f7` |
| `task.md` | 任务契约 + 隔离清单 + 远程设计提示词（v1 调用的 stdin 原文） | 17,013 | `d83b5f44` |
| `design-v1.md` | v1 调用元信息 + 远程设计正文（未改写） | 62,939 | `31603542` |
| `review-1.md` | 第一轮两份评审**逐字**合集 + 效力声明 + 本地编号索引 | 57,555 | `9a4b07e1` |
| `design-v2.md` | v2：v1 正文 + 43 个整节替换（模型原文，本地仅机械装配） | 77,957 | `11b11c51` |
| `response-1.md` | v2 的分节摘录：49 条裁决矩阵、变更清单、UD、证明义务 | 24,841 | `0849a217` |
| `review-2.md` | 第二轮两份评审**逐字**合集（B1–B3、O-1–O-5、R-1–R-11、X-1–X-3、M-22/M-31）+ 本地编号索引 | 38,152 | `85731228` |
| `design-v3.md` | **v3：v2 正文 + 19 个整节替换 + 6 个单行 patch**（模型原文，本地仅机械装配；= `plan.md` 的正文来源快照） | 96,702 | `452ba330` |
| `response-2.md` | v3 的分节摘录：24 条逐条裁决、变更清单、完整性声明 | 7,391 | `b2169a7b` |
| `draftadr.md` | **历史** ADR 草案（`DRAFT`，非规范；含 v2 阶段 ADR 表与"临时默认"措辞，不得作为实施依据） | 14,359 | `ec535fcc` |
| `telemetry-correction-1.md` | v1 遥测更正：CPU 列标错/方向反转的根因、重算结果、装置 v2 修复 | 8,011 | — |

> **原始 JSON 不入库**：v1 的 `remote.result` 私有保存为 `~/.evidence/task-002/raw/remote.result.v1.json`（sha256 `fc85ffa7…`）；
> v2 为 `~/.evidence/task-002/v2b/out.json`（sha256 `7f702dcf…`，97,355 B）；
> **v3 为 `~/.evidence/task-002/v3/out.json`（sha256 `4a693795…`，70,211 B）**。

## 隔离记录

| 项 | 值 |
|---|---|
| BASE_SHA | `2263425df8bd074f3c5e0d8f15e695e4f6c709e0` |
| **唯一候选实施工作树** | `/Applications/WorkStudio/GitHub/claude-test-opus55`（分支 `feature/TASK-002-opus55`，基于 BASE 新建，未提交、未推送） |
| 规范包位置 | `docs/remote/TASK-002/`（`plan.md` / `adr.md` / `handoff.md` / `review-3.md`；历史快照同目录，无嵌套副本） |
| 临时工作树（已删除） | `/Applications/WorkStudio/GitHub/claude-test-final` + 分支 `feature/TASK-002-final`：打包过程中误建的第三个工作树，规范包已并入本工作树后**整体删除**（见 §规范包 打包记录） |
| TASK-001 工作树（对照，未改动） | `/Applications/WorkStudio/GitHub/claude-test`（`feature/TASK-001` @ `c78ba01…`，含未跟踪文件 `1{u+=$4}` 与 baseline 文档，均未触碰） |
| 远程设计工作树 | `/home/devagent/worktrees/design-TASK-002-opus55-2263425`（detached @ BASE；三次调用前后 `git status --porcelain` 均为 0 行） |
| 旧实现是否暴露给远程 | **否**（只给 SHA 与缺陷类别，避免锚定） |
| 应用代码改动 | **P0 仅构建链**：`tools/vendor-three.sh`、`tools/vendor/*`、`tools/three-smoke.html`、`tools/e2e/*`、`vendor/three.min.js` + `three.LICENSE` + `VERSION.txt`；**无** `index.html`/`js/`/`css/`（P1 起） |
| 新增文档 | `packages/P0.md`（任务书）、`packages/P0-execution-result.md`（执行记录）、`impl-notes.md`（决策/未知项/读数） |
| 模型调用次数 | v1：1 次；v2：**2 次**（第 1 次被本地 wall-clock 上限杀死、零输出；第 2 次成功）；v3：**1 次**（成功，未重试） |

## 调用记录（v3 设计对话）

| 项 | 值 |
|---|---|
| 目的 | 同一会话、同一任务：对 `review-2.md` 做最后一轮修订，产出可机械装配的增量块 |
| 参数 | `-p --resume 17c5e5a3-2d23-4637-b36d-9af9a7ecbac4 --safe-mode --permission-mode plan --output-format json --max-turns 24 --model claude-opus-5-5 --effort medium --no-chrome --tools Read,Glob,Grep` |
| 提示词 | 78,249 B，sha256 `12250219…`（§A 事实 / §B UD 裁决 / §C 24 条修复判据 / §D 硬约束 / §E 机器装配格式 / §F 预算 / §G 附录 A 逐字 v2 正文 30 节 / §H 附录 B 60 个标题锚点） |
| 远程退出码 | CLI `0`；`timeout -k 20 1500` 未触发；`DONE` 哨兵独立确认 `rc=0` |
| 结果 | `type=result`、`subtype=success`、`is_error=false`、`stop_reason=end_turn`、`terminal_reason=completed`、`num_turns=1`、`permission_denials=[]`、`safety_stops=0` |
| 模型 / effort | `modelUsage.canonicalModel=claude-opus-5-5`、`provider=firstParty`；`--effort medium` 显式传参 |
| 会话 | `session_id=17c5e5a3-2d23-4637-b36d-9af9a7ecbac4`（未 fork）；会话 JSONL 711,561 B（调用前）→ 1,018,113 B（结束后） |
| 耗时 | wall 518 s（`duration_ms=515,530`）；`ttft_ms=250,092`；`duration_api_ms=1,940,125`（大于 wall，按观测原样记录，不解释） |
| 用量 | `usage`：input 2 / cache_creation 234,516 / cache_read 3,223 / output 59,969；`modelUsage`：outputTokens 206,223、cacheRead 123,529、cacheCreation 269,074 |
| 成本估计 | `total_cost_usd=6.3017898`（CLI 客户端估算，**不是**账单） |
| 响应规模 | `.result` 67,468 B（46,454 字符），sha256 `33909c3f…`；装配后 `design-v3.md` 96,702 B |
| 结构完整性 | 5 个 `@@SECTION` 各出现 1 次；19 个 `@@AMD` + 6 个 `@@PATCH`；`COMPLETENESS=COMPLETE`；`RESPONSE` 24/24 行无缺无重 |
| 采样 | 495 样本 / 518 s（1 Hz）；CPU 忙均值 4.47%、中位 4.30%、p95 6.20%、峰值 71.8%；CLI 树 RSS 峰值 343,176 kB；最低 MemAvailable 461,728 kB；SwapFree 恒定 2,095,596 kB；`oom_kill=0`；`pswpout` 无增长；load1 峰值 0.23；trojan-go PID 469341 前后存活（RSS 49,372 kB）；**fail-stop 看门狗未触发**（`health_abort=none`） |
| 与指令的偏差 | 本地轮询上限 1,700 s（指令给"最多 1800 s"），实际 518 s 结束；其余参数与指令一致 |

## 装配（v3，本地，机械）

- `design-v3.md` = `design-v2.md` 的**模型正文**（H1 之后全部；v2 的本地元信息头不继承，改为 v3 的新头）+ 19 个 `REPLACE_SECTION` + 6 个单行 `PATCH`；
- 装配器（`~/.evidence/task-002/assemble_v3.py`，本地工具，不入库）**只做**：按标题定位整节替换（保留标题行）、单行精确替换、校验"每个锚点/每行各命中且仅命中 1 次"；
- 本地改写**仅两行**：文档 H1（v2→v3）与新增的本地元信息头；正文内容零改写；
- 修复了装配器自身的一个缺陷：模型有两节（§4.4.2、§4.11）的正文**以代码围栏开头**，初版 `strip_fences` 误删了开栏符 → 改为"仅当首尾都是围栏且全文只有这两个围栏行时才剥离外层围栏"，并增加"每节围栏数必须为偶数"的断言后重新装配；
- `diffstat`：**+398 / −209，97 个 hunk**（`git diff --no-index --stat design-v2.md design-v3.md`）；
- 标题集合不变（62 个标题，仅 H1 换成 v3 的两行）；AC 行 41 → 42（新增 `AC-5d`），无删除。

## 已执行的验证

1. **装配前**：远程 preflight（cwd/HEAD/dirty=0/session 文件存在/单进程/prompt sha256）、提示词本地与远端字节一致。
2. **装配**：19/19 个 `target` 各命中 1 次（`ok`），6/6 个 `PATCH` 各命中 1 行，无重复锚点、无未终止块、无残留 `@@` 行、文档与逐节围栏均平衡。
   - **可重复性**：用同一份 `out.json` 重新装配到临时目录，与 `design-v3.md` 逐行比对，**唯一差异是本地元信息头的 1 行**（"装配记录"指向），正文完全字节一致。
3. **机械闭环检查**（`~/.evidence/task-002/verify_v3.py`，25 条断言全部 PASS）：
   - UD 落点：无 `<UD-1` 占位符、`"three": "0.162.0"` 恰好 1 次、无"临时默认"、无"待 UD-"、`muted:false` 已写、§5.3 含 Playwright；
   - B1：§4.4.2 含 `SHORE_X`/`SEA_Y`、旧 `+7.5a` 公式已消失、新增 AC-5d；
   - B2：`initState`/`initSession` 存在且 `initSession` ≥3 处（boot/softReset/签名）；
   - B3：§4.6.3 含"保留"与 `prevTArr` 重置；
   - O-2：§5.1 含 `js/core/config.js`、`js/debug.js`、P2 创建 selfcheck；
   - 结构：M-01…M-32 全在、P0…P16 行全在、无 AC 被删、12 条契约行齐、14 成就未动。
4. **数值复核（本地手算，抽查）**：B1 的 `a_cross=0.574`、`x(0.8)=17.429`、`y(0.8)=−3.19/−1.73`、步长 ≤0.564 m 全部与公式一致；R-9 的 `atan(2.5·0.586/9.8)=8.50°`、`63.9/64.4/67.9°` 三档一致；R-7 的 `tan18°/tan25°=0.697 → 地平线距顶 15.2%` 一致。
5. **规范包落位核对**（本地）：`plan.md`/`adr.md`/`handoff.md`/`review-3.md` 已并入本目录；`review-3.md` 与评审原文逐字一致，其余三份与打包副本的差异**只有路径/分支/H-7 元信息行**（plan 2 行、adr 3 行、handoff 6 行），规范性正文零改动；`design-v1/v2/v3` 哈希未变。
6. **未做（设计阶段）**：任何构建、渲染、浏览器、真机验证；PR-1…PR-12 当时**全部未执行**（诚实状态，未虚报）。

### P0 实施阶段（2026-10-25，追加）

7. **构建（PR-2）**：`tools/vendor-three.sh` 真实执行，`npm ci` + esbuild 0.24.0 产出 `vendor/three.min.js` 671,847 B（≤ 819,200 B），sha256 `bd869f42b68296319769db683efd6c7a6f6249f35f3d39cd3bd09e9cdc7c20e7`；`VERSION.txt` 完整；IIFE 三项校验通过。
8. **浏览器（PR-2/PR-3）**：Playwright 1.48.2 + 自带 Chromium 130.0.6723.31，`file://` 直开 `tools/three-smoke.html`：默认 WebGL2 渲染 12 三角面、85,547 个非背景像素、非 file 请求 0、Console 0 错误；`--disable-webgl2` 下真实 WebGL1 渲染成功（`ANGLE_instanced_arrays=true`）；`--disable-es3-apis` **未生效**（`Q-01`）；"无 `ANGLE_instanced_arrays`"真实设备支路 **NOTVERIFIED**。
9. **离线**：`tools/vendor/node_modules` 移出 + Playwright `context.setOffline(true)` 下，冒烟页仍渲染、`THREE.REVISION='162'`、非 file 请求 0。
10. 读数与截图：`~/.evidence/task-002/implementation/P0/`（`p0-browser-gates.json`、`screens/*.png`、`logs/*.log`）；详细结论见 `packages/P0-execution-result.md` 与 `impl-notes.md`。

## 规范包（canonical package，`docs/remote/TASK-002/`）

| 文件 | 角色 | 规范效力 | 字节 | sha256（前 12） |
|---|---|---|---|---|
| `plan.md` | **canonical master plan**（唯一权威；已含 AMD-P0-001 修订） | 规范 | 100,881 | `eec120a1f84e` |
| `adr.md` | ADR-01…20 + UD-1…UD-5（均 APPROVED；ADR-20 为 AMD-P0-001 新增） | 规范（决策记录） | 7,985 | `ede29985ab2b` |
| `handoff.md` | 移交入口：MUST/MAY、P0–P16、PR 门禁、停止条件（已含 AMD-P0-001） | 非规范（导航） | 11,157 | `4db5d828297a` |
| `review-3.md` | 最终静态门禁评审逐字原文 + provenance | 评审记录，非规范 | 6,095 | `af1128f714dc` |
| `AMD-P0-001.md` | `Q-01`/`Q-02` 的版本化裁决与逐项 old→new（含哈希链、重跑清单） | 规范（修订记录） | 25,594 | `1534e474bc95` |

**打包记录（本地机械操作，逐条可核对）**

1. `plan.md` 的规范性正文（模型 H1 之后）与 `design-v3.md` **逐字一致**，实测差异**仅 2 行**：§6.2 索引单元格 `AC-5a–5c`→`AC-5a–5d`、`S3–S5`→`S3–S5、S14`（review-3 指出的非规范索引遗漏）。顶部元信息块为本地重写：打包时为 `AWAITING_USER_APPROVAL`，2026-10-25 批准后改为 `APPROVED` 并补记批准元数据；**规范性正文 sha256 保持 `4771b9b4d8715a21c8e9beb68df9457b0314914a506b992c43f0708c90352aa2`（95,198 B）不变**，不属于正文。
2. `adr.md` 只取 `plan.md` §6.1 的 ADR 表（逐字）+ 已批准 UD 表；**未**收录 v2 草案 ADR 表与 v1→v2 差异摘要（避免把历史草案误标为规范）。历史见 `draftadr.md`（非规范）。
3. `review-3.md` = 评审 agent 最终消息逐字（3,937 B，`84ee58bb…`）+ 本地 provenance 头。
4. 历史快照（`design-v1/v2/v3`、`review-1/2`、`response-1/2`、`draftadr`、`task.md`）**就是本目录原有文件**，未复制副本、未嵌套目录。
5. **原设计哈希保持**：`design-v1.md` `31603542…`、`design-v2.md` `11b11c51…`、`design-v3.md` `452ba330…`（与 v3 装配时一致，未被本次打包改动）。
6. 误建的第三个工作树 `/Applications/WorkStudio/GitHub/claude-test-final`（分支 `feature/TASK-002-final`）在规范包**逐字核验并落位后**删除；未删除任何原始文件或未知文件。当前仓库只有 2 个工作树：本工作树 + TASK-001 对照工作树。
7. 应用代码、`index.html`、`js/`、`css/`：**仍不存在**（P1 起）。P0 已产出构建链与 vendor：`tools/vendor-three.sh`、`tools/vendor/package.json`、`tools/vendor/package-lock.json`、`tools/three-smoke.html`、`tools/e2e/package.json`、`tools/e2e/package-lock.json`、`tools/e2e/run.mjs`、`vendor/three.min.js`（671,847 B，sha256 `bd869f42…`）、`vendor/three.LICENSE`、`vendor/VERSION.txt`。**无 git 提交、无推送**；`tools/*/node_modules` 为构建期依赖，不入交付、不提交。

**校验命令（可复现）**

```bash
cd /Applications/WorkStudio/GitHub/claude-test-opus55/docs/remote/TASK-002
sha256sum plan.md adr.md handoff.md review-3.md design-v1.md design-v2.md design-v3.md
diff <(sed -n '/^# TASK-002 设计 v3：/,$p' design-v3.md) <(sed -n '/^# TASK-002 设计 v3：/,$p' plan.md)   # 应只有 2 行差异
```

## 待处理（不自行裁决）

### `review-3` 结论（已完成，2026-10-24T19:31:57Z）

`review-3.md` 判 **`READYFORUSERAPPROVAL`（无阻塞，置信度 0.87）**，并逐项复核了 B1/B2/B3/O-1/O-2/O-3/UD-1…UD-5。其提出的两处非阻塞项已处置：

| review-3 提出 | 本地处置 |
|---|---|
| §6.2 汇总表漏列新增 `AC-5d`、`S14` | **已在 `plan.md` §6.2 补全**（仅 2 个索引单元格；权威 AC 表/截图表/P9/P10 本来就有） |
| B1 的"≤0.5 m/步"归因不准确 | 已核实：该措辞源自本地 review-2 汇总，**不是**原评审主张；模型的反驳（互斥性证明）成立，AC-5d 采用 **0.6 m** |

### 批准时一并确认的残留（已随 2026-10-25 批准确认；非阻塞，详见 `handoff.md` §6 H-1…H-7）

1. §3.1 **标题**仍写"约 3800 行"（紧邻正文已作废，唯一口径 = 5600 行）；
2. PR-3 必须覆盖"有/无 `ANGLE_instanced_arrays`"两种 WebGL1 设备；
3. PR-8 必须覆盖 v3 上移后的围巾锚点/颈碰撞球几何；
4. `playwright` 锁 `1.48.2`（UD-4 未指定版本）；
5. **H-7 路径**：正文 §5.6 写 `docs/remote/TASK-002/impl-notes.md`，规范包就在该目录 → **路径一致，无需映射**，impl-notes 建在 `docs/remote/TASK-002/impl-notes.md`。

### 用户签核与执行边界（2026-10-25 更新）

- 用户已签核（2026-10-25，「批准计划，可以开始实施」）：P0 已按 `packages/P0.md` 执行，记录见 `packages/P0-execution-result.md`。
- **仍未执行**：`git commit` / `git push`；P1–P16；PR-1、PR-4…PR-12；任何远程模型/订阅调用。
- **已裁决（2026-10-25，`AMD-P0-001.md`，用户授权单次裁决）**：
  - `Q-01`：方法改为 `--disable-webgl2` + **能力断言**（不看 flag 名）；`--disable-es3-apis` 在锁定工具链下不再关闭 WebGL2，已停用（历史读数保留）。
  - `Q-02`：应用与冒烟页改为**预创建上下文**再传 `WebGLRenderer({context})`，从源头消除 three 的两条回退 error；Console 判据 = error/pageerror 均为 0、不设白名单，warning 允许但须逐条记录。
  - **PR-3 能力路径已按新构造重跑并 PASS（2026-10-25）**：`tools/three-smoke.html` 改为预创建上下文、`tools/e2e/run.mjs` 收敛为「默认 + `--disable-webgl2`」两条场景；实测 2/2 PASS、退出码 0，两场景 console error = 0、pageerror = 0、非 file 请求 = 0，WebGL1 场景 1 条预期弃用 warning 已逐条记录 → **P1 放行**。
  - 设备支路（无 `ANGLE_instanced_arrays` 的真实 WebGL1、移动端 WebGL1）仍 **PENDING-USER-HARDWARE**，P16 出口（用户真机）。

## 遥测更正（2026-10-24，v1；v2/v3 沿用修正后的采样器）

- `design-v1.md` 资源表中的 **CPU 忙占比 95.8%/98.5% 无效**：采样器 v1 该列实际是 **idle%**。
  同一份原始样本重算：忙占比均值 **4.23%**、中位 3.80%、p95 6.70%；其中约 2 个百分点为采样器自身开销，CLI 约 **1.26%**。
  **CPU 未饱和**，瓶颈是推理/网络等待。
- v2 两次与 v3 一次都用修正后的采样器（原始计数器可复算）：忙均值 3.35% / 3.39% / **4.47%**，`oom_kill=0`，Swap 无增长。
- SSH 客户端挂住的原因**未证实**；三次调用统一改为"远端 `setsid` 脱离 + `DONE` 哨兵 + 调用方轮询"，均能从文件独立确认远程结束与退出码。
- v3 新增 **1 Hz fail-stop 看门狗**（`oom_kill` 增长或 `MemAvailable` 连续 3 次 <150 MB 即终止 CLI 并写 `HEALTH_ABORT`），本次未触发。
- 详见 `telemetry-correction-1.md`。
