# 遥测更正 1：CPU 指标标错与方向反转（TASK-002 设计 v1）

> 状态：**更正（更正对象保留原文，不覆盖）**。本文件不新增任何模型调用、不重跑任务；
> 只对已落盘的原始样本（`~/.evidence/task-002/sample.csv`，539 行）做重新核算与装置复现。
> 更正范围：`design-v1.md` 头部"资源包络"中的 CPU 两行；其余数字（RSS、MemAvailable、Swap、OOM、代理、磁盘、
> CLI 退出码、JSON 状态、模型/effort、token 用量）不受影响，见 §6。

---

## 1. 原结论（保留原文）

`design-v1.md` 与交付消息中曾写：

> 系统 CPU 忙占比（2 核） | 均值 95.8%，峰值 98.5%
>
> 说明：CPU 忙占比接近饱和是**系统级**指标（含 SSH/采样器/CLI 与推理等待），
> `/usr/bin/time` 记录 CLI 自身 user 11.82 s + sys 2.28 s（2% CPU），说明瓶颈在网络/推理等待而非本地算力。

**该两行判定为无效（INVALID）**：数值本身不是"忙占比"，"接近饱和"的推论不成立。
"瓶颈在推理等待"的最终判断仍然成立，但当时给出的理由链是错的（见 §3、§4）。

## 2. 根因（采样器 v1 代码缺陷，非数据缺失）

采样器 v1 的 CPU 计算（`~/.evidence/task-002/sampler.sh` 原版）：

```bash
read -r prev_idle prev_total < <(awk '/^cpu /{i=$2+$3+$4+$6+$7+$8; print i, i+$5}' /proc/stat)
...
busy=$(awk -v d="$di" -v t="$dt" 'BEGIN{ ... printf "%.1f", 100*(t-d)/t }')
```

`/proc/stat` 的 `cpu` 行字段是 `user nice system idle iowait irq softirq steal guest guest_nice`。于是：

- `i = user+nice+system+iowait+irq+softirq` —— 这是**忙**时间，不是空闲时间，变量却命名为 `i`/`idle`；
- `total = i + idle` —— 总数正确（但漏了 `steal`，本机为 0，可忽略）；
- 打印的 `100*(t-d)/t` = `100*(total − busy)/total` = **空闲百分比**。

所以 `cpu_busy_pct` 这一列的真实含义是 **idle%**，且变量名与方向同时反了。
`load1=0.20` 与 `CLI 自身 2% CPU` 与"95.8% 忙"在物理上互斥，这是发现该缺陷的线索。

v1 的第二个缺陷：CSV 只保存派生值，没有保存 `/proc/stat` 原始计数器，因此无法逐样本重算——
只能做"取反"这一层还原（`busy = 100 − recorded`）。`iowait` 被算进"忙"，本机无 IO 压力，影响可忽略。

## 3. 用同一份原始样本重算（未重跑任务）

| 指标（539 样本 / 560 s） | v1 报告值（错误标签） | 更正后 |
|---|---|---|
| 系统 CPU **忙** 均值（2 核） | 95.8%（实为 idle） | **4.23%** |
| 中位数 | 96.20（idle） | **3.80%** 忙 |
| p95 | 97.60（idle） | **6.70%** 忙 |
| 峰值 | 98.50（实为峰值 idle = 最低忙 1.50%） | **68.0%**（单样本尖峰，见下） |
| 最低 | 32.00（实为 68% 忙的那一秒） | **1.50%** |

分布形状：539 个样本中仅 **8 个** >10% 忙、**2 个** >25% 忙。异常样本：

| 时刻（UTC） | 忙% | 备注 |
|---|---|---|
| 15:50:04 | 21.7 | 会话首样本（CLI 启动、292 MB 二进制加载、页错误） |
| 15:50:08 | 10.6 | 启动余波 |
| 15:54:33 | 19.7 | 未归因 |
| 15:56:20 / 21 / 22 | 31.4 / **68.0** / 22.0 | 连续 3 秒尖峰，原因未验证（可能是 GC/内存整理或上下文处理） |
| 15:56:44 | 10.3 | 未归因 |
| 15:59:24 | 15.8 | 收尾（快照、JSON 落盘、采样器退出） |

## 4. 观测者开销与独立交叉验证（本次只做装置校准，无模型调用）

1. **采样器自身成本**：单独运行 v1 采样器 10 s，`/usr/bin/time -v` 记录 user 0.26 s + sys 0.24 s
   = 0.50 CPU·s / 10 s ≈ 单核 5%，折合 2 核总量约 **2.0%–2.5%**。
   也就是说 4.23% 的系统忙占比里，约一半是**采样器自己**（每秒 fork `awk/ps/pgrep/date`）。
2. **CLI 自身**：14.10 CPU·s / 560 s / 2 核 ≈ **1.26%**。
3. **独立交叉验证（更正后的 v2 采样器）**：同一 10 s 窗口内，外部脚本直接读 `/proc/stat` 两次得到
   **4.3%**，v2 采样器逐秒均值 **4.00%**，一致；v2 输出 `busy+idle=100`、原始计数器可复算。

**更正后的结论**：该次调用期间 2 核系统 CPU 忙占比约 **4%**，其中约 2 个百分点来自采样器自身，
CLI 实际占用约 **1.3%**；**CPU 远未饱和**，不存在本地算力瓶颈。`load1` 峰值 0.20 与"低 CPU 忙占比"
并不矛盾：load 计入 D 状态（不可中断等待，如网络/页缓存）并按 1 分钟指数平均，且包含进程启动尖峰。
**瓶颈仍是模型推理/网络等待**（`duration_api_ms=560048` 占 wall 的 99.8%），这一结论不变，但依据应是
`duration_api_ms` 与 `time -v` 的 CPU 时间，而不是被标错的 busy%。

## 5. SSH 客户端挂住：机制未证实（UNVERIFIED），不归因于采样器

事实（来自已落盘文件，非推测）：

- 远程脚本在 `15:59:24Z` 完成：`post.txt` 与 `DONE` 之前的最后写入均为该时刻，`sample.csv` 最后一行为 15:59:24，
  之后不再增长；`time.txt` 记录 CLI `Exit status: 0`；
- `16:00:30` 在远端 `ps` 中已无 `claude`/`node`/`sampler`/`timeout` 进程；后续 SSH 命令均正常返回；
- 本地 SSH 客户端一直挂到本地 900 s 上限被杀，**传输层退出码未观测**。

装置复现（本次，无模型调用）：

| 实验 | 结果 |
|---|---|
| `ssh host 'echo hi'`（对照） | 立即返回，exit 0 |
| `ssh host 'sleep 30 & echo started'`（后台子进程继承 stdout） | **挂住**，8 s 上限被 `timeout` 杀掉，exit 124 |
| 复刻 run.sh 的采样器模式（后台采样器 + `touch stop` + `wait`） | **正常返回**，exit 0，`script_done` |

结论：**"后台子进程继承会话 stdout 会拖住 SSH"这一类缺陷在本机真实存在**，但"采样器是本次挂住的元凶"
**未被证据支持**——采样器在同一模式下能干净退出，且事后无残留进程。剩余可能（CLI 子树残留句柄、
客户端作业/管道状态）**无法用现有遥测区分**，标记 UNVERIFIED，不写成结论。

对交付的影响：**无**。结果完整（`subtype=success`、`is_error=false`、`stop_reason=end_turn`、
JSON 可解析、正文与 `.result` 字节一致），只是"SSH 退出码"这一项按未观测记录。

## 6. 未受影响的结论（仍有效）

| 项 | 状态 |
|---|---|
| CLI 进程树峰值 RSS 343,892 kB | 有效（直接来自 `/proc/<pid>/stat` 第 24 字段求和） |
| 最低 MemAvailable 467,504 kB | 有效 |
| Swap：`SwapFree` 恒 2,095,596 kB；`pswpout` 289→295；`oom_kill=0` | 有效 |
| 代理 PID 469341 前后存活；磁盘 40% 不变 | 有效 |
| CLI 退出码 0、`duration_ms`、token 用量、模型/effort | 有效（来自 `time -v` 与 `out.json`） |
| SSH 传输层退出码 | 未观测（不变） |
| "瓶颈在推理/网络等待" | 结论成立，依据改为 `duration_api_ms`/CPU 时间 |

## 7. 装置修复（仅改本地脚本，未重跑、未上传到旧证据目录）

`~/.evidence/task-002/sampler.sh`（v2）：

- `idle = idle + iowait`，`total = user+nice+system+idle+iowait+irq+softirq+steal`（排除 `guest/guest_nice`，它们在 `user/nice` 内）；
- 同时输出 `cpu_busy_pct`、`cpu_idle_pct`、`stat_total_jiffies`、`stat_idle_jiffies`（原始计数器，事后可复算）；
- 已验证：`busy+idle=100`，与外部独立 `/proc/stat` 计算一致（§4.3）。

`~/.evidence/task-002/run.sh`（v2）：

- 采样器改为 `setsid ... >> sampler.log 2>&1 < /dev/null &`，**不再继承 SSH 会话的 stdout/stderr**；
- CLI 仍保持 stdin/stdout/stderr 全部重定向到文件；
- 结束时写 `DONE` 哨兵（`rc`、`ts`、`out_sha256`、`wall_s`），即使通道异常也能从文件确认远程已结束及其退出码；
- 调用方约定：`ssh -n ...`，本地 `timeout` 上限须大于远程 `timeout` 上限，并单独记录客户端退出码。

以上修复供**下一次**（`--resume` 设计 v2）使用；本次调用不重试。
