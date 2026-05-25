import * as pdfjsLib from 'pdfjs-dist';

// Point pdfjs at its bundled worker (Vite resolves the URL at build time)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

/**
 * Converts every page of a PDF File into JPEG data-URLs.
 *
 * Scale 1.8 gives roughly 1600 × 2200 px for A4 — enough for OCR, small
 * enough to stay under the 1 MB per-page limit in most cases.
 */
export async function pdfToImages(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // Render at scale 1.8; cap width at 1 600 px to stay within size limits
    let scale = 1.8;
    const rawViewport = page.getViewport({ scale: 1 });
    if (rawViewport.width * scale > 1600) {
      scale = 1600 / rawViewport.width;
    }

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.92));
  }

  return images;
}
