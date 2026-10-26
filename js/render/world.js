// TASK-002 P4: 世界几何与道具（plan.md §1.1 横向布局、§1.4 色值、§1.5 道具、§4.7 camFloor 数据源）。
// 跑步机模型：几何体静止，道具按 §1.1 的回收公式沿 −Z 滚动，只在镜头背后 20 m 处回绕。
// 本包只做路面/边线/虚线/草地/山崖/沙滩/棕榈/路灯；海面（P8）、角色（P5）、天空（P7）由各自包追加。
(function (PB) {
  'use strict';
  var CFG = PB.config;
  var W = CFG.WORLD;
  var C = CFG.COLORS;
  var S = PB.world = {};
  var root = null;                  // 世界根节点（scene 的子节点）
  var palms = null;                 // InstancedMesh：棕榈干
  var palmCrowns = null;            // InstancedMesh：棕榈冠
  var lamps = null;                 // InstancedMesh：灯杆
  var lampArms = null;              // InstancedMesh：灯臂
  var lampHeads = null;             // InstancedMesh：灯头（自发光）
  var lampPatches = null;           // InstancedMesh：路面光斑（加色圆片）
  var dashes = null;                // InstancedMesh：车道虚线
  var dummy = null;                 // 复用矩阵（M-31：稳态帧不新建对象；boot 时创建）
  var lampLevel = 0;
  // 建一条沿 z 轴延伸的横向条带（两个 x 采样点，各自一个 y），用于路面/草地/沙滩/边线。 顶点数固定为 4，索引固定为 2 个三角形；不做 UV（本包无贴图）。
  function strip(x0, y0, x1, y1, colorHex, yLift) {
    var zNear = W.ROAD_Z_NEAR;
    var zFar = W.ROAD_Z_FAR;
    var lift = yLift || 0;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array([
      x0, y0 + lift, zNear,
      x1, y1 + lift, zNear,
      x0, y0 + lift, zFar,
      x1, y1 + lift, zFar
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    geo.computeVertexNormals();
    var mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex) });
    return new THREE.Mesh(geo, mat);
  }
  // 山崖剖面（§1.1：x < −16 时高度 min((−16−x)·0.6, 12)）。 用一条沿 z 拉伸的折带，分段数取 W.CLIFF_SEGMENTS，保证坡度折点可见。
  function buildCliff() {
    var segs = W.CLIFF_SEGMENTS;
    var x0 = W.GRASS_X0;
    var x1 = W.CLIFF_X_END;
    var zNear = W.ROAD_Z_NEAR;
    var zFar = W.ROAD_Z_FAR;
    var pos = new Float32Array((segs + 1) * 2 * 3);
    var idx = [];
    for (var i = 0; i <= segs; i++) {
      var x = x0 + (x1 - x0) * (i / segs);
      var y = CFG.ground(x);
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = zNear;
      pos[i * 6 + 3] = x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = zFar;
      if (i < segs) {
        var a = i * 2;
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(C.cliff) }));
  }
  // 建一个 InstancedMesh 并挂到世界根节点。所有实例矩阵在 update 中按 S 重写。
  function instanced(geo, mat, count) {
    var mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;   // 实例位置每帧变化，包围球无意义
    root.add(mesh);
    return mesh;
  }
  // 初始化世界（boot 时调用一次，§3.6「renderer、scene、各 mesh | boot」）。 所有网格在此时创建，之后稳态帧只写实例矩阵，不新建对象（M-31）。
  S.init = function (scene) {
    if (root) return;
    dummy = new THREE.Matrix4();
    root = new THREE.Group();
    scene.add(root);
    // 路面与两侧（§1.1）：草地 −16..−4.5，沥青 −4.5..4.5，沙滩 4.5..SHORE_X
    root.add(strip(W.GRASS_X0, 0, W.GRASS_X1, 0, C.grass, 0));
    root.add(strip(-CFG.ROAD_HALF, 0, CFG.ROAD_HALF, 0, C.asphalt, 0.001));
    root.add(strip(CFG.ROAD_HALF, 0, CFG.SHORE_X, CFG.SEA_Y, C.sandDry, 0));
    root.add(buildCliff());
    // 边线（实线，宽 0.15）与路肩由沥青条带本身体现（§1.1）
    var e = CFG.EDGE_LINE_W / 2;
    root.add(strip(-CFG.EDGE_LINE_X - e, 0, -CFG.EDGE_LINE_X + e, 0, C.edgeLine, 0.006));
    root.add(strip(CFG.EDGE_LINE_X - e, 0, CFG.EDGE_LINE_X + e, 0, C.edgeLine, 0.006));
    // 车道虚线：两条线 × 50 段（§1.5）
    var dashGeo = new THREE.PlaneGeometry(CFG.DASH_W, CFG.DASH_LEN);
    dashGeo.rotateX(-Math.PI / 2);
    dashes = instanced(dashGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color(C.laneDash) }), CFG.DASH_COUNT * 2);
    // 棕榈：干 + 冠（§1.5：20 棵，spacing 25，x=−8，高 6+2·hash(i)）
    var trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 6);
    trunkGeo.translate(0, 0.5, 0);      // 原点在根部，便于按高度缩放
    palms = instanced(trunkGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color(C.palmTrunk) }), W.PALM_COUNT);
    var crownGeo = new THREE.ConeGeometry(1.7, 1.2, 7);
    crownGeo.translate(0, 0.6, 0);
    palmCrowns = instanced(crownGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color(C.palmLeaf) }), W.PALM_COUNT);
    // 路灯：杆 + 臂 + 灯头 + 路面光斑（§1.5；灯头 emissive，光斑亮度由 setLamps 控制）
    var poleGeo = new THREE.CylinderGeometry(0.07, 0.09, W.LAMP_POLE_H, 6);
    poleGeo.translate(0, W.LAMP_POLE_H / 2, 0);
    lamps = instanced(poleGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color(C.lampPole) }), W.LAMP_COUNT);
    var armGeo = new THREE.BoxGeometry(W.LAMP_ARM, 0.08, 0.08);
    armGeo.translate(W.LAMP_ARM / 2, 0, 0);
    lampArms = instanced(armGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color(C.lampPole) }), W.LAMP_COUNT);
    var headGeo = new THREE.BoxGeometry(0.42, 0.16, 0.24);
    lampHeads = instanced(headGeo, new THREE.MeshLambertMaterial({
      color: new THREE.Color(C.lampPole),
      emissive: new THREE.Color(C.lampHead),
      emissiveIntensity: 0
    }), W.LAMP_COUNT);
    var patchGeo = new THREE.CircleGeometry(W.LAMP_PATCH_R, 20);
    patchGeo.rotateX(-Math.PI / 2);
    var patchMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.lampHead),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    lampPatches = instanced(patchGeo, patchMat, W.LAMP_COUNT);
    S.update({ S: 0 });   // 以 S=0 摆好初始位置，避免首帧前实例都在原点
  };
  // 道具回收位置（§1.1）：z_i = −(mod(i·spacing − S, span)) + 20，span = count·spacing。 单独成函数便于 selfcheck 与 debug 复用同一口径。
  S.propZ = function (i, spacing, span, S) {
    return -PB.mathx.mod(i * spacing - S, span) + W.PROP_AHEAD;
  };
  // 每帧 F8：按当前 G.S 重写所有道具的实例矩阵。 只写矩阵，不分配几何体/材质；实例数固定，因此 draw call 恒定。
  S.update = function (G) {
    if (!root) return;
    var s = G.S;
    var i;
    // 棕榈：高度 6 + 2·hash(i)，冠在干顶。z 只由 propZ 求得并直接写进实例矩阵的平移分量，
    // 不保留任何第二份 z 状态：绘制路径上唯一的值就是 instanceMatrix 里的 float32（ADR-21）。
    for (i = 0; i < W.PALM_COUNT; i++) {
      var h = W.PALM_H_BASE + W.PALM_H_VAR * PB.mathx.hash01(i);
      var z = S.propZ(i, W.PALM_SPACING, W.PALM_COUNT * W.PALM_SPACING, s);
      dummy.makeScale(1, h, 1);
      dummy.setPosition(W.PALM_X, 0, z);
      palms.setMatrixAt(i, dummy);
      dummy.makeScale(1, 1, 1);
      dummy.setPosition(W.PALM_X, h, z);
      palmCrowns.setMatrixAt(i, dummy);
    }
    palms.instanceMatrix.needsUpdate = true;
    palmCrowns.instanceMatrix.needsUpdate = true;
    // 路灯：杆在 x=−5，臂伸向 +X，灯头在臂端；光斑落在灯头正下方的路面
    for (i = 0; i < W.LAMP_COUNT; i++) {
      var lz = S.propZ(i, W.LAMP_SPACING, W.LAMP_COUNT * W.LAMP_SPACING, s);
      dummy.makeScale(1, 1, 1);
      dummy.setPosition(W.LAMP_X, 0, lz);
      lamps.setMatrixAt(i, dummy);
      dummy.setPosition(W.LAMP_X, W.LAMP_POLE_H - 0.1, lz);
      lampArms.setMatrixAt(i, dummy);
      dummy.setPosition(W.LAMP_X + W.LAMP_ARM, W.LAMP_POLE_H - 0.1, lz);
      lampHeads.setMatrixAt(i, dummy);
      dummy.setPosition(W.LAMP_X + W.LAMP_ARM, 0.02, lz);
      lampPatches.setMatrixAt(i, dummy);
    }
    lamps.instanceMatrix.needsUpdate = true;
    lampArms.instanceMatrix.needsUpdate = true;
    lampHeads.instanceMatrix.needsUpdate = true;
    lampPatches.instanceMatrix.needsUpdate = true;
    // 车道虚线：i < 50 为 x=−1.25，i ≥ 50 为 x=+1.25；每段 span 600
    for (i = 0; i < CFG.DASH_COUNT * 2; i++) {
      var line = i < CFG.DASH_COUNT ? -1 : 1;
      var k = i % CFG.DASH_COUNT;
      var dz = S.propZ(k, CFG.DASH_PERIOD, CFG.DASH_COUNT * CFG.DASH_PERIOD, s);
      dummy.makeScale(1, 1, 1);
      dummy.setPosition(line * CFG.DASH_X, 0.005, dz);
      dashes.setMatrixAt(i, dummy);
    }
    dashes.instanceMatrix.needsUpdate = true;
  };
  // 设置路灯亮度（§3.5 / T4）。亮度同时驱动灯头 emissive 与路面光斑不透明度； 初值 0，P7 接入 daynight 后每帧推送 G.env.lamps。
  S.setLamps = function (x) {
    var v = x < 0 ? 0 : (x > 1 ? 1 : x);
    if (v === lampLevel) return;
    lampLevel = v;
    if (!root) return;
    lampHeads.material.emissiveIntensity = v * 1.6;
    lampPatches.material.opacity = v * 0.35;
    lampPatches.visible = v > 0.001;
  };
  // 读取某个棕榈实例当前的真实 z：直接读 instanceMatrix.array 的第 14 个分量（平移 z）。
  // 这个 Float32Array 就是每帧上传给 GPU 的实例缓冲，因此读数即绘制路径上的真值；
  // 本模块不保留任何 z 的第二份副本（ADR-21 / Q-04）。
  S.palmZAt = function (i) {
    if (!palms) return NaN;
    return palms.instanceMatrix.array[i * 16 + 14];
  };
})(window.PB = window.PB || {});
