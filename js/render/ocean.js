// TASK-002 P8: 海面网格与着色（plan.md §4.3、M-11、M-12、M-24、M-27、ADR-06/14）。
// 网格静止、顶点在着色器里按 Gerstner 位移；法线只能由 oceanDisp 的有限差分得到（M-11）。
// 相位/噪声偏移/泡沫相位都在 JS 用双精度取模后写成 float32 uniform（M-27，不做 rebase）。
// 逐像素法线仅在 L2/L3 且 highp 可用时启用，否则走逐顶点路径；两条路径共用 OCEAN_DISP_GLSL。
(function (PB) {
  'use strict';
  var CFG = PB.config, O = CFG.OCEAN, M = PB.mathx, C = CFG.COLORS, OM = PB.oceanmath;
  var S = PB.ocean = {};

  var mesh = null;
  var geos = null;               // 4 个等级的网格（boot 预建，§4.10）
  var matVertex = null, matPixel = null;
  var highp = false;             // 逐像素路径的精度前提（M-12）
  var level = O.LEVEL_INIT;
  var U = null;                  // 两种材质共享同一份 uniform 对象：写一次两边都生效
  var _deepDusk = null, _shallowDusk = null, _deepNight = null, _shallowNight = null;

  /**
   * 建一块 x∈[X0,X1]、z∈[Z0,Z1] 的非均匀网格（近岸与近镜头更密，§2.2 允许非均匀分布）。
   * 只写 position（法线由着色器算），索引为 32 位以支持 192² 顶点。
   *
   * @param {number} nx x 方向顶点数
   * @param {number} nz z 方向顶点数
   * @returns {THREE.BufferGeometry} 网格
   */
  function buildGrid(nx, nz) {
    var pos = new Float32Array(nx * nz * 3);
    var i, j, k;
    for (j = 0; j < nz; j++) {
      var vz = j / (nz - 1);
      var z = O.Z1 - (O.Z1 - O.Z0) * Math.pow(vz, 1.5);   // j=0 在 +80（镜头后方）
      for (i = 0; i < nx; i++) {
        var ux = i / (nx - 1);
        var x = O.X0 + (O.X1 - O.X0) * Math.pow(ux, 1.6); // 近岸更密
        k = (j * nx + i) * 3;
        pos[k] = x; pos[k + 1] = 0; pos[k + 2] = z;
      }
    }
    var idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    var t = 0;
    for (j = 0; j < nz - 1; j++) {
      for (i = 0; i < nx - 1; i++) {
        var a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx[t++] = a; idx[t++] = b; idx[t++] = c;   // 绕序使法线朝 +Y（z 随 j 递减）
        idx[t++] = b; idx[t++] = d; idx[t++] = c;
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }

  /**
   * 顶点着色器。逐像素路径不需要 vNrm，逐顶点路径需要。
   * @param {boolean} withNormal 是否输出法线 varying
   * @returns {string} GLSL 源码
   */
  function vertexSrc(withNormal) {
    return [
      OM.OCEAN_DISP_GLSL,
      'uniform float uSeaY;',
      'varying vec3 vWorld;',
      'varying float vDy;',
      'varying float vAlpha;',
      withNormal ? 'varying vec3 vNrm;' : '',
      'void main() {',
      '  vec2 xz = vec2(position.x, position.z);',
      '  float alpha = oceanAlpha(xz.x);',
      '  vec3 d = oceanDisp(xz, alpha);',
      '  vec3 p = vec3(xz.x + d.x, uSeaY + d.y, xz.y + d.z);',
      '  vWorld = p; vDy = d.y; vAlpha = alpha;',
      withNormal ? '  vNrm = oceanNormal(xz, alpha);' : '',
      '  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);',
      '}'
    ].join('\n');
  }

  /**
   * 片元着色器（§4.3 的光照与泡沫公式逐项）。pow 的底数都先 max/clamp（M-24）。
   * @param {boolean} pixelNormals 是否逐像素算法线
   * @returns {string} GLSL 源码
   */
  function fragmentSrc(pixelNormals) {
    return [
      OM.OCEAN_DISP_GLSL,   // 两条路径都 include：uShoreX 等 uniform 与函数定义只有一份来源
      'uniform vec3 uLightDir; uniform vec3 uLightColor; uniform vec3 uAmbient;',
      'uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uDeep; uniform vec3 uShallow;',
      'uniform vec3 uFoamColor; uniform vec3 uFogColor;',
      'uniform float uSpecPow; uniform float uSpecI;',
      'uniform float uFoamPhase; uniform float uNoiseOff;',
      'uniform float uFogNear; uniform float uFogFar; uniform float uFoamOn;',
      'uniform float uTlo; uniform float uNa;',
      'varying vec3 vWorld; varying float vDy; varying float vAlpha;',
      pixelNormals ? '' : 'varying vec3 vNrm;',
      'float hash21(vec2 p) { p = mod(p, 256.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'float vnoise256(vec2 p) {',
      '  vec2 i = floor(p); vec2 f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),',
      '             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);',
      '}',
      'void main() {',
      pixelNormals ? '  vec3 N = oceanNormal(vWorld.xz, vAlpha);' : '  vec3 N = normalize(vNrm);',
      '  vec3 V = normalize(cameraPosition - vWorld);',
      '  float ndv = max(dot(N, V), 0.0);',
      '  vec3 lightTerm = uAmbient + uLightColor * max(dot(N, uLightDir), 0.0);',
      '  float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);',
      '  vec3 R = reflect(-V, N);',
      '  float m = clamp(smoothstep(-0.2, 0.3, vDy) * (1.0 - smoothstep(uShoreX, uShoreX + ' + num(O.SHORE_FADE2) + ', vWorld.x)) + 0.25, 0.0, 1.0);',
      '  vec3 base = mix(uDeep, uShallow, m);',
      '  vec3 refl = mix(uHorizon, uZenith, clamp(R.y, 0.0, 1.0));',
      '  vec3 spec = pow(max(dot(R, uLightDir), 0.0), uSpecPow) * uSpecI * uLightColor;',
      '  vec3 color = mix(base * lightTerm, refl, fresnel) + spec;',
      '  float d = vWorld.x - uShoreX;',
      '  float band = smoothstep(-0.3, 0.0, d) * (1.0 - smoothstep(4.0, 6.5, d));',
      '  float nz = vnoise256(vec2(0.15 * vWorld.x, 0.15 * vWorld.z - uNoiseOff));',
      '  float shoreFoam = band * smoothstep(0.6, 0.9, 0.5 + 0.5 * sin(6.2831853 * (d / ' + num(O.FOAM_BAND) + ' + uFoamPhase) + uNa * nz));',
      '  float h = vDy / (max(vAlpha, 0.001) * ' + num(O.A_SUM) + ');',
      '  float crestFoam = smoothstep(uTlo, uTlo + ' + num(O.CREST_W) + ', h);',
      '  float foam = clamp(shoreFoam + crestFoam, 0.0, 1.0) * uFoamOn;',
      '  vec3 final = mix(color, uFoamColor * max(lightTerm, vec3(0.08)), foam);',
      '  float fogF = clamp((length(cameraPosition - vWorld) - uFogNear) / max(uFogFar - uFogNear, 1.0), 0.0, 1.0);',
      '  final = mix(final, uFogColor, fogF);',
      '  gl_FragColor = vec4(final, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n');
  }

  /**
   * GLSL 浮点字面量（必须带小数点）。
   * @param {number} x 数值
   * @returns {string} 字面量
   */
  function num(x) { return (x % 1 === 0) ? x.toFixed(1) : String(x); }

  /**
   * 判断 three 报告的可用精度是否为 highp（M-12，ADR-30）。字面读 capabilities 的精度字段并与 'highp' 比较：
   * 这是 M-12 原文"capabilities 的精度字段 !== 'highp' 时走逐顶点"的一一对应写法。
   * 该字段由 three 用 getShaderPrecisionFormat 推导（r162 的 WebGLCapabilities），因此语义与硬件一致；
   * 读不到渲染器（或字段缺失）时返回 false，即保守地走逐顶点路径（低精度设备的安全回退）。
   *
   * @param {THREE.WebGLRenderer} renderer 渲染器
   * @returns {boolean} 是否可用 highp
   */
  function detectHighp(renderer) {
    var c = renderer && renderer.capabilities;
    return !!(c && c.precision === 'highp');
  }

  /**
   * 建海面（boot 时一次）。四档网格与两种材质全部预建并预编译（§4.10 / §4.11）。
   * @param {THREE.Scene} scene 场景
   * @returns {void}
   */
  S.init = function (scene) {
    if (mesh) return;
    var renderer = PB.scene.renderer();
    highp = renderer ? detectHighp(renderer) : false;

    var waves = [];
    for (var i = 0; i < OM.WAVES.length; i++) {
      var w = OM.WAVES[i];
      waves.push(new THREE.Vector4(w.dx, w.dz, w.A, w.k));
    }
    U = {
      uPhase: { value: new Float32Array(4) },
      uWaves: { value: waves },
      uShoreX: { value: CFG.SHORE_X },
      uSeaY: { value: CFG.SEA_Y },
      uNoiseOff: { value: 0 },
      uFoamPhase: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightColor: { value: new THREE.Color(0, 0, 0) },
      uAmbient: { value: new THREE.Color(0, 0, 0) },
      uZenith: { value: new THREE.Color(0, 0, 0) },
      uHorizon: { value: new THREE.Color(0, 0, 0) },
      uDeep: { value: new THREE.Color(0, 0, 0) },
      uShallow: { value: new THREE.Color(0, 0, 0) },
      uSpecPow: { value: 120 },
      uSpecI: { value: 1.2 },
      uFogColor: { value: new THREE.Color(0, 0, 0) },
      uFogNear: { value: CFG.DAY.FOG_NEAR },
      uFogFar: { value: CFG.DAY.FOG_FAR_BY_LEVEL[O.LEVEL_INIT] },
      uFoamColor: { value: new THREE.Color(C.foam) },
      uFoamOn: { value: 1 },
      uTlo: { value: O.TLO },
      uNa: { value: O.NA }
    };
    matVertex = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vertexSrc(true), fragmentShader: fragmentSrc(false) });
    matPixel = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vertexSrc(false), fragmentShader: fragmentSrc(true) });

    geos = [];
    for (var l = 0; l < O.GRID.length; l++) geos.push(buildGrid(O.GRID[l], O.GRID[l]));

    _deepDusk = new THREE.Color(C.seaDuskDeep);
    _shallowDusk = new THREE.Color(C.seaDuskShallow);
    _deepNight = new THREE.Color(C.seaNightDeep);
    _shallowNight = new THREE.Color(C.seaNightShallow);

    mesh = new THREE.Mesh(geos[level], matVertex);
    mesh.frustumCulled = false;
    scene.add(mesh);
    S.applyLevel(level);
  };

  /**
   * 选择画质等级对应的网格与法线路径（§4.10：L2/L3 且 highp 才逐像素）。
   * @param {number} l 等级 0..3
   * @returns {void}
   */
  S.applyLevel = function (l) {
    level = Math.max(0, Math.min(3, l | 0));
    if (!mesh) return;
    mesh.geometry = geos[level];
    mesh.material = (level >= 2 && highp) ? matPixel : matVertex;
    U.uFoamOn.value = level >= 1 ? 1 : 0;    // L0 关泡沫（§4.10）
  };

  /**
   * 每帧 F8：写周期量（M-27）与环境相关的 uniform。所有周期量都在 JS 双精度取模后写入。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.update = function (G) {
    if (!mesh) return;
    var env = G.env;
    OM.phase(G.S, G.t, U.uPhase.value);
    env.uPhase.set(U.uPhase.value);
    U.uNoiseOff.value = M.mod(0.15 * G.S, 256);
    env.uNoiseOff = U.uNoiseOff.value;
    U.uFoamPhase.value = M.mod(G.t / O.FOAM_T, 1);
    env.uFoamPhase = U.uFoamPhase.value;
    U.uLightDir.value.set(env.lightDir.x, env.lightDir.y, env.lightDir.z);
    U.uLightColor.value.setRGB(env.lightColor.r, env.lightColor.g, env.lightColor.b);
    U.uAmbient.value.setRGB(env.ambient.r, env.ambient.g, env.ambient.b);
    U.uZenith.value.setRGB(env.zenith.r, env.zenith.g, env.zenith.b);
    U.uHorizon.value.setRGB(env.horizon.r, env.horizon.g, env.horizon.b);
    U.uSpecPow.value = env.specPow;
    U.uSpecI.value = env.specI;
    // 海色在黄昏/夜两组之间按 nightMix 线性插值（§4.3 uniform 表）
    U.uDeep.value.copy(_deepDusk).lerp(_deepNight, env.nightMix);
    U.uShallow.value.copy(_shallowDusk).lerp(_shallowNight, env.nightMix);
    // 雾与 scene.fog 同源（scene 是雾 far 的唯一持有者，P14 改等级时只改那里）
    var fog = PB.scene.scene().fog;
    if (fog) {
      U.uFogColor.value.copy(fog.color);
      U.uFogNear.value = fog.near;
      U.uFogFar.value = fog.far;
    }
  };

  /**
   * 预编译两种海面材质（§4.11 的 restored 路径要求）。临时切换材质后调用 renderer.compile，
   * 保证上下文恢复后两条路径的 program 都已就绪（PR-4）。
   * @returns {void}
   */
  S.precompile = function () {
    var renderer = PB.scene.renderer();
    var cam = PB.camera.object();
    if (!renderer || !mesh || !cam) return;
    var cur = mesh.material;
    mesh.material = cur === matVertex ? matPixel : matVertex;
    renderer.compile(PB.scene.scene(), cam);
    mesh.material = cur;
  };

  /**
   * 海面当前使用的 uLightDir（AC-3c 的三方一致性读数）。
   * @returns {THREE.Vector3} 光源方向
   */
  S.uniformLightDir = function () { return U ? U.uLightDir.value : null; };

  /**
   * 当前 uPhase（M-27 的 JS→GLSL 同相位读数；测试与 debug 用）。
   * @returns {Float32Array} 四波相位
   */
  S.phaseValues = function () { return U ? U.uPhase.value : null; };

  /**
   * 当前是否走逐像素法线路径（M-12 的读数）。
   * @returns {boolean} 逐像素为 true
   */
  S.pixelNormals = function () { return !!(mesh && mesh.material === matPixel); };
})(window.PB = window.PB || {});
