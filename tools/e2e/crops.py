#!/usr/bin/env python3
"""TASK-002 证据裁剪与完整性核对（P9-P12 manifest 的伴生材料）。

为什么需要它：ui-vision 判定 S3a/S6/S7/S11/S12 时看的是整幅 1920×1080 夜景图，
海面/围巾/鱼在整幅尺度上只有几十像素，容易被读成"没有"。这里只做**派生材料**：
  - 从同一帧裁出小区域并放大（Lanczos），用于把"就是这一块像素"摆到判据边上；
  - 用"隐藏某物体"的差分图给出目标物体的真实像素（海面掩膜、鱼掩膜、车包围盒）；
  - 亮度放大只用于看清夜间细节，文件在 crops.json 里标 derived=true + brightness，
    绝不冒充原始证据（原始图的 sha256 在 P9-P12/manifest.json 里）。
同时核对：manifest 里每张图的文件名/尺寸/哈希与磁盘一致，截图文件没有缺漏。

用法：python3 tools/e2e/crops.py [--screens DIR] [--out DIR]
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

DEFAULT = Path.home() / ".evidence" / "task-002" / "implementation" / "P9-P12"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def diff_mask(a: Image.Image, b: Image.Image, thr: int = 12):
    """逐像素 |ΔRGB| 求和 > thr 的二值掩膜（与 tools/e2e/app.mjs 的 diffImages 同口径）。"""
    from PIL import ImageChops
    d = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).convert("L")
    # diffImages 用三通道差之和；这里用单通道近似前先按 3 倍阈值折算，保持"同一类硬差"的语义
    return d.point(lambda v: 255 if v * 3 > thr else 0)


def bbox_of(mask: Image.Image):
    bb = mask.getbbox()
    return list(bb) if bb else None


def save(img: Image.Image, path: Path, entry: dict, crops: list, **meta):
    img.save(path)
    entry.update({
        "file": path.name,
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "dims": f"{img.width}x{img.height}",
        **meta,
    })
    crops.append(entry)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--screens", default=str(DEFAULT / "screens"))
    ap.add_argument("--out", default=str(DEFAULT / "crops"))
    args = ap.parse_args()
    screens = Path(args.screens)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = screens.parent / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    by_name = {s["name"]: s for s in manifest["screens"]}
    crops = []
    integrity = {"checked": 0, "mismatch": [], "missing": [], "extra": []}

    # ---- 0) 完整性：manifest 声称的文件必须在磁盘上，且 sha256/尺寸一致 ----
    # 视频条目落在 ../video/，不归 screens 目录管，这里只核对截图与差分源图。
    for s in manifest["screens"]:
        if s.get("kind") == "video":
            continue
        p = screens / s["name"]
        if not p.exists():
            integrity["missing"].append(s["name"])
            continue
        integrity["checked"] += 1
        if sha256(p) != s["sha256"]:
            integrity["mismatch"].append({"name": s["name"], "reason": "sha256"})
        if s.get("dims"):
            with Image.open(p) as im:
                if f"{im.width}x{im.height}" != s["dims"]:
                    integrity["mismatch"].append({"name": s["name"], "reason": f"dims {im.width}x{im.height} != {s['dims']}"})
    listed = {s["name"] for s in manifest["screens"]}
    for p in sorted(screens.glob("*.png")):
        if p.name not in listed:
            integrity["extra"].append(p.name)

    # ---- 1) S3a：下半区海面、渲染海面掩膜、车包围盒 ----
    if "S3a-side-seaview-p10.png" in by_name:
        full = Image.open(screens / "S3a-side-seaview-p10.png").convert("RGB")
        no_sea = Image.open(screens / "S3a-no-ocean-diagnostic-p10.png").convert("RGB")
        no_car = Image.open(screens / "S3a-no-pelican-diagnostic-p10.png").convert("RGB")
        sea_mask = diff_mask(full, no_sea)
        car_mask = diff_mask(full, no_car)
        car_bb = bbox_of(car_mask)
        W, H = full.size
        srcs = [{"file": n, "sha256": sha256(screens / n)} for n in
                ("S3a-side-seaview-p10.png", "S3a-no-ocean-diagnostic-p10.png", "S3a-no-pelican-diagnostic-p10.png")]

        # 1a) 海面掩膜（红=渲染出来的海面像素），用来直接核对"下半 65% 是海"
        overlay = full.copy()
        red = Image.new("RGB", full.size, (255, 40, 40))
        overlay = Image.composite(red, overlay, sea_mask.convert("L"))
        overlay = Image.blend(full, overlay, 0.55)
        save(overlay.resize((W // 2, H // 2), Image.LANCZOS), out / "S3a-rendered-sea-mask.png",
             {"kind": "derived-mask", "note": "红=隐藏海面网格后发生变化的像素（这一帧真实画出的海面）；整幅缩至 1/2",
              "sources": srcs, "derived": True}, crops)

        # 1b) 下半区放大提亮（只为了让夜里看不清的海面细节可读）
        low = full.crop((0, H // 2, W, H))
        low = ImageEnhance.Brightness(low).enhance(2.6)
        save(low.resize((W // 2, H // 4), Image.LANCZOS), out / "S3a-lower-half-bright.png",
             {"kind": "derived-crop", "crop": [0, H // 2, W, H], "brightness": 2.6,
              "note": "画面下半部分（y≥540），亮度 ×2.6 便于在夜景里辨认海面反光条纹",
              "sources": srcs, "derived": True}, crops)

        # 1c) 车包围盒标注（框来自真实像素差分，不是几何投影）
        if car_bb:
            ann = full.copy()
            ImageDraw.Draw(ann).rectangle(car_bb, outline=(0, 255, 0), width=3)
            save(ann.resize((W // 2, H // 2), Image.LANCZOS), out / "S3a-car-bbox.png",
                 {"kind": "derived-annotation", "carBBox": car_bb, "carHeightPx": car_bb[3] - car_bb[1],
                  "note": "绿框=隐藏鹈鹕根节点后发生变化的像素包围盒（车+骑手真实像素高）",
                  "sources": srcs, "derived": True}, crops)
            pad = 40
            box = (max(0, car_bb[0] - pad), max(0, car_bb[1] - pad), min(W, car_bb[2] + pad), min(H, car_bb[3] + pad))
            crop = full.crop(box).resize(((box[2] - box[0]) * 4, (box[3] - box[1]) * 4), Image.NEAREST)
            save(crop, out / "S3a-car-x4.png",
                 {"kind": "derived-crop", "crop": list(box), "scale": 4,
                  "note": "同一帧的车+骑手（像素放大 4 倍，无插值）", "sources": srcs, "derived": True}, crops)

    # ---- 2) S6/S12：遮挡像素掩膜（证明"没有棕榈/灯杆挡主体"）----
    for tag, base in (("S6", "S6-foam-orbit-p10.png"), ("S12", "S12-shore-highlight-p10.png")):
        no_props_name = f"{tag}-no-props-diagnostic-p10.png"
        if base in by_name and no_props_name in by_name:
            a = Image.open(screens / base).convert("RGB")
            b = Image.open(screens / no_props_name).convert("RGB")
            m = diff_mask(a, b)
            overlay = Image.composite(Image.new("RGB", a.size, (0, 220, 120)), a, m.convert("L"))
            overlay = Image.blend(a, overlay, 0.6)
            save(overlay.resize((a.width // 2, a.height // 2), Image.LANCZOS), out / f"{tag}-prop-occlusion-mask.png",
                 {"kind": "derived-mask", "note": f"绿=被棕榈/路灯覆盖的像素（{tag}，整幅 1/2）",
                  "sources": [{"file": base, "sha256": sha256(screens / base)},
                              {"file": no_props_name, "sha256": sha256(screens / no_props_name)}], "derived": True}, crops)

    # ---- 3) S7：同一矩形裁出的 0/8/16 s 序列 + 3/4 补充视角 ----
    s7_names = ["S7-side-scarf-v8-p10.png", "S7-motion-0s-p10.png", "S7-motion-8s-p10.png", "S7-motion-16s-p10.png"]
    if all(n in by_name for n in s7_names):
        # 矩形固定为 90° 主图里围巾-隐藏差分的外扩包围盒，四帧共用，保证可直接对比
        a = Image.open(screens / "S7-side-scarf-v8-p10.png").convert("RGB")
        b = Image.open(screens / "S7-ribbon-hidden-p10.png").convert("RGB")
        bb = bbox_of(diff_mask(a, b, 8))
        rect = (max(0, bb[0] - 60), max(0, bb[1] - 60), min(a.width, bb[2] + 60), min(a.height, bb[3] + 60)) if bb else (830, 300, 1230, 620)
        for n in s7_names:
            im = Image.open(screens / n).convert("RGB").crop(rect)
            im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
            save(im, out / f"{n.replace('.png', '')}-scarf-x3.png",
                 {"kind": "derived-crop", "crop": list(rect), "scale": 3,
                  "note": "围巾区域（同一矩形，3 倍放大）；90° 侧视下飘带几乎正对视线，只剩 1–2 px 侧棱",
                  "sources": [{"file": n, "sha256": sha256(screens / n)}], "derived": True}, crops)
    if "S7-scarf-3q-supp-p10.png" in by_name:
        im = Image.open(screens / "S7-scarf-3q-supp-p10.png").convert("RGB")
        rect = (820, 320, 1200, 560)
        im = im.crop(rect).resize(((rect[2] - rect[0]) * 2, (rect[3] - rect[1]) * 2), Image.LANCZOS)
        save(im, out / "S7-scarf-3q-supp-x2.png",
             {"kind": "derived-crop", "crop": list(rect), "scale": 2,
              "note": "补充 3/4 机位（60°/15°/4.5 m，不计入 AC-2a）：飘带带宽可见，对照 90° 侧视的 1–2 px 侧棱",
              "sources": [{"file": "S7-scarf-3q-supp-p10.png", "sha256": sha256(screens / "S7-scarf-3q-supp-p10.png")}],
              "derived": True}, crops)

    # ---- 4) S11：捕获框区域的鱼（放大）+ 鱼-only 差分 ----
    if "S11-fish-catchbox-p10.png" in by_name:
        base = "S11-fish-catchbox-p10.png"
        hid = "S11-fish-hidden-p10.png"
        a = Image.open(screens / base).convert("RGB")
        b = Image.open(screens / hid).convert("RGB")
        m = diff_mask(a, b, 12)
        bb = bbox_of(m)
        rect = (max(0, bb[0] - 130), max(0, bb[1] - 100), min(a.width, bb[2] + 130), min(a.height, bb[3] + 100)) if bb else (1000, 400, 1250, 570)
        crop = a.crop(rect)
        crop = crop.resize((crop.width * 4, crop.height * 4), Image.LANCZOS)
        save(crop, out / "S11-catchbox-fish-x4.png",
             {"kind": "derived-crop", "crop": list(rect), "scale": 4, "fishBBox": bb,
              "note": "捕获框 + 鱼（灰椭圆，带眼），4 倍放大；框是应用自己画的调试框，不是后加的注释",
              "sources": [{"file": base, "sha256": sha256(screens / base)}], "derived": True}, crops)
        # 鱼-only 掩膜：只保留差分像素，放大于鱼附近
        fish_only = Image.new("RGB", a.size, (0, 0, 0))
        fish_only.paste(Image.new("RGB", a.size, (255, 80, 80)), (0, 0), m.convert("L"))
        rect2 = (max(0, (bb[0] - 40) if bb else 1100), max(0, (bb[1] - 40) if bb else 450),
                 min(a.width, (bb[2] + 40) if bb else 1200), min(a.height, (bb[3] + 40) if bb else 540))
        f = fish_only.crop(rect2)
        f = f.resize((f.width * 8, f.height * 8), Image.NEAREST)
        save(f, out / "S11-fish-diff-x8.png",
             {"kind": "derived-mask", "crop": list(rect2), "scale": 8, "fishBBox": bb,
              "note": "红=隐藏鱼池后发生变化的像素（鱼本体）", "sources":
              [{"file": base, "sha256": sha256(screens / base)}, {"file": hid, "sha256": sha256(screens / hid)}],
              "derived": True}, crops)

    # ---- 5) S2：夜间骑手可读性（设计限制的记录材料）----
    if "S2-night-moon-p10.png" in by_name:
        im = Image.open(screens / "S2-night-moon-p10.png").convert("RGB")
        rect = (760, 400, 1160, 760)
        c = im.crop(rect)
        ImageEnhance.Brightness(c).enhance(2.2).resize((c.width * 2, c.height * 2), Image.LANCZOS).save(
            out / "S2-rider-bright-x2.png")
        crops.append({"file": "S2-rider-bright-x2.png", "kind": "derived-crop", "crop": list(rect), "scale": 2,
                      "brightness": 2.2, "derived": True,
                      "note": "p=0.50 的骑手剪影（亮度 ×2.2）：AC-3b/3c 判的是星星与月光高光，不判骑手可读性",
                      "sha256": sha256(out / "S2-rider-bright-x2.png"),
                      "bytes": (out / "S2-rider-bright-x2.png").stat().st_size,
                      "dims": f"{(rect[2]-rect[0])*2}x{(rect[3]-rect[1])*2}",
                      "sources": [{"file": "S2-night-moon-p10.png", "sha256": sha256(screens / "S2-night-moon-p10.png")}]})

    report = {
        "generatedBy": "tools/e2e/crops.py",
        "screensDir": str(screens),
        "manifestSha256": sha256(manifest_path),
        "manifestGeneratedAt": manifest.get("generatedAt"),
        "integrity": integrity,
        "note": "所有 crops 均为原始截图的派生物（裁剪/放大/掩膜/提亮），derived=true；原始证据请按 sources 里的 sha256 核对。",
        "crops": crops,
    }
    (out / "crops.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n")
    lines = ["# TASK-002 P9–P12 裁剪/掩膜材料（派生证据）", "",
             f"- 源 manifest: `{manifest_path}`（sha256 `{report['manifestSha256']}`）",
             f"- 核对：{integrity['checked']} 张已登记图，sha256/尺寸不一致 {len(integrity['mismatch'])}，缺失 {len(integrity['missing'])}，未登记多余文件 {len(integrity['extra'])}",
             "", "| 文件 | 尺寸 | 类型 | 说明 |", "|---|---|---|---|"]
    for c in crops:
        lines.append(f"| {c['file']} | {c.get('dims', '')} | {c['kind']} | {c.get('note', '')} |")
    (out / "crops.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({"crops": len(crops), "integrity": {k: (len(v) if isinstance(v, list) else v) for k, v in integrity.items()},
                      "mismatch": integrity["mismatch"], "missing": integrity["missing"], "extra": integrity["extra"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
