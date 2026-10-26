// TASK-002 P13: 程序化音频（plan.md §4.9、M-18、AC-9a–9d）。
// 全部声音由 WebAudio 现场合成：振荡器 + 代码生成的 2 s 噪声缓冲，页面不加载任何音频文件（AC-9a）。
// 本模块**不读 app 状态**：门控由 main 算好经 setGate 传入（M-18），静音只经 setMuted 写入，
// 持久化由 main 经 store 完成（M-29）。调度器跑在 setInterval 里，不在 rAF 稳态帧内分配节点（M-31）。
// 任何一次调度失败都只影响该步，不得把异常抛进帧循环（§5.4 第 2 条要求 Console 零 error）。
(function (PB) {
  'use strict';

  var AC = PB.config.AUDIO;
  var S = PB.audio = {};

  // 音频链路（§4.9）：sources → musicBus/sfxBus/ambBus → master → compressor → destination
  var ctx = null;
  var master = null, comp = null;
  var musicBus = null, sfxBus = null, ambBus = null;
  var noiseBuf = null;
  // 常驻环境声节点（只在 unlock 时创建一次，之后只改参数）
  var windFilter = null, windGain = null;
  var waveGain = null, padFilter = null;

  var unlocked = false;      // 是否已成功创建 AudioContext
  var gateOpen = false;      // main 传入的门（running && !document.hidden）
  var muted = false;         // 用户静音（store 是唯一持久化点，这里只镜像）
  var state = 'idle';        // idle | running | suspended | unavailable

  var bpm = 0;               // 当前实际节拍（stats().bpm）
  var bpmTarget = AC.BPM_MIN;
  var step = 0;              // 0..15（16 分音符）
  var nextNote = 0;          // 下一个音符的 AudioContext 时间
  var timerId = 0;
  var bar = 0;               // 小节序号（决定和弦）
  var vNow = 0, nightMix = 0, rpmNow = 0;

  /**
   * 门控判定（AC-9d 的唯一判据，纯函数，不读任何模块状态）。
   * 三项都为真才允许出声：应用在 running 且页面可见、已解锁、未静音。
   *
   * @param {boolean} gate main 算出的门（running && !document.hidden）
   * @param {boolean} isUnlocked 是否已成功创建 AudioContext
   * @param {boolean} isMuted 是否静音
   * @returns {boolean} 是否应当出声
   */
  S.shouldRun = function (gate, isUnlocked, isMuted) {
    return !!gate && !!isUnlocked && !isMuted;
  };

  /**
   * @returns {number} 当前节拍（BPM）；未解锁时为 0
   */
  S.bpm = function () { return bpm; };

  /**
   * @returns {string} 音频状态：idle | running | suspended | unavailable
   */
  S.state = function () { return state; };

  /**
   * 真实 AudioContext 状态（测试用来交叉核对 state 的镜像是否与浏览器一致）。
   * @returns {string|null} ctx.state；未创建时为 null
   */
  S.ctxState = function () { return ctx ? ctx.state : null; };

  /**
   * @returns {boolean} 是否已解锁
   */
  S.isUnlocked = function () { return unlocked; };

  /**
   * @returns {boolean} 是否静音
   */
  S.isMuted = function () { return muted; };

  /**
   * 生成 2 s 噪声缓冲（§4.9：噪声为代码生成的 AudioBuffer）。
   * 用确定性 LCG 而不是 Math.random：同一构建的两次运行噪声相同，便于像素/波形复核。
   *
   * @returns {AudioBuffer} 单声道噪声缓冲
   */
  function makeNoise() {
    var n = Math.floor(ctx.sampleRate * AC.NOISE_SEC);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var seed = 0x9E3779B9;
    for (var i = 0; i < n; i++) {
      // 步骤1：32 位 LCG 取高位映射到 [−1,1)；确定性、无外部依赖
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = seed / 2147483648 - 1;
    }
    return buf;
  }

  /**
   * 建链路与常驻环境声（只在 unlock 成功时调用一次）。
   * 顺序固定：压缩器 → 主增益 → destination；三条总线各接主增益（§4.9 链路图）。
   *
   * @returns {void}
   */
  function build() {
    // 步骤1：压缩器与主增益。主增益初值按 muted 决定（静音时置 0，§4.9）
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = AC.COMP_THRESH;
    comp.ratio.value = AC.COMP_RATIO;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : AC.MASTER;
    master.connect(comp);
    comp.connect(ctx.destination);

    // 步骤2：三条总线。音量上限写死在常量里，音色（振荡器/包络）属 MAY
    musicBus = ctx.createGain(); musicBus.gain.value = AC.MUSIC; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = AC.SFX; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = AC.AMB; ambBus.connect(master);

    noiseBuf = makeNoise();

    // 步骤3：常驻风。噪声 → 带通（中心 400+40v）→ 增益；参数在 update 里按速度写
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = AC.WIND_BASE_HZ;
    windFilter.Q.value = 0.7;
    windGain = ctx.createGain();
    windGain.gain.value = AC.WIND_GAIN_BASE;
    var windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambBus);
    windSrc.start();

    // 步骤4：常驻海浪。噪声 → 低通 500 Hz → 增益 0.08，再用 4.5 s 周期的 LFO 调制增益
    var waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.value = AC.WAVE_HZ;
    waveGain = ctx.createGain();
    waveGain.gain.value = AC.WAVE_GAIN;
    var waveSrc = ctx.createBufferSource();
    waveSrc.buffer = noiseBuf;
    waveSrc.loop = true;
    waveSrc.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(ambBus);
    waveSrc.start();
    var lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / AC.WAVE_LFO_SEC;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = AC.WAVE_GAIN * 0.6;   // 只调制不越过 0，避免负增益反相
    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);
    lfo.start();

    // 步骤5：pad 共用低通（截止随 nightMix 从 2200 降到 900）
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = AC.PAD_CUT_DAY;
    padFilter.connect(musicBus);
  }

  /**
   * 首次可信手势解锁（§4.9）：创建 AudioContext 并 resume()。
   * 创建失败（浏览器不支持 / 策略拒绝）时 state='unavailable'，静音按钮由 HUD 置灰。
   * 重复调用直接返回，不会创建第二个上下文。
   *
   * @returns {void}
   */
  S.unlock = function () {
    if (unlocked) return;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { state = 'unavailable'; return; }
    try {
      ctx = new Ctor();
      build();
    } catch (e) {
      // 步骤1：构造或建链失败 → 关闭可能已建了一半的上下文，标记不可用；不打印（Console 判据），不抛进事件处理
      if (ctx && ctx.close) { try { ctx.close(); } catch (e2) { /* 已经失效，忽略 */ } }
      ctx = null;
      state = 'unavailable';
      return;
    }
    unlocked = true;
    state = 'suspended';
    // 步骤2：解锁后立刻按门控决定 resume/suspend（首次手势通常就在 running 状态里）
    applyRun();
  };

  /**
   * 应用当前门控与静音：应出声则 resume 并起调度器，否则 suspend 并停调度器（M-18）。
   * 状态镜像 state 在这里同步写入（AC-9c 要求 hidden 后下一帧就能读到 'suspended'）；
   * 浏览器真实状态用 ctxState() 交叉核对。
   *
   * @returns {void}
   */
  function applyRun() {
    if (!ctx) return;
    var run = S.shouldRun(gateOpen, unlocked, muted);
    master.gain.value = muted ? 0 : AC.MASTER;
    if (run) {
      state = 'running';
      // 首次出声时把节拍钉在 BPM_MIN（72）：之后每小节最多 ±12，AC-9b 的"单调不减"由此成立。
      // 若从 0 起算，第一小节会被 ±12 的限制压成 12 BPM，永远追不上目标。
      if (bpm === 0) bpm = AC.BPM_MIN;
      if (ctx.state !== 'running') {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () { /* 自动播放策略拒绝：保持静默，不抛 */ });
      }
      // 恢复后从当前时间 +0.05 起算，避免把积压的音符一次性倾泻出来（§4.9）
      nextNote = ctx.currentTime + AC.RESUME_LEAD;
      if (!timerId) timerId = setInterval(tick, AC.TICK_MS);
    } else {
      state = 'suspended';
      if (ctx.state === 'running') {
        var q = ctx.suspend();
        if (q && q.catch) q.catch(function () { /* 同上 */ });
      }
      if (timerId) { clearInterval(timerId); timerId = 0; }
    }
  }

  /**
   * main 写入门（§4.9 M-18）。gate = (app.state === 'running') && !document.hidden。
   *
   * @param {boolean} open 门是否打开
   * @returns {void}
   */
  S.setGate = function (open) {
    var next = !!open;
    if (next === gateOpen) return;
    gateOpen = next;
    applyRun();
  };

  /**
   * 静音开关（M 键 / 🔊）。只写本模块状态与主增益；持久化由 main 经 store 完成（M-29）。
   *
   * @param {boolean} b 是否静音
   * @returns {void}
   */
  S.setMuted = function (b) {
    var next = !!b;
    if (next === muted) return;
    muted = next;
    applyRun();
  };

  /**
   * 16 分音符时长（秒）。BPM 只在调度时读取，所以变化只影响后续音符。
   * @returns {number} 秒
   */
  function sixteenth() {
    var b = bpm > 0 ? bpm : AC.BPM_MIN;
    return 60 / b / 4;
  }

  /**
   * 在给定时刻安排一个 16 分音符（§4.9 编排表）。所有节点都是短命的，播完自动断开。
   *
   * @param {number} i 步号 0..15
   * @param {number} t AudioContext 时间（秒）
   * @returns {void}
   */
  function scheduleStep(i, t) {
    // 步骤1：小节边界（第 0 步）才应用 BPM 目标，且每小节变化不超过 12（§4.9）
    if (i === 0) {
      var d = bpmTarget - bpm;
      if (d > AC.BPM_STEP) d = AC.BPM_STEP;
      else if (d < -AC.BPM_STEP) d = -AC.BPM_STEP;
      bpm += d;
      bar++;
      schedulePad(t);
    }
    // 步骤2：kick —— 第 0/4/8/12 步，v≥1 时才有（§4.9）
    if (AC.KICK_STEPS.indexOf(i) >= 0 && vNow >= 1) kick(t);
    // 步骤3：hat —— 第 2/6/10/14 步；v≥8 时所有奇数步加奏（0.4 音量）
    if (AC.HAT_STEPS.indexOf(i) >= 0) hat(t, 1);
    if (vNow >= AC.HAT_ALL_ODD_V && (i % 2) === 1) hat(t, 0.4);
    // 步骤4：bass —— 第 0/3/8/11 步弹根音
    if (AC.BASS_STEPS.indexOf(i) >= 0) bass(t, AC.CHORDS[bar % AC.CHORDS.length][0]);
  }

  /**
   * kick：正弦 120→45 Hz，0.12 s（§4.9）。
   * @param {number} t 起始时间
   * @returns {void}
   */
  function kick(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.13);
  }

  /**
   * hat：噪声经 7 kHz 高通，极短衰减（§4.9）。
   * @param {number} t 起始时间
   * @param {number} amp 相对音量（1 或 0.4）
   * @returns {void}
   */
  function hat(t, amp) {
    var src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    g.gain.setValueAtTime(0.22 * amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp); hp.connect(g); g.connect(musicBus);
    src.start(t, (t * 7) % 1.5);   // 每次取不同的缓冲偏移，避免听感上的机械重复
    src.stop(t + 0.06);
  }

  /**
   * bass：锯齿波经 800 Hz 低通，弹根音（§4.9）。
   * @param {number} t 起始时间
   * @param {number} hz 根音频率
   * @returns {void}
   */
  function bass(t, hz) {
    var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = hz / 2;
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.30, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.24);
  }

  /**
   * pad：每小节两个和弦音（根音 + 五度），每个音两个三角波失谐 ±6 cent，经共用低通（§4.9）。
   * 时长取一整小节，起落各留 0.4 s，避免爆音。
   *
   * @param {number} t 小节起始时间
   * @returns {void}
   */
  function schedulePad(t) {
    var ch = AC.CHORDS[bar % AC.CHORDS.length];
    var dur = sixteenth() * AC.STEPS_PER_BAR;
    for (var k = 0; k < ch.length; k++) {
      for (var s = -1; s <= 1; s += 2) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = ch[k];
        o.detune.value = s * AC.PAD_DETUNE_CENT;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.055, t + 0.4);
        g.gain.setValueAtTime(0.055, t + dur - 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(padFilter);
        o.start(t); o.stop(t + dur + 0.02);
      }
    }
  }

  /**
   * 调度器心跳（25 ms）：只在 ctx 真正 running 时推进，前瞻 0.12 s（§4.9）。
   * 单步异常只跳过该步，不中断调度、不抛进帧循环。
   *
   * @returns {void}
   */
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    var ahead = ctx.currentTime + AC.LOOKAHEAD;
    var guard = 0;
    while (nextNote < ahead && guard < 64) {
      try {
        scheduleStep(step, nextNote);
      } catch (e) { /* 单步失败：跳过，保持调度与帧循环都不受影响 */ }
      nextNote += sixteenth();
      step = (step + 1) % AC.STEPS_PER_BAR;
      guard++;
    }
  }

  /**
   * 短音效（§4.9 音效表）：catch 880→1320、jump 300→600、land 低频冲击、
   * laneChange 噪声 whoosh、achievement 大三和弦琶音。
   *
   * @param {string} kind 音效类型
   * @returns {void}
   */
  function sfx(kind) {
    if (!ctx || ctx.state !== 'running' || muted) return;
    var t = ctx.currentTime;
    try {
      if (kind === 'catch' || kind === 'jump') {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        var f0 = kind === 'catch' ? 880 : 300, f1 = kind === 'catch' ? 1320 : 600;
        var dur = kind === 'catch' ? 0.18 : 0.15;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(sfxBus);
        o.start(t); o.stop(t + dur + 0.01);
      } else if (kind === 'land') {
        // 低频冲击：正弦 120→50 Hz + 低通噪声
        var lo = ctx.createOscillator(), lg = ctx.createGain();
        lo.type = 'sine';
        lo.frequency.setValueAtTime(120, t);
        lo.frequency.exponentialRampToValueAtTime(50, t + 0.2);
        lg.gain.setValueAtTime(0.55, t);
        lg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        lo.connect(lg); lg.connect(sfxBus);
        lo.start(t); lo.stop(t + 0.21);
        var ns = ctx.createBufferSource(), nlp = ctx.createBiquadFilter(), ng = ctx.createGain();
        ns.buffer = noiseBuf;
        nlp.type = 'lowpass';
        nlp.frequency.value = 220;
        ng.gain.setValueAtTime(0.35, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        ns.connect(nlp); nlp.connect(ng); ng.connect(sfxBus);
        ns.start(t, 0.3); ns.stop(t + 0.17);
      } else if (kind === 'laneChange') {
        // whoosh：带通从 700 Hz 扫到 2400 Hz 的噪声
        var ws = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), wg = ctx.createGain();
        ws.buffer = noiseBuf;
        bp.type = 'bandpass';
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(700, t);
        bp.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
        wg.gain.setValueAtTime(0.28, t);
        wg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        ws.connect(bp); bp.connect(wg); wg.connect(sfxBus);
        ws.start(t, 0.7); ws.stop(t + 0.19);
      } else if (kind === 'achievement') {
        // 大三和弦琶音：C5–E5–G5，每音 0.12 s
        var notes = [523.25, 659.25, 783.99];
        for (var i = 0; i < notes.length; i++) {
          var ao = ctx.createOscillator(), ag = ctx.createGain();
          var at = t + i * 0.12;
          ao.type = 'triangle';
          ao.frequency.value = notes[i];
          ag.gain.setValueAtTime(0.0001, at);
          ag.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
          ag.gain.exponentialRampToValueAtTime(0.001, at + 0.30);
          ao.connect(ag); ag.connect(sfxBus);
          ao.start(at); ao.stop(at + 0.32);
        }
      }
    } catch (e) { /* 单个音效失败不影响游戏与帧循环 */ }
  }

  /**
   * 事件消费（F7）：只认 catch / jump / land / laneChange / achievement（§4.9 音效表）。
   * 事件对象由生产者新建，本函数只读。
   *
   * @param {Array<{type:string}>} events 本帧事件
   * @returns {void}
   */
  S.onEvents = function (events) {
    if (!ctx || !events || !events.length) return;
    for (var i = 0; i < events.length; i++) {
      var t = events[i] && events[i].type;
      if (t === 'catch' || t === 'jump' || t === 'land' || t === 'laneChange' || t === 'achievement') sfx(t);
    }
  };

  /**
   * 每帧参数推送（F10）：BPM 目标、环境声参数、pad 截止。
   * 只写 AudioParam 的标量，不创建节点（节点创建只在调度器与音效路径里）。
   *
   * @param {object} G 一局状态（只读 bike.v / bike.rpm / env.nightMix）
   * @param {number} dt 帧时长（秒，本函数不使用，保留以匹配 §3.5 签名）
   * @returns {void}
   */
  S.update = function (G, dt) {
    if (!G || !G.bike) return;
    vNow = G.bike.v;
    rpmNow = G.bike.rpm;
    // 步骤1：BPM 目标 = clamp(2·round(rpm/2), 72, 144)（§4.9）；实际节拍只在小节边界变化
    var tgt = 2 * Math.round(rpmNow / 2);
    if (tgt < AC.BPM_MIN) tgt = AC.BPM_MIN;
    else if (tgt > AC.BPM_MAX) tgt = AC.BPM_MAX;
    bpmTarget = tgt;
    if (!ctx) return;
    // 步骤2：环境声参数随速度与夜色变化（§4.9）
    nightMix = G.env ? G.env.nightMix : 0;
    try {
      windFilter.frequency.value = AC.WIND_BASE_HZ + AC.WIND_PER_V_HZ * vNow;
      var wg = AC.WIND_GAIN_BASE + AC.WIND_GAIN_V2 * vNow * vNow;
      windGain.gain.value = wg > AC.WIND_GAIN_MAX ? AC.WIND_GAIN_MAX : wg;
      padFilter.frequency.value = AC.PAD_CUT_DAY + (AC.PAD_CUT_NIGHT - AC.PAD_CUT_DAY) * nightMix;
    } catch (e) { /* 参数写入失败（上下文被回收）时静默跳过，下一次 resume 会重建 */ }
  };
})(window.PB = window.PB || {});
