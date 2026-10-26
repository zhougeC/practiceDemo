// TASK-002 P8: 海面波参数与 CPU 镜像（plan.md §4.3、M-11、M-27、ADR-06/14）。
// 本文件是"波参数 → GLSL / CPU 镜像"的唯一来源：OCEAN_DISP_GLSL 与 disp() 逐项对应，
// 法线只能由 oceanDisp 的有限差分得到（M-11）。core 不引用 THREE（M-07）。
(function (PB) {
  'use strict';
  var CFG = PB.config, M = PB.mathx, O = CFG.OCEAN;
  var S = PB.oceanmath = {};
  var TAU = Math.PI * 2;

  // 派生量：归一化方向、k = 2π/L、ω = √(g·k)、Q = 0.125/(k·A)（每波 Q·k·A = 0.125，§4.3）
  var W = [];
  (function () {
    for (var i = 0; i < O.WAVES.length; i++) {
      var w = O.WAVES[i];
      var len = Math.sqrt(w[0] * w[0] + w[1] * w[1]);
      var k = TAU / w[3];
      W.push({
        dx: w[0] / len, dz: w[1] / len, A: w[2], k: k,
        omega: Math.sqrt(O.GRAVITY * k), Q: O.Q_TARGET / (k * w[2])
      });
    }
  })();
  S.WAVES = W;

  /**
   * GLSL 浮点字面量（必须带小数点，GLSL ES 1.00 不接受 int → float 的隐式转换）。
   * @param {number} x 数值
   * @returns {string} 字面量
   */
  function num(x) { return (x % 1 === 0) ? x.toFixed(1) : String(x); }

  // 顶点路径与逐像素路径共用的 GLSL 片段（M-24：GLSL ES 1.00；常量循环界；无位运算/texelFetch）。
  // 两条路径都 #include 同一份字符串，因此公式不可能分叉（M-11 / §4.3 "两条路径共用 OCEAN_DISP_GLSL"）。
  S.OCEAN_DISP_GLSL = [
    'uniform float uPhase[4];',
    'uniform vec4 uWaves[4];',            // (dirX, dirZ, A, k)
    'uniform float uShoreX;',
    'float oceanAlpha(float x) {',
    '  return mix(' + num(O.ALPHA_NEAR) + ', 1.0, smoothstep(uShoreX, uShoreX + ' + num(O.SHORE_FADE) + ', x));',
    '}',
    'vec3 oceanDisp(vec2 xz, float alpha) {',
    '  vec3 d = vec3(0.0);',
    '  for (int i = 0; i < 4; i++) {',
    '    vec4 w = uWaves[i];',
    '    float k = w.w; float A = w.z;',
    '    float Q = ' + num(O.Q_TARGET) + ' / (k * A);',
    '    float th = k * (w.x * xz.x + w.y * xz.y) - uPhase[i];',
    '    float c = cos(th); float s = sin(th);',
    '    d.x += Q * A * w.x * c;',
    '    d.z += Q * A * w.y * c;',
    '    d.y += A * s;',
    '  }',
    '  return d * alpha;',
    '}',
    'vec3 oceanNormal(vec2 xz, float alpha) {',
    '  float e = ' + num(O.EPS) + ';',
    '  vec3 pz1 = vec3(xz.x, 0.0, xz.y + e) + oceanDisp(vec2(xz.x, xz.y + e), alpha);',
    '  vec3 pz0 = vec3(xz.x, 0.0, xz.y - e) + oceanDisp(vec2(xz.x, xz.y - e), alpha);',
    '  vec3 px1 = vec3(xz.x + e, 0.0, xz.y) + oceanDisp(vec2(xz.x + e, xz.y), oceanAlpha(xz.x + e));',
    '  vec3 px0 = vec3(xz.x - e, 0.0, xz.y) + oceanDisp(vec2(xz.x - e, xz.y), oceanAlpha(xz.x - e));',
    '  return normalize(cross(pz1 - pz0, px1 - px0));',
    '}'
  ].join('\n');

  /**
   * 近岸衰减 α(x) = mix(0.25, 1.0, smoothstep(SHORE_X, SHORE_X+12, x))（§4.3）。
   * @param {number} x 世界 x（米）
   * @returns {number} 衰减系数
   */
  S.alpha = function (x) { return M.lerp(O.ALPHA_NEAR, 1, M.smoothstep(CFG.SHORE_X, CFG.SHORE_X + O.SHORE_FADE, x)); };

  /**
   * 相位（M-27）：uPhase[i] = mod(k_i·dirZ_i·S + ω_i·t, 2π)，双精度算完再写 float32。
   * @param {number} Sdist 累计路程（米）
   * @param {number} t 模拟时间（秒）
   * @param {Float32Array} out 长度 4 的输出
   * @returns {Float32Array} out
   */
  S.phase = function (Sdist, t, out) {
    for (var i = 0; i < W.length; i++) out[i] = M.mod(W[i].k * W[i].dz * Sdist + W[i].omega * t, TAU);
    return out;
  };

  /**
   * CPU 镜像的位移（与 oceanDisp 逐项对应）：返回 (dx, dy, dz)，已乘 α。
   * @param {number} x 世界 x（米）
   * @param {number} z 世界 z（米）
   * @param {Float32Array|number[]} phases uPhase
   * @param {{x:number,y:number,z:number}} out 输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  S.disp = function (x, z, phases, out) {
    var alpha = S.alpha(x);
    var dx = 0, dy = 0, dz = 0;
    for (var i = 0; i < W.length; i++) {
      var w = W[i];
      var th = w.k * (w.dx * x + w.dz * z) - phases[i];
      var c = Math.cos(th), s = Math.sin(th);
      dx += w.Q * w.A * w.dx * c;
      dz += w.Q * w.A * w.dz * c;
      dy += w.A * s;
    }
    out.x = dx * alpha; out.y = dy * alpha; out.z = dz * alpha;
    return out;
  };

  var _d = { x: 0, y: 0, z: 0 };
  var _n0 = { x: 0, y: 0, z: 0 }, _n1 = { x: 0, y: 0, z: 0 };
  var _n2 = { x: 0, y: 0, z: 0 }, _n3 = { x: 0, y: 0, z: 0 };

  /**
   * 有限差分法线（M-11，与 GLSL 的 oceanNormal 同一公式与同一 ε）：
   * N = normalize(cross(P(x,z+ε)−P(x,z−ε), P(x+ε,z)−P(x−ε,z)))，P = (x,0,z) + disp。
   * @param {number} x 世界 x（米）
   * @param {number} z 世界 z（米）
   * @param {Float32Array|number[]} phases uPhase
   * @param {{x:number,y:number,z:number}} out 输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  S.normal = function (x, z, phases, out) {
    var e = O.EPS;
    S.disp(x, z + e, phases, _n0);
    S.disp(x, z - e, phases, _n1);
    S.disp(x + e, z, phases, _n2);
    S.disp(x - e, z, phases, _n3);
    var ax = _n0.x - _n1.x, ay = _n0.y - _n1.y, az = 2 * e + _n0.z - _n1.z;
    var bx = 2 * e + _n2.x - _n3.x, by = _n2.y - _n3.y, bz = _n2.z - _n3.z;
    out.x = ay * bz - az * by;
    out.y = az * bx - ax * bz;
    out.z = ax * by - ay * bx;
    var len = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z) || 1;
    out.x /= len; out.y /= len; out.z /= len;
    return out;
  };

  /**
   * 值噪声（晶格周期 256，与 GLSL 的 vnoise256 同一哈希）。坐标先取模再哈希，保证周期性。
   * @param {number} x 输入 x
   * @param {number} y 输入 y
   * @returns {number} 噪声值 [0,1)
   */
  function vnoise256(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    var ab = a + (b - a) * ux, cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
  }

  /**
   * 256 周期哈希（与 GLSL 的 hash21 同一常数）。
   * @param {number} ix 整数格 x
   * @param {number} iy 整数格 y
   * @returns {number} [0,1)
   */
  function h(ix, iy) {
    var x = M.mod(ix, 256), y = M.mod(iy, 256);
    var v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return v - Math.floor(v);
  }
  S.vnoise256 = vnoise256;

  /**
   * CPU 镜像的泡沫（§4.3）：shoreFoam（近岸推进带）+ crestFoam（波峰）。
   * @param {number} x 世界 x（米）
   * @param {number} z 世界 z（米）
   * @param {Float32Array|number[]} phases uPhase
   * @param {number} foamPhase uFoamPhase = mod(t/4.5, 1)
   * @param {number} noiseOff uNoiseOff = mod(0.15·S, 256)
   * @param {{shoreFoam:number,crestFoam:number,foam:number,dy:number}} out 输出（复用）
   * @returns {object} out
   */
  S.foam = function (x, z, phases, foamPhase, noiseOff, out) {
    var d = x - CFG.SHORE_X;
    var band = M.smoothstep(-0.3, 0, d) * (1 - M.smoothstep(4, 6.5, d));
    var n = vnoise256(0.15 * x, 0.15 * z - noiseOff);
    var wave = 0.5 + 0.5 * Math.sin(TAU * (d / O.FOAM_BAND + foamPhase) + O.NA * n);
    out.shoreFoam = band * M.smoothstep(0.6, 0.9, wave);
    var alpha = S.alpha(x);
    out.dy = S.disp(x, z, phases, _d).y;
    var hgt = out.dy / (alpha * O.A_SUM);
    out.crestFoam = M.smoothstep(O.TLO, O.TLO + O.CREST_W, hgt);
    out.foam = Math.min(1, out.shoreFoam + out.crestFoam);
    return out;
  };
})(window.PB = window.PB || {});
