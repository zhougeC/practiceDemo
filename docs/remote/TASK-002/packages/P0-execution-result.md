# TASK-002 P0 执行结果（`packages/P0-execution-result.md`）

> 任务书：`packages/P0.md`（派生自 `plan.md` §5.1 P0 行 / §5.7 / PR-2 / PR-3）。
> 结论一句话：**P0 交付物全部产出；PR-2 PASS；PR-3 能力路径 PASS（按 `AMD-P0-001` / ADR-20 的新构造重跑：默认 WebGL2 与 `--disable-webgl2` 两场景 2/2 PASS，两场景 console error = 0、pageerror = 0、非 file 请求 = 0）；PR-3 设备支路仍为 PENDING-USER-HARDWARE（P16 出口，用户真机），未记为 PASS。** 未提交、未推送。
>
> **2026-10-25 更新（AMD-P0-001 重跑）**：`tools/three-smoke.html` 与 `tools/e2e/run.mjs` 已按 `AMD-P0-001` §9 改造并重跑，退出码 **0**、2/2 PASS；旧构造下的 FAIL 读数与 2 条 `console.error` 作为历史证据保留（`~/.evidence/.../P0/rerun/`），未改写为 PASS。

## 1. ChangedFiles

| 文件 | 字节 | sha256 | 说明 |
|---|---|---|---|
| `tools/vendor-three.sh` | 3,544 | `2f68404ee158af8fec1f8d12b456ce024383f72d1dd11338366a70b8eadaa30c` | 构建脚本：`npm ci` + §5.7 逐字 esbuild 命令 + 门禁 + `VERSION.txt` |
| `tools/vendor/package.json` | 277 | `e6304d9446782dddcdb02407c030ab4bb3cc36827f9ffa0613c3f7323221c898` | `three 0.162.0` / `esbuild 0.24.0`（精确版本） |
| `tools/vendor/package-lock.json` | 12,706 | `e2082dede596acac72811edb528e8a386b3f0bf5c0699d3e30d845d4b31bc4a5` | 锁文件（lockfileVersion 3） |
| `tools/three-smoke.html` | 3,014 | `18ea2fd7550fb7d55ae183de2aaaf3b0ef77894f4a2262804962e25861f7f3d9` | 冒烟页（**40 行，未超 P0 行数上限**）；按 `AMD-P0-001` §9 第 1 条改为 `CTX_ATTRS` 预创建上下文（`webgl2 → webgl → experimental-webgl`）再传 `WebGLRenderer({canvas, context})`，新增读数 `glIsWebGL2Context` |
| `tools/e2e/package.json` | 256 | `c07454be8785be32b4576dafca7a6addd110c45d1f04e76859057f808f400c18` | `playwright 1.48.2`（devDependency） |
| `tools/e2e/package-lock.json` | 1,659 | `8fe6e016cea55900bebc42ae8734f651d87596eea60b6a051593b89df584b759` | 锁文件（lockfileVersion 3） |
| `tools/e2e/run.mjs` | 7,865 | `b28d7f400eee959d6f2f5e3d35c48239a7e1b5ba7bbc18e056f8d0ac56c55efc` | 浏览器门禁执行器（逐场景启动浏览器；`AMD-P0-001` §9 第 2 条：场景收敛为默认 + `--disable-webgl2` 两条，删除 `threeFallbackErrors` 分类，断言回到 `consoleErrors===[]` 且 `pageErrors===[]`，warning 只记录） |
| `vendor/three.min.js` | 671,847 | `bd869f42b68296319769db683efd6c7a6f6249f35f3d39cd3bd09e9cdc7c20e7` | 构建产物（IIFE 全局 `THREE`） |
| `vendor/three.LICENSE` | 1,081 | `4c40a1ef62450b857c3b2aaf294936304cd552d965fbcd9d32d4c5bcf4ba4454` | 源自 `node_modules/three/LICENSE` |
| `vendor/VERSION.txt` | 684 | `7673393bfa6a0b25ae7f9fef8a95a6ac97f26e7c122a28cceb2a3d8cbc70996d` | 版本/哈希/命令记录 |
| `docs/remote/TASK-002/plan.md` | 97,547 | `4c272bda…`（正文 `4771b9b4…` 不变） | **仅元数据**：状态 → APPROVED + 批准记录 |
| `docs/remote/TASK-002/adr.md` | 6,688 | `5d6ddec3…` | **仅元数据**：批准状态矩阵 |
| `docs/remote/TASK-002/handoff.md` | 10,648 | `81a92175…` | **仅元数据**：状态、PR 执行状态 |
| `docs/remote/TASK-002/README.md` | 18,964 | `8b6acd6f…` | **仅元数据**：阶段表、哈希、P0 验证 |
| `docs/remote/TASK-002/packages/P0.md` | 5,507 | `277e17d5f43480c5edcd2f8d50976a95b2606d90bfd856c98a1a89dcdf0b097d` | P0 任务书（新增） |
| `docs/remote/TASK-002/packages/P0-execution-result.md` | 本文件 | — | 执行结果（新增） |
| `docs/remote/TASK-002/impl-notes.md` | 14,324 | `77cfba36…` | 决策/未知项/读数（新增，§5.6） |

未跟踪但不入交付：`tools/vendor/node_modules/`、`tools/e2e/node_modules/`（构建期依赖，§5.7 明确不提交）。

## 2. AppliedChanges

1. **批准元数据**：`plan.md` / `adr.md` / `handoff.md` / `README.md` 的 pending → **APPROVED（2026-10-25，用户原话「批准计划，可以开始实施」）**；记录批准前 plan sha256、规范性正文 sha256、元数据哈希链（`impl-notes.md` §A）。**规范性正文逐字节未改**（复核哈希一致）。
2. **构建锁**：新增 `tools/vendor/package.json` + lock、`tools/vendor-three.sh`；脚本按 §5.7 逐字执行 `npm ci` 与 esbuild 命令，并在脚本内强制体积/IIFE/sourcemap 门禁。
3. **vendor 产物**：`vendor/three.min.js`（671,847 B）、`vendor/three.LICENSE`、`vendor/VERSION.txt`（three/esbuild/node 版本、输入输出 sha256、字节数、完整命令）。
4. **冒烟页**：`tools/three-smoke.html`（40 行），`file://` 相对引用 `../vendor/three.min.js`，按 §4.11 预创建上下文（`CTX_ATTRS` 逐字相同）后传 `WebGLRenderer({canvas, context})`，渲染立方体并回读真实像素、三角面数、WebGL 能力。
5. **浏览器门禁**：`tools/e2e/package.json` + lock、`tools/e2e/run.mjs`；逐场景独立启动浏览器（进程级 flag 必需），场景为「默认 WebGL2」+「`--disable-webgl2`」，断言能力读数（ADR-20），Console 判据为 error/pageerror 均为 0（无白名单），warning 只记录，统计请求并写 JSON 报告。
6. **文档**：`packages/P0.md`（任务书）、`impl-notes.md`（决策/`Q-01`/`Q-02`/读数/证据）、本执行结果。

## 3. Verification

### 3.1 构建（PR-2，`[build]` §5.7 全部）

| 命令 | 真实退出码 | 结果 |
|---|---|---|
| `bash tools/vendor-three.sh` | **0** | three 0.162.0 / esbuild 0.24.0 / node v18.19.0；输出 671,847 B ≤ 819,200 B；`sourceMappingURL`=0；首 10 字节 `var THREE=`；顶层 `import`/`export`=0；动态 `import(`=0 |
| `stat -f%z vendor/three.min.js` | 0 | `671847` |
| `grep -c sourceMappingURL vendor/three.min.js` | 0（grep 无匹配） | `0` |
| `head -c 10 vendor/three.min.js` | 0 | `var THREE=` |
| `grep -cE '^(import|export)[ {*]' vendor/three.min.js` | 0（grep 无匹配） | `0` |
| `shasum -a 256 vendor/three.LICENSE tools/vendor/node_modules/three/LICENSE` | 0 | 两者均 `4c40a1ef…`（逐字节一致） |
| `cat vendor/VERSION.txt` | 0 | 必填项齐全（见 `impl-notes.md` §C-1） |

### 3.2 浏览器（PR-2 / PR-3，`[browser]`）——AMD-P0-001 重跑（**当前有效证据**）

命令：`cd tools/e2e && node run.mjs`（headed；Chromium **130.0.6723.31**；macOS 15.1；Apple M4 Pro；ANGLE Metal）。**真实退出码：0**，2/2 PASS。日志 `~/.evidence/task-002/implementation/P0/logs/p0-rerun.log`，报告 `~/.evidence/task-002/implementation/P0/p0-browser-gates.json`。

| 场景 | 判定 | 关键读数 |
|---|---|---|
| `webgl2-default` | **PASS** | `REVISION=162`、`isWebGL2=true`、`glIsWebGL2Context=true`、`WebGL 2.0 (OpenGL ES 3.0 Chromium)`、12 三角面、85,547 非背景像素、25 色、非 file 请求 **0**、console error **0**、pageerror **0**、warning 0 |
| `webgl1-disable-webgl2` | **PASS** | `isWebGL2=false`、`glIsWebGL2Context=false`、`WebGL 1.0 (OpenGL ES 2.0 Chromium)`、`ANGLE_instanced_arrays`：`gl.getExtension=true` / `three.extensions.has=true`、12 三角面、85,547 px、非 file 请求 0、console error **0**、pageerror **0**、warning **1** |

- **Console 判据**（`plan.md` §5.4 第 2 条）：两场景 error = 0 且 pageerror = 0，**不设白名单、不做过滤**。
- **warning 逐条记录**：`webgl1-disable-webgl2` 1 条 —— `THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163.`（来源 `vendor/three.min.js`，r162 构造期弃用提示，场景 = 真实 WebGL1 回退）。属 `plan.md` §4.11 第 3 条**预期**的 1 条 WebGL1 弃用 warning，不是 error，也不是新 warning 类别，无需追加 `Q-nn`。
- **PR-3 能力断言**（`plan.md` §5.7 / ADR-20，只看能力读数不看 flag 名）：`isWebGL2 === false`、`gl.getParameter(gl.VERSION)` 以 `WebGL 1.0` 开头、`!(gl instanceof WebGL2RenderingContext)`、三角面 = 12、非背景像素 > 0 —— 全部成立。
- 截图：`screens/webgl2-default.png`、`screens/webgl1-disable-webgl2.png`（1280×720，sha256 `2aae66d529b4d580…`）。**截图仅作证据，视觉判定留给 `ui-vision`，不自评。**
- 旧构造读数（含 `--disable-es3-apis` FAIL 与 2 条 three 回退 error）保留在 `rerun/p0-browser-gates.pre-rerun.json` 与 `rerun/screens-pre-rerun/`，**未改写为 PASS**；历史读数见 §3.2b。

### 3.2b 浏览器（历史读数，旧构造，已被 §3.2 取代）

真实退出码：**1**（因字面 flag 场景失败）。

| 场景 | 判定 | 关键读数 |
|---|---|---|
| `webgl2-default` | PASS | `isWebGL2=true`、12 三角面、85,547 px、非 file 请求 0、console error 0 |
| `webgl1-disable-es3-apis`（§5.7 字面） | **FAIL → Q-01** | `isWebGL2=true`（flag 未生效） |
| `webgl1-disable-webgl2`（补充） | PASS | `isWebGL2=false`、`WebGL 1.0`、`ANGLE_instanced_arrays=true`、**console error 2**（three 回退消息，`Q-02`） |
| `webgl1-noangle-simulation`（**SIMULATION**） | PASS（模拟） | 扩展屏蔽后两者均 false，页面仍渲染；**不作为硬件缺失证明** |

- 资源：real 3.88 s / user 2.85 s / sys 1.71 s，最大 RSS 212,598,784 B（`/usr/bin/time -l`）。

### 3.3 离线（§5.7 离线验证的 P0 等价物）

| 命令 | 真实退出码 | 结果 |
|---|---|---|
| `mv tools/vendor/node_modules /tmp/... && TASK002_ONLY=webgl2-default TASK002_OFFLINE=1 node run.mjs && mv 回来` | **0** | 页面在无 `vendor/node_modules`、`context.setOffline(true)` 下仍渲染；`REVISION=162`；非 file 请求 0；Console 0 错误 |

未做：删除 `tools/e2e/node_modules` 后的手工双击（该目录是门禁自身的运行依赖，删除后无法程序化取证）——留待 P16/交付前人工复核。

### 3.4 失败与未通过项（不得表述为 PASS）

1. **`--disable-es3-apis` 字面门禁 = FAIL（历史，已由 `AMD-P0-001` 以方法替换关闭，非放宽）**：实测 Chromium 130 仍为 WebGL2 → **`Q-01`**；按 ADR-20 改判据为 `--disable-webgl2` + 能力断言。该场景已从执行器移除，FAIL 读数保留在 `rerun/`，**未改写为 PASS**。
2. **PR-3 "无 `ANGLE_instanced_arrays`" 真实设备支路 = NOTVERIFIED / PENDING-USER-HARDWARE**：只有能力屏蔽模拟，未取得真实缺失设备（H-4）；`AMD-P0-001` 改挂 **P16 出口**，不阻塞 P1。
3. **PR-3 移动端 WebGL1 真实硬件 = NOTVERIFIED / PENDING-USER-HARDWARE**（P16 出口）。
4. **`Q-02` 已关闭**：`AMD-P0-001` 规定预创建上下文；本轮实测两场景 console error 均为 0，不再需要任何日志过滤。

### 3.5 消费者检查

- `tools/three-smoke.html` → `../vendor/three.min.js`：`file://` 下加载成功（浏览器场景全部 `REVISION=162`）。
- `tools/e2e/run.mjs` → `playwright` 1.48.2：lock 安装成功，Chromium 130.0.6723.31 可用。
- `vendor/*` 暂无应用页面消费者（`index.html` 属 P1）；P0 未创建任何应用页面，未出现"占位/no-op"。

### 3.6 边界核对

- `git status`（隔离工作树）：仅 `docs/`、`tools/`、`vendor/` 未跟踪；无 Java/pom/`.gitignore`/系统配置改动。
- TASK-001 工作树 `/Applications/WorkStudio/GitHub/claude-test`：`feature/TASK-001` @ `c78ba01`，`git status` 与开工前一致。
- **无** `git commit` / `git push`；**无**远程模型/订阅调用；**无** VPS 操作。

## 4. NotDone

1. **P1–P16**：P0 阶段未开始（`index.html`、`js/`、`css/` 均未创建）；本轮 P0 门禁通过后按 `plan.md` §5.1 顺序进入 P1。
2. **PR-1、PR-4…PR-12**：P0 阶段未执行（PR-1 挂 P2 出口、其余由所属包任务书指定）。
3. **PR-3 设备支路（无 `ANGLE_instanced_arrays` 的真实 WebGL1、移动端 WebGL1）**：NOTVERIFIED / PENDING-USER-HARDWARE（P16 出口，用户真机）。
4. **真机**（PR-5/PR-6/PR-7）：未执行。
5. **视觉判定**：未做；截图留给 `ui-vision` 复核，不自评。
6. **`git commit` / `git push`**：按指令未执行。
7. **`tools/*/node_modules` 删除**：保留以便复跑门禁；最终提交前删除（§5.7 不提交 `node_modules`）。
8. **`Q-01` / `Q-02`**：已由 `AMD-P0-001` 裁决并应用；无待裁决项阻塞 P1。

## 5. AdditionalChanges

- 无允许清单之外的业务代码改动。
- 未改 `.gitignore`（不在 P0 允许清单内）；因此 `tools/*/node_modules` 目前以未跟踪状态存在，提交前必须删除或排除。
- 未改 `plan.md` 的 M/AC/正文；未降级任何依赖版本；未新增全局配置。
