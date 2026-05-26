import { Router } from 'express';
import type { Request, Response } from 'express';
import { validateDocumentScan, extractDocumentData } from '../services/openaiService';
import type { ValidateScanRequest, ExtractDataRequest } from '../types';
import { VALID_DOCUMENT_IDS } from '../types';

const router = Router();

// POST /api/validate-scan
router.post('/validate-scan', async (req: Request, res: Response) => {
  const { documentId, imageBase64 } = req.body as ValidateScanRequest;

  if (!documentId || !imageBase64) {
    return res.status(400).json({ error: 'documentId and imageBase64 are required' });
  }

  if (!VALID_DOCUMENT_IDS.has(documentId)) {
    return res.status(400).json({ error: 'Invalid documentId.' });
  }

  try {
    const result = await validateDocumentScan(imageBase64, documentId);
    return res.json(result);
  } catch (err) {
    console.error('[/validate-scan]', err);
    return res.status(500).json({ error: 'Validation service unavailable' });
  }
});

// POST /api/extract-data
router.post('/extract-data', async (req: Request, res: Response) => {
  const { documentId, pages } = req.body as ExtractDataRequest;

  if (!documentId || !Array.isArray(pages) || pages.length === 0) {
    return res.status(400).json({ error: 'documentId and pages array are required' });
  }

  if (!VALID_DOCUMENT_IDS.has(documentId)) {
    return res.status(400).json({ error: 'Invalid documentId.' });
  }

  if (pages.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 pages per document' });
  }

  try {
    const result = await extractDocumentData(documentId, pages);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed';
    console.error('[/extract-data]', err);
    return res.status(500).json({ error: msg });
  }
});

export default router;
