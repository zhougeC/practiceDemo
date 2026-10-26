// TASK-002 P4/P10: 五种镜头（plan.md §4.7、AC-8a/8b、M-02 构图）。
// P4 只做 mode 0（追尾）；P10 追加 mode 1 侧视、mode 2 电影、mode 3 POV、mode 4 环绕，
// 以及模式间 0.6 s 混合、电影镜头内部 1.2 s 混合、orbit 交互与 POV 头部可见性滞回。
// 所有机位都从同一份 G 读取（bike / rig），不保存第二份位置；避障一律最后执行（§4.7 公共规则）。
// M-31：稳态帧不新建对象——目标、暂存点、四元数、迭代回调都在 init 时分配一次。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var CH = CFG.CAM_CHASE;
  var SIDE = CFG.CAM_SIDE;
  var CINE = CFG.CAM_CINE;
  var ORB = CFG.CAM_ORBIT_UI;
  var LIM = CFG.CAM_LIMIT;
  var D2R = Math.PI / 180;
  var S = PB.camera = {};

  var cam = null;
  var size = null;                 // 复用 Vector2，避免每帧分配（M-31）
  var inited = false;
  var lastAspect = 0, appliedAspect = -1;
  var mode = 0;                    // 与 G.cam.mode 同步的本地副本（变化即触发 0.6 s 混合）
  var blendT = 1;                  // 模式切换进度 [0,1]；1 = 已完成
  var pos = { x: 0, y: 0, z: 0 };  // 阻尼后的目标位置（目标空间，不含混合）
  var look = { x: 0, y: 0, z: 0 }; // 阻尼后的注视点（目标空间，不含混合）
  var fpos = { x: 0, y: 0, z: 0 }; // 混合后的最终位置（写进相机）
  var tPos = { x: 0, y: 0, z: 0 };
  var tLook = { x: 0, y: 0, z: 0 };
  var tp = { fov: CH.fov, near: CH.near, rigid: false, k: CH.kPos, slerp: false };
  var from = { x: 0, y: 0, z: 0, fov: 0, near: 0 };
  var curQ = null, tQ = null, fromQ = null, qa = null, qb = null;
  var _m4 = null, _up = null, _eye = null, _tgt = null;
  var _pa = { x: 0, y: 0, z: 0 }, _pb = { x: 0, y: 0, z: 0 };
  var _la = { x: 0, y: 0, z: 0 }, _lb = { x: 0, y: 0, z: 0 };
  // orbit 指针采样（回调只建一次，稳态帧不分配）
  var oPrev = { count: 0, id: -1, x: 0, y: 0, dist: 0 };
  var oP1 = null, oP2 = null;
  var collectPtr = function (p, id) {
    if (!oP1) oP1 = { id: id, p: p };
    else if (!oP2) oP2 = { id: id, p: p };
  };
  var dHead = 0, headHidden = false, headViolations = 0;

  /**
   * 建相机单例（boot 时由 main 调用一次；§3.6「相机对象 | boot」）。
   * THREE 对象延迟到此处创建：vendor 缺失时本文件的加载期不得引用 THREE（§4.11 判定路径）。
   * @returns {THREE.PerspectiveCamera} 相机
   */
  S.init = function () {
    if (cam) return cam;
    size = new THREE.Vector2();
    cam = new THREE.PerspectiveCamera(CH.fov, 1, CH.near, CFG.CAM_FAR);
    curQ = new THREE.Quaternion();
    tQ = new THREE.Quaternion();
    fromQ = new THREE.Quaternion();
    qa = new THREE.Quaternion();
    qb = new THREE.Quaternion();
    _m4 = new THREE.Matrix4();
    _up = new THREE.Vector3(0, 1, 0);
    _eye = new THREE.Vector3();
    _tgt = new THREE.Vector3();
    inited = false;
    return cam;
  };

  /**
   * @returns {THREE.PerspectiveCamera|null} 相机对象（main 的 F13 渲染使用）
   */
  S.object = function () { return cam; };

  /**
   * 取当前画布宽高比。尺寸为 0（最小化）时保持上一次的值，避免除零把投影矩阵打成 NaN。
   * @returns {number} 宽高比
   */
  function aspect() {
    var r = PB.scene.renderer();
    if (!r) return lastAspect || 1;
    r.getSize(size);
    if (size.y > 0) lastAspect = size.x / size.y;
    return lastAspect || 1;
  }

  /**
   * 把角度回绕到 (−π, π]（§4.7 的 yaw 区间）。
   * @param {number} a 弧度
   * @returns {number} 回绕后的弧度
   */
  function wrapPi(a) {
    return PB.mathx.mod(a + Math.PI, Math.PI * 2) - Math.PI;
  }

  /**
   * 由位置与注视点算朝向四元数（写入 out，避免分配）。
   * @param {{x:number,y:number,z:number}} p 相机位置
   * @param {{x:number,y:number,z:number}} l 注视点
   * @param {THREE.Quaternion} out 输出
   * @returns {THREE.Quaternion} out
   */
  function lookQuat(p, l, out) {
    _eye.set(p.x, p.y, p.z);
    _tgt.set(l.x, l.y, l.z);
    _m4.lookAt(_eye, _tgt, _up);
    return out.setFromRotationMatrix(_m4);
  }

  /**
   * 开始一次模式切换：快照当前相机位姿，供 0.6 s smoothstep 混合使用（§4.7）。
   * @param {number} next 目标机位 0..4
   * @param {object} G 一局状态
   * @returns {void}
   */
  function beginSwitch(next, G) {
    from.x = cam.position.x; from.y = cam.position.y; from.z = cam.position.z;
    fromQ.copy(cam.quaternion);
    from.fov = cam.fov; from.near = cam.near;
    mode = next;
    blendT = 0;
    G.cam.blendT = 0;
    // 进入电影镜头时从头播放（§4.7：模式切换进行中不推进 cineT）
    if (next === 2) { G.cam.cineShot = 0; G.cam.cineT = 0; }
  }

  /**
   * 切换机位（F3 的 camNext/camSet 与 §5.3 的 setCamera 都经这里）。越界机位忽略；
   * 同一机位重复请求不重启动画。切换结果经 store 持久化（§3.6「用户切换镜头后经 store.update 写入」）。
   * @param {number} i 机位 0..4
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.setMode = function (i, G) {
    if (!cam || !G) return;
    var n = i | 0;
    if (n < 0 || n > 4 || n === G.cam.mode) return;
    G.cam.mode = n;
    beginSwitch(n, G);
    PB.store.update(function (d) { d.settings.cam = n; });
  };

  /**
   * 电影镜头机位（§4.7 mode 2）：A/B 由 u = cineT/8 参数化，C 固定；全部相对"车"（x,0,0）。
   * @param {number} shot 0=A / 1=B / 2=C
   * @param {number} u 参数 [0,1]
   * @param {number} cenX 车的 x
   * @param {{x:number,y:number,z:number}} outPos 输出位置
   * @param {{x:number,y:number,z:number}} outLook 输出注视点
   * @returns {number} 该镜头的 FOV
   */
  function cinePose(shot, u, cenX, outPos, outLook) {
    var A = CINE.a, B = CINE.b, Cc = CINE.c;
    if (shot === 0) {
      outPos.x = cenX + A.dx; outPos.y = A.dy; outPos.z = PB.mathx.lerp(A.z0, A.z1, u);
      outLook.x = cenX; outLook.y = 1.0; outLook.z = 0;
      return A.fov;
    }
    if (shot === 1) {
      var phi = PB.mathx.lerp(B.phi0, B.phi1, u) * D2R;
      outPos.x = cenX + B.r * Math.sin(phi);
      outPos.y = PB.mathx.lerp(B.h0, B.h1, u);
      outPos.z = B.r * Math.cos(phi);
      outLook.x = cenX; outLook.y = 1.0; outLook.z = 0;
      return B.fov;
    }
    outPos.x = cenX + Cc.dx; outPos.y = Cc.dy; outPos.z = Cc.dz;
    outLook.x = cenX; outLook.y = 1.0; outLook.z = Cc.lookDz;
    return Cc.fov;
  }

  /**
   * 环绕镜头交互（§4.7 mode 4）：拖拽 0.3°/px、滚轮/捏合按 1.1 的幂缩放、无交互 3 s 后 6°/s 自转
   * （frozen 时不自转）。只写 G.cam.orbit（§3.6 的字段所有者），不写相机。
   * @param {object} G 一局状态
   * @param {number} dt 帧时长（秒）
   * @returns {void}
   */
  function orbitInput(G, dt) {
    var o = G.cam.orbit;
    var now = performance.now() / 1000;
    var ptrs = PB.input.orbitPointers();
    var n = ptrs.size;
    oP1 = null; oP2 = null;
    if (n > 0) ptrs.forEach(collectPtr);
    if (n === 1 && oP1) {
      if (oPrev.count === 1 && oPrev.id === oP1.id) {
        var dx = oP1.p.x - oPrev.x, dy = oP1.p.y - oPrev.y;
        if (dx !== 0 || dy !== 0) {
          o.yaw = wrapPi(o.yaw - dx * ORB.dragDeg * D2R);
          o.pitch = PB.mathx.clamp(o.pitch + dy * ORB.dragDeg * D2R,
            CFG.CAM_ORBIT_DEFAULT.pitchMinDeg * D2R, CFG.CAM_ORBIT_DEFAULT.pitchMaxDeg * D2R);
          o.lastInteractT = now;
        }
      }
      oPrev.count = 1; oPrev.id = oP1.id; oPrev.x = oP1.p.x; oPrev.y = oP1.p.y; oPrev.dist = 0;
    } else if (n >= 2 && oP1 && oP2) {
      // 双指捏合：按两指屏幕距离的比值以 1.1 的幂缩放 dist
      var ex = oP1.p.x - oP2.p.x, ey = oP1.p.y - oP2.p.y;
      var dist = Math.sqrt(ex * ex + ey * ey);
      if (oPrev.count >= 2 && oPrev.dist > 1) {
        var ratio = dist / oPrev.dist;
        if (ratio > 1.05 || ratio < 0.95) {
          o.dist = PB.mathx.clamp(o.dist * Math.pow(ORB.zoomPow, ratio > 1 ? 1 : -1),
            CFG.CAM_ORBIT_DEFAULT.distMin, CFG.CAM_ORBIT_DEFAULT.distMax);
          o.lastInteractT = now;
        }
      }
      oPrev.count = 2; oPrev.dist = dist;
    } else {
      oPrev.count = 0;
    }
    var w = PB.input.takeWheel();
    if (w) {
      o.dist = PB.mathx.clamp(o.dist * Math.pow(ORB.zoomPow, w > 0 ? 1 : -1),
        CFG.CAM_ORBIT_DEFAULT.distMin, CFG.CAM_ORBIT_DEFAULT.distMax);
      o.lastInteractT = now;
    }
    if (!o.frozen && (now - o.lastInteractT) > ORB.idleSec) {
      o.yaw = wrapPi(o.yaw + ORB.autoDeg * D2R * dt);
    }
  }

  /**
   * 计算当前机位的目标（位置、注视点、FOV、near、阻尼速率），写入模块级 tPos/tLook/tp。
   * @param {object} G 一局状态
   * @param {number} dt 帧时长（秒）
   * @returns {object} tp（复用对象）
   */
  function target(G, dt) {
    var b = G.bike;
    tp.rigid = false;
    tp.slerp = false;
    if (mode === 0) {
      // 追尾：位置绝对 y=2.4、注视点 y=1.3，保证 AC-1a/§1.3 的构图数值在任何 y 下成立
      tPos.x = b.x + CH.offset.x; tPos.y = CH.offset.y; tPos.z = CH.offset.z;
      tLook.x = b.x + CH.lookAt.x; tLook.y = CH.lookAt.y; tLook.z = CH.lookAt.z;
      tp.fov = CH.fov; tp.near = CH.near; tp.k = CH.kPos;
    } else if (mode === 1) {
      // 侧视（ADR-34：海侧远景）。offset/look 的 y 都是**世界绝对高度**（0.6，不叠加车高），
      // z 也是绝对值（车恒在 z=0）。x 跟随车，使三条车道都满足"下半 ≥40% 海面 + 车在中央 1/3"。
      tPos.x = b.x + SIDE.offset.x; tPos.y = SIDE.offset.y; tPos.z = SIDE.offset.z;
      tLook.x = b.x + SIDE.look.x; tLook.y = SIDE.look.y; tLook.z = SIDE.look.z;
      tp.fov = SIDE.fov; tp.near = SIDE.near; tp.k = SIDE.k;
    } else if (mode === 2) {
      // 电影：8 s 一个镜头、1.2 s 过渡。过渡期把上一镜头末帧与下一镜头首帧按 smoothstep 混合。
      if (blendT >= 1) G.cam.cineT += dt;
      var T = G.cam.cineT;
      var k = G.cam.cineShot % 3;
      if (T <= CINE.shotSec) {
        tp.fov = cinePose(k, PB.mathx.clamp(T / CINE.shotSec, 0, 1), b.x, tPos, tLook);
        tp.near = CINE.near; tp.k = CINE.k;
      } else {
        var alpha = PB.mathx.smoothstep(0, 1, (T - CINE.shotSec) / CINE.blendSec);
        var k2 = (k + 1) % 3;
        var f1 = cinePose(k, 1, b.x, _pa, _la);
        var f2 = cinePose(k2, 0, b.x, _pb, _lb);
        if (T - CINE.shotSec >= CINE.blendSec) {
          // 过渡结束：切到下一镜头并把 cineT 归零（下一帧从这里开始参数化）
          G.cam.cineShot = k2;
          G.cam.cineT = T - CINE.shotSec - CINE.blendSec;
          tPos.x = _pb.x; tPos.y = _pb.y; tPos.z = _pb.z;
          tLook.x = _lb.x; tLook.y = _lb.y; tLook.z = _lb.z;
          tp.fov = f2;
        } else {
          tPos.x = PB.mathx.lerp(_pa.x, _pb.x, alpha);
          tPos.y = PB.mathx.lerp(_pa.y, _pb.y, alpha);
          tPos.z = PB.mathx.lerp(_pa.z, _pb.z, alpha);
          tLook.x = PB.mathx.lerp(_la.x, _lb.x, alpha);
          tLook.y = PB.mathx.lerp(_la.y, _lb.y, alpha);
          tLook.z = PB.mathx.lerp(_la.z, _lb.z, alpha);
          tp.fov = PB.mathx.lerp(f1, f2, alpha);
          // 朝向用 slerp（§4.7 公共规则）：两个镜头朝向的四元数按 alpha 球面插值
          lookQuat(_pa, _la, qa);
          lookQuat(_pb, _lb, qb);
          qa.slerp(qb, alpha);
          curQ.copy(qa);
          tp.slerp = true;
        }
        tp.near = CINE.near; tp.k = CINE.k;
      }
    } else if (mode === 3) {
      // POV：rig.M·(0,1.85,−0.47)，朝向 = rig 旋转后的 −Z；刚性（无阻尼），near 0.05（喙根深度 0.11）
      PB.rig.toWorld(G, CFG.CAM_POV.offset, tPos);
      var m = G.rig.M;
      tLook.x = tPos.x - m[8]; tLook.y = tPos.y - m[9]; tLook.z = tPos.z - m[10];
      tp.fov = CFG.CAM_POV.fov; tp.near = CFG.CAM_POV.near; tp.rigid = true; tp.k = 0;
    } else {
      // 环绕：车 + (0,1,0) + dist·(cos pitch·sin yaw, sin pitch, cos pitch·cos yaw)
      var o = G.cam.orbit;
      var cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
      tPos.x = b.x + cp * Math.sin(o.yaw) * o.dist;
      tPos.y = 1 + sp * o.dist;
      tPos.z = cp * Math.cos(o.yaw) * o.dist;
      tLook.x = b.x; tLook.y = 1.0; tLook.z = 0;
      tp.fov = ORB.fov; tp.near = ORB.near; tp.k = ORB.k;
    }
    return tp;
  }

  /**
   * 每帧更新镜头（§3.4 F9）。顺序：同步机位 → 机位内部时间/交互 → 目标 → 阻尼 → 模式混合 →
   * 避障（最后）→ 写相机与投影 → POV 头部可见性 → camUsed。
   *
   * @param {object} G 一局状态
   * @param {number} dt 本帧时间步（秒）
   * @returns {void}
   */
  S.update = function (G, dt) {
    if (!cam || !G) return;

    // 步骤1：机位同步。G.cam.mode 是唯一来源（store/UI/debug 都只改它）；变化时启动 0.6 s 混合。
    if (G.cam.mode !== mode) beginSwitch(G.cam.mode, G);

    // 步骤2：mode 4 的 orbit 交互先跑（只写 G.cam.orbit，作为本帧的目标输入）
    if (mode === 4) orbitInput(G, dt);

    // 步骤3：目标 + 阻尼。POV 刚性吸附；其余按各自 k 指数阻尼（§4.7 表格）。
    var t = target(G, dt);
    if (t.rigid || !inited) {
      // 刚性机位（POV）没有阻尼，但仍参与"模式之间 0.6 s 混合"（§4.7）：pos 直接取目标，
      // 由下面的 blend 步骤从上一机位的快照插值过去。首帧（inited=false）直接吸附。
      pos.x = tPos.x; pos.y = tPos.y; pos.z = tPos.z;
      look.x = tLook.x; look.y = tLook.y; look.z = tLook.z;
      if (!inited) blendT = 1;
    } else {
      pos.x = PB.mathx.damp(pos.x, tPos.x, t.k, dt);
      pos.y = PB.mathx.damp(pos.y, tPos.y, t.k, dt);
      pos.z = PB.mathx.damp(pos.z, tPos.z, t.k, dt);
      var kl = mode === 0 ? CH.kLook : t.k;
      look.x = PB.mathx.damp(look.x, tLook.x, kl, dt);
      look.y = PB.mathx.damp(look.y, tLook.y, kl, dt);
      look.z = PB.mathx.damp(look.z, tLook.z, kl, dt);
    }

    // 步骤4：朝向。普通情况由（阻尼后的）位置与注视点算；电影过渡已在上面的 slerp 写入 curQ。
    if (!t.slerp) lookQuat(pos, look, tQ);

    // 步骤5：模式间混合（0.6 s）。位置线性、朝向 slerp、FOV/near lerp，都用 smoothstep 的 u。
    var fov = t.fov, near = t.near;
    if (!t.slerp) {
      if (blendT < 1 && dt > 0) {
        blendT = Math.min(1, blendT + dt / CFG.CAM_BLEND_SEC);
        var u = PB.mathx.smoothstep(0, 1, blendT);
        fpos.x = PB.mathx.lerp(from.x, pos.x, u);
        fpos.y = PB.mathx.lerp(from.y, pos.y, u);
        fpos.z = PB.mathx.lerp(from.z, pos.z, u);
        curQ.copy(fromQ).slerp(tQ, u);
        fov = PB.mathx.lerp(from.fov, fov, u);
        near = PB.mathx.lerp(from.near, near, u);
      } else {
        fpos.x = pos.x; fpos.y = pos.y; fpos.z = pos.z;
        curQ.copy(tQ);
      }
    } else {
      fpos.x = pos.x; fpos.y = pos.y; fpos.z = pos.z;
    }

    // 步骤6：避障（最后执行，§4.7）。x ∈ [−15,60]；y ≥ camFloor(x)；mode 0 离车 ≥2.5。
    if (fpos.x < LIM.X0) fpos.x = LIM.X0;
    else if (fpos.x > LIM.X1) fpos.x = LIM.X1;
    var floorY = CFG.camFloor(fpos.x);
    if (fpos.y < floorY) fpos.y = floorY;
    if (mode === 0) {
      var ddx = fpos.x - G.bike.x, ddz = fpos.z;
      var d2 = ddx * ddx + ddz * ddz;
      if (d2 < LIM.CHASE_MIN * LIM.CHASE_MIN) {
        var dl = Math.sqrt(d2) || 1;
        fpos.x = G.bike.x + ddx / dl * LIM.CHASE_MIN;
        fpos.z = ddz / dl * LIM.CHASE_MIN;
      }
    }

    // 步骤7：写相机。位置/朝向直接写；投影只在参数变化时重建（M-31）。
    cam.position.set(fpos.x, fpos.y, fpos.z);
    cam.quaternion.copy(curQ);
    var a = aspect();
    if (cam.fov !== fov || cam.near !== near || cam.far !== CFG.CAM_FAR || Math.abs(a - appliedAspect) > 1e-6) {
      cam.fov = fov;
      cam.near = near;
      cam.far = CFG.CAM_FAR;
      cam.aspect = a;
      appliedAspect = a;
      cam.updateProjectionMatrix();
    }
    inited = true;

    // 步骤8：POV 头部可见性。dHead < 0.6 隐藏（头/头盔/墨镜），> 0.9 显示；喙组始终可见。
    // 每帧断言两条不变式（AC-8b：隐藏时 dHead<0.9、显示时 dHead>0.6），违例计数供浏览器门禁用。
    var hw = G.rig.headW;
    var ex = cam.position.x - hw.x, ey = cam.position.y - hw.y, ez = cam.position.z - hw.z;
    dHead = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (headHidden) { if (dHead > CFG.CAM_HEAD.show) headHidden = false; }
    else if (dHead < CFG.CAM_HEAD.hide) headHidden = true;
    if (headHidden && dHead >= CFG.CAM_HEAD.show) headViolations++;
    if (!headHidden && dHead <= CFG.CAM_HEAD.hide) headViolations++;
    G.cam.headHidden = headHidden;
    var hg = PB.pelican.headGroup();
    if (hg) hg.visible = !headHidden;

    // 步骤9：camUsed 累加（G.stats.camUsed 的唯一写者是 camera，§3.6）
    G.cam.blendT = blendT;
    G.stats.camUsed[G.cam.mode] += dt;
  };

  /**
   * @returns {number} 最近一帧相机到 headW 的距离（AC-8b 读数）
   */
  S.distanceToHead = function () { return dHead; };

  /**
   * @returns {number} 头部可见性不变式的累计违例数（AC-8b 的逐帧断言）
   */
  S.headViolations = function () { return headViolations; };
})(window.PB = window.PB || {});
