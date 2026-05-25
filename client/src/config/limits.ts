// ─── Size guardrails ───────────────────────────────────────────────────────────
// Applied to both uploaded files and camera-scanned pages.

export const MAX_PAGE_BYTES  = 1_048_576;   // 1 MB per individual file / scan (image or PDF)
export const MAX_TOTAL_BYTES = 23_068_672;  // 22 MB cumulative across ALL documents
