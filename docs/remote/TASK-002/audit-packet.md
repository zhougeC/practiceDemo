# TASK-002 独立审计材料包（入口）

> 状态：待裁决。审计必须独立读取代码、批准计划与 ADR，不以本文件替代规范正文。
> 审计方式：新会话、只读 `Read/Glob/Grep`、固定 HEAD、不续接设计会话。

## 1. 基本事实

| 项 | 值 |
|---|---|
| 任务契约 | `docs/remote/TASK-002/task.md` |
| 批准主计划 | `docs/remote/TASK-002/plan.md` |
| 决策记录 | `docs/remote/TASK-002/adr.md` |
| 移交摘要 | `docs/remote/TASK-002/handoff.md` |
| 实施记录/未决项 | `docs/remote/TASK-002/impl-notes.md` |
| 基线 BASE_SHA | `2263425df8bd074f3c5e0d8f15e695e4f6c709e0` |
| 审计 HEAD_SHA | 以仓库当前 `HEAD` 为准（提交后为不可变完整 SHA） |
| 分支 | `feature/TASK-002-opus55` |
| 计划来源 | 远程 Claude Code，Opus 5.5 / medium；经两轮本地评审并在同一会话逐条修订 |
| 历史快照 | `design-v1/v2/v3.md`、`review-1/2/3.md`、`response-1/2.md`、`AMD-*.md`（非规范，供追溯） |

编号即契约：`M-xx`、`UD-n`、`ADR-xx`、`AC-xx`、`S-n`、`PR-n`、`P-n` 不得重新解释或改号。

## 2. 验收覆盖面

12 项用户功能均保留：鹈鹕/自行车/头盔/墨镜/红围巾；围巾布料；昼夜；海浪/碎浪；抓鱼；W/S/A/D/Space/T；14 成就；5 镜头；WebAudio 音乐随踏频；触屏；自适应画质；自动驾驶。

主计划 §6.2 给出契约 → AC → 实施包映射；§5.1 给出 P0–P16 包与允许文件；§5.3 给出截图机位与判据。

## 3. 本地已执行的验证（可复核命令）

| 命令 | 结果 |
|---|---|
| `cd tools/e2e && PW_HEADLESS=1 node app.mjs` | 退出 0；32/32 场景 PASS；`failures=[]` |
| `TASK002_OFFLINE=1 node app.mjs` | 退出 0；32/32 PASS；非 file 请求 0 |
| `TASK002_ONLY=selfcheck node app.mjs` | 271/271 PASS |
| `TASK002_ONLY=p11-ach-play` | 14/14 成就真实解锁 |
| `node tools/e2e/adr34-projection.mjs` | 海面占比 47.7 / 66.2 / 75.0%（三车道） |
| `node tools/e2e/count-lines.mjs` | 4,770 代码行（上限 5,600） |
| 构建 grep | TODO/STUB、shadowMap、castShadow、GLSL precision、RawShaderMaterial 均 0 |

证据文档：`docs/remote/TASK-002/packages/P0-execution-result.md`、`P1-P4-execution-result.md`、`P5-P8-execution-result.md`、`P5-P8-fix-execution-result.md`、`P9-P12-execution-result.md`、`P13-P16-execution-result.md`、`P16-execution-result.md`、`P9-P16-evidence-repair-execution-result.md`。

关键实测：WebGL2 + 真实 WebGL1 回退均渲染；console error/pageerror 0（除故意缺失 vendor 的预期资源错误，按精确条数登记）；30 秒级视频存在；音频 BPM 72→144 约 14.5 秒；画质降档约 4.6 秒、恢复约 10.5 秒；触屏 9 按钮多点计数；视觉审计已由本地 ui-vision 逐像素复核并放行关键截图。

## 4. 审计时必须独立的假设

以下为本地结论，审计不得直接采信，需从代码与证据复核：

1. 围巾二次阻力、椭球碰撞、静止姿态读法符合 ADR-22/23/24/29；边缘双吸引子风险仅记录。
2. 漏鱼轨迹在移除前越岸落海，且实际渲染坐标与判定同源。
3. 自动驾驶对所有可信输入同帧退出，已锁定高空鱼不会在起跳前被候选过滤丢弃。
4. 14 个成就条件唯一、幂等、刷新持久化且存储拒绝时降级。
5. 5 个镜头切换不出现“无头鹈鹕”，POV 喙根不被近平面裁剪。
6. 画质控制使用原始帧间隔，降档/恢复与滞回满足 AC-11 时间序列。
7. 音频仅在用户手势后启动，隐藏时挂起，BPM 随踏频。
8. 离线 `file://` 无外部请求；WebGL1 分支与 `ANGLE_instanced_arrays` 能力路径成立。
9. S3a 海侧机位实际像素下半海面 ≥40%，车辆居中可见；S6/S12 取证相位无道具遮挡。

## 5. 明确未验证 / 限制

- **音频听感**：已测状态与 BPM 调度，未做人耳听感验证；录屏文件无音轨。
- **真实硬件**：PR-3 无 `ANGLE_instanced_arrays` 设备、PR-5 移动端 mediump、PR-6 真机多点、PR-7 iOS `file://` 存储/音频、PR-9 真实 GPU 性能，均 PENDING。
- **GC 停顿 <5 ms**（M-31）未做 Performance 录制。
- **AC-2d 10 分钟**在最终 P9–P16 批次未重跑；上一次在 P5–P8 修复后参数下完成。
- **夜间骑手可读性**：计划未设阈值，仍为剪影；不得据此判 PASS/FAIL。
- **DeepSeek/Pro 订阅账单**不在本审计范围。

## 6. 历史偏差与失败证据（保留）

- P0 首次 `--disable-es3-apis` 未关闭 WebGL2；改按能力断言与 `--disable-webgl2`，ADR-20。
- 跳跃逐字欧拉序无法满足 AC-6c；改等加速积分，ADR-21。
- 道具矩阵 Float32 不能承载 1e-6；改为真实 GPU 缓冲 + ULP 分层判据，删除旁路镜像。
- 围巾线性阻力峰值越界且被躯干吞没；改二次阻力 + 同参椭球，ADR-22/23。
- 墨镜在追尾机位被头部遮挡；改几何并迁到 S4a 差分，ADR-26/27。
- 侧视机位三项判据互斥；拆 S3a/S3b 并改海侧机位，ADR-33/34。
- 调试捕获框曾错误锚在角色原点；已修为喙尖，判定逻辑未变。
- 一次实现轮曾把“父任务上下文”误写成用户原话；已更正为实际选择文本并保留更正记录。

## 7. 审计输出要求

1. 先建立“验收标准 → 设计决策 → 代码位置 → 证据”矩阵。
2. 逐项给 PASS / FAIL / UNVERIFIED，并给文件:行号。
3. 输出 findings：严重度、文件:行号、复现路径、消费者影响、修复建议。
4. 输出**假设队列**：假设、依据、预测、本地验证方法、置信度；不得把假设写成结论。
5. 明确“审计不等于运行测试”；截图只能作为参考证据。
6. 重点检查：输入/指针/失焦/隐藏、自动驾驶仲裁、鱼状态迁移、布料稳定性、资源生命周期、错误恢复、离线/WebGL1、成就与存储、音频手势与挂起、画质时序。

## 8. 关键截图（私有证据，供审计参考）

审计环境可读取的截图清单与 SHA 由执行方另行提供；对应状态、尺寸、提交 SHA 见清单。截图不替代运行时结论。
