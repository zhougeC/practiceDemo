# TASK-001 独立审计报告（R3 + R4 汇总）

> **状态：PASS-with-caveat（有条件通过，非完整独立 PASS）**
>
> - R3（提交 `90c75ce4`）：切片 A（玩法/状态）与切片 C（运行时/交付）产出可复核结论；切片 B 因执行装置 cwd 缺陷无效。
> - R4（最终提交 `3eb78f9`）：在全新会话、全新工作树上补齐 **切片 B（渲染/物理）**；契约 **2/3/4/8/11 全部 PASS（机制层）**，无阻断 findings。
> - R3 的阻断项（契约 12 / F1）已随修复提交 `3eb78f9`（F1–F13）修复并推送；修复仅经**本地真实浏览器回归 22/22** 验证，
>   **未经独立复审**，本报告不为其背书为“独立 PASS”。
> - C 片两项 UNVERIFIED（对象池/资源释放、交付文件实体清单）仍未补齐，属非阻断遗留。
> - 本轮审计未修改源码、未提交、未推送；远端工作树审计前后 `status --porcelain -uall` 均为 0。

---

## 1. 固定提交与发布

| 项 | 值 |
| --- | --- |
| 仓库 | `https://github.com/zhougeC/practiceDemo.git` |
| 分支 | `feature/TASK-001` |
| BASE_SHA | `2263425df8bd074f3c5e0d8f15e695e4f6c709e0` |
| R3 审计对象 | `90c75ce4f60457cbdcbc1afb8f8312976c833432`（`feat(TASK-001): 鹈鹕海岸公路 3D 交互页面（纯静态，本地 three.js）`） |
| **最终 HEAD_SHA（R4 B 片审计对象）** | **`3eb78f9a504c3f6707f22d910d2983ecd1cb1378`**（`fix(TASK-001): resolve audit findings F1-F13`） |
| 修复提交 | `3eb78f9`，父提交 `90c75ce4`；F1–F13 修复，已推送 `origin/feature/TASK-001`（`git ls-remote` 校验一致） |
| 变更规模 | 6 文件，+3429 / -0（`90c75ce4`）；`3eb78f9` 为修复提交 |
| 远端工作树（R3） | `/home/devagent/worktrees/audit-TASK-001-90c75ce4`（detached） |
| 远端工作树（R4 B 片） | `/home/devagent/worktrees/audit-TASK-001-3eb78f9`（detached，创建前路径不存在） |
| 审计后 HEAD / 洁净度 | `3eb78f9…` / `git status --porcelain -uall` = **0**，`git diff --stat` 空 |

入库文件：`.gitignore`、`index.html`、`vendor/three.min.js`、`vendor/three.LICENSE.txt`、`docs/tasks/TASK-001.md`、`docs/designs/TASK-001.md`。
`evidence/`、`.omp/`、`*.log`、`.DS_Store` 未入库。

---

## 2. 多轮审计总览

| 轮次 | 方式 | 结果 | 有效结论 | 备注 |
| --- | --- | --- | --- | --- |
| R1 | 单次全量，360s 超时 | 失败（0 B result） | 无 | 见附录 §3 |
| R2 | A/B/C 切片，`--max-turns 14` | A `error_max_turns`；B/C 未执行 | 无 | 见附录 §7 |
| R3 | A/B/C 切片，`--max-turns 24`，输出预算 + 行段约束 | **A 有效；B 无效（cwd/EACCES）；C 有效** | A + C | 本文件 §3–§11 |
| **R4** | 仅补 B 切片，`--max-turns 24`，最终提交 `3eb78f9`，新会话/新工作树 | **B 有效** | B | §4.4 |

R3 每次调用均为**全新会话**，无 `--resume` / `--continue` / `--fork-session`；提示词经 **stdin 文件重定向**投递，无位置参数。
R4 B 片同样为全新会话（`c0e6e7e4…`），使用独立的 detached 工作树 `/home/devagent/worktrees/audit-TASK-001-3eb78f9`，未复用 R3 工作树。

---

## 3. R3 执行装置与前置校验

| 项 | 值 |
| --- | --- |
| 主机 | jp-vps（Debian 5.10.0-33-cloud-amd64，2 vCPU / 978 MiB / 2 GiB swap） |
| 执行用户 | `devagent`（uid 1001），`HOME=/home/devagent` |
| CLI | Claude Code `2.1.308`，包装器 `/home/devagent/bin/claude-ds`；provider `api.deepseek.com`，model `deepseek-flash` |
| 调用模板 | `/usr/bin/time -v -o time.txt timeout -k 20 600 claude-ds -p --output-format json --permission-mode plan --safe-mode --max-turns 24 --tools Read,Glob,Grep < prompt.txt` |
| 证据目录 | `/home/devagent/p1-audit-evidence-r3/{A,B,C}`，权限 **700**；提示词 **600**；本机副本 `evidence/P1-audit/r3/remote/` |
| 工作树校验 | HEAD = `90c75ce4…`（逐字节一致），`status --porcelain -uall` = 0 |
| 起始残留进程 | 无 `claude` / `runner.sh` / `sampler.sh` |
| 提示词 A | 1 638 B，sha256 `301c7a62…b4d50`，行段 4 处、工具上限 1 处、输出预算 1 处 |
| 提示词 B | 1 631 B，sha256 `767117cf…8cbd1`，行段 5 处、工具上限 1 处、输出预算 1 处 |
| 提示词 C | 1 801 B，sha256 `2c3fb2fb…2ac20`，行段 5 处、工具上限 1 处、输出预算 1 处 |

**采样器与健康闸门**：每 1 s 采集 `/proc/stat`、CLI 进程 ticks/RSS、`MemAvailable`、swap 已用、`pswpin/pswpout/oom_kill`、load1、进程数。
B/C 的 CLI 进程用 `/proc/<pid>/exe` 解析到 `/.local/share/claude/versions/2.1.308`，并以“已记录 CLI 根 PID 的后代”作为兜底；
A 片使用旧版 cmdline 匹配，未命中 CLI 本体（见 §8）。健康闸门：`oom_kill` 递增、`MemAvailable < 64 MiB` 连续 5 s、swap 已用 > 512 MiB → 写 `HEALTH-ABORT` 并终止 CLI。

**上线前探针（付费调用之前）**：用复制到 `.../.local/share/claude/versions/probe` 的 `sleep` 与一个“根 PID 后代”进程验证匹配逻辑：
3/3 采样行命中、RSS > 0、`match-debug` 记录到两条真实 cmdline；采样器存活且 `samples.csv` ≥ 2 行才允许进入 CLI。
该探针在 A 片前用旧 matcher、在 B/C 前用新版 matcher 各验证一次。

**基线（2026-10-23T06:20:30Z）**：

| 指标 | 值 |
| --- | --- |
| MemAvailable | 691 272 kB ≈ 675 MiB（MemTotal 1 002 172 kB） |
| Swap | `/swapfile` 262 140 kB 用 1 548 kB；`/swapfile-omp` 1 835 004 kB 用 **0**；合计用 1 548 kB |
| `vmstat` | `pswpin 107` / `pswpout 289` / `pgmajfault 13 648` / `oom_kill 0` |
| Load1 | 0.00 |
| 代理 | `trojan-go` PID **365 811**（运行期实测），RSS 40 844 kB |

---

## 4. R3/R4 逐切片结果

### 4.1 切片 A：玩法与状态（有效）

| 项 | 值 |
| --- | --- |
| 会话 ID | `e8340d35-25c3-4656-99d3-b38392317fbf`（全新） |
| SSH 退出码 | **0** |
| CLI 退出码 | **0** |
| 结果类型 | `subtype=success`，`is_error=false`，`num_turns=9` |
| 墙钟 | **88.479 s**（`/usr/bin/time -v` 1:28.47；`duration_ms` 87 366） |
| 结果文本 | 2 003 字符 / 635 汉字，表格 7 行，PASS 4 / FAIL 1 / UNVERIFIED 0 |
| Token | input 34 161 / cache-read 25 472 / output 14 032 / thinking 0 |
| 计费 | `totalCostUSD = 0.534341`（**单次观测，不可作预算依据**） |
| 采样 | 74 点 / 91 s；旧版 matcher 命中 0 点（见 §8 局限） |

契约结论：1 PASS、5 PASS、6 PASS、7 PASS、12 **FAIL**。findings 5 条（见 §6）。

### 4.2 切片 B：渲染与物理（**无效**）

| 项 | 值 |
| --- | --- |
| 会话 ID | `f60d05eb-d485-4252-8b84-86678d8bf8a5`（全新） |
| SSH 退出码 | **0** |
| CLI 退出码 | **0** |
| 结果类型 | `subtype=success`，`is_error=false`，`num_turns=9` |
| 墙钟 | **21.089 s** |
| 结果文本 | 887 字符 / 384 汉字，表格 7 行；5 项契约**全部 UNVERIFIED**（校验器的 PASS/FAIL 计数来自正文“PASS/FAIL”字样，非结论） |
| 计费 | `totalCostUSD = 0.110606`（**该次调用未产出审计结论，成本已发生**） |

**无效原因（已确证）**：runner 未 `cd` 到工作树，CLI 以 cwd=`/root` 启动；提示词中的相对路径被 CLI 解析为 `/root/...`，
8/8 次 Read 全部返回 `EACCES: permission denied, open '/root/index.html'`（及 `/root/docs/...`）。模型据实输出“无法读取任何目标文件”，
契约 2/3/4/8/11 全部 UNVERIFIED。**该结果不构成 B 片审计，不得引用为 PASS/FAIL 证据。**

A 片之所以未受影响，是因为其模型先用 2 次 Glob 发现了绝对路径 `/home/devagent/worktrees/...`，随后用绝对路径读取；
B 片直接按提示词读相对路径，因此暴露了装置缺陷。C 片在修正 `cd "$WT"` 后执行（`CWD` 已写入 `precheck.txt`）。

> 对 fail-stop 的说明：B 满足既定机械校验（CLI 0 / JSON 可解析 / `is_error=false` / 非空 / 有表格与 findings），
> 其失效是**执行装置 cwd 缺陷**而非模型/供应商失败；C 为同一轮已授权的独立切片，故在修正 cwd 后执行。
> R3 内**未重跑 B**（遵守 no-retry）。R4 经单独授权，在最终提交 `3eb78f9` 上以全新会话补跑一次（见 §4.4）；
> 该次结果不与本次无效调用合并，本次 `0.110606` 的调用不计入有效审计。

### 4.3 切片 C：运行时与交付（有效）

| 项 | 值 |
| --- | --- |
| 会话 ID | `cad64ec9-4f60-4d9a-8620-b135a2df8f93`（全新） |
| SSH 退出码 | **0** |
| CLI 退出码 | **0** |
| 结果类型 | `subtype=success`，`is_error=false`，`num_turns=9` |
| 墙钟 | **55.869 s**（`/usr/bin/time -v` 0:55.86；`duration_ms` 54 623） |
| 结果文本 | 2 644 字符 / 800 汉字，表格 13 行，PASS 9 / FAIL 0 / UNVERIFIED 2 |
| Token | input 26 512 / cache-read 6 144 / output 8 306 / thinking 0 |
| 计费 | `totalCostUSD = 0.343282`（**单次观测，不可作预算依据**） |
| 采样 | 40 点 / 58 s；CLI 命中 38/40 点 |

C 片无 FAIL；对象池/内存与交付文件完整性两项 UNVERIFIED（工具预算耗尽，未读 `2643-2924`、未列 `vendor/`）。
findings 8 条（见 §6）。

### 4.4 切片 B 补审（R4，最终提交 `3eb78f9`，有效）

#### 4.4.1 前置校验与执行元数据

| 项 | 值 |
| --- | --- |
| 审计对象 | `3eb78f9a504c3f6707f22d910d2983ecd1cb1378`（`fix(TASK-001): resolve audit findings F1-F13`） |
| 拉取/校验 | `git fetch origin feature/TASK-001`；`git cat-file -t 3eb78f9…` = `commit`；`origin/feature/TASK-001` = `3eb78f9…` |
| 工作树 | `/home/devagent/worktrees/audit-TASK-001-3eb78f9`（`git worktree add --detach`；创建前路径不存在，拒绝复用） |
| HEAD 断言 | `git rev-parse HEAD` = `3eb78f9a504c3f6707f22d910d2983ecd1cb1378`（逐字节一致） |
| 洁净度 | `git status --porcelain -uall` = **0 行**；`git diff --stat` 空（审计前后均复核） |
| cwd 断言 | `pwd -P` = `/home/devagent/worktrees/audit-TASK-001-3eb78f9`，与工作树路径一致后才调用 CLI |
| 提示词 | `evidence/P1-audit/prompts/B-render.json`，1 631 B，sha256 `6dc1c33e…3eb4be`；经 stdin 文件重定向投递，本机/远端哈希一致 |
| 行段校验 | 工作树 `index.html` = **3 232 行**；提示词最大行号 2 955 ≤ 3 232，全部行段在文件范围内 |
| 会话 | `c0e6e7e4-c012-4acf-83d2-02daf1e9b3a3`（**全新**，无 `--resume` / `--continue` / `--fork-session`） |
| CLI | 包装器 `/home/devagent/bin/claude-ds`；provider `api.deepseek.com`（stderr 告警佐证），model `deepseek-flash`；本轮未单独查询 CLI 版本号 |
| 结果类型 | `subtype=success`，`is_error=false`，`stop_reason=end_turn`，`terminal_reason=completed` |
| 轮数 / 时长 | `num_turns=9`；`duration_ms=87 807`；`/usr/bin/time -v` 墙钟 **1:29.16**；`ttft_ms=4 124` |
| 结果文本 | 2 239 字符；契约表 5 行（2/3/4/8/11）；findings **7 条**（≤10） |
| Token | input 28 608 / cache-read 5 760 / output 14 359 / thinking 0 |
| 计费 | `totalCostUSD = 0.504895`（**CLI 自报单次观测，不可靠，不可作预算依据**） |
| stderr | 2 行非致命告警：`[claude-code:unrecognized_model] {"model":"deepseek-flash"}`；auto-mode 分类器计费说明（网关不兼容，不影响调用） |
| 证据目录 | 远端 `/home/devagent/audit-runs/TASK-001-3eb78f9/`（700）；本机 `evidence/P1-audit/r4/B/`（out.json / time / err.txt / monitor.log / cli.code / prompt.txt / pwd.txt） |

**调用命令**（cwd = 上述工作树；仅此一次，无重跑）：

```bash
/usr/bin/time -v -o /home/devagent/audit-runs/TASK-001-3eb78f9/time \
  timeout -k20 600 /home/devagent/bin/claude-ds -p --safe-mode \
  --permission-mode plan --output-format json --max-turns 24 \
  --tools Read,Glob,Grep \
  < /home/devagent/audit-runs/TASK-001-3eb78f9/prompt.txt \
  > /home/devagent/audit-runs/TASK-001-3eb78f9/out.json \
  2> /home/devagent/audit-runs/TASK-001-3eb78f9/err.txt
```

**退出码（独立采集）**：

| 层 | 退出码 | 说明 |
| --- | --- | --- |
| SSH | **0** | 传输正常，无断连 |
| CLI / 包装器 | **0** | `cli.code` = 0；`timeout` 未触发（非 124/137） |
| `/usr/bin/time -v` | **0** | `Exit status: 0` |
| JSON 校验 | 通过 | `python3 json.load` 成功；`is_error=false`；`result` 非空（2 239 字符） |
| 重跑 | **无** | 单次调用 |

#### 4.4.2 资源信封（1 s 采样，85 点 / ≈86 s；CLI 进程树命中 84/85）

| 指标 | 基线 | 峰值/区间 | 结束 |
| --- | --- | --- | --- |
| MemTotal / MemAvailable | 978 MiB / **688 272 kB ≈ 672 MiB** | MemAvailable 最低 **556 044 kB ≈ 543 MiB** | 672 MiB 可用 |
| Swap | 已用 1 548 kB（`/swapfile` 1.5 M；`/swapfile-omp` 0） | `SwapFree` 恒定 2 095 596 kB（净占用不变） | 不变 |
| `pswpin` / `pswpout` | 107 / 289 | 107 / 289（窗口内**零换页**） | 不变 |
| `oom_kill` | 0 | **0** | 0 |
| Load1 | 0.00 | 峰值 **0.23** | 0.09 |
| CLI 进程树 RSS | — | 峰值 **265 924 kB ≈ 260 MiB**（`time -v` 264 280 kB） | 释放 |
| CLI 进程树 CPU | — | 峰值 **116%**（2 核合计，短时多线程）；均值 14.4% | — |
| 进程 CPU（`time -v`） | — | user 11.23 s + sys 1.45 s = **12.68 s**（14%） | — |
| 系统 CPU busy（逐秒 `/proc/stat`） | — | 均值 **11.1%**，峰值 **63.7%** | — |
| 进程数峰值 | — | 10 | — |
| 代理 `trojan-go` | PID **365 811**，RSS 43 128 kB | 全程存活，PID 未变 | 存活 |
| 健康闸门 | — | 未触发（无 OOM、无持续换页、内存余量充足） | — |

#### 4.4.3 契约结论（B 片范围：2/3/4/8/11）

| # | 契约 | 结论 | 证据（`index.html`）与要点 |
| --- | --- | --- | --- |
| 2 | 红围巾 Verlet 布料 | **PASS** | `1296-1553`：Verlet 积分、3 次距离约束、顶部锚点固定、重力/车速气流/侧风/湍流/转向跳跃伪惯性；`Float32Array` 预分配 + `DynamicDrawUsage`。瑕疵 B-F1 |
| 3 | 昼夜循环 | **PASS（机制）** | `2890-2952`：相位循环、日月方向、星空透明度、调色板/雾/主光/半球光/灯塔随夜变化、入夜 Toast。`CFG` 起始相位与周期未读 → 取值 **UNVERIFIED**；日月方向一致性瑕疵 B-F3 |
| 4 | 海面波浪与岸边碎浪 | **PASS** | `407-484`：5 层正弦顶点位移、解析梯度法线、菲涅尔、日月高光、近岸泡沫带与雾融合。近岸法线幅度瑕疵 B-F2 |
| 8 | 5 种镜头与相机避障 | **PASS** | `2286-2417`：5 模式、FOV 随速、`damp` 平滑、POV 开关。避障不完整 B-F4；POV 可见性 B-F6 |
| 11 | 按帧率自适应画质 | **PASS** | `2546-2580`：EMA 帧时间、38/57 双阈值滞回、2.5/4.0 s 冷却、分辨率与星空细节降档。DPR 缓存缺陷 B-F5 |

**B 片结论**：5 项契约全部 **PASS（机制层）**，**0 条阻断 findings**；7 条 findings 均为中低/低危，见 §6 的 B-F1–B-F7。
着色器 `precision highp float;` 的移动端兼容性（B-F7）为规范层风险评估，未经实机 GLSL 编译验证。

---

## 5. 12 条功能契约汇总

| # | 契约 | 结论 | 证据/来源 |
| --- | --- | --- | --- |
| 1 | 鹈鹕/自行车/头盔/墨镜/红围巾外观 | **PASS** | A：`index.html:804-968, 973-1104, 1140-1158, 2567` |
| 2 | 红围巾 Verlet 布料 | **PASS**（瑕疵 B-F1） | B(R4)：`index.html:1296-1553` |
| 3 | 昼夜循环 | **PASS（机制；CFG 取值 UNVERIFIED）**（瑕疵 B-F3） | B(R4)：`index.html:2890-2952` |
| 4 | 海面波浪与岸边碎浪 | **PASS**（瑕疵 B-F2） | B(R4)：`index.html:407-484` |
| 5 | 抓鱼/金鱼/计分/连击/车篮 | **PASS** | A：`1550-1732, 1644-1648, 2723-2738` |
| 6 | W/S、A/D、Space、T 控制与物理 | **PASS**（附低危瑕疵） | A：`1823-1850, 2666-2686, 2855-2886` |
| 7 | 14 个成就 | **PASS** | A：`2119-2135, 2144-2159` |
| 8 | 5 种镜头与相机避障 | **PASS**（避障不完整 B-F4；POV 可见性 B-F6） | B(R4)：`index.html:2286-2417` |
| 9 | WebAudio 合成音效/音乐、节奏随踏频、静音 | **PASS**（BPM 下限瑕疵） | C：`1956-2061, 2068-2071, 2077-2095` |
| 10 | 触屏按钮（Pointer Events）与键盘并存 | **PASS**（多点瑕疵） | C：`1823-1857, 1859-1886, 1918-1921` |
| 11 | 按帧率自适应画质 | **PASS**（DPR 缓存缺陷 B-F5） | B(R4)：`index.html:2546-2580` |
| 12 | 空闲自动驾驶、可被输入打断 | **FAIL@`90c75ce4`；`3eb78f9` 已修复但未经独立复审** | A：`1829-1832, 1927-1929, 2830-2833`；修复提交 `3eb78f9`（F1–F13），仅经本地浏览器回归 22/22，非独立审计 |

> 说明：契约 2/3/4/8/11 的 PASS 来自 R4 静态审计（`3eb78f9`），属机制层结论，未经实机渲染验收。
> 契约 12 的修复由修复轮自测（本地真实浏览器 22/22）佐证；本轮审计**未复审** A 片修复代码，故不将其计为独立 PASS。

技术约束（C 片，限已读段）：

| 约束 | 结论 | 证据 |
| --- | --- | --- |
| 直接 `file://` 打开、无运行时 CDN/fetch | PASS（限已读段） | `index.html:6, 194-195`；已读段无 http/fetch/XHR |
| WebGL 不可用降级提示 | PASS | `2506-2516, 2520-2540, 2493-2499` |
| context lost/restored | PASS | `2951-2966` |
| resize / visibilitychange | PASS（音频未挂起） | `2940-2949` |
| 主循环异常处理 | PASS（fatal 不可恢复） | `2932-2937, 3043-3052` |
| 对象池/内存/资源释放 | **UNVERIFIED** | 指定行段外 |
| 静态安全性（无凭据/注入面） | PASS（限已读段） | `2326-2382, 2978-3036` |
| 交付文件完整性（index + vendor + license） | **UNVERIFIED** | 未列目录核实 |

---

## 6. 去重 findings

| ID | 严重度 | 文件:行号 | 问题 | 消费者影响 | 来源 |
| --- | --- | --- | --- | --- | --- |
| F1 | **中（阻断契约 12）** | `index.html:1829-1832, 1927-1929, 2830-2833` | A/D/Space/T 只在按下瞬间触发，未进入 `held`/`isActive`；`isActive` 只查油门、刹车、拖拽、触屏指针 | 按住 A/Space/T 超过 5 s 仍会进入自动驾驶并自动变道，违背“任意键盘输入立即打断” | A |
| F2 | 中低 | `index.html:1890-1909` | 画布只处理 `pointerup/pointercancel`，无 `lostpointercapture`/`blur` 清理 | 捕获丢失后 `dragId` 永久非空 → `isActive()` 恒真，自动驾驶永不启动；环绕拖拽卡死 | A |
| F3 | 低 | `index.html:2855-2864` | `accelInput = accel - brakeDecel`，油门/刹车代数和 | 若 `CFG.accel > CFG.brakeDecel`，同时按住 W+S 仍加速 | A |
| F4 | 低 | `index.html:1711-1716`（渲染 `1700`） | 捕获判定用静态 `f.x`，渲染位置为 `f.x + sin(...)*0.18` | 变道穿鱼时画面偏离车篮仍触发捕获/粒子 | A |
| F5 | 低 | `index.html:2639, 2828-2833` | `lastInputMs` 在 boot 时初始化，首帧/着色器编译耗时计入 5 s 空闲 | 弱机首帧阻塞 > 5 s 会在用户操作前触发自动驾驶 | A |
| F6 | P2 | `index.html:1819-1821, 1872-1878` | 同一长按按钮双指按下时 `held[act]` 为单一布尔，任一指针抬起即清零 | 另一指仍按但加速/刹车停止 | C |
| F7 | P2 | `index.html:1970-1995, 2946-2948` | 海浪/风 loop 音源常驻；`visibilitychange` 只重置时钟，未 `ctx.suspend()` | 切后台仍持续出声 | C |
| F8 | P3 | `index.html:1951-1952` | `ctx.resume()` 的 Promise 拒绝未被捕获 | 控制台可能出现未处理 rejection | C |
| F9 | P3 | `index.html:2084-2090` | BPM `clamp(..., 60, 180)` 下限硬编码 60 | 停车/低速时鼓点仍 60 BPM，节奏与踏频脱节 | C |
| F10 | P3 | `index.html:2509-2511` | WebGL 探测上下文创建后未 `loseContext()` | 移动端上下文配额紧张时可能挤占正式渲染上下文 | C |
| F11 | P3 | `index.html:2925, 2934-2937` | 任一帧异常即 `fatal=true` 永久停循环，无重试/刷新入口 | 一次瞬时异常导致整页不可用 | C |
| F12 | P3 | `index.html:1889-1909` | 画布仅保存单个 `dragId`；第二指覆盖第一指 | 自由镜头双指操作断续（与 F2 同根，建议一并修） | C |
| F13 | P3 | `index.html:2493-2499, 2957-2959` | fatal 时 `showFallback` 未隐藏 `#ctxlost` | 上下文丢失提示已显示时两层 overlay 叠加 | C |

> F2 与 F12 同属“画布指针状态机”，修复时合并处理；F6 属“触屏按钮按住计数”，与 F2/F12 不同层。

**R4 切片 B findings（B-F1–B-F7，均非阻断；B 片内部编号 1–7）**：

| ID | 严重度 | 文件:行号 | 问题 | 消费者影响 | 修复建议 |
| --- | --- | --- | --- | --- | --- |
| B-F1 | 中低 | `index.html:1540-1542` | NaN 自愈以步长 7 抽查 `pos`（180 分量仅约 26 个），且完全不检查 `prev` | 漏检 NaN 持续污染法线与 GPU 缓冲，围巾局部消失/闪烁；`prev` 中 NaN 永不恢复 | 按步长 3 遍历 `pos` 与 `prev`，命中即 `reset()` |
| B-F2 | 中 | `index.html:423` vs `459-460` | 顶点位移乘了近岸衰减 `(0.35+0.65*shore)`，片段 `waveGrad` 未乘该因子 | 近岸区法线幅度最大约 2.9 倍偏强，泡沫带内高光/明暗跳变 | 以 varying 传 `shore` 并在片段梯度中同乘 |
| B-F3 | 低 | `index.html:2914` vs `2926` | 天空球把 `sunDir.y` 抬高 0.06 后归一化，海洋仍用未修正方向 | 黄昏时日轮与海面高光路径错位约 3–4° | 修正一次后同时写入 sky/ocean |
| B-F4 | 低 | `index.html:2390-2394` | 相机避障仅 `y>=1.15` 与 `x<-9` 时抬升到 7.4，无近平面/障碍体检测，POV 分支跳过 | 环绕半径至 20 时抬升后仍处棕榈冠层上缘；电影机位贴近车身可能穿模 | 对机位-目标连线做球体/AABB 检测，或收紧 `orbitRadius` 上限 |
| B-F5 | 低 | `index.html:2547, 2581-2584` | `baseDPR` 仅创建时读取，`resize()` 与 `tickRepair()` 不重算 | 浏览器缩放/跨屏移动后按旧 DPR 渲染，画质档显示正常但实际分辨率倍率错误 | `resize` 中重算 `Math.min(devicePixelRatio, maxPixelRatio)` |
| B-F6 | 低 | `index.html:2321, 2369-2374` | 切 POV 时 `rider.setPov()` 立即切换头部/头盔可见性，机位受 `damp(lambda=16)` 延迟 0.1–0.2 s | 进入 POV 瞬间可见无头鹈鹕；退出瞬间相机仍在头内 | 可见性延迟到机位距离阈值内再切换 |
| B-F7 | 低 | `index.html:289, 430` | 两个自定义片段着色器硬编码 `precision highp float;` | WebGL1 片段阶段不支持 highp 的老旧移动 GPU 编译失败，天空/海面不渲染 | 移除显式声明交由 three 注入，或提供 mediump 回退 |

> 历史 F1–F13（A/C 片 findings）已由修复提交 `3eb78f9` 处理并推送；修复内容仅经本地真实浏览器回归 22/22，
> **本轮未逐条独立复审**，故上表保留其原始判定与行号作为历史证据，不据此宣称已独立验证修复。

---

## 7. Spot-check（6 条，只读复核）

### 7.1 R3（A/C，3 条）

| # | 被核验声明 | 结果 | 复核证据 |
| --- | --- | --- | --- |
| 1 | A-F1：按住 A/Space/T 不打断自动驾驶 | **CONFIRMED** | `1829-1832`：`KeyA/KeyD/Space/KeyT` 均只在 `!e.repeat` 时调用回调，未写 `held`；`1927-1929`：`isActive` 仅 `held.throttle \|\| held.brake \|\| dragId !== null \|\| activePointers > 0` |
| 2 | C-F6：同一按钮双指按住，任一抬起即释放 | **CONFIRMED** | `1872-1878`：`finish()` 用 `pointerActs[e.pointerId]` 取 `act` 后直接 `release(act)`；`1819-1821`：`release` 仅把 `held[act]` 置 false，无按 act 的指针计数 |
| 3 | C-F7：隐藏页面不挂起音频 | **CONFIRMED** | `1970-1995`：ocean/wind `BufferSource` 均 `loop=true` 且 `start()` 后无 stop；`2946-2948`：`visibilitychange` 仅 `last = performance.now()`，无 `ctx.suspend()` |

另：A-F4/F5、C-F9/F10 在复核过程中一并重读，行号与代码行为一致；未计入上述 3 条配额。C-F13 未单独复核。

### 7.2 R4（B，3 条，提交 `3eb78f9`）

| # | 被核验声明 | 结果 | 复核证据 |
| --- | --- | --- | --- |
| 1 | B-F2：顶点位移乘近岸衰减，片段法线未乘 | **CONFIRMED** | `423`：`h = waveH(...) * uAmp * (0.35 + 0.65 * shore)`；`459-460`：`g = waveGrad(...) * uAmp` 后直接构造 `N`，无 `shore` 因子 |
| 2 | B-F1：NaN 检测步长 7 且只查 `pos` | **CONFIRMED** | `1540-1542`：`for (var q = 0; q < N * 3; q += 7)` 仅检查 `isFinite(pos[q])`；循环体内无 `prev` |
| 3 | B-F5：`baseDPR` 缓存，`resize`/`tickRepair` 不重算 | **CONFIRMED** | `2547`：`var baseDPR = Math.min(window.devicePixelRatio || 1, CFG.maxPixelRatio)`；`2581-2584` 的 `resize` 与 `tickRepair` 仅用 `baseDPR * renderScales[scaleIdx]`，未重新读取 `devicePixelRatio` |

---

## 8. 资源信封（R3 + R4 实测）

| 指标 | A | B（无效调用） | C |
| --- | --- | --- | --- |
| 采样点 / 窗口 | 74 / 91 s | 16 / 23 s | 40 / 58 s |
| 系统 CPU busy（前后 `/proc/stat` 差分） | **16.7%** | 25.0% | 23.6% |
| 逐秒峰值 busy（2 核） | 50.2% | 46.1% | 48.4% |
| 进程 CPU（`/usr/bin/time -v`） | user 10.12 + sys 1.25 = **11.37 s**（12%） | 3.60 + 0.39 = 3.99 s（18%） | 7.06 + 0.90 = **7.96 s**（14%） |
| 进程 CPU（采样器 ticks 差分） | 0（matcher 未命中） | 3.79 s | 7.59 s |
| 峰值 RSS（`time -v`） | **286 668 kB ≈ 280 MiB** | 258 852 kB ≈ 253 MiB | **263 728 kB ≈ 258 MiB** |
| 峰值 RSS（采样器） | — | 256 328 kB | 253 980 kB |
| MemAvailable 最低 | **529 864 kB ≈ 517 MiB** | 559 440 kB ≈ 546 MiB | **562 560 kB ≈ 549 MiB** |
| Swap 已用 | 恒定 **1 548 kB** | 恒定 1 548 kB | 恒定 1 548 kB |
| `pswpin` / `pswpout` | 107→107 / 289→289 | 107→107 / 289→289 | 107→107 / 289→289 |
| `pgmajfault` | 13 648→13 648 | 13 648→13 659 | 13 648→13 664 |
| `oom_kill` | **0→0** | 0→0 | 0→0 |
| Load1 峰值 | 0.41 | 0.25 | 0.15 |
| 健康闸门 | 未触发 | 未触发 | 未触发 |
| 代理 `trojan-go` | PID 365 811 全程存活，RSS 40 844 kB 不变 | 同左 | 同左 |

**说明**：

- A 片采样器使用旧版 cmdline 匹配，未命中 CLI 本体（0/74）；A 的进程级数据以 `/usr/bin/time -v` 为准，**无逐秒进程曲线**。
- B/C 使用 `/proc/<pid>/exe` 解析，分别命中 14/16 与 38/40 个采样点；采样器 ticks 与 `time -v` 的进程 CPU 偏差 < 5%。
- 全程无 OOM、无持续换页、swap 净占用不变；`pgmajfault` 增量 0–16 页，属正常。

### 8.1 R4 切片 B（`3eb78f9`，有效调用）

采样：每 1 s 采集，85 点 / ≈86 s；CLI 进程树（记录根 PID 的后代）命中 **84/85** 点。

| 指标 | 值 |
| --- | --- |
| 基线（调用前） | MemAvailable **688 272 kB**；Swap 已用 1 548 kB；`pswpin/pswpout` 107/289；`oom_kill` 0；Load1 0.00 |
| 系统 CPU busy（逐秒） | 均值 **11.1%**，峰值 **63.7%**（2 核） |
| 进程树 CPU（逐秒） | 均值 **14.4%**，峰值 **116%**（短时多线程） |
| 进程 CPU（`/usr/bin/time -v`） | user **11.23 s** + sys **1.45 s** = **12.68 s**（14%） |
| 峰值 RSS（采样器 / `time -v`） | **265 924 kB ≈ 260 MiB** / **264 280 kB** |
| MemAvailable 最低 | **556 044 kB ≈ 543 MiB** |
| Swap 净占用 | 恒定 **1 548 kB**（`SwapFree` 恒定 2 095 596 kB） |
| `pswpin` / `pswpout` | **107 → 107** / **289 → 289**（窗口内零换页） |
| `oom_kill` | **0 → 0** |
| Load1 峰值 | **0.23** |
| 进程数峰值 | 10 |
| 代理 `trojan-go` | PID **365 811** 全程存活（调用前 09:47:02、调用后 09:49:45，未重启），RSS 43 128 kB |
| 健康闸门 | 未触发 |

采样器以“已记录根 PID 的后代”匹配 CLI（`/proc/<pid>/statm`、`/proc/<pid>/stat`），与 `time -v` 的进程 CPU 偏差约 0.5 s；
两类数据不混用。

---

## 9. 只读性、健康与成本

| 项 | 结果 |
| --- | --- |
| 审计后 HEAD（R4） | `3eb78f9a504c3f6707f22d910d2983ecd1cb1378`（未变） |
| 审计后工作树（R4） | `/home/devagent/worktrees/audit-TASK-001-3eb78f9`；`status --porcelain -uall` = 0；`git diff --stat` 空 |
| R3 审计后 HEAD/工作树 | `90c75ce4…`；`status --porcelain -uall` = 0（A/B/C 每片结束后均复核） |
| 残留进程 | 无 `claude` / `run_audit` / `monitor.sh` |
| 工具白名单 | `Read,Glob,Grep`；`--permission-mode plan` + `--safe-mode` |
| 网络/构建/测试 | 未执行；C 片另以 CSP `default-src 'none'`、`connect-src 'none'` 佐证无外部请求 |
| 凭据读取 | 未读取/未回显 `claude-ds` 内容或环境变量 |
| 健康危险 | 无（OOM 0、MemAvailable 最低 517 MiB（R3）/543 MiB（R4）、swap 恒定、load 峰值 0.41/0.23） |

**成本（CLI 自报 `totalCostUSD`，单次观测，不可靠）**：

| 切片 | 成本 USD | 备注 |
| --- | --- | --- |
| R3-A | 0.534341 | 有效 |
| R3-B | 0.110606 | **无效审计，成本已发生** |
| R3-C | 0.343282 | 有效 |
| **R3 合计** | **0.988229** | 不含 R1/R2 历史成本；不可作预算承诺 |
| R4-B（`3eb78f9`） | 0.504895 | 有效；**单次观测，不可靠** |
| **R3 + R4 合计** | **1.493124** | 不含 R1/R2 历史成本；不可作预算承诺 |

---

## 10. 未验证与局限

1. **B 片为静态机制审计**：契约 2/3/4/8/11 均 PASS，但未构建、未开浏览器、未实测围巾稳定性/镜头平滑/画质滞回/移动端 GLSL 编译。
2. **B 片未读 `CFG` 与跨函数实现**：`dayCycleSeconds`、`startPhase`、`renderScales`、`maxSpeed` 的实际取值，以及 `blendPalette`、`rider.getEyeWorld/getLookWorld/setPov`、HUD 与主循环调用点未核实，故契约 3 的“起始黄昏/周期”为 UNVERIFIED。
3. **C 片两项 UNVERIFIED**：对象池/几何纹理释放（未读 `2643-2924`）、交付文件实体清单（未列 `vendor/`）；C 的 `file://`/无 CDN 结论仅限已读段与 CSP。
4. **A 片未读 `CFG` 取值**：捕获窗口、`maxSpeed/accel/brakeDecel/jumpVelocity/wheelieSeconds` 的实际数值未核对，F3/F4 的触发条件依赖这些取值。
5. **A 片进程曲线缺失**：旧 matcher 未命中 CLI，A 的 CPU/RSS 为 `time -v` 单次统计；R4-B 曲线正常（84/85 点）。
6. **修复未经独立复审**：`3eb78f9` 的 F1–F13 修复仅由修复轮以本地真实浏览器回归 22/22 佐证；本轮审计未复审修复代码，不将其计为独立 PASS。
7. **静态审计**：各片均未构建、未起服务、未开浏览器；交互/音频/触屏/上下文恢复/渲染结论均为代码路径推断，不替代人工实机验收。
8. **B 无效调用的成本**：R3-B `0.110606` 来自 CLI 自报；该次未产出审计结论，不计入有效审计。
9. **R1/R2 历史失败**：见附录；其成本与失败根因不因本轮而改变。

---

## 11. 裁决与编号修复项

**裁决：PASS-with-caveat（有条件通过，非完整独立 PASS）**

依据：

- **R4 切片 B（`3eb78f9`）**：契约 2/3/4/8/11 全部 **PASS（机制层）**，**0 条阻断 findings**；7 条中低/低危 findings（B-F1–B-F7）不构成阻断。
- **契约 12**：在 `90c75ce4` 上独立判定 **FAIL**（F1）；修复提交 `3eb78f9` 已包含 F1–F13 修复并推送，修复轮本地真实浏览器回归 **22/22 PASS**。
  但本轮审计**未复审修复代码**，故契约 12 记为“已修复、未经独立复审”，不计为独立 PASS。
- **C 片**：无 FAIL；两项 UNVERIFIED（对象池/资源释放、交付文件清单）为**非阻断遗留**。
- **因此**：不存在阻断项；但“独立 PASS”只能覆盖 R3 的 A/C（`90c75ce4`）与 R4 的 B（`3eb78f9`），
  对 `3eb78f9` 的整体交付应表述为 **PASS-with-caveat**，而非完整独立 PASS。

历史阻断项状态：

- **B1（契约 12 FAIL）**：**已修复（`3eb78f9`）**，未经独立复审；本地回归 22/22。
- **B2（B 片覆盖缺口）**：**已关闭**——R4 以全新会话/新工作树补审，5 项契约均 PASS。

遗留非阻断项：

1. **【中】** B-F2：近岸法线未乘 `(0.35+0.65*shore)`，泡沫带高光/明暗跳变。证据：`index.html:423, 459-460`。
2. **【中低】** B-F1：NaN 自愈步长 7 且不检查 `prev`。证据：`index.html:1540-1542`。
3. **【低】** B-F3：天空 `sunDir.y` 抬高 0.06，海洋未同步。证据：`index.html:2914, 2926`。
4. **【低】** B-F4：相机避障仅做粗略抬升，POV 分支跳过。证据：`index.html:2390-2394`。
5. **【低】** B-F5：`baseDPR` 不随缩放/跨屏重算。证据：`index.html:2547, 2581-2584`。
6. **【低】** B-F6：POV 切换时头部可见性与机位不同步。证据：`index.html:2321, 2369-2374`。
7. **【低】** B-F7：片段着色器硬编码 `precision highp float;`，老移动 GPU 风险。证据：`index.html:289, 430`。
8. **【待验证】** 补审 C 的 `2643-2924` 与 `vendor/` 实体清单；补读 `CFG` 取值以量化契约 3 与 A-F3/F4/F5 的触发条件。
9. **【待验证】** 独立复审 `3eb78f9` 的 F1–F13 修复（尤其契约 12 的 `keysDown`/`isActive` 改动）；本地 22/22 回归不能替代独立审计。

> 本轮审计**未修改任何源码、未提交、未推送**；R4 仅在 detached 工作树只读执行一次。
> 升级为完整独立 PASS 的条件：独立复审修复提交 + 补齐 C 两项 UNVERIFIED + 至少一次真实浏览器/移动端验收。

---

## 附录 A：历史轮次证据（R1/R2 原文保留）

> 以下为 R1/R2 报告原文（仅标题层级下调一级，正文与数据未改），保留其原始状态与编号，**不代表 R3 结论**。

### TASK-001 独立审计报告（远程）

> **状态：未完成（INCOMPLETE / INCONCLUSIVE）— 不存在 PASS 结论，也不存在任何 findings。**
>
> 已执行两轮审计，**两轮均未产出审计结论**：
> 1. 第一轮（§2–§5）：单次全量审计，360s 硬超时被杀，`result.json` 为 0 字节。
> 2. 第二轮（§7，R2）：按 §6 建议切成 A/B/C 三次调用，**切片 A 以 `error_max_turns` 失败**
>    （14 轮预算耗尽时模型仍在读文件，0 条文本输出），按"失败即停"约束**未执行 B、C，也未重试**。
>
> 因此本文件**不包含任何代码审计结论**。所有"看起来应该没问题"的判断一律不作数。
> 下面记录的是**已确证的事实**（发布、拉取、只读性、资源信封、失败根因）与**未完成的原因**。

---

#### 1. 发布（已完成并验证）

| 项 | 值 |
| --- | --- |
| 仓库 | `https://github.com/zhougeC/practiceDemo.git` |
| 分支 | `feature/TASK-001` |
| BASE_SHA（父提交 / 初始基线） | `2263425df8bd074f3c5e0d8f15e695e4f6c709e0` |
| HEAD_SHA（被发布提交） | `90c75ce4f60457cbdcbc1afb8f8312976c833432` |
| 提交标题 | `feat(TASK-001): 鹈鹕海岸公路 3D 交互页面（纯静态，本地 three.js）` |
| 推送方式 | `git push -u origin feature/TASK-001`（非强制，未触碰 master，未创建 PR） |
| 远端校验 | `git ls-remote origin refs/heads/feature/TASK-001` → `90c75ce4f60457cbdcbc1afb8f8312976c833432`（与本地 HEAD 逐字节一致） |
| 比对页（已准备，未创建 PR） | `https://github.com/zhougeC/practiceDemo/compare/master...feature/TASK-001` |

提交内容为 6 个文件、+3429 / -0 行，仅以下路径入库：

```
.gitignore
index.html
vendor/three.min.js
vendor/three.LICENSE.txt
docs/tasks/TASK-001.md
docs/designs/TASK-001.md
```

未入库（保持在本地、被 `.gitignore` 忽略）：`evidence/`（审计与冒烟证据）、`.omp/`、`*.log`、`.DS_Store`。
工作区遗留的无关文件（`1{u+=$4}`、`docs/Mac OMP + 日本 VPS …v2.0.md`）**未被暂存、未被提交**。

#### 2. 远程审计执行信息

| 项 | 值 |
| --- | --- |
| 审计主机 | `jp-vps`（Debian 5.10.0-33-cloud-amd64，2 vCPU，978 MiB RAM + 2 GiB swap） |
| 执行用户 | `devagent`（uid 1001） |
| 工作树 | `/home/devagent/worktrees/audit-TASK-001-90c75ce4`（detached，`git worktree add --detach`，创建前路径不存在） |
| 工作树 HEAD | `90c75ce4f60457cbdcbc1afb8f8312976c833432`（与 HEAD_SHA 完全一致） |
| 拉取 | `git fetch origin feature/TASK-001` → `FETCH_HEAD=90c75ce…`，`git cat-file -t` = `commit` |
| CLI | Claude Code `2.1.308`（`/home/devagent/bin/claude-ds` 包装器） |
| Provider / 模型 | 经 `api.deepseek.com` 网关；CLI 告警 `[claude-code:unrecognized_model] {"model":"deepseek-flash"}` |
| 会话 ID | `ab1ab32b-0448-429b-9cdc-e1ead63f9b2f`（本次被杀的审计会话） |
| 失败的前置探测会话 | `4f641b99-d029-4e2d-a48d-4a1c6ca0175d`（直接调裸二进制，未带包装器环境 → `Not logged in`，0 token / 0 成本，未产生任何审计动作） |
| 调用命令 | `timeout --kill-after=15 360 claude -p --output-format json --permission-mode plan --safe-mode --max-turns 16 --tools Read,Glob,Grep < audit-prompt.txt` |
| 提示词投递 | 经 stdin 文件重定向（`audit-prompt.txt`，6196 字节，sha256 `ff4c4472…b6c2b2`，本机与远端逐字节一致），未使用 shell 替换 |
| 会话新鲜度 | 全新会话，无 `--resume` / `--continue` / `--fork-session` |

#### 3. 审计结果：**失败（无输出）**

| 证据 | 值 |
| --- | --- |
| CLI 退出码 | `124`（`timeout` 到期强杀） |
| `result.json` 大小 | **0 字节** |
| 实际墙钟 | 360.0s（`/usr/bin/time -v`：6:00.27） |
| 失败性质 | 不是代码缺陷，是**模型侧推理爆炸 + 360s 硬超时**，JSON 结果在进程被杀时尚未落盘 |
| API 请求数 | 8 次（7 次完成、第 8 次在途被杀） |
| 累计 API 时长 | 273 047 ms（其中重试耗时 41 ms，即**无有效重试**） |
| 工具执行总时长 | 307 ms（工具几乎不耗时） |
| 计费 | `totalCostUSD = 1.559644`；input 59 797 / output 46 763 / cache-read 183 168 tokens |

> 说明：会话记录（`~/.claude/projects/…/ab1ab32b….jsonl`，873 KB）中确有中途产出的分析内容，
> 但按任务约束**不使用 transcript 作为结果回退**，故本报告不含任何从中摘取的结论。
> 下述时间线仅用于**故障归因**，不是审计结论。

##### 3.1 时间线与根因（只读诊断，来自 transcript + stderr）

| # | 时刻 (UTC) | 时长 | 输入 / 缓存读 / 输出 tokens | stop | 动作 |
| --- | --- | --- | --- | --- | --- |
| 1 | 05:32:20.5 | 2.28s | 5 935 / 0 / 428 | tool_use | 并行读 `docs/tasks`、`three.LICENSE.txt`、`.gitignore` |
| 2 | 05:32:23.3 | 0.92s | 1 171 / 6 272 / 160 | tool_use | 读 `docs/designs`、`index.html` 1-400 |
| 3 | 05:32:24.6 | 1.59s | 14 618 / 7 552 / 209 | tool_use | 读 `index.html` 400-850、850-1300 |
| 4 | 05:32:26.7 | 1.36s | 14 533 / 22 272 / 180 | tool_use | 读 `index.html` 1300-1750、1750-2200 |
| 5 | 05:32:28.6 | 1.40s | 12 883 / 36 864 / 181 | tool_use | 读 `index.html` 2200-2700、2700-3056 |
| **6** | 05:32:30.5 | **181.58s** | 10 493 / 49 920 / **32 000** | **max_tokens** | 纯 thinking 112 285 字符，**撞满 32k 输出上限** |
| — | 05:35:32.1 | — | — | — | CLI 注入 "Output token limit hit. Resume directly…" |
| **7** | 05:35:32.2 | **80.54s** | 164 / 60 288 / 13 605 | tool_use | thinking 47 784 字符，之后才发出 Grep/Glob |
| 8 | 05:36:53.9 | **在途 86s 被杀** | — | — | 第三次长推理，未返回即超时 |

- **根因**：模型（`deepseek-flash`）把审计当成"穷举假想缺陷"的长推理，单轮 thinking 达 112 KB（383 处 "Bug candidate" 编号），
  直接耗尽 32 000 输出 token；CLI 触发续写，又消耗 13 605 token。**7 次完成的请求里 5 次是毫秒级的文件读取，2 次推理吃掉 262s**，
  第 8 次请求再吃掉剩余 86s。**不是**重复读取（仅 11 次 Read，覆盖 index.html 1-3056 全量），**不是** 429/限流（`rate_limit`/`overloaded`/`Retrying` 计数均为 0，
  transcript 中 106 处 "429" 全部是会话 UUID 与 `+3429 行` 的子串），**不是**工具或文件 IO 慢（工具总耗时 0.3s）。
- **最长间隔**：181.58s，位于请求 #6 —— 恰好在读完 `index.html` 全量之后、模型开始一次性穷举全部 12 条契约的推理阶段。
- **无任何完成态文本**：21 条 assistant 消息的 content 全是 `thinking`，`text` 块数量为 **0**；不存在"已经写好的报告片段"可回收。
- **vendor 未被误读**：14 次工具调用中只有 `vendor/three.LICENSE.txt` 被 Read，`vendor/three.min.js` **从未被读取正文**；
  transcript 中 40 处 `three.min.js` 字样全部来自提示词、任务/设计文档、`index.html` 内的引用与模型自己的讨论。
- **读取量**：`index.html` 3 056 行 / 120 990 B（7 段全覆盖）、`docs/designs` 301 行 / 21 710 B、`docs/tasks` 41 行 / 2 354 B、
  `three.LICENSE.txt` 21 行 / 1 081 B、`.gitignore` 9 行 / 71 B；提示词 68 行 / 6 196 B。合计约 152 KB。
- **进程残留**：审计结束后远端无任何 `claude` / `runner.sh` / `timeout` / `sampler` 进程。

因此：

- **findings：无**（不是"没有问题"，而是"没有被产出"）。
- **12 条功能契约**（围巾物理、昼夜循环、海面碎浪、抓鱼与输入、14 成就、5 镜头、音频节奏、触屏、画质自适应、自动驾驶、离线/file:// 与 WebGL 降级）：**全部未审计**，状态一律为 `未审计`，不得视为通过。
- **安全与只读性核查（代码层面）**：未执行（无输出）。

#### 4. 已确证：远程审计确实保持只读

- 审计结束后 `git -C <worktree> status --porcelain` 行数 = `0`（工作树干净）。
- 工作树 HEAD 仍为 `90c75ce4f60457cbdcbc1afb8f8312976c833432`，`git diff --stat` 为空。
- 未发现晚于提示词投递时间的新增/修改文件。
- 未执行任何构建、测试、lint 或联网安装（提示词与工具白名单 `Read/Glob/Grep` + `--permission-mode plan` 双重约束）。

#### 5. 资源信封（实测，非外推）

采样：远端每 1s 采集 `/proc/stat`、`/proc/meminfo`、`/proc/loadavg`、进程数；355 个采样点，361s。

| 指标 | 值 |
| --- | --- |
| 系统 CPU 总占用（前后 `/proc/stat` 差分，2 核） | user 3993 + system 1120 jiffies；总 72178，idle+iowait 66807 → **busy 7.4%** |
| 逐秒峰值 busy（全系统，2 核合计） | **64.4%** |
| 逐秒中位 / 均值 busy | 6.8% / 7.5% |
| 审计进程 CPU 时间（`/usr/bin/time -v`，进程生命周期） | user **37.69s** + sys **3.83s** = **41.52s** |
| 审计进程生命周期平均 CPU（`% of CPU`） | 11% |
| 峰值 RSS（`Maximum resident set size`） | **363 572 KB ≈ 355 MiB** |
| MemAvailable 最低 | **452 088 KB ≈ 441 MiB**（区间 452 088 – 689 672 KB） |
| Swap 使用（净） | **恒定 1 292 KB**（`SwapTotal 2 097 144` − `SwapFree 2 095 852`，前后两次快照完全一致） |
| Swap 写出现象 | `/proc/vmstat`：`pswpout 280 → 284`（+4 页 = 16 KB）、`pswpin 104 → 104`（0） |
| Swap 设备分布 | `/proc/swaps`：`/swapfile` 262 140 KB 已用 1 292 KB；`/swapfile-omp` 1 835 004 KB 已用 **0** |
| `vmstat` 采样窗口 | 前后各 1s 窗口 `si=0 / so=0`，`swpd=1292` 恒定 |
| SwapCached | 336 → 340 KB |
| Load1 峰值 | 0.34 |
| OOM | `oom_kill 0`（前后一致） |
| 进程数峰值 | 107 |

> **Swap 计数口径说明（消除"既在换页又没换页"的表面矛盾）**：
> `/proc/vmstat` 的 `pswpout` 是**开机以来的累计页数**，取前后差值才代表本窗口新增的换出量（+4 页）；
> `vmstat` 的 `si/so` 是**采样窗口内的速率**（此处只有前后各 1s 两个窗口），那 4 页发生在两次快照之间的 360s 里，故两个窗口都读到 0；
> `/proc/meminfo` 的 `SwapFree` 是**时间点快照**，前后完全相等（2 095 852 KB）说明净占用未增加。
> 三者可同时为真：4 页写出后，其 swap 槽在进程退出/页面丢弃时被释放且**从未被读回**（`pswpin` 不变即证据），
> `SwapCached +4 KB` 与"仍有 1 页留在 swap cache"一致。**未观测到持续换页**，MemAvailable 最低 441 MiB、`oom_kill 0`。
> 该机制为推断（有计数证据支撑），非直接抓取到的调用栈。

> 采样缺陷（如实记录）：per-进程 CPU/RSS 采样器用 `pgrep -f 'claude/versions/2.1.308'` 匹配，
> 而实际进程 cmdline 是包装器 `claude-ds`，导致 `claude_pids` 列全程为空、进程级逐秒曲线缺失。
> 进程级数据以上表 `/usr/bin/time -v` 的单次统计为准（两者不混用）。

##### 代理存活（关键基础设施）

| 项 | before | after |
| --- | --- | --- |
| PID | 365811 | 365811（**未重启**，ELAPSED 连续 08:02:17 → 08:08:21） |
| RSS | 50 056 KB | 47 228 KB |
| CPU ticks | utime 9320 / stime 11 574 | utime 9444 / stime 11 716（增量 ≈ 2.7s） |

- 全程存活，未被 OOM、未被 swap 抖动影响。
- **代理端点本身未做连通性测试**（按约束：不改动、不测试代理链路，仅观察存活）。

#### 6. 未完成事项与阻塞

1. **没有审计结果**：`result.json` 为 0 字节，无 findings、无 12 条契约结论，因此**不给出总体 PASS**。
2. 若要取得审计结果，需要**新的、被授权的**第二次付费调用；按任务约束（"One paid audit invocation; no retries on fail"、"Stop if provider/…/incomplete JSON errors"）本次**未自动重试**。
3. **重跑方案必须针对根因，不能只放宽超时**（本轮 360s 中 262s 花在两次撞上限的长推理上，单纯加时间只会再烧一轮）：

   - **已核实**：`2.1.308` 中 `--print` + `--output-format=stream-json` **必须**同时给 `--verbose`，否则 CLI 直接
     `Error: When using --print, --output-format=stream-json requires --verbose` 并退出（二进制内校验分支已确认）。
     上一版本报告的 stream-json 命令缺少 `--verbose`，**该命令无效，已作废**。
   - **推荐（按优先级）**：
     1. 在提示词里加**输出预算**：先出 12 条契约结论表（每项 ≤3 行）、再给 ≤15 条 findings，明确禁止在 thinking 里穷举数百条"候选缺陷"；
     2. **按范围切片**（scope-aware）：拆成 3 次调用（契约 1-4 / 5-8 / 9-12+技术约束），每次只读相关行段，避免单轮上下文与推理同时膨胀；
     3. 如需抗中途被杀，用 `--output-format stream-json --verbose --include-partial-messages` 保留增量文本；
     4. 超时按切片后的实际耗时设定，而不是无条件放大。
   - 工作树 `/home/devagent/worktrees/audit-TASK-001-90c75ce4` 已就绪且干净，可复用（若要求"唯一路径"，换 `audit-TASK-001-90c75ce4-r2`）。
   - **成本提示**：本轮失败已消耗 `$1.5596`；任何重跑都是新的付费调用，需显式授权。
4. 本次发布本身不受影响：分支已推送并通过 `ls-remote` 校验；`docs/reviews/TASK-001.md`（本文件）按要求**保持未提交**，未做第二次推送。

#### 7. 第二轮（R2）：切片化重跑 —— 切片 A 失败，按约束停止

第二轮按 §6 的三条建议执行：提示词加**输出预算**、按范围**切成 3 片**（A 玩法/状态、B 渲染/物理、C 运行时/交付）、
每片独立调用、不 resume/fork。结果：**A 片以 `error_max_turns` 失败**，B、C **未执行**，**未重试**。

##### 7.1 前置校验（已确证）

| 项 | 值 |
| --- | --- |
| 工作树 | `/home/devagent/worktrees/audit-TASK-001-90c75ce4`（detached，884 KB） |
| HEAD | `90c75ce4f60457cbdcbc1afb8f8312976c833432`（与 HEAD_SHA 逐字节一致） |
| 洁净度 | `git status --porcelain --untracked-files=all` = **0 行**；`git diff --stat` 空 |
| 起始进程 | 无任何 `claude` / `runner.sh` / `sampler` 残留 |
| 基线时刻 | `2026-10-23T06:09:06Z` |
| 基线内存 | MemTotal 1 002 172 kB / MemAvailable **692 772 kB** / SwapCached 336 kB |
| 基线 swap | SwapTotal 2 097 144 kB，SwapFree 2 095 596 kB（已用 **1 548 kB**）；`/swapfile` 262 140 kB 用 1 548 kB，`/swapfile-omp` 1 835 004 kB 用 **0** |
| 基线 vmstat | `pswpin 105` / `pswpout 289` / `pgmajfault 13 540` / `oom_kill 0` |
| 基线负载 | `load1 0.07` |
| 代理进程（运行期实测） | `trojan-go` PID **365 811**，RSS 40 844 KB，ELAPSED 08:39:05 |

##### 7.2 执行装置

- 每个切片独立目录 `/home/devagent/p1-audit-evidence-r2/{A,B,C}`，权限 **700**；提示词 `prompt.txt` 权限 **600**。
- 提示词经 **stdin 文件重定向**投递（非 shell 替换），sha256：A `d63901fe…b8b1a6`（1 300 B）、B `869fca2c…c3c4`、C `b5536daf…1603`。
- 调用模板：`/usr/bin/time -v -o time.txt timeout -k 20 600 claude-ds -p --output-format json --permission-mode plan --safe-mode --max-turns 14 --tools Read,Glob,Grep < prompt.txt`
- 采样器每秒采集：`/proc/stat` 全字段、claude 进程 PID/ticks/RSS、MemAvailable、swap 已用、`pswpin/pswpout/oom_kill`、load1、进程数；
  内置健康闸门（MemAvailable 连续 5 秒 < 80 MiB，或 `oom_kill` 相对基线递增 → 记录 `STOP_HEALTH` 并终止 CLI）。**本次闸门未触发**。
- 采样器上线前做过 4 秒空跑自检（5 行样本、字段完整、无 `STOP_HEALTH`）。

##### 7.3 一次中止的无效调用（如实记录）

首次启动时 runner 引用了 `$OUT/sampler.sh`，但脚本实际位于父目录 → 采样器启动失败，
而 runner 未中断，继续进入了付费 CLI。约 60 秒后人工 `pkill` 终止。
该次 `result.json` 为 **0 字节**、无 JSON 结果，SSH 退出码 `255`，**成本无法从结果文件读取（未知）**。
随后修正 runner（`cp sampler.sh → $OUT/`、启动后 `kill -0` 存活校验、提示词/CLI 存在性校验），重跑即下节的 A 片。

##### 7.4 切片 A：执行结果（失败）

| 项 | 值 |
| --- | --- |
| SSH 退出码 | **0**（传输正常） |
| CLI 退出码 | **1** |
| 结果类型 | `subtype = error_max_turns`，`is_error = true`，`terminal_reason = max_turns` |
| 错误文本 | `Reached maximum number of turns (14)` |
| 会话 ID | `d7c12804-9de5-4ec0-b630-43b572eedeac`（全新会话，无 resume/fork） |
| 墙钟 | **60.19 s**（`/usr/bin/time -v`：1:00.19；`duration_ms` 59 007） |
| 轮数 | `num_turns = 15`（预算 14） |
| 进程 CPU | user **8.84 s** + sys **1.07 s** = **9.91 s**，占 CPU **16%** |
| 峰值 RSS | **300 904 KB ≈ 294 MiB** |
| Token | input 38 556 / cache-read **347 520** / output 8 599 / thinking **0** |
| 计费 | `totalCostUSD = 0.581515`（**单次观测，不作预算承诺**） |
| 结果文件 | `result.json` 1 527 B —— **仅含错误元数据，无 `.result` 文本** |

**根因（结构性计数，未摘取任何正文）**：会话记录 42 条 assistant 消息，内容块为
`tool_use 28`（Read 20 / Grep 7 / Glob 1）+ `thinking 14`，**`text` 块 = 0**。
即模型把 14 轮预算全部用于读文件（`index.html` 3 056 行被分段读 + 反复 Grep），
在预算耗尽时**尚未开始写结论**。与第一轮的"单轮推理爆炸"不同，本轮**不是** thinking 超限，
而是**轮数预算与"分段读全量文件"策略不匹配**。

##### 7.5 资源信封（A 片实测，50 个采样点，≈60 s 窗口）

| 指标 | 值 |
| --- | --- |
| 系统 CPU 总占用（`/proc/stat` 前后差分，2 核） | user 1 191 + sys 1 074 jiffies；总 12 437，idle+iowait 10 127 → **busy 18.6%** |
| MemAvailable 最低 | **518 400 kB ≈ 506 MiB**（基线 691 712 kB） |
| Swap 已用 | **恒定 1 548 kB**（前后 `SwapFree` 完全相等） |
| `pswpin` / `pswpout` | **105 → 105** / **289 → 289**（窗口内零换页） |
| `pgmajfault` | 13 601 → 13 603（+2） |
| `oom_kill` | **0 → 0** |
| Load1 峰值 | 0.41 |
| 代理进程 | PID **365 811** 全程存活；RSS 40 844 KB → 40 844 KB；ticks (10008/12274) → (10024/12283) |

> 采样缺陷（如实记录，与第一轮同类）：per-进程匹配用 cmdline 含 `claude-ds` / `claude/versions` 且 uid=1001，
> 实际命中的是 `timeout`/包装器层（RSS 恒为 1 112 KB、ticks 恒 0），**CLI 本体未被逐秒捕获**。
> 进程级结论以 `/usr/bin/time -v` 的单次统计为准（294 MiB / 9.91 s CPU），两类数据不混用。

##### 7.6 停止判定

按任务约束"任一切片失败（超时/空结果/报错/健康危险）→ 立即停止，不跑剩余切片、不重试"：

- 切片 A：**失败**（`error_max_turns`，0 条审计文本）。
- 切片 B、C：**未执行**（未产生任何调用与费用）。
- 重试：**未执行**。
- 只读性复核：结束后 `git status --porcelain --untracked-files=all` = **0**，HEAD 未变，无残留进程。

##### 7.7 重跑建议（针对本轮根因，非简单放宽超时）

1. **提高轮数预算**：`--max-turns` 由 14 提到 **30–40**。本轮 28 次工具调用仅完成"读文件"阶段，14 轮显然不足；
   墙钟 60 s、RSS 294 MiB，说明**超时与内存都不是瓶颈**，瓶颈是轮数。
2. **压缩读取策略**：在提示词中指定"先用 Grep 定位，只读命中的行段，禁止整文件分段通读 `index.html`"，
   并要求"读完即写结论，最多 8 次工具调用"。
3. **保留输出预算**：本轮的 1 500 字输出上限与 findings 上限未被执行（因为没走到输出阶段），保留即可。
4. **成本**：A 片单次 `$0.5815`；B、C 若同样配置预计同量级（**估算，不可靠**）。中止的无效调用成本未知。

#### 8. 局限

- 本报告只覆盖"发布 + 远程环境准备 + 两轮失败的审计执行"，**不含任何代码审计判断**。
- 审计为静态阅读（无构建、无运行、无浏览器），即便成功也不能替代人工体验验收。
- 资源数据为 2 vCPU / 978 MiB 小机上的单次观测，不可外推为容量结论或乘数。
- 成本数字取自 CLI 自报的 `totalCostUSD`，为单次观测，**不可作为预算依据**。
