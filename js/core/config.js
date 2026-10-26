// TASK-002 P1: 全局常量（plan.md §1.1 M-01、§4.11、§4.10、§5.3）。
// 本文件是唯一常量来源：其他模块不得私建常量（handoff.md §2「禁止」）。
// 后续包只追加常量，不改写本包写入的值。
(function (PB) {
  'use strict';

  var CFG = PB.config = {};

  // ---- 帧循环（M-09：固定步长 H，每帧最多 5 步，dt 上限 0.1 s）----
  CFG.H = 1 / 60;            // 固定模拟步长，秒
  CFG.MAX_STEPS = 5;         // 每帧最多执行的固定步数
  CFG.DT_MAX = 0.1;          // 单帧 dt 上限，秒；超过按此值（时间膨胀由 M-09 接受）

  // ---- 应用状态与错误（§4.11 M-13）----
  // 上下文属性与 r162 WebGLRenderer 默认值逐字一致（AMD-P0-001 / ADR-20）：
  // 不一致会导致 _alpha / stencil 等语义漂移，因此逐项写死而不是依赖默认值。
  CFG.CTX_ATTRS = {
    alpha: false,
    depth: true,
    stencil: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false
  };
  CFG.CTX_LOST_BUTTON_MS = 8000;   // ctxlost 后多久出现[重新加载]（§4.11）
  CFG.POST_RESTORE_FRAMES = 3;     // 恢复后 3 帧内再抛错 → fatal(runtime)（§4.11）
  CFG.ERROR_WINDOW_MS = 10000;     // health.errors 只保留最近 10 s（§4.11）
  CFG.ERROR_STRIKES = 3;           // 10 s 内 3 次 → fatal(runtime)（§4.11）

  // 三态 overlay 文案（§4.11 表格逐字；fatal(runtime) 前缀 + 摘要 ≤120 字符）
  CFG.OVERLAY_TEXT = {
    ctxlost: '图形上下文丢失，正在等待恢复…',
    noWebGL: '此浏览器/设备不支持 WebGL，无法显示 3D 场景。请使用新版 Chrome/Safari/Edge 或启用硬件加速。',
    vendorMissing: '缺少 vendor/three.min.js，无法启动。请确认该文件与 index.html 一起完整复制。',
    runtimePrefix: '运行出错：',
    retry: '重试',
    reload: '重新加载'
  };
  CFG.OVERLAY_ERR_MAX = 120;       // fatal(runtime) 摘要长度上限

  // ---- 色值表（M-03，sRGB 十六进制；代码中经 THREE.Color 转线性空间）----
  // P1 只需要天空色：黄昏 zenith #3B4C86 作为首帧清屏底色（P7 接入 daynight 后由 G.env 覆盖）。
  // 其余色值由各自实施包追加到本对象。
  CFG.COLORS = {
    skyZenithDusk: '#3B4C86',
    skyHorizonDusk: '#FFB26B'
  };

  // ---- DPR（§4.10 M-19）：上限取 L3 的 2.0。P14 接入分级后按等级取 min。----
  CFG.DPR_MAX_CEIL = 2.0;

  // ---- 持久化（§4.8 / M-29）：唯一 key 与 doc 初值 ----
  CFG.STORE_KEY = 'pelicanBike.v1';
  CFG.STORE_VERSION = 1;
  // muted 初值 false（UD-5）；cam 初值 0（追尾镜头）
  CFG.STORE_DEFAULT = {
    v: 1,
    ach: {},
    best: { points: 0, distance: 0 },
    settings: { muted: false, cam: 0 }
  };

  // ---- 摄像机公共量（§4.7）：near 0.1 / far 1500，P4 的 camera 使用 ----
  CFG.CAM_FAR = 1500;
  CFG.CAM_NEAR = 0.1;

  // ==== P2 追加：PR-1 投影预计值所需的常量（§1.3 / §4.2.2 / §4.7 / §1.5）====
  // 机位实现属 P4（mode 0）与 P10（其余机位），此处只有参数，没有机位逻辑。

  // 追尾镜头（§1.3 / §4.7 mode 0）
  CFG.CAM_CHASE = {
    fov: 55,
    offset: { x: 0, y: 2.4, z: 6.5 },   // 相对车（车原点 = 后轮着地点正上方的路面点）
    lookAt: { x: 0, y: 1.3, z: -4 },    // 世界系注视点（x 跟随车）
    kPos: 6,
    kLook: 10,
    near: 0.1
  };

  // 自由/环绕镜头默认值（§4.7 mode 4）：yaw 35°、pitch 18°、dist 9
  CFG.CAM_ORBIT_DEFAULT = {
    yawDeg: 35, pitchDeg: 18, dist: 9, fov: 50, near: 0.1,
    pitchMinDeg: 5, pitchMaxDeg: 75, distMin: 3, distMax: 25
  };

  // POV（§4.7 mode 3）：相机在 rig 局部 (0, 1.85, −0.47)，朝向 rig 旋转后的 −Z
  CFG.CAM_POV = { offset: { x: 0, y: 1.85, z: -0.47 }, fov: 70, near: 0.05 };

  // 天体水平方向（§1.3，已归一化）与角直径（度）
  CFG.SUN_DIR_H = { x: 0.6, y: 0, z: -0.8 };                    // normalize(0.60, 0, −0.80)
  CFG.MOON_DIR_H = { x: 0.348937, y: 0, z: -0.937146 };         // normalize(0.35, 0, −0.94)
  CFG.SUN_DIAMETER_DEG = 3.0;
  CFG.MOON_DIAMETER_DEG = 2.4;

  // 星点数（§4.2.4）
  CFG.STAR_COUNT = 3000;

  // 角色关键局部坐标（§1.5）：rig（P4）、POV（P4/P10）、捕获判定（P9）共用同一份数值
  CFG.BEAK_TIP_L = { x: 0, y: 1.663, z: -1.072 };
  CFG.HEAD_CENTER_L = { x: 0, y: 1.75, z: -0.42 };
  CFG.HELMET_TOP_Y = 1.98;

  // ==== P4 追加：地面几何、运动学、道具与 mode 0 镜头 ====

  // 横向布局（§1.1 M-01，单位 m；+X 为海侧，−Z 为前进方向，车道中心 −2.5/0/+2.5）
  CFG.LANE_X = [-2.5, 0, 2.5];
  CFG.ROAD_HALF = 4.5;                 // 沥青路面总宽 9.0 → 半宽 4.5
  CFG.EDGE_LINE_X = 3.75;              // 边线（实线）中心
  CFG.EDGE_LINE_W = 0.15;              // 边线宽
  CFG.DASH_X = 1.25;                   // 车道虚线 x = ±1.25
  CFG.DASH_LEN = 3;                    // 每段虚线长
  CFG.DASH_PERIOD = 12;                // 虚线周期
  CFG.DASH_W = 0.12;                   // 虚线宽
  CFG.DASH_COUNT = 50;                 // 每条线的段数（span = 600）
  CFG.SAND_SLOPE = 0.07;               // 沙滩坡度 −0.07·(x−4.5)
  CFG.SEA_Y = -0.8;                    // 平均海平面
  // 海岸线：4.5 + 0.8/0.07 = 15.928571428571429（§1.1 的派生常量）
  CFG.SHORE_X = CFG.ROAD_HALF + (-CFG.SEA_Y) / CFG.SAND_SLOPE;
  CFG.CLIFF_X = -16;                   // 山崖起始 x
  CFG.CLIFF_SLOPE = 0.6;               // 山崖坡度
  CFG.CLIFF_MAX = 12;                  // 山崖最大高度
  CFG.GRASS_X0 = -16;
  CFG.GRASS_X1 = -4.5;

  // 地面高度（§1.1）：山崖式 / 0 / 沙滩坡 / 海平面。两个连续函数，供 world 与 camera 共用。
  /**
   * 地面高度函数（§1.1）。
   * @param {number} x 横向坐标（米）
   * @returns {number} 该处地面高度（米）
   */
  CFG.ground = function (x) {
    if (x < CFG.CLIFF_X) {
      var h = (CFG.CLIFF_X - x) * CFG.CLIFF_SLOPE;
      return h < CFG.CLIFF_MAX ? h : CFG.CLIFF_MAX;
    }
    if (x <= CFG.ROAD_HALF) return 0;
    if (x <= CFG.SHORE_X) return -CFG.SAND_SLOPE * (x - CFG.ROAD_HALF);
    return CFG.SEA_Y;
  };

  /**
   * 相机高度下限（§1.1）：两个连续函数取 max，结果连续。
   * @param {number} x 横向坐标（米）
   * @returns {number} 相机允许的最低高度（米）
   */
  CFG.camFloor = function (x) {
    var a = CFG.ground(x) + 0.4;
    var b = CFG.SEA_Y + 0.8;
    return a > b ? a : b;
  };

  // 运动学（§4.5.2）。所有速率单位为 1/s 或 m/s²，全部写死，避免实施者自编数值。
  CFG.SIM = {
    V_MAX: 16,              // 最高速度 m/s
    BRAKE_DECEL: 9,         // 刹车减速度（M-14：优先于油门）
    THROTTLE_ACC: 4,        // 油门加速度系数：a = 4·(1 − v/16)
    DRAG_BASE: 0.4,         // 无输入时的常数阻力
    DRAG_QUAD: 0.004,       // 无输入时的速度平方阻力
    LANE_HALF: 2.5,         // 车道中心间距（§1.1）
    LANE_TIME: 0.35,        // 一次变道耗时（AC-6b：21±1 步）
    LEAN_MAX: 0.21,         // 最大倾角 rad（§3.3）
    LEAN_K: 12,             // 倾角阻尼速率
    LEAN_DX_REF: 7.1,       // 倾角参考横向速度（§4.5.2 的 dx/h/7.1）
    JUMP_V0: 5.0,           // 起跳竖直初速
    GRAVITY: 14,            // 空中重力
    JUMP_BUF: 0.12,         // 起跳缓冲窗口（§4.5.2）
    WHEELIE_MAX: 0.314,     // 抬轮最大角 rad（18°）
    WHEELIE_UP: 1.05,       // 抬轮角速度 rad/s
    WHEELIE_DOWN: 1.6,      // 回落角速度 rad/s
    WING_UP: 4,             // 展翅速率 1/s
    WING_DOWN: 3,           // 收翅速率 1/s
    CADENCE_DIV: 2.136 * 2.8, // §3.5 cadenceRpm 的分母（轮周长 × 传动比）
    CYCLE_SECONDS: 240,     // 昼夜周期（UD-2）
    HOLD_REPEAT: 0.45        // 按住方向键的重复变道间隔
  };

  // 一局种子：固定值使同一构建的会话可复现（AC-5d / AC-12e 的确定性依赖它）
  CFG.SEED = 0x2F6E2B1;

  // rig 关键局部坐标（§1.5 / §4.13 M-25）
  CFG.RIG = {
    ANCHOR_L: [{ x: -0.06, y: 1.55, z: -0.54 }, { x: 0.06, y: 1.55, z: -0.54 }],
    TORSO_L: { x: 0, y: 1.10, z: -0.30 },     // 躯干碰撞球心
    NECK_L: { x: 0, y: 1.68, z: -0.58 },      // 颈碰撞球心
    HEAD_L: { x: 0, y: 1.75, z: -0.42 }       // 头心（POV 头部可见性用）
  };

  // 道具（§1.5）：回收公式 z_i = −(mod(i·spacing − S, span)) + 20，span = count·spacing
  CFG.WORLD = {
    PROP_AHEAD: 20,          // 回收点（镜头背后 20 m）
    PALM_COUNT: 20,
    PALM_SPACING: 25,
    PALM_X: -8,
    PALM_H_BASE: 6,
    PALM_H_VAR: 2,
    LAMP_COUNT: 16,
    LAMP_SPACING: 30,
    LAMP_X: -5.0,
    LAMP_POLE_H: 6.0,
    LAMP_ARM: 1.5,
    LAMP_PATCH_R: 2.5,
    ROAD_Z_FAR: -900,
    ROAD_Z_NEAR: 80,
    GRASS_X0: -16,
    GRASS_X1: -4.5,
    CLIFF_X_END: -40,
    CLIFF_SEGMENTS: 8
  };

  // 本包新增的色值（§1.4；P1 已有天空色，其余由各自实施包追加）
  CFG.COLORS.asphalt = '#3A3D42';
  CFG.COLORS.laneDash = '#F2F2E6';
  CFG.COLORS.edgeLine = '#E8C547';
  CFG.COLORS.sandDry = '#D9C08F';
  CFG.COLORS.grass = '#6E7F45';
  CFG.COLORS.cliff = '#5E6B4A';
  CFG.COLORS.palmTrunk = '#8A6A45';
  CFG.COLORS.palmLeaf = '#2F7D3A';
  CFG.COLORS.lampPole = '#6B6F75';
  CFG.COLORS.lampHead = '#FFD58A';

  // ==== P5 追加：角色与自行车比例（§1.5 的 MUST 局部坐标；几何构造方式属 MAY）====
  // 自行车（管径 0.018；原点 = 后轮着地点的正上方路面点）
  CFG.BIKE = {
    WHEEL_R: 0.34, TIRE_R: 0.025, SPOKES: 12, TUBE_R: 0.018,
    REAR_AXLE: { x: 0, y: 0.34, z: 0 }, FRONT_AXLE: { x: 0, y: 0.34, z: -1.05 },
    BB: { x: 0, y: 0.30, z: -0.42 }, CRANK: 0.17, CRANK_X: 0.11, CHAINRING_R: 0.10, CHAINRING_X: 0.05,
    SEAT: { x: 0, y: 0.95, z: -0.22 }, SADDLE_LEN: 0.26, BAR: { x: 0, y: 1.02, z: -0.98 }, BAR_W: 0.50,
    // 车架 6 管 + 把立，每段 [ax,ay,az,bx,by,bz]，半径 TUBE_R（§1.5 逐段坐标）
    FRAME: [
      [0, 0.30, -0.42, 0, 0.88, -0.24], [0, 0.86, -0.27, 0, 0.86, -0.93], [0, 0.30, -0.42, 0, 0.70, -0.92],
      [0, 0.30, -0.42, 0, 0.34, 0], [0, 0.34, 0, 0, 0.86, -0.25], [0, 0.70, -0.92, 0, 0.34, -1.05],
      [0, 0.86, -0.93, 0, 1.02, -0.98]
    ]
  };
  // 鹈鹕（色值见 CFG.COLORS；喙尖与头心沿用 CFG.BEAK_TIP_L / CFG.HEAD_CENTER_L）
  CFG.PEL = {
    TORSO: { x: 0, y: 1.15, z: -0.38 }, TORSO_R: { x: 0.28, y: 0.36, z: 0.50 }, TORSO_RX: 25 * Math.PI / 180,
    NECK_R: 0.06, NECK: [[0, 1.40, -0.62], [0, 1.62, -0.66], [0, 1.75, -0.48]], HEAD_R: 0.16,
    BEAK_ROOT: { x: 0, y: 1.75, z: -0.58 }, BEAK_ROOT_W: 0.07, BEAK_TIP_W: 0.03,
    POUCH: { x: 0, y: 1.64, z: -0.82 }, POUCH_R: { x: 0.05, y: 0.07, z: 0.20 },
    HELMET: { x: 0, y: 1.79, z: -0.42 }, HELMET_R: 0.19,
    // 墨镜（§1.5，ADR-26）：中心 (±0.07,1.765,−0.583)，厚 0.012；八角逐个头心 ≥0.16 且 y ≤ 1.79
    GLASS: { x: 0.07, y: 1.765, z: -0.583, w: 0.07, h: 0.045, d: 0.012 },
    WING: { x: 0.27, y: 1.30, z: -0.35, len: 0.80, maxDeg: 75 },
    HIP: { x: 0.12, y: 1.00, z: -0.24 }, THIGH: 0.46, SHIN: 0.46, FOOT: 0.12, LEG_R: 0.05,
    RING: { x: 0, y: 1.55, z: -0.65, r: 0.11, tube: 0.035 },
    // 围巾碰撞体（§1.5，ADR-23）：躯干椭球与渲染躯干同参（中心/半轴/Rx 取自 TORSO/TORSO_R/TORSO_RX，
    // 外扩 TORSO_EPS 在 scarf.js 里加），参数不另存第二份；颈仍是球 r=0.07
    NECK_BALL: { x: 0, y: 1.68, z: -0.58, r: 0.07 },
    // blob 阴影：椭圆 0.7×1.6（半轴 0.35/0.80），不随 wheelie/lean 旋转（§1.5）
    SHADOW: { y: 0.01, z: -0.52, rx: 0.35, rz: 0.80, op: 0.35 }
  };
  CFG.COLORS.feather = '#F4F1EA'; CFG.COLORS.featherBack = '#9AA3A8'; CFG.COLORS.beak = '#F2A33A';
  CFG.COLORS.leg = '#E07B39'; CFG.COLORS.scarf = '#D7262E'; CFG.COLORS.helmet = '#2F6FDE';
  CFG.COLORS.helmetStripe = '#FFFFFF'; CFG.COLORS.lens = '#111114'; CFG.COLORS.lensFrame = '#1E1E22';
  CFG.COLORS.frame = '#1F7A8C'; CFG.COLORS.tire = '#1A1A1A'; CFG.COLORS.rim = '#C8CCD0';
  CFG.COLORS.moon = '#DCE6FF'; CFG.COLORS.sandWet = '#B89F70'; CFG.COLORS.foam = '#F4F8FA';
  CFG.COLORS.seaDuskDeep = '#1E4D6B'; CFG.COLORS.seaDuskShallow = '#3C8DA3';
  CFG.COLORS.seaNightDeep = '#06182B'; CFG.COLORS.seaNightShallow = '#0E3046';

  // ==== P6 追加：围巾 Verlet 参数（§4.1；AMD-P8-001 的 ADR-22/29 修订）====
  // C_Q 是二次气动阻力系数（单位 m⁻¹），校准窗口 [0.8,1.4]，初值 1.0；DAMP 仍在 [0.97,0.995] 内校准（PR-8）。
  CFG.SCARF = {
    ROWS: 13, COLS: 2, ROW_SPACING: 0.055, SUBSTEPS: 4, ITER: 6,
    DAMP: 0.985, CQ: 1.0, CQ_RANGE: [0.8, 1.4], MAX_VEL: 20, MAX_DISP: 0.05, GRAVITY: 9.8,
    MAX_PQ: 0.2, MAX_ANCHOR_DIST: 1.5,
    // 复位方向（ADR-29）：d = (0, −cos20°, +sin20°)，从竖直向下朝 +Z 偏 20°（跑步机视图坐标）
    RESET_DIR: [0, -Math.cos(20 * Math.PI / 180), Math.sin(20 * Math.PI / 180)],
    // 躯干椭球的外扩量（ADR-23）：渲染椭球分段 ≥24 时弦高 ≤0.0043，取 0.005 保证飘带不被曲面切进去
    TORSO_EPS: 0.005,
    FLUTTER_AMP: 0.9, FLUTTER_BASE_HZ: 3, FLUTTER_V_HZ: 0.35, WIND_GUST_Z: 1.5,
    NOISE_SEED_A: 3, NOISE_SEED_B: 5
  };

  // ==== P7 追加：昼夜关键帧与雾（§4.2.2 / §4.2.3 / §4.10）====
  // 每行 = [p, 太阳仰角°, 月亮仰角°, zenith, horizon, 主光色, 主光强度, 半球 sky, 半球 ground,
  //         半球强度, 星星, 路灯, specPow, specI]（§4.2.2 表格逐行；颜色为 sRGB 十六进制）
  CFG.DAY = {
    KEYS: [
      [0.00, 10, -10, '#3B4C86', '#FFB26B', '#FFB070', 2.2, '#F4A57A', '#4A3B3A', 0.6, 0, 0, 120, 1.2],
      [0.12, 2, -8, '#2B3A67', '#F28C4B', '#FF8A4A', 1.6, '#F4A57A', '#4A3B3A', 0.5, 0, 0, 90, 1.4],
      [0.20, -3, -2, '#1A2148', '#9C4A5E', '#B05A60', 0.5, '#6A4A70', '#1A1418', 0.35, 0.3, 1, 60, 0.5],
      [0.30, -12, 8, '#070D26', '#1B2A4E', '#9FB4FF', 0.30, '#1A2550', '#05060A', 0.25, 1, 1, 400, 0.6],
      [0.50, -20, 14, '#050A1E', '#14223F', '#9FB4FF', 0.38, '#1A2550', '#05060A', 0.25, 1, 1, 400, 0.7],
      [0.70, -12, 8, '#070D26', '#1B2A4E', '#9FB4FF', 0.30, '#1A2550', '#05060A', 0.25, 1, 1, 400, 0.6],
      [0.80, -8, -2, '#121A3E', '#3D2F5A', '#8090D0', 0.25, '#1A2550', '#05060A', 0.28, 0.8, 1, 200, 0.4],
      [0.90, -3, -8, '#24305E', '#6B3F6E', '#C07070', 0.6, '#6A4A70', '#1A1418', 0.35, 0.2, 0.5, 80, 0.6],
      [0.95, 3, -10, '#33457A', '#F2A65A', '#FFA060', 1.6, '#F4A57A', '#4A3B3A', 0.5, 0, 0, 90, 1.3],
      [1.00, 10, -10, '#3B4C86', '#FFB26B', '#FFB070', 2.2, '#F4A57A', '#4A3B3A', 0.6, 0, 0, 120, 1.2]
    ],
    LIGHT_MIN_ELEV_DEG: 3,        // lightDir 里太阳/月亮仰角的下限（§4.2.2）
    TRANS_SUN_MOON: [0.16, 0.24], // 太阳→月亮过渡区间
    TRANS_MOON_SUN: [0.74, 0.86], // 月亮→太阳过渡区间
    FOG_NEAR: 140,
    FOG_FAR_BY_LEVEL: [300, 360, 420, 420],  // §4.10 雾 far（L0…L3）
    LEVEL_INIT: 2                            // 初始画质等级 L2（§4.10；P14 接管）
  };
  // 天空（§4.2.4）：穹顶半径、星点半径、闪烁周期、日/月盘角半径（度，§1.3 的角直径之半）
  CFG.SKY = {
    DOME_R: 1000, STAR_R: 900, TWINKLE_PERIOD: 60, STAR_SIZE: [1.2, 2.8],
    SUN_EDGE_DEG: [1.4, 1.5], MOON_EDGE_DEG: [1.15, 1.25]
  };

  // ==== P8 追加：海面波参数与泡沫（§4.3；GLSL 与 CPU 镜像的唯一来源）====
  CFG.OCEAN = {
    X0: 13, X1: 900, Z0: -900, Z1: 80,
    // [dirX, dirZ, A(m), L(m)]：§4.3 表格四行（dir 未归一化，派生量 k/ω/Q 由 oceanmath 计算）
    WAVES: [[-0.97, 0.24, 0.30, 18], [-0.93, -0.37, 0.16, 9.5], [-0.80, 0.60, 0.08, 5.3], [-0.99, 0.10, 0.035, 2.7]],
    Q_TARGET: 0.125, GRAVITY: 9.8, EPS: 0.08, ALPHA_NEAR: 0.25, SHORE_FADE: 12, SHORE_FADE2: 30,
    NA: 1.2, TLO: 0.45, CREST_W: 0.35, FOAM_BAND: 1.8, FOAM_T: 4.5, A_SUM: 0.575,
    GRID: [48, 80, 128, 192],   // L0…L3 每边顶点数（§4.10）
    LEVEL_INIT: 2               // P8 使用 L2 的 128×128 网格
  };

  // ==== P9 追加：抓鱼（§4.4）====
  // 所有常量逐项来自 §4.4.1–§4.4.4；MISS_XT 是派生量（SHORE_X + 1.5 = 17.428571）。
  CFG.FISH = {
    AHEAD: 70, SPACING_MIN: 25, SPACING_VAR: 20, MAX: 6, HIGH_PROB: 0.2,
    HOVER_LOW: 1.55, HOVER_HIGH: 2.65, BOB_AMP: 0.18, BOB_HZ: 1.3, WEAVE_AMP: 0.15, WEAVE_HZ: 0.6,
    SPAWN_T: 1.0, SPAWN_X: 18, SPAWN_Y: -0.8, ARC_UP: 4.8,
    CATCH_X: 0.9, CATCH_Y: 0.45, CATCH_Z: 1.0,
    MISS_XT: CFG.SHORE_X + 1.5, MISS_T: 0.62, MISS_VY0: 1.5, MISS_G: 18,
    CHASE_T: 0.12, CHASE_DY: 0.05, FADE_A0: 0.15, FADE_A1: 0.4,
    REMOVE_CAUGHT: 0.4, REMOVE_MISSED: 0.8,
    STALE_Z: 3, STALE_T: 14,
    BASE: 10, AIR_BONUS: 5, WHEELIE_BONUS: 5, WHEELIE_RAD: 0.1745,
    COMBO_WINDOW: 4, COMBO_STEP: 0.25, MULT_MAX: 2.0,
    R: { x: 0.03, y: 0.05, z: 0.16 }, TAIL: { w: 0.10, h: 0.08 }
  };
  CFG.COLORS.fishBack = '#6F8FA6';
  CFG.COLORS.fishBelly = '#E9F1F5';
  CFG.COLORS.fishEye = '#111114';

  // ==== P10 追加：镜头机位与过渡（§4.7）====
  // 侧视（mode 1）：ADR-34（用户 2026-10-26 批准"海侧远景，保留海面占比"）把机位从陆侧
  // (−10, 2.2, 1.5)→(+3, 0.8, −2) 改到海侧远景：位置 (车x+23, 0.6, 车z−22)、注视点 (车x, 0.6, 车z+7)。
  // y=0.6 是**世界绝对高度**（camera.js 里 tPos.y 直接取 offset.y，不叠加车高）：
  // camFloor(x>0) = SEA_Y+0.8 = 0，故 0.6 合法且不会被避障抬升。车在 z=0（跑步机世界），
  // 因此 z 也是绝对值。dx=23 是三条车道同时满足"下半 ≥40% 海面 + 车高 ≥90 px + 整车不出画"的最小值
  // （1080p/FOV 40 实测 47.7% / 66.2% / 75.0%；dx=21 时车道 −2.5 只有 26.2%，dx=26 时车高 88.1 px）。
  // 复算脚本：tools/e2e/adr34-projection.mjs（不读应用源码，常量与 config 逐字一致）。
  CFG.CAM_SIDE = {
    offset: { x: 23, y: 0.6, z: -22 }, look: { x: 0, y: 0.6, z: 7 },
    fov: 40, k: 4, near: 0.1
  };
  // 电影（mode 2）：三个镜头各 8 s，机位内部切换 1.2 s；A/B 由 u = cineT/8 参数化。
  CFG.CAM_CINE = {
    shotSec: 8, blendSec: 1.2, k: 3, near: 0.1,
    a: { dx: 1.8, dy: 0.6, z0: -6, z1: -3.5, fov: 45 },
    b: { phi0: 120, phi1: 60, r: 9, h0: 4, h1: 7, fov: 50 },
    c: { dx: 12, dy: 1.5, dz: 2, lookDz: -1, fov: 35 }
  };
  // mode 之间的混合时长（§4.7 公共规则）
  CFG.CAM_BLEND_SEC = 0.6;
  // 自由/环绕（mode 4）交互（§4.7）：拖拽 0.3°/px、滚轮 1.1 的幂、空闲 3 s 后 6°/s 自转
  CFG.CAM_ORBIT_UI = { dragDeg: 0.3, zoomPow: 1.1, idleSec: 3, autoDeg: 6, fov: 50, k: 8, near: 0.1 };
  // POV 头部可见性滞回（§4.7）：dHead < HIDE 隐藏，> SHOW 显示
  CFG.CAM_HEAD = { hide: 0.6, show: 0.9 };
  // 避障（§4.7 公共规则）：y ≥ camFloor(x)、x ∈ [−15, 60]、追尾离车 ≥ 2.5
  CFG.CAM_LIMIT = { X0: -15, X1: 60, CHASE_MIN: 2.5 };

  // ==== P11 追加：14 个成就（§4.8 M-21）====
  // 顺序即 HUD 列表顺序；条件和提示逐项来自 §4.8。
  CFG.ACH = {
    LIST: [
      { id: 'FIRST_CATCH', name: '初次入囊', hint: '抓到第一条鱼' },
      { id: 'FISH_10', name: '渔获十条', hint: '累计抓到 10 条鱼' },
      { id: 'FISH_50', name: '海岸渔王', hint: '累计抓到 50 条鱼' },
      { id: 'COMBO_5', name: '连击五', hint: '连击达到 5' },
      { id: 'AIR_CATCH', name: '空中截击', hint: '在空中抓到鱼' },
      { id: 'WHEELIE_CATCH', name: '抬头吞鱼', hint: '抬轮 ≥10° 时抓到鱼' },
      { id: 'SPEED_DEMON', name: '风驰', hint: 'v ≥ 15 m/s 持续 3 s' },
      { id: 'DIST_1K', name: '一公里', hint: '单局骑行 1 km' },
      { id: 'DIST_5K', name: '五公里', hint: '单局骑行 5 km' },
      { id: 'NIGHT_RIDER', name: '夜骑者', hint: '夜间以 v ≥ 3 骑行 30 s' },
      { id: 'FULL_CYCLE', name: '日夜轮回', hint: '经历一次 240 s 昼夜闭环' },
      { id: 'LONG_WHEELIE', name: '独轮秀', hint: 'wheelie ≥ 0.26 且 v ≥ 4 持续 3 s' },
      { id: 'CAMERA_TOUR', name: '导演', hint: '5 个镜头各用满 1 s' },
      { id: 'AUTO_FISHER', name: '自动渔夫', hint: '自动驾驶抓到 3 条鱼' }
    ],
    SPEED_V: 15, SPEED_T: 3.0, NIGHT_V: 3, NIGHT_T: 30, WHEELIE_RAD: 0.26,
    WHEELIE_V: 4, WHEELIE_T: 3.0, CAM_T: 1.0, AP_CATCHES: 3
  };

  // ==== P12 追加：自动驾驶（§4.6）====
  CFG.AP = {
    IDLE_SEC: 6.0, DEC_T: 0.25, D_MIN: 6, D_MAX: 60, LANE_TOL: 0.35,
    T_V: [8, 10, 12, 16],
    V_LOW: 9.5, V_HIGH: 11, V_CRUISE: 8, V_DEAD: 0.5,
    TARR_LO: 0.15, TARR_HI: 0.357,
    DRIFT_T: 6, DRIFT_VAR: 4
  };

  // ==== P13 追加：音频（§4.9）====
  // 链路增益、压缩器参数、调度器节拍与 BPM 映射全部写死；音色（振荡器类型、包络）属 MAY（§2.2）。
  // 全部声音由 WebAudio 现场合成，页面不加载任何音频文件（AC-9a）。
  CFG.AUDIO = {
    MUSIC: 0.45, SFX: 0.8, AMB: 0.5, MASTER: 0.6,     // 三条总线与主增益（§4.9 链路）
    COMP_THRESH: -18, COMP_RATIO: 4,                    // DynamicsCompressor（§4.9 链路）
    NOISE_SEC: 2,                                       // 代码生成的噪声缓冲时长
    TICK_MS: 25, LOOKAHEAD: 0.12, STEPS_PER_BAR: 16,    // 调度器：25 ms 轮询、0.12 s 前瞻、16 分音符
    RESUME_LEAD: 0.05,                                  // 恢复后 nextNoteTime = currentTime + 0.05
    BPM_MIN: 72, BPM_MAX: 144, BPM_STEP: 12,            // target = clamp(2·round(rpm/2), 72, 144)；每小节变化 ≤12
    HAT_ALL_ODD_V: 8,                                   // v ≥ 8 时所有奇数步加奏 hat
    BASS_STEPS: [0, 3, 8, 11], KICK_STEPS: [0, 4, 8, 12], HAT_STEPS: [2, 6, 10, 14],
    PAD_CUT_DAY: 2200, PAD_CUT_NIGHT: 900,              // pad 低通截止 lerp(2200, 900, nightMix)
    PAD_DETUNE_CENT: 6,                                 // 两个三角波失谐 ±6 cent
    WIND_BASE_HZ: 400, WIND_PER_V_HZ: 40,               // 风：带通中心 400 + 40v
    WIND_GAIN_MAX: 0.25, WIND_GAIN_BASE: 0.02, WIND_GAIN_V2: 0.0025,  // 风：min(0.25, 0.02 + 0.0025v²)
    WAVE_HZ: 500, WAVE_GAIN: 0.08, WAVE_LFO_SEC: 4.5,   // 海浪：LP 500、增益 0.08、LFO 周期 4.5 s
    // 和弦进行 Am–F–C–G（§4.9）；每项 = [根音 Hz, 五度 Hz]
    CHORDS: [[110.00, 164.81], [87.31, 130.81], [130.81, 196.00], [98.00, 146.83]]
  };

  // ==== P14 追加：画质自适应（§4.10）====
  // 四级离散 + 滞回。窗口 1.5 s（按 rawDtMs 计），降级 2 个有效窗口、升级 5 个有效窗口。
  CFG.QUALITY = {
    WINDOW_MS: 1500, LONG_FRAME_MS: 250,
    DOWN_FPS: 45, DOWN_WINS: 2,
    UP_FPS: 57, UP_WINS: 5,
    MIN_SINCE_CHANGE_S: 2,      // 距上次任意等级变化 <2 s 的窗口丢弃
    MIN_SINCE_UP_S: 10,         // 升级要求 now − lastChangeT ≥ 10
    OSC_AFTER_S: 10,            // 升级后 10 s 内又降级 → 判为振荡
    OSC_BLOCK_S: 60,            // 振荡后 60 s 内禁止升级
    DPR: [0.75, 1.0, 1.5, 2.0],     // L0…L3 的 DPR 上限（§4.10 表格）
    STARS: [1200, 2000, 3000, 3000], // 星星 drawRange（§4.10 表格）
    COARSE_INIT: 1, FINE_INIT: 2     // 初始等级：粗指针 L1，其他 L2
  };
})(window.PB = window.PB || {});
