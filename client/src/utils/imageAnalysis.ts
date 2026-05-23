import type { QualityResult } from '../types';

const ANALYSIS_SIZE = 400; // px — analyse at reduced resolution for speed

function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const base = i * 4;
    gray[i] = 0.299 * data[base] + 0.587 * data[base + 1] + 0.114 * data[base + 2];
  }
  return gray;
}

function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        gray[(y - 1) * w + x] +
        gray[(y + 1) * w + x] +
        gray[y * w + (x - 1)] +
        gray[y * w + (x + 1)] -
        4 * gray[idx];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function brightnessStats(
  data: Uint8ClampedArray,
  pixelCount: number
): { avgLuminance: number; glarePercent: number } {
  let totalLuminance = 0;
  let glarePixels = 0;

  for (let i = 0; i < pixelCount; i++) {
    const base = i * 4;
    const lum = 0.299 * data[base] + 0.587 * data[base + 1] + 0.114 * data[base + 2];
    totalLuminance += lum;
    if (lum > 240) glarePixels++;
  }

  return {
    avgLuminance: totalLuminance / pixelCount,
    glarePercent: (glarePixels / pixelCount) * 100,
  };
}

function drawDownsampled(
  source: HTMLVideoElement | HTMLImageElement,
  canvas: HTMLCanvasElement
): { w: number; h: number } {
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  const ratio = Math.min(ANALYSIS_SIZE / srcW, ANALYSIS_SIZE / srcH);
  const w = Math.max(1, Math.floor(srcW * ratio));
  const h = Math.max(1, Math.floor(srcH * ratio));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);
  return { w, h };
}

let _analysisCanvas: HTMLCanvasElement | null = null;
function getAnalysisCanvas(): HTMLCanvasElement {
  if (!_analysisCanvas) _analysisCanvas = document.createElement('canvas');
  return _analysisCanvas;
}

export function analyzeVideoFrame(video: HTMLVideoElement): Pick<QualityResult, 'isDark' | 'avgLuminance'> {
  if (video.readyState < 2) return { isDark: false, avgLuminance: 128 };

  const canvas = getAnalysisCanvas();
  const { w, h } = drawDownsampled(video, canvas);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, w, h);
  const { avgLuminance } = brightnessStats(imageData.data, w * h);

  return { isDark: avgLuminance < 55, avgLuminance };
}

export function analyzeImageQuality(dataUrl: string): Promise<QualityResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const { w, h } = drawDownsampled(img, canvas);
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, w, h);

      const gray = toGrayscale(imageData.data, w, h);
      const blurScore = laplacianVariance(gray, w, h);
      const { avgLuminance, glarePercent } = brightnessStats(imageData.data, w * h);

      resolve({
        blurScore,
        isBlurry: blurScore < 60,
        avgLuminance,
        isDark: avgLuminance < 55,
        glarePercent,
        // Only flag extreme concentrated glare (e.g. direct sunlight reflection),
        // not normal white paper which naturally has high luminance.
        hasGlare: glarePercent > 55 && avgLuminance > 230,
      });
    };
    img.onerror = () => reject(new Error('Failed to load image for analysis'));
    img.src = dataUrl;
  });
}

export function captureFrame(video: HTMLVideoElement): string {
  const maxW = 1600;
  let w = video.videoWidth;
  let h = video.videoHeight;

  if (w > maxW) {
    h = Math.floor((h * maxW) / w);
    w = maxW;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, w, h);
  // Return raw photo — scan effect is applied after perspective warp in warpAndScan()
  return canvas.toDataURL('image/jpeg', 0.88);
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? dataUrl;
}
