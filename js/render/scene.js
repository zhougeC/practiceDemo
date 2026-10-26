// TASK-002 P1: 渲染器与场景（plan.md §4.11 检测顺序、§3.5 scene 签名、§4.10 DPR）。
// 只负责：按 §4.11 预创建 WebGL 上下文 → 建 WebGLRenderer → 建空场景与清屏色。
// 本包不建任何几何体、灯光或相机（属 P4/P5/P7 等包）；renderer 与 scene 是单例，boot 时建一次。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var S = PB.scene = {};

  var renderer = null;
  var scene = null;
  var canvasEl = null;
  var glVersion = 0;
  // P14 追加：当前画质等级允许的 DPR 上限（初始为 L2 的 1.5；applyQuality 会改写）
  var dprCap = CFG.QUALITY ? CFG.QUALITY.DPR[CFG.QUALITY.FINE_INIT] : CFG.DPR_MAX_CEIL;
  var resMql = null, resDpr = 0;

  /**
   * 创建唯一 WebGL 上下文。按 plan.md §4.11 的顺序尝试 webgl2 → webgl → experimental-webgl，
   * 属性用 CFG.CTX_ATTRS（与 r162 默认逐字一致，ADR-20）。
   * 应用自己建上下文而不用 three 内部回退，是因为 r162 内部回退会在 webglcontextcreationerror
   * 监听器里打印 error 级日志（AMD-P0-001），而 §5.4 第 2 条禁止任何 error 级消息。
   *
   * @param {HTMLCanvasElement} canvas 目标画布
   * @returns {WebGLRenderingContext|WebGL2RenderingContext} 第一个非 null 的上下文
   * @throws {Error} name='NoWebGLError' 当三种上下文全部为 null
   */
  function createContext(canvas) {
    var attrs = CFG.CTX_ATTRS;
    // 步骤1：按 webgl2 → webgl → experimental-webgl 顺序取第一个可用上下文。
    // 顺序即回退优先级（UD-1）；三个都为 null 时没有可用的图形能力，抛 NoWebGLError 交给 main 转 fatal(noWebGL)。
    var gl = canvas.getContext('webgl2', attrs) ||
             canvas.getContext('webgl', attrs) ||
             canvas.getContext('experimental-webgl', attrs);
    if (!gl) {
      var err = new Error('no WebGL context available (webgl2/webgl/experimental-webgl all null)');
      err.name = 'NoWebGLError';
      throw err;
    }
    return gl;
  }

  /**
   * 建 renderer 并判定 GL 版本。判定口径见 §4.11 第 3 条：
   * WebGL2 要求 instanceof 与 capabilities.isWebGL2 同时为真；只有 WebGL1 时必须有
   * ANGLE_instanced_arrays（否则 fatal(noWebGL)）；两者矛盾视为运行时错误。
   *
   * @param {HTMLCanvasElement} canvas 目标画布
   * @param {WebGLRenderingContext} gl 预创建的上下文
   * @returns {THREE.WebGLRenderer} 已配置好的渲染器
   * @throws {Error} name='NoWebGLError'（构造失败 / WebGL1 缺 ANGLE_instanced_arrays）
   * @throws {Error} name='GLVersionMismatch'（instanceof 与 isWebGL2 矛盾）
   */
  function createRenderer(canvas, gl) {
    var r;
    try {
      // 步骤2：把预创建上下文交给 three。传 context 时 r162 跳过内部 getContext，因此不产生回退 error。
      r = new THREE.WebGLRenderer({ canvas: canvas, context: gl, antialias: true });
    } catch (e) {
      // 步骤3：构造抛错（驱动/上下文不可用）按 noWebGL 处理，不降级、不重试。
      var err = new Error('WebGLRenderer construction failed: ' + String((e && e.message) || e));
      err.name = 'NoWebGLError';
      throw err;
    }

    // 步骤4：判定真实版本。instanceof 与 capabilities 必须一致，否则语义不可信（§4.11 最后一条）。
    var isWebGL2Ctx = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    var isWebGL2Cap = r.capabilities.isWebGL2 === true;
    if (isWebGL2Ctx !== isWebGL2Cap) {
      var mismatch = new Error('GL version mismatch: instanceof=' + isWebGL2Ctx + ' capabilities.isWebGL2=' + isWebGL2Cap);
      mismatch.name = 'GLVersionMismatch';
      throw mismatch;
    }

    if (isWebGL2Cap) {
      glVersion = 2;
    } else {
      // 步骤5：只有 WebGL1 时，r162 的实例化渲染依赖 ANGLE_instanced_arrays；
      // 缺失则能力不足，按 §4.11 直接 fatal(noWebGL)，不做"降级渲染"。
      if (!r.extensions.has('ANGLE_instanced_arrays')) {
        var noInst = new Error('WebGL1 without ANGLE_instanced_arrays');
        noInst.name = 'NoWebGLError';
        throw noInst;
      }
      glVersion = 1;
    }
    return r;
  }

  /**
   * 初始化渲染器与场景。只在 PB.main.boot() 中调用一次；重复调用直接返回已有单例。
   *
   * @param {HTMLCanvasElement} canvas 画布元素
   * @returns {{renderer: THREE.WebGLRenderer, scene: THREE.Scene, glVersion: number}}
   * @throws {Error} name='NoWebGLError' | 'GLVersionMismatch'（由调用方转 fatal）
   */
  S.init = function (canvas) {
    if (renderer) return { renderer: renderer, scene: scene, glVersion: glVersion };
    canvasEl = canvas;
    var gl = createContext(canvas);
    renderer = createRenderer(canvas, gl);

    // 清屏色取 §4.2.2 p=0 的黄昏 zenith（§1.4 色值经 THREE.Color 转线性空间，M-03）。
    // P7 接入 daynight 后由 G.env 覆盖；此处只是首帧底色，不是第二套天空来源。
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CFG.COLORS.skyZenithDusk);
    // 无相机时的 clear() 也要清成天空色，否则会清成默认黑（P1 出口要求"天空色清屏"）。
    renderer.setClearColor(scene.background, 1);

    // ==== P7 追加：主光 + 半球光 + 雾（§4.2.2 / §4.2.3 / §4.10）====
    // 灯光与雾的参数每帧由 applyEnvironment 从 G.env 写入；这里只建对象，不写任何常量。
    dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(0, 1, 0);
    scene.add(dirLight);
    scene.add(dirLight.target);
    hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(hemi);
    scene.fog = new THREE.Fog(CFG.COLORS.skyHorizonDusk, CFG.DAY.FOG_NEAR, CFG.DAY.FOG_FAR_BY_LEVEL[fogLevel]);

    S.resize();
    return { renderer: renderer, scene: scene, glVersion: glVersion };
  };

  /**
   * 按当前 CSS 尺寸与 DPR 重算绘制缓冲区（§4.10 M-19）。
   * 尺寸为 0（窗口最小化）时跳过，避免 setSize(0,0) 造成 framebuffer 非法。
   * DPR 上限由当前画质等级决定（P14 的 applyQuality 写入 dprCap），不是固定的 2.0。
   *
   * @returns {void}
   */
  S.resize = function () {
    if (!renderer || !canvasEl) return;
    var w = canvasEl.clientWidth;
    var h = canvasEl.clientHeight;
    if (w === 0 || h === 0) return;
    var dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
  };

  /**
   * @returns {THREE.WebGLRenderer|null} 当前渲染器单例
   */
  S.renderer = function () { return renderer; };

  /**
   * @returns {THREE.Scene|null} 当前场景单例
   */
  S.scene = function () { return scene; };

  /**
   * @returns {number} 0 表示尚未初始化；1 或 2 为已判定的 GL 主版本
   */
  S.glVersion = function () { return glVersion; };

  // ==== P7 追加：环境（灯光、雾、背景）====
  var dirLight = null, hemi = null, fogLevel = CFG.DAY.LEVEL_INIT;

  /**
   * 每帧 F8：把 G.env 写入主光、半球光、雾与清屏色。所有值都来自同一个 G.env（AC-3c），
   * 主光的颜色用 lightColor/lightI 还原"未乘强度的线性色"，强度单独给 lightI。
   *
   * @param {object} env G.env
   * @returns {void}
   */
  S.applyEnvironment = function (env) {
    if (!scene || !dirLight) return;
    var inv = env.lightI > 1e-6 ? 1 / env.lightI : 0;
    dirLight.position.set(env.lightDir.x * 100, env.lightDir.y * 100, env.lightDir.z * 100);
    dirLight.color.setRGB(env.lightColor.r * inv, env.lightColor.g * inv, env.lightColor.b * inv);
    dirLight.intensity = env.lightI;
    hemi.color.setRGB(env.hemiSky.r, env.hemiSky.g, env.hemiSky.b);
    hemi.groundColor.setRGB(env.hemiGround.r, env.hemiGround.g, env.hemiGround.b);
    hemi.intensity = env.hemiI;
    scene.background.setRGB(env.zenith.r, env.zenith.g, env.zenith.b);
    scene.fog.color.setRGB(env.horizon.r, env.horizon.g, env.horizon.b);
    scene.fog.near = env.fogNear;
    scene.fog.far = CFG.DAY.FOG_FAR_BY_LEVEL[fogLevel];
  };

  /**
   * 主光方向（从表面指向光源），供 AC-3c 的三方一致性检查读取。
   * @param {{x:number,y:number,z:number}} out 输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  S.lightDir = function (out) {
    if (!dirLight) return out;
    var x = dirLight.position.x - dirLight.target.position.x;
    var y = dirLight.position.y - dirLight.target.position.y;
    var z = dirLight.position.z - dirLight.target.position.z;
    var len = Math.sqrt(x * x + y * y + z * z) || 1;
    out.x = x / len; out.y = y / len; out.z = z / len;
    return out;
  };

  /**
   * 设置雾 far 对应的画质等级（§4.10；P14 的 applyQuality 调用）。
   * @param {number} l 等级 0..3
   * @returns {void}
   */
  S.setFogLevel = function (l) {
    fogLevel = Math.max(0, Math.min(3, l | 0));
    if (scene && scene.fog) scene.fog.far = CFG.DAY.FOG_FAR_BY_LEVEL[fogLevel];
  };

  /**
   * @returns {THREE.DirectionalLight|null} 主光（调试读数用）
   */
  S.directionalLight = function () { return dirLight; };

  // ==== P14 追加：画质等级的唯一应用点（§4.10）====

  /**
   * 应用一个画质等级：海面网格与法线路径、星点 drawRange、雾 far、DPR 上限（§4.10 表格）。
   * 这是等级的唯一应用点——quality 只决定等级，scene 负责把它落到渲染资源上（M-23 单一写者）。
   *
   * @param {number} l 等级 0..3
   * @returns {void}
   */
  S.applyQuality = function (l) {
    var q = CFG.QUALITY;
    var n = Math.max(0, Math.min(3, l | 0));
    // 步骤1：海面（网格 48/80/128/192、L0 关泡沫、L2/L3 且 highp 才逐像素法线）
    PB.ocean.applyLevel(n);
    // 步骤2：星星 drawRange（1200/2000/3000/3000）
    PB.sky.setStarCount(q.STARS[n]);
    // 步骤3：雾 far（300/360/420/420）
    S.setFogLevel(n);
    // 步骤4：DPR 上限（0.75/1.0/1.5/2.0），并立即按新上限重算绘制缓冲区
    dprCap = q.DPR[n];
    S.resize();
  };

  /**
   * 监听 devicePixelRatio 变化（换显示器、浏览器缩放）。§4.10 要求在这条路径上重算 DPR。
   * matchMedia 的 resolution 查询只在"查询值等于当前值"时匹配，所以每次变化后按新值重新挂一次。
   *
   * @returns {void}
   */
  function watchResolution() {
    if (!window.matchMedia) return;
    var dpr = window.devicePixelRatio || 1;
    if (dpr === resDpr) return;
    resDpr = dpr;
    if (resMql && resMql.removeEventListener) resMql.removeEventListener('change', onResolutionChange);
    resMql = window.matchMedia('(resolution: ' + dpr + 'dppx)');
    if (resMql.addEventListener) resMql.addEventListener('change', onResolutionChange);
  }

  /**
   * resolution 查询变化：重算 DPR 并重新挂监听。
   * @returns {void}
   */
  function onResolutionChange() {
    S.resize();
    resDpr = 0;
    watchResolution();
  }

  /**
   * 挂上 resolution 监听（boot 时由 scene.init 调用一次）。
   * @returns {void}
   */
  S.watchResolution = function () { watchResolution(); };
})(window.PB = window.PB || {});
