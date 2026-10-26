// TASK-002 P4: 角色骨架 rig（plan.md §4.13 M-25）。
// 唯一变换 M = T(x,y,0)·Rz(lean)·Rx(wheelie)；喙尖、围巾锚点、碰撞球、POV 相机都读同一个 G.rig，
// 因此"渲染位置"和"判定位置"不可能不同源（ADR-15）。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var S = PB.rig = {};

  /**
   * 由局部坐标计算世界坐标。变换只用 G.rig.M（列主序 4×4），不另建矩阵。
   * @param {object} G 一局状态（需要 G.rig.M）
   * @param {{x:number,y:number,z:number}} local 局部坐标
   * @param {{x:number,y:number,z:number}} out 输出对象（复用，不新建）
   * @returns {{x:number,y:number,z:number}} out
   */
  S.toWorld = function (G, local, out) {
    var m = G.rig.M;
    out.x = m[0] * local.x + m[4] * local.y + m[8] * local.z + m[12];
    out.y = m[1] * local.x + m[5] * local.y + m[9] * local.z + m[13];
    out.z = m[2] * local.x + m[6] * local.y + m[10] * local.z + m[14];
    return out;
  };

  /**
   * 世界坐标 → rig 局部坐标（ADR-23 的碰撞体判定需要）。是 toWorld 的严格逆变换：
   * 先减去平移，再乘 R 的转置（R = Rz(lean)·Rx(wheelie)，正交矩阵，转置即逆）。
   * 本函数只读 G.rig.M，不写任何字段；compute / toWorld 的输出因此逐位不变。
   *
   * @param {object} G 一局状态（需要 G.rig.M）
   * @param {{x:number,y:number,z:number}} p 世界坐标
   * @param {{x:number,y:number,z:number}} out 输出对象（复用，不新建）
   * @returns {{x:number,y:number,z:number}} out
   */
  S.toLocal = function (G, p, out) {
    var m = G.rig.M;
    var dx = p.x - m[12], dy = p.y - m[13], dz = p.z - m[14];
    // R 的第 j 列就是 m[j*4..j*4+2]；R^T 的行 = R 的列，因此分量 = 该列与位移的点积
    out.x = m[0] * dx + m[1] * dy + m[2] * dz;
    out.y = m[4] * dx + m[5] * dy + m[6] * dz;
    out.z = m[8] * dx + m[9] * dy + m[10] * dz;
    return out;
  };

  /**
   * 重建 M 与世界坐标派生量（§4.13）。M 的旋转部分为 Rz(lean)·Rx(wheelie)：
   *   Rx(θ)：y' = y·cosθ − z·sinθ，z' = y·sinθ + z·cosθ（θ>0 前端抬起）
   *   Rz(φ)：x' = x·cosφ − y·sinφ，y' = x·sinφ + y·cosφ
   * 合成后按列主序写入 Float64Array(16)，可直接喂给 THREE.Matrix4.fromArray。
   * @param {object} G 一局状态（读 bike.x/y/lean/wheelie，写 G.rig）
   * @returns {void}
   */
  S.compute = function (G) {
    var b = G.bike;
    var r = G.rig;
    var m = r.M;
    var cl = Math.cos(b.lean), sl = Math.sin(b.lean);
    var cw = Math.cos(b.wheelie), sw = Math.sin(b.wheelie);

    // 列 0（R 的第一列）
    m[0] = cl; m[1] = sl; m[2] = 0; m[3] = 0;
    // 列 1
    m[4] = -sl * cw; m[5] = cl * cw; m[6] = sw; m[7] = 0;
    // 列 2
    m[8] = sl * sw; m[9] = -cl * sw; m[10] = cw; m[11] = 0;
    // 平移：车辆始终在 z=0 的跑步机上（M-01 / ADR-14）
    m[12] = b.x; m[13] = b.y; m[14] = 0; m[15] = 1;

    S.toWorld(G, CFG.BEAK_TIP_L, r.beakW);
    S.toWorld(G, CFG.RIG.ANCHOR_L[0], r.anchorW[0]);
    S.toWorld(G, CFG.RIG.ANCHOR_L[1], r.anchorW[1]);
    S.toWorld(G, CFG.RIG.TORSO_L, r.torsoW);
    S.toWorld(G, CFG.RIG.NECK_L, r.neckW);
    S.toWorld(G, CFG.RIG.HEAD_L, r.headW);
  };

  /**
   * 创建 G.rig 并计算一次（§3.6 initSession 第 1 步）。prevBeakZ 在创建后立即对齐，
   * 避免第一帧把"从 0 到当前"误判为跨过喙（P9 的捕获判定依赖它）。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.initState = function (G) {
    G.rig = {
      M: new Float64Array(16),
      beakW: { x: 0, y: 0, z: 0 },
      anchorW: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
      torsoW: { x: 0, y: 0, z: 0 },
      neckW: { x: 0, y: 0, z: 0 },
      headW: { x: 0, y: 0, z: 0 },
      prevBeakZ: 0
    };
    S.compute(G);
    G.rig.prevBeakZ = G.rig.beakW.z;
  };
})(window.PB = window.PB || {});
