// TASK-002 P5: 角色与自行车（plan.md §1.5 比例 M-04、§1.4 色值 M-03、§4.13 rig M-25、§3.5 pelican 签名）。
// 全部子件用 §1.5 的局部坐标建在 pelicanRoot 下；根节点每帧取 G.rig.M（matrixAutoUpdate=false），
// 因此渲染位置与 AC-1d 的判定位置同源（ADR-15）。围巾飘带由 P6 追加（§4.1 渲染段），夜灯由 P7 推送。
(function (PB) {
  'use strict';
  var CFG = PB.config, PEL = CFG.PEL, BK = CFG.BIKE, C = CFG.COLORS;
  var S = PB.pelican = {};

  var root = null;              // 角色根：matrix = G.rig.M
  var shadow = null;            // blob 阴影（世界系圆片，不随 wheelie/lean 旋转）
  var headGroup = null;         // 头 + 头盔 + 墨镜：POV 近距时隐藏（§4.7，P10 接线）
  var beakMarker = null;        // 喙尖标记（AC-1d 的世界坐标读数点）
  var beakMesh = null;          // 喙网格（用真实网格顶点复核与 rig 的一致性）
  var scarfMesh = null;         // 围巾飘带（§4.1 渲染段：26 顶点、DoubleSide、Lambert、scene 根下单位变换）
  var collarMesh = null;        // 颈环（§1.5 torus，刚体、与围巾同色，不参与模拟）
  var glassesGroup = null;      // 墨镜两片 + 镜框（AC-1b(iii) 的差分判据要能单独隐藏它们）
  var crankR = null, crankL = null;
  var thighR = null, thighL = null, shinR = null, shinL = null, footR = null, footL = null;
  var wingR = null, wingL = null, wheelR = null, wheelF = null;
  var night = 0;                // setNight 入参（0..1），初值 0（§3.5）

  // M-31：稳态帧不新建对象，所有中间量复用。
  // THREE 对象必须延迟到 S.init 才创建：本文件在 main.js 之前加载，vendor 缺失时
  // 加载期引用 THREE 会抛 pageerror，破坏 §4.11 的 vendorMissing 判定路径。
  var _v = null, _q = null, _up = null, _w = null;
  var _knee = { x: 0, y: 0, z: 0 }, _hip = { x: 0, y: 0, z: 0 };
  var _pedalR = { x: 0, y: 0, z: 0 }, _pedalL = { x: 0, y: 0, z: 0 };

  /**
   * 建一个 Lambert 材质（M-03：色值经 THREE.Color 转线性空间）。
   * @param {string} hex sRGB 十六进制
   * @param {boolean} [double] 是否双面
   * @returns {THREE.MeshLambertMaterial} 材质
   */
  function mat(hex, double) {
    return new THREE.MeshLambertMaterial({ color: new THREE.Color(hex), side: double ? THREE.DoubleSide : THREE.FrontSide });
  }

  /**
   * 把一条单位高圆柱摆到两点之间（用于车架、颈、腿）。只在 init 或每帧末调用，
   * 通过 scale.y 表达长度，因此不需要重建几何体（M-31）。
   * @param {THREE.Mesh} m 目标网格（几何体高度 1、中心在原点）
   * @param {number} ax 起点 x
   * @param {number} ay 起点 y
   * @param {number} az 起点 z
   * @param {number} bx 终点 x
   * @param {number} by 终点 y
   * @param {number} bz 终点 z
   * @returns {void}
   */
  function placeSeg(m, ax, ay, az, bx, by, bz) {
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    m.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
    _v.set(dx, dy, dz).normalize();
    _q.setFromUnitVectors(_up, _v);
    m.quaternion.copy(_q);
    m.scale.set(1, len > 1e-6 ? len : 1e-6, 1);
  }

  /**
   * 建一段固定圆柱（静态部件用，几何体高度直接等于长度）。
   * @param {number[]} seg [ax,ay,az,bx,by,bz]
   * @param {number} r 半径
   * @param {THREE.Material} material 材质
   * @param {number} [radialSeg] 径向分段
   * @returns {THREE.Mesh} 已摆好的网格
   */
  function staticSeg(seg, r, material, radialSeg) {
    var dx = seg[3] - seg[0], dy = seg[4] - seg[1], dz = seg[5] - seg[2];
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var g = new THREE.CylinderGeometry(r, r, len, radialSeg || 8);
    var m = new THREE.Mesh(g, material);
    placeSeg(m, seg[0], seg[1], seg[2], seg[3], seg[4], seg[5]);
    return m;
  }

  /**
   * 把多个只读几何体合并成一个（静态、共享同一材质时用，减少 mesh 数 → §2.2 的 ≤40 预算）。
   * 只支持带 index 的 position/normal 属性；合并后顶点与三角面完全等价于逐个绘制。
   *
   * @param {THREE.BufferGeometry[]} list 已应用世界/局部变换的几何体
   * @returns {THREE.BufferGeometry} 合并后的几何体
   */
  function mergeGeoms(list) {
    var totalV = 0, totalI = 0, i, g;
    for (i = 0; i < list.length; i++) {
      totalV += list[i].getAttribute('position').count;
      totalI += list[i].getIndex().count;
    }
    var pos = new Float32Array(totalV * 3);
    var nrm = new Float32Array(totalV * 3);
    var idx = totalV > 65535 ? new Uint32Array(totalI) : new Uint16Array(totalI);
    var vo = 0, io = 0;
    for (i = 0; i < list.length; i++) {
      g = list[i];
      pos.set(g.getAttribute('position').array, vo * 3);
      nrm.set(g.getAttribute('normal').array, vo * 3);
      var gi = g.getIndex().array;
      for (var j = 0; j < gi.length; j++) idx[io + j] = gi[j] + vo;
      vo += g.getAttribute('position').count;
      io += gi.length;
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  /**
   * 建自行车（§1.5 比例表逐项）。轮组、曲柄、踏板单独成组以便每帧更新。
   * @returns {void}
   */
  function buildBike() {
    var frameMat = mat(C.frame), tireMat = mat(C.tire), rimMat = mat(C.rim);

    // 轮：轮胎 + 轮辋 + 12 根辐条（每轮 1 个 LineSegments，§1.5）
    function wheel(axle) {
      var g = new THREE.Group();
      g.position.set(axle.x, axle.y, axle.z);
      var tireGeo = new THREE.TorusGeometry(BK.WHEEL_R, BK.TIRE_R, 8, 24);
      tireGeo.rotateY(Math.PI / 2);            // 环面从 XY 平面转到 ZY 平面
      g.add(new THREE.Mesh(tireGeo, tireMat));
      var rimGeo = new THREE.TorusGeometry(BK.WHEEL_R - BK.TIRE_R, 0.012, 4, 24);
      rimGeo.rotateY(Math.PI / 2);
      g.add(new THREE.Mesh(rimGeo, rimMat));
      var sp = new Float32Array(BK.SPOKES * 6);
      for (var i = 0; i < BK.SPOKES; i++) {
        var a = i * Math.PI * 2 / BK.SPOKES;
        sp[i * 6] = 0; sp[i * 6 + 1] = 0.02 * Math.cos(a); sp[i * 6 + 2] = 0.02 * Math.sin(a);
        sp[i * 6 + 3] = 0; sp[i * 6 + 4] = (BK.WHEEL_R - BK.TIRE_R) * Math.cos(a);
        sp[i * 6 + 5] = (BK.WHEEL_R - BK.TIRE_R) * Math.sin(a);
      }
      var sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: new THREE.Color(C.rim) })));
      root.add(g);
      return g;
    }
    wheelR = wheel(BK.REAR_AXLE);
    wheelF = wheel(BK.FRONT_AXLE);

    // 牙盘：半径 0.10，x=+0.05（法线沿 X）
    var ringGeo = new THREE.CylinderGeometry(BK.CHAINRING_R, BK.CHAINRING_R, 0.008, 16);
    ringGeo.rotateZ(Math.PI / 2);
    var ring = new THREE.Mesh(ringGeo, rimMat);
    ring.position.set(BK.CHAINRING_X, BK.BB.y, BK.BB.z);
    root.add(ring);

    // 曲柄：组心在 BB±0.11，绕局部 X 转 −θ；θ=0 时踏板在最高点（§1.5 参数化）
    function crank(sign) {
      var g = new THREE.Group();
      g.position.set(BK.BB.x + sign * BK.CRANK_X, BK.BB.y, BK.BB.z);
      var armGeo = new THREE.CylinderGeometry(0.014, 0.014, BK.CRANK, 6);
      var arm = new THREE.Mesh(armGeo, frameMat);
      arm.position.set(0, BK.CRANK * 0.5, 0);
      g.add(arm);
      var pedal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.06), mat(C.tire));
      pedal.position.set(0, BK.CRANK, 0);
      g.add(pedal);
      root.add(g);
      return { group: g, pedal: pedal };
    }
    crankR = crank(1);
    crankL = crank(-1);

    // 车架 6 管 + 把立（§1.5 逐段坐标）：静态、同材质、同层，合并为 1 个 mesh（§2.2 的 mesh 预算）
    var chassis = [];
    for (var i = 0; i < BK.FRAME.length; i++) {
      var seg = staticSeg(BK.FRAME[i], BK.TUBE_R, frameMat, 8);
      seg.updateMatrix();
      var sg = seg.geometry.clone();
      sg.applyMatrix4(seg.matrix);
      chassis.push(sg);
      seg.geometry.dispose();
    }
    root.add(new THREE.Mesh(mergeGeoms(chassis), frameMat));
    for (var ci = 0; ci < chassis.length; ci++) chassis[ci].dispose();
    // 座垫（顶面中心 (0,0.95,−0.22)，长 0.26）与车把（中心 (0,1.02,−0.98)，宽 0.50）
    var saddle = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, BK.SADDLE_LEN), mat(C.tire));
    saddle.position.set(BK.SEAT.x, BK.SEAT.y - 0.02, BK.SEAT.z);
    root.add(saddle);
    var barGeo = new THREE.CylinderGeometry(0.015, 0.015, BK.BAR_W, 8);
    barGeo.rotateZ(Math.PI / 2);
    var bar = new THREE.Mesh(barGeo, frameMat);
    bar.position.set(BK.BAR.x, BK.BAR.y, BK.BAR.z);
    root.add(bar);
  }

  /**
   * 建鹈鹕（§1.5 比例表；smooth shading 满足 §1.6 目标视觉 T1）。
   * @returns {void}
   */
  function buildPelican() {
    var featherMat = mat(C.feather), backMat = mat(C.featherBack), beakMat = mat(C.beak), legMat = mat(C.leg);

    // 躯干：椭球中心 (0,1.15,−0.38)，半轴 (0.28,0.36,0.50)，Rx=+25°（前端抬高）。
    // 经向/纬向分段都取 24（ADR-23）：弦高 ≤0.5·(1−cos7.5°)=0.0043 < 碰撞外扩 ε=0.005，
    // 因此"渲染表面"与"碰撞椭球"之间的差不会把飘带切进可见的躯体里。
    var torso = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), featherMat);
    torso.scale.set(PEL.TORSO_R.x, PEL.TORSO_R.y, PEL.TORSO_R.z);
    torso.position.set(PEL.TORSO.x, PEL.TORSO.y, PEL.TORSO.z);
    torso.rotation.x = PEL.TORSO_RX;
    root.add(torso);
    // 背部覆羽：略大于躯干上侧的椭球，取 M-03 的"背部"色（与翼同色）；分段同躯干（ADR-23 的 ≥24）
    var mantle = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), backMat);
    mantle.scale.set(0.29, 0.28, 0.46);
    mantle.position.set(0, 1.24, -0.42);
    mantle.rotation.x = PEL.TORSO_RX;
    root.add(mantle);

    // 颈：两段半径 0.06 的圆柱，(0,1.40,−0.62)→(0,1.62,−0.66)→(0,1.75,−0.48)
    var neckGeo = new THREE.CylinderGeometry(PEL.NECK_R, PEL.NECK_R, 1, 8);
    var neck1 = new THREE.Mesh(neckGeo, featherMat);
    placeSeg(neck1, PEL.NECK[0][0], PEL.NECK[0][1], PEL.NECK[0][2], PEL.NECK[1][0], PEL.NECK[1][1], PEL.NECK[1][2]);
    var neck2 = new THREE.Mesh(neckGeo, featherMat);
    placeSeg(neck2, PEL.NECK[1][0], PEL.NECK[1][1], PEL.NECK[1][2], PEL.NECK[2][0], PEL.NECK[2][1], PEL.NECK[2][2]);
    root.add(neck1);
    root.add(neck2);

    // 头组：头 + 头盔 + 头盔条纹 + 墨镜（§4.7 POV 近距时整组隐藏）
    headGroup = new THREE.Group();
    var head = new THREE.Mesh(new THREE.SphereGeometry(PEL.HEAD_R, 16, 12), featherMat);
    head.position.set(CFG.HEAD_CENTER_L.x, CFG.HEAD_CENTER_L.y, CFG.HEAD_CENTER_L.z);
    headGroup.add(head);
    var helmetGeo = new THREE.SphereGeometry(PEL.HELMET_R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    var helmet = new THREE.Mesh(helmetGeo, mat(C.helmet));
    helmet.position.set(PEL.HELMET.x, PEL.HELMET.y, PEL.HELMET.z);
    headGroup.add(helmet);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.30), mat(C.helmetStripe));
    stripe.position.set(PEL.HELMET.x, CFG.HELMET_TOP_Y - 0.004, PEL.HELMET.z);
    headGroup.add(stripe);
    // 墨镜（§1.5，ADR-26）：两片 0.07×0.045×0.012，中心 (±0.07,1.765,−0.583)，朝 −Z；
    // 八个角都在头球外（到头心 ≥0.16）且在头盔沿以下（y ≤ 1.79），因此从正面/侧前方真实可见。
    // 镜框贴在两片之后，只作为 M-03 的第二种色值的载体，不改变镜片包围盒。
    glassesGroup = new THREE.Group();
    var lensGeo = new THREE.BoxGeometry(PEL.GLASS.w, PEL.GLASS.h, PEL.GLASS.d);
    for (var s = -1; s <= 1; s += 2) {
      var lens = new THREE.Mesh(lensGeo, new THREE.MeshPhongMaterial({ color: new THREE.Color(C.lens), shininess: 90 }));
      lens.position.set(s * PEL.GLASS.x, PEL.GLASS.y, PEL.GLASS.z);
      glassesGroup.add(lens);
    }
    var frame = new THREE.Mesh(new THREE.BoxGeometry(2 * PEL.GLASS.x + PEL.GLASS.w, PEL.GLASS.h + 0.014, 0.008), mat(C.lensFrame));
    frame.position.set(0, PEL.GLASS.y, PEL.GLASS.z + PEL.GLASS.d * 0.5 + 0.004);
    glassesGroup.add(frame);
    headGroup.add(glassesGroup);
    root.add(headGroup);

    // 喙组（始终可见）：喙根 (0,1.75,−0.58) 宽 0.07 → 尖 BEAK_TIP_L 宽 0.03；喉囊椭球
    var beakGeo = new THREE.BufferGeometry();
    var hw = PEL.BEAK_ROOT_W / 2, hh = 0.025, tw = PEL.BEAK_TIP_W / 2, th = 0.010;
    var r0 = PEL.BEAK_ROOT, tp = CFG.BEAK_TIP_L;
    var bv = new Float32Array([
      -hw, r0.y + hh, r0.z, hw, r0.y + hh, r0.z, -hw, r0.y - hh, r0.z, hw, r0.y - hh, r0.z,
      -tw, tp.y + th, tp.z, tw, tp.y + th, tp.z, -tw, tp.y - th, tp.z, tw, tp.y - th, tp.z
    ]);
    beakGeo.setAttribute('position', new THREE.BufferAttribute(bv, 3));
    beakGeo.setIndex([0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5, 4, 5, 6, 5, 7, 6]);
    beakGeo.computeVertexNormals();
    var beak = new THREE.Mesh(beakGeo, beakMat);
    beakMesh = beak;
    root.add(beak);
    var pouch = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), beakMat);
    pouch.scale.set(PEL.POUCH_R.x, PEL.POUCH_R.y, PEL.POUCH_R.z);
    pouch.position.set(PEL.POUCH.x, PEL.POUCH.y, PEL.POUCH.z);
    root.add(pouch);

    // 喙尖标记：AC-1d 用它的世界坐标与 G.rig.beakW 比较（§4.13）
    beakMarker = new THREE.Object3D();
    beakMarker.position.set(tp.x, tp.y, tp.z);
    root.add(beakMarker);

    // 翼：枢轴 (±0.27,1.30,−0.35)，单翼长 0.80，展开 0→75°（绕 z 轴向外）
    function wing(sign) {
      var g = new THREE.Group();
      g.position.set(sign * PEL.WING.x, PEL.WING.y, PEL.WING.z);
      var L = PEL.WING.len;
      var wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        sign * 0.02, 0, -0.10, sign * 0.02, 0, 0.10,
        sign * L * 0.55, 0, -0.13, sign * L * 0.55, 0, 0.10,
        sign * L, 0, -0.02
      ]), 3));
      wg.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 4]);
      wg.computeVertexNormals();
      g.add(new THREE.Mesh(wg, mat(C.featherBack, true)));
      root.add(g);
      return g;
    }
    wingR = wing(1);
    wingL = wing(-1);

    // 腿：髋 (±0.12,1.00,−0.24)，大腿/小腿各 0.46，脚为蹼状三角 0.12（每帧解析 IK）
    var thighGeo = new THREE.CylinderGeometry(PEL.LEG_R, PEL.LEG_R * 0.8, 1, 8);
    var shinGeo = new THREE.CylinderGeometry(PEL.LEG_R * 0.8, PEL.LEG_R * 0.6, 1, 8);
    thighR = new THREE.Mesh(thighGeo, legMat);
    thighL = new THREE.Mesh(thighGeo, legMat);
    shinR = new THREE.Mesh(shinGeo, legMat);
    shinL = new THREE.Mesh(shinGeo, legMat);
    root.add(thighR); root.add(thighL); root.add(shinR); root.add(shinL);
    function foot(sign) {
      var fg = new THREE.BufferGeometry();
      var h = PEL.FOOT / 2;
      fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        sign * h, 0, 0.04, -sign * h, 0, 0.04, 0, 0, -PEL.FOOT
      ]), 3));
      fg.setIndex([0, 1, 2]);
      fg.computeVertexNormals();
      var m = new THREE.Mesh(fg, mat(C.leg, true));
      root.add(m);
      return m;
    }
    footR = foot(1);
    footL = foot(-1);

    // 颈环：torus 中心 (0,1.55,−0.65)，R 0.11，管半径 0.035（环面水平）
    var ringGeo = new THREE.TorusGeometry(PEL.RING.r, PEL.RING.tube, 8, 16);
    ringGeo.rotateX(Math.PI / 2);
    var ring = new THREE.Mesh(ringGeo, mat(C.scarf));
    ring.position.set(PEL.RING.x, PEL.RING.y, PEL.RING.z);
    collarMesh = ring;
    root.add(ring);
  }

  /**
   * 建围巾飘带（§4.1 的渲染段）：2 列 × 13 行带状网格、26 顶点、DoubleSide、Lambert、颜色 #D7262E。
   * 顶点坐标是世界坐标（每帧由 G.scarf.P 写入），因此挂在 scene 根下、单位变换；若挂在 pelicanRoot 下
   * 会与 G.rig.M 叠加，导致画面与 §4.1 的测量量不同源（M-25）。
   *
   * @param {THREE.Scene} scene 场景
   * @returns {void}
   */
  function buildScarf(scene) {
    var rows = CFG.SCARF.ROWS, cols = CFG.SCARF.COLS;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
    // 法线属性必须在这里建好：updateScarf 每帧就地累加面法线，不调用 three 的 computeVertexNormals（M-31）
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
    var idx = [];
    for (var r = 0; r < rows - 1; r++) {
      for (var c = 0; c < cols - 1; c++) {
        var a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
    }
    geo.setIndex(idx);
    scarfMesh = new THREE.Mesh(geo, mat(C.scarf, true));
    scarfMesh.frustumCulled = false;   // 顶点每帧变化，包围球无意义
    scene.add(scarfMesh);
  }

  /**
   * 每帧把 G.scarf.P 写进围巾顶点并重算法线（§4.1）。写的是同一份模拟状态，不插值、不加偏移。
   * 法线在本函数内按面法线累加后归一化：three 的 computeVertexNormals 每次调用会新建 7 个 Vector3，
   * 违反 M-31（稳态帧不得新建对象），因此这里用预分配的 Float32Array 手工算。
   *
   * @param {object} G 一局状态
   * @returns {void}
   */
  function updateScarf(G) {
    if (!scarfMesh || !G.scarf) return;
    var geo = scarfMesh.geometry;
    var posAttr = geo.getAttribute('position');
    var nrmAttr = geo.getAttribute('normal');
    var pos = posAttr.array, nrm = nrmAttr.array, P = G.scarf.P;
    var i;
    for (i = 0; i < pos.length; i++) pos[i] = P[i];
    for (i = 0; i < nrm.length; i++) nrm[i] = 0;
    var idx = geo.getIndex().array;
    for (i = 0; i < idx.length; i += 3) {
      var a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      var abx = pos[b] - pos[a], aby = pos[b + 1] - pos[a + 1], abz = pos[b + 2] - pos[a + 2];
      var acx = pos[c] - pos[a], acy = pos[c + 1] - pos[a + 1], acz = pos[c + 2] - pos[a + 2];
      // 面法线 = ab × ac（未归一化，面积权重自然保留）
      var nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
      nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz;
      nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (i = 0; i < nrm.length; i += 3) {
      var len = Math.sqrt(nrm[i] * nrm[i] + nrm[i + 1] * nrm[i + 1] + nrm[i + 2] * nrm[i + 2]);
      if (len > 1e-12) { nrm[i] /= len; nrm[i + 1] /= len; nrm[i + 2] /= len; }
      else { nrm[i] = 0; nrm[i + 1] = 1; nrm[i + 2] = 0; }
    }
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
  }

  /**
   * 建 blob 阴影（§1.5：椭圆 0.7×1.6，中心局部 (0,0.01,−0.52)，不随 wheelie/lean 旋转）。
   * 阴影挂在 scene 根下（世界系），因此只用 rig 的 x；这是 §1.5 明确要求的例外。
   * @param {THREE.Scene} scene 场景
   * @returns {void}
   */
  function buildShadow(scene) {
    var g = new THREE.CircleGeometry(1, 24);
    g.rotateX(-Math.PI / 2);
    shadow = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0, depthWrite: false
    }));
    shadow.scale.set(PEL.SHADOW.rx, 1, PEL.SHADOW.rz);
    shadow.position.set(0, PEL.SHADOW.y, PEL.SHADOW.z);
    scene.add(shadow);
  }

  /**
   * 两段解析 IK（§1.5 可达性：髋到踏板距离 ∈ [0.553,0.893] < 0.92，恒有解）。
   * 膝朝 −Z 弯：取 (0,0,−1) 对腿方向的正交分量作为弯曲平面法向。
   *
   * @param {{x:number,y:number,z:number}} hip 髋局部坐标
   * @param {{x:number,y:number,z:number}} p 踏板局部坐标
   * @param {{x:number,y:number,z:number}} out 膝输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  function solveKnee(hip, p, out) {
    var dx = p.x - hip.x, dy = p.y - hip.y, dz = p.z - hip.z;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-6) d = 1e-6;
    var L = PEL.THIGH;
    var a = d * 0.5;                                  // (d² + L² − L²)/(2d)，两段等长
    var h = Math.sqrt(Math.max(0, L * L - a * a));     // 垂距；d > 2L 时退化为 0
    var ux = dx / d, uy = dy / d, uz = dz / d;
    var dot = -uz;                                     // (0,0,−1)·u
    var nx = -ux * dot, ny = -uy * dot, nz = -1 - uz * dot;
    var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    out.x = hip.x + ux * a + nx / nl * h;
    out.y = hip.y + uy * a + ny / nl * h;
    out.z = hip.z + uz * a + nz / nl * h;
    return out;
  }

  /**
   * 曲柄参数化（§1.5）：右踏板 = BB + (0.11, 0.17cosθ, −0.17sinθ)，左踏板用 θ+π。
   * @param {number} theta 曲柄角（G.bike.crank 或其 +π）
   * @param {number} sign +1 右 / −1 左
   * @param {{x:number,y:number,z:number}} out 输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  function pedalPos(theta, sign, out) {
    out.x = BK.BB.x + sign * BK.CRANK_X;
    out.y = BK.BB.y + BK.CRANK * Math.cos(theta);
    out.z = BK.BB.z - BK.CRANK * Math.sin(theta);
    return out;
  }

  /**
   * 建角色根、自行车、鹈鹕与阴影（boot 时一次，§3.6）。
   * @param {THREE.Scene} scene 场景
   * @returns {void}
   */
  S.init = function (scene) {
    if (root) return;
    _v = new THREE.Vector3();
    _q = new THREE.Quaternion();
    _up = new THREE.Vector3(0, 1, 0);
    _w = new THREE.Vector3();
    root = new THREE.Group();
    root.matrixAutoUpdate = false;   // 矩阵只由 G.rig.M 写入（M-25）
    scene.add(root);
    buildBike();
    buildPelican();
    buildShadow(scene);
    buildScarf(scene);
    S.setNight(0);
  };

  /**
   * 每帧 F8：写根矩阵、曲柄/踏板、腿部 IK、翼展开、轮自转与阴影（§1.5 / §4.13）。
   * 所有派生量都从 G 的同一份状态算出，不保存第二份位置（M-10 / M-23）。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.update = function (G) {
    if (!root) return;
    root.matrix.fromArray(G.rig.M);
    root.matrixWorldNeedsUpdate = true;

    // 步骤1：曲柄组按 −θ 绕 X 旋转，使子件踏板落在 §1.5 的解析位置
    var th = G.bike.crank;
    crankR.group.rotation.x = -th;
    crankL.group.rotation.x = -(th + Math.PI);
    pedalPos(th, 1, _pedalR);
    pedalPos(th + Math.PI, -1, _pedalL);

    // 步骤2：腿部两段 IK。髋在 (±0.12,1.00,−0.24)，脚点等于同侧踏板点
    _hip.x = PEL.HIP.x; _hip.y = PEL.HIP.y; _hip.z = PEL.HIP.z;
    solveKnee(_hip, _pedalR, _knee);
    placeSeg(thighR, PEL.HIP.x, PEL.HIP.y, PEL.HIP.z, _knee.x, _knee.y, _knee.z);
    placeSeg(shinR, _knee.x, _knee.y, _knee.z, _pedalR.x, _pedalR.y, _pedalR.z);
    footR.position.set(_pedalR.x, _pedalR.y, _pedalR.z);
    _hip.x = -PEL.HIP.x;
    solveKnee(_hip, _pedalL, _knee);
    placeSeg(thighL, -PEL.HIP.x, PEL.HIP.y, PEL.HIP.z, _knee.x, _knee.y, _knee.z);
    placeSeg(shinL, _knee.x, _knee.y, _knee.z, _pedalL.x, _pedalL.y, _pedalL.z);
    footL.position.set(_pedalL.x, _pedalL.y, _pedalL.z);

    // 步骤3：翼展开 0→75°（wing=1 时水平外展，wing=0 时下垂收拢）
    var open = (1 - G.bike.wing) * PEL.WING.maxDeg * Math.PI / 180;
    wingR.rotation.z = -open;
    wingL.rotation.z = open;

    // 步骤4：轮自转（弧长/半径，模 2π 保精度）。轮胎/轮辋旋转对称，只有辐条可见
    var spin = PB.mathx.mod(G.S / BK.WHEEL_R, Math.PI * 2);
    wheelR.rotation.x = -spin;
    wheelF.rotation.x = -spin;

    // 步骤5：围巾顶点（世界坐标；scene 根下单位变换，§4.1）
    updateScarf(G);

    // 步骤6：blob 阴影：只取 rig 的 x，不随 wheelie/lean 旋转（§1.5）
    shadow.position.x = G.bike.x;
    shadow.material.opacity = PEL.SHADOW.op * (1 - G.bike.y / 1.2) * (1 - 0.6 * night);
  };

  /**
   * 夜间因子（§3.5 / §1.5 blob 阴影）：P7 在 F8 推送 G.env.nightMix。
   * @param {number} x 0..1
   * @returns {void}
   */
  S.setNight = function (x) {
    night = x < 0 ? 0 : (x > 1 ? 1 : x);
    if (shadow) shadow.material.opacity = PEL.SHADOW.op * (1 - 0.6 * night);
  };

  /**
   * 围巾飘带网格（调试读数用：测量它在画面上的实际贡献，并做 §1.5 形体穿透复核）。
   * @returns {THREE.Mesh|null} 网格
   */
  S.scarfMesh = function () { return scarfMesh; };

  /**
   * 与角色同色的刚性件（颈环）网格。AC-1b 的"围巾像素"统计必须能把飘带贡献与颈环贡献分开，
   * 否则"飘带被躯干挡住"会被颈环的颜色掩盖（见 Q-11）。
   * @returns {THREE.Mesh|null} 颈环
   */
  S.collarMesh = function () { return collarMesh; };

  /**
   * 围巾网格第 i 个顶点的某个分量（渲染侧读数，用于复核"渲染 = 模拟"）。
   * @param {number} i 顶点下标（0..25）
   * @param {number} k 分量 0=x,1=y,2=z
   * @returns {number} 分量值；未初始化时为 NaN
   */
  S.scarfVertex = function (i, k) {
    if (!scarfMesh) return NaN;
    return scarfMesh.geometry.getAttribute('position').array[i * 3 + k];
  };

  /**
   * 围巾渲染顶点与模拟粒子的违例计数（§4.1 的同源判据）。
   * 渲染缓冲是 Float32Array，所以判据取 binary32 能给出的最严形式：逐样本
   * `attr[i] === Math.fround(P[i])`（正确舍入，同一口径见 ADR-21 的 float32 层）。
   *
   * @param {object} G 一局状态
   * @returns {number} 不满足逐位相等的分量个数（0 = 完全同源）；未初始化时为 NaN
   */
  S.scarfMeshViolations = function (G) {
    if (!scarfMesh || !G.scarf) return NaN;
    var arr = scarfMesh.geometry.getAttribute('position').array;
    var P = G.scarf.P, bad = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] !== Math.fround(P[i])) bad++;
    return bad;
  };

  /**
   * 头部组（头、头盔、墨镜）：POV 近距时由 camera 隐藏（§4.7）。
   * @returns {THREE.Group|null} 头部组
   */
  S.headGroup = function () { return headGroup; };

  /**
   * 飘带可见性（AC-1b(i) 的真实渲染差分：同一冻结帧渲染两次，第二次只隐藏飘带）。
   * 只改 mesh.visible，不碰几何、材质或模拟状态，因此两帧之差只能来自飘带自身。
   * @param {boolean} v 是否可见
   * @returns {void}
   */
  S.setRibbonVisible = function (v) {
    if (scarfMesh) scarfMesh.visible = !!v;
  };

  /**
   * 墨镜可见性（AC-1b(iii) 的差分判据，S4a/P10 使用）。只隐藏镜片与镜框组，
   * 头、头盔、羽毛保持可见，因此差分像素只可能是墨镜。
   * @param {boolean} v 是否可见
   * @returns {void}
   */
  S.setGlassesVisible = function (v) {
    if (glassesGroup) glassesGroup.visible = !!v;
  };

  /**
   * 墨镜两片共 16 个角的世界坐标（`pelican.glasses.cornersOutsideHead` 的读数来源）。
   * 用真实网格的 matrixWorld 变换局部角点，因此同时覆盖"几何尺寸"和"父级变换"两层。
   *
   * @returns {Array<{x:number,y:number,z:number}>} 角点世界坐标；未初始化时为空数组
   */
  S.glassesCorners = function () {
    var out = [];
    if (!glassesGroup) return out;
    glassesGroup.updateMatrixWorld(true);
    var hw = PEL.GLASS.w * 0.5, hh = PEL.GLASS.h * 0.5, hd = PEL.GLASS.d * 0.5;
    for (var k = 0; k < glassesGroup.children.length; k++) {
      var child = glassesGroup.children[k];
      if (!child.isMesh || child.geometry.type !== 'BoxGeometry') continue;
      if (child.geometry.parameters.width !== PEL.GLASS.w) continue;   // 只要镜片，不要镜框
      for (var sx = -1; sx <= 1; sx += 2) {
        for (var sy = -1; sy <= 1; sy += 2) {
          for (var sz = -1; sz <= 1; sz += 2) {
            _w.set(sx * hw, sy * hh, sz * hd);
            child.localToWorld(_w);
            out.push({ x: _w.x, y: _w.y, z: _w.z });
          }
        }
      }
    }
    return out;
  };

  /**
   * 角色根节点（调试统计 mesh/三角面预算用）。
   * @returns {THREE.Group|null} 根节点
   */
  S.root = function () { return root; };

  /**
   * 喙标记与 G.rig.beakW 的距离（AC-1d 的实测口径）。读取真实 matrixWorld，
   * 因此同时覆盖"矩阵写入 → 层级变换 → 世界坐标"整条渲染路径。
   * @param {object} G 一局状态
   * @returns {number} 距离（米）；未初始化时为 NaN
   */
  S.beakError = function (G) {
    if (!root || !beakMarker) return NaN;
    root.updateMatrixWorld(true);
    beakMarker.getWorldPosition(_w);
    var b = G.rig.beakW;
    var dx = _w.x - b.x, dy = _w.y - b.y, dz = _w.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /**
   * 喙网格尖端（几何索引 4..7 的中点）与 G.rig.beakW 的距离。
   * 与 beakError 的区别：这里读真实网格顶点经 matrixWorld 变换后的世界坐标，
   * 因此同时覆盖"几何顶点是否就是 §1.5 的 BEAK_TIP_L"这一层（AC-1d 的网格侧证据）。
   * @param {object} G 一局状态
   * @returns {number} 距离（米）
   */
  S.beakMeshError = function (G) {
    if (!root || !beakMesh) return NaN;
    root.updateMatrixWorld(true);
    var pos = beakMesh.geometry.getAttribute('position');
    var sx = 0, sy = 0, sz = 0;
    for (var i = 4; i <= 7; i++) {
      _w.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      beakMesh.localToWorld(_w);
      sx += _w.x; sy += _w.y; sz += _w.z;
    }
    sx *= 0.25; sy *= 0.25; sz *= 0.25;
    var b = G.rig.beakW;
    var dx = sx - b.x, dy = sy - b.y, dz = sz - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /**
   * 脚点与解析踏板点的最大距离（§1.5 要求 ≤0.01）。脚网格挂在角色根下，
   * 因此这里把脚的世界坐标反算回局部后与 §1.5 的踏板公式比较。
   * @param {object} G 一局状态
   * @returns {number} 左右脚中的最大误差（米）
   */
  S.footPedalError = function (G) {
    if (!root || !footR) return NaN;
    root.updateMatrixWorld(true);
    var th = G.bike.crank, worst = 0;
    var i;
    for (i = 0; i < 2; i++) {
      var f = i === 0 ? footR : footL;
      var sign = i === 0 ? 1 : -1;
      pedalPos(i === 0 ? th : th + Math.PI, sign, _pedalR);
      f.getWorldPosition(_w);
      root.worldToLocal(_w);
      var dx = _w.x - _pedalR.x, dy = _w.y - _pedalR.y, dz = _w.z - _pedalR.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > worst) worst = d;
    }
    return worst;
  };
})(window.PB = window.PB || {});
