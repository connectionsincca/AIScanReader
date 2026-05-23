export type Corner = { x: number; y: number }; // normalized 0-1 relative to image

// ── Gaussian elimination for homography ──────────────────────────────────────

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let max = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[max][col])) max = r;
    }
    [M[col], M[max]] = [M[max], M[col]];

    const p = M[col][col];
    if (Math.abs(p) < 1e-12) continue;
    for (let j = col; j <= n; j++) M[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

// Compute 3×3 homography mapping src[] → dst[]
function computeHomography(src: Corner[], dst: Corner[]): number[] {
  const A: number[][] = [];
  const b: number[]   = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
  }
  return [...gaussianElimination(A, b), 1];
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Given a raw photo dataURL and 4 corners (normalized 0-1 relative to image
 * dimensions, order: TL, TR, BR, BL), perspective-warps the selected quad to a
 * flat rectangle and applies a high-contrast document-scan colour effect.
 *
 * Processing is chunked so the UI can repaint during the computation.
 */
export function warpAndScan(
  srcDataUrl: string,
  corners: [Corner, Corner, Corner, Corner],
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;

      // Map normalized corners to source pixel coordinates
      const sp = corners.map(c => ({ x: c.x * srcW, y: c.y * srcH }));

      // Output dimensions from the distances of the quad sides
      const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot(b.x - a.x, b.y - a.y);
      const outW = Math.round(Math.max(d(sp[0], sp[1]), d(sp[3], sp[2])));
      const outH = Math.round(Math.max(d(sp[0], sp[3]), d(sp[1], sp[2])));

      if (outW < 4 || outH < 4) { resolve(srcDataUrl); return; }

      // Draw source image
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width  = srcW;
      srcCanvas.height = srcH;
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

      // Destination points (flat rectangle)
      const dp = [
        { x: 0,    y: 0    },
        { x: outW, y: 0    },
        { x: outW, y: outH },
        { x: 0,    y: outH },
      ];

      // H maps dst pixel → src pixel (inverse mapping for quality)
      const H = computeHomography(dp, sp);

      const dstCanvas = document.createElement('canvas');
      dstCanvas.width  = outW;
      dstCanvas.height = outH;
      const dstCtx = dstCanvas.getContext('2d')!;
      const dstImg  = dstCtx.createImageData(outW, outH);
      const dstData = dstImg.data;

      // Process row by row, yielding every ~40ms so the spinner can paint
      let lastYield = performance.now();

      for (let dy = 0; dy < outH; dy++) {
        if (performance.now() - lastYield > 40) {
          await new Promise<void>(r => requestAnimationFrame(() => r()));
          lastYield = performance.now();
        }

        for (let dx = 0; dx < outW; dx++) {
          const w  = H[6] * dx + H[7] * dy + H[8];
          const sx = (H[0] * dx + H[1] * dy + H[2]) / w;
          const sy = (H[3] * dx + H[4] * dy + H[5]) / w;

          const x0 = Math.floor(sx), y0 = Math.floor(sy);
          const x1 = x0 + 1,         y1 = y0 + 1;
          const di = (dy * outW + dx) * 4;

          if (x0 < 0 || y0 < 0 || x1 >= srcW || y1 >= srcH) {
            dstData[di] = dstData[di + 1] = dstData[di + 2] = 255;
            dstData[di + 3] = 255;
            continue;
          }

          const fx = sx - x0, fy = sy - y0;
          const i00 = (y0 * srcW + x0) * 4;
          const i10 = (y0 * srcW + x1) * 4;
          const i01 = (y1 * srcW + x0) * 4;
          const i11 = (y1 * srcW + x1) * 4;

          // Bilinear interpolation per channel
          for (let c = 0; c < 3; c++) {
            dstData[di + c] = Math.round(
              srcData[i00 + c] * (1 - fx) * (1 - fy) +
              srcData[i10 + c] *       fx  * (1 - fy) +
              srcData[i01 + c] * (1 - fx) *       fy  +
              srcData[i11 + c] *       fx  *       fy,
            );
          }
          dstData[di + 3] = 255;
        }
      }

      // ── Scan effect (Adobe-Scan style) ─────────────────────────────────────────
      // Normalise each colour channel independently so paper becomes white while
      // preserving document colours (blue headers, red stamps, etc.).
      // Then apply a moderate contrast boost — no grayscale conversion.
      const pixCount = outW * outH;
      const rArr = new Float32Array(pixCount);
      const gArr = new Float32Array(pixCount);
      const bArr = new Float32Array(pixCount);
      for (let i = 0, li = 0; i < dstData.length; i += 4, li++) {
        rArr[li] = dstData[i]; gArr[li] = dstData[i + 1]; bArr[li] = dstData[i + 2];
      }

      const pctIdx = (pct: number) => Math.floor(pixCount * pct);
      const sortCh = (arr: Float32Array) => arr.slice().sort();
      const sr = sortCh(rArr), sg = sortCh(gArr), sb = sortCh(bArr);

      // 3rd %ile = dark point (ink/shadow), 94th %ile = paper/highlight
      const rLo = sr[pctIdx(0.03)], rHi = sr[pctIdx(0.94)];
      const gLo = sg[pctIdx(0.03)], gHi = sg[pctIdx(0.94)];
      const bLo = sb[pctIdx(0.03)], bHi = sb[pctIdx(0.94)];
      const rR = Math.max(1, rHi - rLo);
      const gR = Math.max(1, gHi - gLo);
      const bR = Math.max(1, bHi - bLo);

      // Normalise + moderate contrast (1.6×) — keeps colours intact
      const CONTRAST = 1.6;
      for (let i = 0, li = 0; i < dstData.length; i += 4, li++) {
        const rn = Math.max(0, Math.min(255, (rArr[li] - rLo) / rR * 255));
        const gn = Math.max(0, Math.min(255, (gArr[li] - gLo) / gR * 255));
        const bn = Math.max(0, Math.min(255, (bArr[li] - bLo) / bR * 255));
        dstData[i]     = Math.max(0, Math.min(255, (rn - 128) * CONTRAST + 128));
        dstData[i + 1] = Math.max(0, Math.min(255, (gn - 128) * CONTRAST + 128));
        dstData[i + 2] = Math.max(0, Math.min(255, (bn - 128) * CONTRAST + 128));
        dstData[i + 3] = 255;
      }

      dstCtx.putImageData(dstImg, 0, 0);
      resolve(dstCanvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = srcDataUrl;
  });
}
