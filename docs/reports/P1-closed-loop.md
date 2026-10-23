# 跨机器协同验证报告（P0 + P1）

> 日期：2026-10-23
> 基线：`docs/Mac OMP + 日本 VPS Claude Code（DeepSeek）跨机器协同验证实施方案 v2.0.md`
> 结论先行：P0 约定范围通过；P1 已交付可体验页面并完成设计/实施/审计/修复闭环，独立审计为 **PASS-with-caveat**；4GB 官方规格、真实账单、代理端到端未验证。

## 1. 环境与部署（脱敏）

| 项 | 实测 |
|---|---|
| Mac | macOS Darwin 24.1.0 / arm64；OMP 18.12.3；Tern 0.9.5；OpenSSH 9.8p1 |
| VPS | Debian 11 (bullseye) x86_64，2 vCPU，978 MiB RAM |
| Swap | `/swapfile` 256 MiB + `/swapfile-omp` 1792 MiB，合计约 2 GiB，已写入 fstab |
| 磁盘 | 20 GB，剩余约 12 GB |
| Claude Code | 2.1.308，原生安装于 `devagent` 用户 `~/.local/bin/claude` |
| Git | 2.30.2（经隔离临时源安装，未改全局 APT 源，未升级系统） |
| 账号 | `devagent`，无 sudo；专用 SSH 公钥登录；`deepseek.env` 600，未被读取/回显 |
| 代理 | Trojan-Go 手动实例全程存活（观测期 PID 由 288441 变为 365811，环境自身变化）；未改动配置，未做端到端探测 |

## 2. DeepSeek 接入与 JSON/Session

- 端点配置：`https://api.deepseek.com/anthropic`，`ANTHROPIC_AUTH_TOKEN` 由启动器私有加载；模型映射 `deepseek-flash`。
- E01/E02 真实请求成功，JSON 含 `result`、`session_id`、`usage`、`modelUsage`；`is_error=false`。
- `--resume` 验证：同一 `session_id` 续接成功，零新增工具调用，上下文内容与仓库事实一致。
- `--max-turns 1` 边界：返回 `error_max_turns`，CLI 退出码 1；该分支 JSON **无 `result` 键**，消费侧必须检查 `is_error`/`subtype`。
- `num_turns` 不是 API 轮次；实测满足 `num_turns = 唯一工具调用数 + 1`。`--max-turns` 限制模型请求轮次。
- 工具白名单 `--tools Read,Glob,Grep` 可从请求体中移除 Agent/Bash/Write 等，避免后台子 Agent 截断 `.result`。

## 3. 真实分析与资源包络（实测，不外推）

| 负载 | 结果 | 峰值 RSS | 最低 MemAvailable | Swap/换页 | OOM |
|---|---|---:|---:|---|---|
| 小仓库 practiceDemo ×3 | 3/3 成功，38–45 s | 254–260 MiB | 543–549 MiB | 恒定约 1.3 MiB；si/so=0 | 0 |
| Spring Petclinic ×3 | 3/3 成功，136–183 s | 285–297 MiB | 499–512 MiB | 同上 | 0 |
| 页面设计（19 轮，35k output） | 成功，247 s | 332 MiB | 476 MiB | Δ0 | 0 |
| 全量单次审计（失败） | 360 s 超时，无结果 | 355 MiB | 441 MiB | 无持续换页 | 0 |
| 切片审计 A/B/C（有效） | 55–89 s/片 | 253–280 MiB | 517–549 MiB | 恒定 1.5 MiB | 0 |

- 系统 CPU 忙占比：切片审计均值 11%–24%，峰值 46%–64%（2 核）。
- 单进程 CPU：审计约 12%–18% 单核。
- **瓶颈是模型推理长度与任务粒度，不是 VPS 本地 CPU/内存。** 全量审计中两次推理耗时 181 s/80 s，输出触及 32k token 上限。
- 该数据只证明上述负载；不能外推并发数或更大仓库稳定性。

## 4. P1 交付物

| 文件 | 说明 |
|---|---|
| `index.html` | 单页 3D 体验，约 121 KB，直接 `file://` 打开 |
| `vendor/three.min.js` | three.js r128 UMD，本地 vendored；运行期零 CDN/网络 |
| `vendor/three.LICENSE.txt` | MIT 许可 |
| `docs/tasks/TASK-001.md` | 任务契约 |
| `docs/designs/TASK-001.md` | 远程设计 + 本地实施记录 + 资源观测 |
| `docs/reviews/TASK-001.md` | 三轮切片独立审计 + 失败证据 + 修复项 |

页面功能：鹈鹕戴头盔/墨镜/红围巾骑自行车；Verlet 围巾布料；黄昏到星空月夜；海浪与岸边碎浪；抓鱼/金鱼/连击/车篮；W/S/A/D/Space/T；14 成就；5 镜头；WebAudio 合成音效与踏频音乐；触屏；自适应画质；空闲自动驾驶。

## 5. 验证证据

- **真实浏览器**：Chrome 150，桌面 1200×1084@DPR2、移动 390×844@DPR3。
- **交互回归 22/22 PASS**：按住 W/A/D/Space/T 7 秒不触发自动驾驶，释放 5.5 秒后触发；双指油门计数；pointercancel/blur 清理；W+S 刹车优先；后台音频 suspend；停车停拍；fatal 重载；上下文丢失叠层；14 成就；5 镜头；9 个触屏按钮；画质 60→20fps 降档并恢复。
- **视觉审计**：修复侧视棕榈遮挡、移动端面板/Toast 重叠后放行；月盘、岸边泡沫、围巾高速形态均有截图证据。
- **控制台/网络**：正常路径 `console=[]`、`pageErrors=[]`；仅加载 `index.html` + `vendor/three.min.js`。
- **未验证**：音频听感、真实移动设备/Safari/Firefox、真实 GPU 极端负载。

## 6. GitHub 交接与审计

| 项 | 值 |
|---|---|
| 仓库 | `https://github.com/zhougeC/practiceDemo` |
| 分支 | `feature/TASK-001` |
| BASE_SHA | `2263425df8bd074f3c5e0d8f15e695e4f6c709e0` |
| 审计 HEAD | `90c75ce4f60457cbdcbc1afb8f8312976c833432` |
| 修复后 HEAD | `3eb78f9a504c3f6707f22d910d2983ecd1cb1378` |
| 审计方式 | VPS 新会话、detached worktree、固定 SHA、`Read/Glob/Grep`、只读 |

- 首轮全量审计 360 s 超时，无结果；失败证据保留。
- 切片 A（玩法）与 C（运行时）产出有效报告；B（渲染/物理）首次因运行器 cwd 错误失败，修复后在最终 HEAD 补审通过。
- 阻断项 F1（按住方向/跳跃/展翅键仍被自动驾驶接管）已修复；F2–F13 一并修复；本地真实浏览器回归通过。
- B 片 5 项契约 PASS，7 条非阻断 findings（近岸法线、NaN 自愈、日月方向一致性等）。
- **裁决：PASS-with-caveat**。F1–F13 的最终 HEAD 仅由本地回归验证，未做独立复审；不宣称完整独立 PASS。

## 7. 偏差、失败与反证（保留）

1. Git 安装初次失败：镜像 Bullseye 包 404；未升级系统、未改全局源，使用隔离临时源 + 固定版本安装成功。
2. P0 小仓库 S2 `.result` 仅含补充说明：后台 Explore 子 Agent 通知导致；用工具白名单移除 Agent 后连续 6 轮通过。
3. 工具集验证期间误发 1 次真实付费请求（$0.016485 估算，0 工具调用）；mock 鉴权头可能经回环发送，证据中无凭据落盘，但无法证明未发出。
4. 切片审计首次失败：14 轮预算被分段读取耗尽；改为指定行段 + 工具上限 8 次。
5. B 片首次失败：运行器未 `cd` 到工作树，8 次读取 EACCES；已修复并补审。
6. 一次无效调用：采样器路径错误导致 CLI 提前启动后被终止，结果为空、费用未知。
7. 成本均为 CLI 估算（因 `unrecognized_model` 不可靠），非 DeepSeek 平台账单；累计估算约 $7.5–8，实际需以平台记录为准。
8. 资源数字为采样与 `time -v` 观测，不是全生命周期积分；不含真实并发。

## 8. 遗留问题与 Claude Pro 技术条件

- **未满足官方 4GB RAM**：978 MiB + 2 GiB Swap 仅通过约定负载，不能承诺生产稳定。
- **真实账单未核对**；DeepSeek 峰谷价、Web Search 另计费未验证。
- **代理端到端未验证**：仅确认进程存活与 SSH 链路。
- **审计复审缺口**：F1–F13 未在最终 HEAD 做独立复审；B 片 7 条非阻断项未修。
- **音频听感、Safari/Firefox、真实移动设备**未验证。
- **Claude Pro 切换条件**：技术上 OMP→SSH→CLI→JSON→Git 接口可复用，但必须新建 `claude-pro` 启动器、清理 DeepSeek 环境变量、重新做认证/JSON/session/只读分析/资源回归；不能沿用 DeepSeek 的 PASS 结论。
- 建议：若用于生产，升级到 ≥4 GB RAM；若保持 1 GB，只做单进程、小到中等仓库的只读/设计/审计，不做构建与并发。
