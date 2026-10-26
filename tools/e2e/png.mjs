// TASK-002: 极简 PNG 解码（仅供构建期门禁做像素判定，不进交付物）。
// Chromium 截图是 8-bit RGBA/RGB、非隔行；本解码器只支持这些形态，遇到其它形态直接抛错，
// 以免"看起来通过了"的伪证据。只用 node 内置 zlib，不引第三方依赖。
import { inflateSync } from 'node:zlib';

/**
 * 解码 PNG 为 RGBA 像素数组。
 *
 * @param {Buffer} buf PNG 文件字节
 * @returns {{width: number, height: number, data: Uint8Array}} RGBA8 像素（长度 = w*h*4）
 * @throws {Error} 非 PNG、非 8-bit、隔行或色彩类型不受支持时
 */
export function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('interlaced PNG unsupported');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) line[x] = raw[rp++];
    // 逐行反滤波（PNG 规范 9.2 的 5 种过滤器）
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      } else if (filter !== 0) throw new Error(`bad filter ${filter}`);
      line[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
    prev.set(line);
  }
  return { width, height, data: out };
}

/**
 * 统计画面中与给定 sRGB 颜色在容差内的像素占比。
 *
 * @param {{width: number, height: number, data: Uint8Array}} img 解码后的图像
 * @param {[number, number, number]} rgb 目标颜色（0–255）
 * @param {number} tol 每通道容差
 * @returns {{matching: number, total: number, ratio: number}} 命中像素数、总像素数与占比
 */
export function colorRatio(img, rgb, tol) {
  const { data } = img;
  let matching = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i] - rgb[0]) <= tol &&
        Math.abs(data[i + 1] - rgb[1]) <= tol &&
        Math.abs(data[i + 2] - rgb[2]) <= tol) matching++;
  }
  const total = data.length / 4;
  return { matching, total, ratio: matching / total };
}
