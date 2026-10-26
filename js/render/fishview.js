// TASK-002 P9: 鱼的渲染（plan.md §1.5 鱼、§3.5 fishview、M-10、AC-5a）。
// 只读 f.pose，不做插值、不加偏移：G.fish[i].pose 是唯一位置来源（M-10）。
// 浮点边界：节点位置在写入渲染树前经 Math.fround 量化——这是 GPU 上传矩阵时的真实精度层（ADR-21 的
// float32 层），因此 §5.2 第 19 条鱼部分的 `z_inst === Math.fround(z_src)` 判据可逐样本复核；
// 量化误差 ≤ ½ulp32（|z| ≤ 100 m 时 ≤ 4e-6 m），远小于 AC-5a(i) 的 1e-4 m。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var F = CFG.FISH;
  var S = PB.fishview = {};

  var root = null;              // 鱼池根（scene 直挂，单位变换）
  var pool = [];                // 每条鱼一个组：[body, belly, tail, eyeL, eyeR]
  var inited = false;
  var hidden = false;           // 调试用总开关（S11 的真实渲染差分需要"藏起全部鱼"再拍一张）

  /**
   * 建一条鱼的几何（≤300 三角面；§1.5 的尺寸与色值）。全部子件共用同一份几何与材质，
   * 因此 6 条鱼只有 6 组对象、不随帧新建（M-31）。
   * @returns {THREE.Group} 鱼组（鼻朝 +Z）
   */
  function buildFish() {
    var g = new THREE.Group();
    var backMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(CFG.COLORS.fishBack) });
    var bellyMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(CFG.COLORS.fishBelly) });
    var eyeMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(CFG.COLORS.fishEye) });

    // 躯干：椭球半轴 (0.03, 0.05, 0.16)；分段 10×8 → 140 三角面
    var body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), backMat);
    body.scale.set(F.R.x, F.R.y, F.R.z);
    g.add(body);
    // 腹部：更小的椭球略向下偏，形成 §1.5 的"背/腹"双色（48 三角面）
    var belly = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), bellyMat);
    belly.scale.set(F.R.x * 0.8, F.R.y * 0.7, F.R.z * 0.86);
    belly.position.set(0, -0.014, 0.005);
    g.add(belly);
    // 尾鳍：三角 0.10×0.08（1 三角面），在尾部 −Z 一侧张开
    var tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, -F.R.z * 0.92, -F.TAIL.w / 2, F.TAIL.h / 2, -F.R.z - 0.07, F.TAIL.w / 2, F.TAIL.h / 2, -F.R.z - 0.07
    ]), 3));
    tg.computeVertexNormals();
    g.add(new THREE.Mesh(tg, backMat));
    // 眼：左右各一颗 r=0.012 的小球（各 36 三角面）
    for (var s = -1; s <= 1; s += 2) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), eyeMat);
      eye.position.set(s * F.R.x * 0.72, F.R.y * 0.36, F.R.z * 0.62);
      g.add(eye);
    }
    return g;
  }

  /**
   * 建鱼池并挂到场景（boot 时调用一次；§3.6「renderer、scene、各 mesh | boot」）。
   * @param {THREE.Scene} scene 场景
   * @returns {void}
   */
  S.init = function (scene) {
    if (inited) return;
    inited = true;
    root = new THREE.Group();
    scene.add(root);
    for (var i = 0; i < F.MAX; i++) {
      var g = buildFish();
      g.visible = false;
      root.add(g);
      pool.push(g);
    }
  };

  /**
   * 隐藏全部鱼（softReset 用；§3.5 softReset 的"fishview 全部隐藏"）。只改 visible，不销毁对象。
   * @returns {void}
   */
  S.hideAll = function () {
    for (var i = 0; i < pool.length; i++) pool[i].visible = false;
  };

  /**
   * 每帧 F8：把 G.fish[i].pose 写到第 i 个鱼组。位置逐分量 Math.fround（GPU 上传边界），
   * 朝向取 pose.yaw/pitch，缩放取 pose.scale；鱼数少于池容量时多余的组隐藏。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.update = function (G) {
    if (!inited) return;
    // 调试总开关：隐藏时直接把整池设为不可见并返回（不改 G.fish，模拟与判定完全不受影响）
    if (hidden) {
      for (var h = 0; h < pool.length; h++) pool[h].visible = false;
      return;
    }
    var n = G.fish.length;
    for (var i = 0; i < pool.length; i++) {
      var g = pool[i];
      if (i >= n) { g.visible = false; continue; }
      var f = G.fish[i];
      var p = f.pose;
      // 步骤1：位置（float32 量化）；顺序与 G.fish 一致，因此第 i 条鱼永远在同一个组里
      g.position.set(Math.fround(p.x), Math.fround(p.y), Math.fround(p.z));
      // 步骤2：朝向。alive 朝 +Z；跃出/missed/caught 由 pose.yaw/pitch 给出道路相对朝向
      g.rotation.set(p.pitch, p.yaw, 0);
      // 步骤3：缩放（捕获后 0.15→0.4 s 缩到 0，这里视作隐藏）
      var sc = p.scale > 0.02 ? p.scale : 0;
      g.scale.set(sc, sc, sc);
      g.visible = sc > 0;
    }
  };

  /**
   * 第 i 条鱼的真实渲染节点（AC-5a(i) 读取 matrixWorld 平移；供调试与测试使用）。
   * @param {number} i 池下标
   * @returns {THREE.Group|null} 节点
   */
  S.nodeAt = function (i) {
    return pool[i] || null;
  };

  /**
   * 调试用：隐藏/恢复整池鱼。只影响 `visible`，不触碰 G.fish / 判定 / 计分，
   * 因此可以在冻结帧上做"有鱼 / 无鱼"的真实渲染差分（S11 的鱼像素取证）。
   * @param {boolean} b 是否隐藏
   * @returns {void}
   */
  S.setHidden = function (b) { hidden = !!b; };
})(window.PB = window.PB || {});
