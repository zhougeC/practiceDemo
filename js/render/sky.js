// TASK-002 P7: 天空穹顶、日月盘与星点（plan.md §4.2.4、AC-3a/3b/3c、ADR-18）。
// 穹顶与星点每帧跟随相机（半径 1000 / 900，far = 1500）。所有颜色由 G.env 的线性三元组写入，
// 与 DirectionalLight / 海面 uLightDir 同源（AC-3c 的一致性来自"只有一个 G.env"）。
// 自定义 GLSL 一律 GLSL ES 1.00 写法（M-24）；不使用绕过 three 内置 uniform 的原始材质（M-12）。
(function (PB) {
  'use strict';
  var CFG = PB.config, SK = CFG.SKY, M = PB.mathx, C = CFG.COLORS;
  var S = PB.sky = {};
  var D2R = Math.PI / 180;

  var dome = null, domeMat = null;
  var stars = null, starMat = null;
  var starDirs = null;                 // 星点方向（单位向量，供 starsInView 与几何共用）
  var fullStarCount = 0, starCount = 0;
  // 复用对象（M-31）
  var _m = null, _frustum = null, _p = null;

  /**
   * 生成星点几何属性（位置、大小、相位、闪烁速率）。分布由 PB.mathx.starField 给出
   * （55% 仰角 [4°,24°] 均匀 + 45% sin e 均匀 + Fisher–Yates 打乱，§4.2.4，PR-1 同一份数据）。
   *
   * @returns {void}
   */
  function buildStars() {
    fullStarCount = CFG.STAR_COUNT;
    starCount = fullStarCount;
    starDirs = M.starField(new Float32Array(fullStarCount * 3), fullStarCount);
    var pos = new Float32Array(fullStarCount * 3);
    var size = new Float32Array(fullStarCount);
    var phase = new Float32Array(fullStarCount);
    var speed = new Float32Array(fullStarCount);
    var minS = SK.STAR_SIZE[0], maxS = SK.STAR_SIZE[1];
    for (var i = 0; i < fullStarCount; i++) {
      pos[i * 3] = starDirs[i * 3] * SK.STAR_R;
      pos[i * 3 + 1] = starDirs[i * 3 + 1] * SK.STAR_R;
      pos[i * 3 + 2] = starDirs[i * 3 + 2] * SK.STAR_R;
      size[i] = minS + (maxS - minS) * M.hash01(i * 3 + 1);
      phase[i] = Math.PI * 2 * M.hash01(i * 3 + 2);
      speed[i] = 3 + Math.floor(M.hash01(i * 3 + 3) * 10);   // m_i ∈ {3..12}
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTwinkleT: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: [
        'attribute float aSize;',
        'attribute float aPhase;',
        'attribute float aSpeed;',
        'uniform float uTwinkleT;',
        'uniform float uOpacity;',
        'varying float vAlpha;',
        'void main() {',
        '  vAlpha = (0.75 + 0.25 * sin(6.2831853 * aSpeed * uTwinkleT / ' + num(SK.TWINKLE_PERIOD) + ' + aPhase)) * uOpacity;',
        '  gl_PointSize = aSize;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vAlpha;',
        'void main() {',
        '  vec2 c = gl_PointCoord - vec2(0.5);',
        '  float r = length(c);',
        '  if (r > 0.5) discard;',
        '  gl_FragColor = vec4(vec3(1.0), vAlpha * (1.0 - smoothstep(0.28, 0.5, r)));',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    stars = new THREE.Points(g, starMat);
    stars.frustumCulled = false;     // 星点随相机移动，包围球无意义
    stars.renderOrder = -1;
    stars.visible = false;
  }

  /**
   * GLSL 浮点字面量（必须带小数点，否则 GLSL ES 1.00 会当 int 处理）。
   * @param {number} x 数值
   * @returns {string} 字面量
   */
  function num(x) { return (x % 1 === 0) ? x.toFixed(1) : String(x); }

  /**
   * 建穹顶与星点（boot 时一次）。
   * @param {THREE.Scene} scene 场景
   * @returns {void}
   */
  S.init = function (scene) {
    if (dome) return;
    _m = new THREE.Matrix4();
    _frustum = new THREE.Frustum();
    _p = new THREE.Vector3();
    var edgeSun = SK.SUN_EDGE_DEG, edgeMoon = SK.MOON_EDGE_DEG;
    domeMat = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0, 0, 0) },
        uHorizon: { value: new THREE.Color(0, 0, 0) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uMoonColor: { value: new THREE.Color(C.moon) },   // #DCE6FF，经 THREE.Color 转线性
        uNightMix: { value: 0 }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = position;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uZenith;',
        'uniform vec3 uHorizon;',
        'uniform vec3 uSunDir;',
        'uniform vec3 uMoonDir;',
        'uniform vec3 uSunColor;',
        'uniform vec3 uMoonColor;',
        'uniform float uNightMix;',
        'varying vec3 vDir;',
        'const float DEG = 0.017453292519943295;',
        'float hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
        'float vnoise(vec2 p) {',
        '  vec2 i = floor(p); vec2 f = fract(p);',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),',
        '             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);',
        '}',
        'void main() {',
        '  vec3 dir = normalize(vDir);',
        // 渐变：mix(horizon, zenith, pow(max(dir.y,0),0.45))；地平线以下取 horizon·0.6
        '  vec3 col = mix(uHorizon, uZenith, pow(max(dir.y, 0.0), 0.45));',
        '  if (dir.y < 0.0) col = uHorizon * 0.6;',
        '  float above = smoothstep(-0.02, 0.01, dir.y);',
        '  float sd = max(dot(dir, uSunDir), 0.0);',
        '  float sun = smoothstep(cos(' + num(edgeSun[1]) + ' * DEG), cos(' + num(edgeSun[0]) + ' * DEG), sd);',
        '  col += (sun + pow(sd, 300.0) * 0.6) * uSunColor * above;',
        '  float md = max(dot(dir, uMoonDir), 0.0);',
        '  float disc = smoothstep(cos(' + num(edgeMoon[1]) + ' * DEG), cos(' + num(edgeMoon[0]) + ' * DEG), md)',
        '    * (0.85 + 0.15 * vnoise(dir.xz * 40.0));',
        '  col += disc * uMoonColor * above;',
        '  col += pow(md, 800.0) * 0.3 * uNightMix * uMoonColor;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    var geo = new THREE.SphereGeometry(SK.DOME_R, 32, 16);
    dome = new THREE.Mesh(geo, domeMat);
    dome.frustumCulled = false;
    dome.renderOrder = -1;      // 先画穹顶：深度不写，后续几何覆盖它
    scene.add(dome);
    buildStars();
    scene.add(stars);
  };

  /**
   * 每帧 F8：把 G.env 写入 uniform，穹顶/星点跟随相机，星点不透明度与闪烁时间推进。
   * uTwinkleT = mod(t, 60)（§4.2.4；周期量由 JS 生成，M-27）。
   *
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.update = function (G) {
    if (!dome) return;
    var env = G.env;
    var cam = PB.camera.object();
    if (cam) {
      dome.position.copy(cam.position);
      stars.position.copy(cam.position);
    }
    var u = domeMat.uniforms;
    u.uZenith.value.setRGB(env.zenith.r, env.zenith.g, env.zenith.b);
    u.uHorizon.value.setRGB(env.horizon.r, env.horizon.g, env.horizon.b);
    u.uSunDir.value.set(env.sunDir.x, env.sunDir.y, env.sunDir.z);
    u.uMoonDir.value.set(env.moonDir.x, env.moonDir.y, env.moonDir.z);
    // 日盘颜色取主光的"未乘强度"基色（env.lightColor 已乘强度，见 §4.2.3）
    var inv = env.lightI > 1e-6 ? 1 / env.lightI : 0;
    u.uSunColor.value.setRGB(env.lightColor.r * inv, env.lightColor.g * inv, env.lightColor.b * inv);
    u.uNightMix.value = env.nightMix;
    env.uTwinkleT = M.mod(G.t, SK.TWINKLE_PERIOD);
    starMat.uniforms.uTwinkleT.value = env.uTwinkleT;
    starMat.uniforms.uOpacity.value = env.stars;
    stars.visible = env.stars > 0.001;
  };

  /**
   * 星点数量（画质等级用，§4.10 的 drawRange；P14 接线）。
   * @param {number} n 星点数
   * @returns {void}
   */
  S.setStarCount = function (n) {
    if (!stars) return;
    starCount = Math.max(0, Math.min(fullStarCount, n | 0));
    stars.geometry.setDrawRange(0, starCount);
  };

  /**
   * 统计当前相机视锥内的星点数（AC-3b 的读数；只做几何判断，不计山崖遮挡，§4.2.4）。
   * @param {THREE.PerspectiveCamera} camera 相机
   * @returns {number} 视锥内星点数
   */
  S.countStarsInView = function (camera) {
    if (!camera || !starDirs) return 0;
    camera.updateMatrixWorld();
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_m);
    var n = 0;
    for (var i = 0; i < starCount; i++) {
      _p.set(starDirs[i * 3], starDirs[i * 3 + 1], starDirs[i * 3 + 2])
        .multiplyScalar(SK.STAR_R).add(camera.position);
      if (_frustum.containsPoint(_p)) n++;
    }
    return n;
  };
})(window.PB = window.PB || {});
