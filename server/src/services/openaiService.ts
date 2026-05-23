import OpenAI from 'openai';
import { config } from '../config';
import type { DocumentId, FormData, ValidateScanResponse, ExtractDataResponse } from '../types';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// ─── Document labels for UI messages ────────────────────────────────────────

const DOC_LABELS: Record<DocumentId, string> = {
  passport:              'passport',
  visa:                  'visa',
  driverLicense:         "driver's license or government-issued ID card",
  educationalCredential: 'educational diploma or transcript',
  employmentLetter:      'employment letter',
  financialProof:        'bank statement or financial proof',
  marriageCertificate:   'marriage certificate',
  birthCertificate:      'birth certificate',
  supportingDocuments:   'official document',
};

// ─── Per-type visual characteristics injected into the validation prompt ────

const DOC_VISUAL_TRAITS: Record<DocumentId, string> = {
  passport: `A passport is a BOOKLET — multiple pages bound together like a small book, NOT a flat card.
Required visual markers (at least 2 must be clearly visible):
• The word "PASSPORT" on the cover or data page
• A biographical data page with holder's photo and personal details in printed fields
• A Machine Readable Zone (MRZ): two lines of monospaced alphanumeric characters at the bottom of the data page (e.g. "P<GBR..." or "P<USA...")
• An embossed country seal or national emblem on the cover
• Lamination or holographic overlay on the data page

IMPORTANT — the following documents are NOT passports and must be rejected:
- Driver's licence or national ID card (flat plastic card, credit-card size)
- Visa sticker alone (affixed to a passport page but not the passport itself)
- Any flat A4/letter paper document`,

  visa: `A visa is one of the following:
(a) A coloured foil/sticker affixed to a passport page, with printed fields for issuing country, visa type code, entry/exit dates, and a control number or barcode. The underlying passport page grid pattern is usually visible around the sticker.
(b) An official government approval letter explicitly granting visa permission, on official letterhead with the issuing authority's name, address, and reference number.
IMPORTANT — a plain passport booklet without a visa sticker is NOT a visa.`,

  driverLicense: `A driver's licence (or government-issued ID card) is a small plastic card, approximately credit-card size (85×54 mm).
Required visual markers (at least 2 must be clearly visible):
• State, Province, or Country name prominently at the top
• Holder's photograph on the front face
• A driver licence number or ID number
• Vehicle class/category codes (e.g. "CLASS G", "B", "AM/B1")
• Cardholder's address
• Expiry date printed on front
• Magnetic stripe, barcode, or chip
IMPORTANT — a passport booklet is NOT a driver's licence.`,

  educationalCredential: `An educational credential is a formal document issued by a university, college, or school.
Required visual markers (at least 2 must be visible):
• Institution's name and/or logo
• Recipient's full name
• Degree, diploma, or certificate title (e.g. "Bachelor of Science", "Diploma in Business")
• Date of conferral/graduation
• Signatures of dean, registrar, or authorised signatory
• Official institutional seal or stamp`,

  employmentLetter: `An employment verification letter is a formal letter on company letterhead confirming employment.
Required visual markers (at least 2 must be visible):
• Company name, logo, and address in the letterhead
• Salutation (e.g. "To Whom It May Concern")
• Employee's full name and job title
• Employment details: start date, salary/compensation
• Authorised signatory with name, title, and signature`,

  financialProof: `A bank statement or financial proof document issued by a financial institution.
Required visual markers (at least 2 must be visible):
• Bank or financial institution name and/or logo
• Account holder's name and address
• Account number (may be partially masked)
• Statement period dates
• Transaction history or account balance`,

  marriageCertificate: `A marriage certificate is an official document recording a marriage.
Required visual markers (at least 2 must be visible):
• Title "Certificate of Marriage", "Marriage Certificate", or equivalent
• Full names of both spouses
• Date and place/location of marriage
• Signatures of officiant and/or witnesses
• Official government seal or stamp, or registration number`,

  birthCertificate: `A birth certificate is an official document recording a birth.
Required visual markers (at least 2 must be visible):
• Title "Certificate of Birth", "Birth Certificate", or equivalent
• Full name of the registered person
• Date and place of birth
• Names of parents
• Official government seal or stamp, or registration number
• Registrar's signature`,

  supportingDocuments: `Any clearly legible official document that could support an immigration application. Accept if the document appears to be a genuine official or formal document.`,
};

// ─── Extraction field schemas per document ──────────────────────────────────

type FieldSpec = { key: keyof FormData; desc: string };

const EXTRACT_FIELDS: Record<DocumentId, FieldSpec[]> = {
  passport: [
    { key: 'firstName',             desc: 'Given / first name(s)'         },
    { key: 'lastName',              desc: 'Surname / family name'          },
    { key: 'dateOfBirth',           desc: 'Date of birth (YYYY-MM-DD)'     },
    { key: 'gender',                desc: 'Gender (M/F/X)'                 },
    { key: 'nationality',           desc: 'Nationality as printed'         },
    { key: 'placeOfBirth',          desc: 'Place / city of birth'          },
    { key: 'countryOfBirth',        desc: 'Country of birth'               },
    { key: 'passportNumber',        desc: 'Passport number'                },
    { key: 'passportExpiry',        desc: 'Expiry/expiration date (YYYY-MM-DD)' },
    { key: 'passportIssuingCountry',desc: 'Country that issued the passport' },
  ],
  visa: [
    { key: 'visaNumber',        desc: 'Visa number / foil number'          },
    { key: 'visaType',          desc: 'Visa type/category (e.g. Study, Work, Visitor)' },
    { key: 'visaExpiry',        desc: 'Visa expiry date (YYYY-MM-DD)'      },
    { key: 'visaIssuingCountry',desc: 'Country that issued the visa'       },
  ],
  driverLicense: [
    { key: 'address',     desc: 'Full street address'           },
    { key: 'city',        desc: 'City'                          },
    { key: 'province',    desc: 'Province or state abbreviation'},
    { key: 'postalCode',  desc: 'Postal or ZIP code'            },
    { key: 'licenseNumber',desc: 'Driver license number'        },
    { key: 'licenseExpiry',desc: 'License expiry date (YYYY-MM-DD)' },
  ],
  educationalCredential: [
    { key: 'institution',    desc: 'Name of the educational institution' },
    { key: 'degree',         desc: 'Degree, diploma, or certificate name' },
    { key: 'graduationDate', desc: 'Graduation or completion date (YYYY-MM-DD or YYYY-MM or YYYY)' },
  ],
  employmentLetter: [
    { key: 'employerName',       desc: 'Employer / company name' },
    { key: 'jobTitle',           desc: 'Job title / position'    },
    { key: 'salary',             desc: 'Salary amount and currency (as printed)' },
    { key: 'employmentStartDate',desc: 'Employment start date (YYYY-MM-DD)'      },
  ],
  financialProof: [
    { key: 'bankName', desc: 'Bank or financial institution name' },
  ],
  marriageCertificate: [
    { key: 'spouseName',       desc: 'Full name of spouse / partner' },
    { key: 'marriageDate',     desc: 'Date of marriage (YYYY-MM-DD)'  },
    { key: 'marriageLocation', desc: 'Location / city and country of marriage' },
  ],
  birthCertificate: [
    { key: 'placeOfBirth', desc: 'Place / city of birth'          },
    { key: 'dateOfBirth',  desc: 'Date of birth (YYYY-MM-DD)'     },
  ],
  supportingDocuments: [],
};

// ─── Validate scan ───────────────────────────────────────────────────────────

export async function validateDocumentScan(
  imageBase64: string,
  documentId: DocumentId
): Promise<ValidateScanResponse> {
  const expectedLabel = DOC_LABELS[documentId];
  const visualTraits  = DOC_VISUAL_TRAITS[documentId];

  const prompt = `You are a strict document classifier for an immigration services intake portal.

The user claims the image shows a: ${expectedLabel}

VISUAL CHARACTERISTICS OF THE EXPECTED DOCUMENT:
${visualTraits}

Your task:
1. Examine the image carefully.
2. Check whether the document in the image matches the expected type based on the visual characteristics above.
3. Do NOT accept a document of a different type even if it is a valid official document.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "isCorrectType": true or false,
  "confidence": number between 0 and 1,
  "detectedType": "concise description of what you actually see in the image",
  "reason": "one short sentence explaining your decision"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());

    if (json.isCorrectType) {
      return { valid: true, confidence: json.confidence ?? 0.9, message: 'Document accepted.' };
    } else {
      const detected = json.detectedType ? ` The image appears to show: ${json.detectedType}.` : '';
      return {
        valid: false,
        confidence: json.confidence ?? 0.1,
        message: `Wrong document type.${detected} Please scan your ${expectedLabel} instead. ${json.reason ?? ''}`.trim(),
      };
    }
  } catch (err) {
    console.error('[validateDocumentScan] error:', err);
    // Cannot validate — return skipped flag so the client can warn the user
    return {
      valid: true,
      confidence: 0,
      message: `AI validation is currently unavailable. Please confirm you are scanning your ${expectedLabel} before continuing.`,
      validationSkipped: true,
    };
  }
}

// ─── Extract data ────────────────────────────────────────────────────────────

export async function extractDocumentData(
  documentId: DocumentId,
  pages: string[]
): Promise<ExtractDataResponse> {
  const fields = EXTRACT_FIELDS[documentId];

  if (fields.length === 0) {
    return { extractedData: {}, confidence: {} };
  }

  const fieldList = fields.map((f) => `  "${f.key}": ${f.desc}`).join('\n');
  const jsonKeys  = fields.map((f) => `"${f.key}"`).join(', ');

  const prompt = `You are an OCR system for immigration document processing. Extract information from the provided ${DOC_LABELS[documentId]} image(s).

Extract the following fields:
${fieldList}

Rules:
- Return ONLY valid JSON, no markdown, no extra text
- Use null for fields you cannot find or read
- Dates must be in YYYY-MM-DD format when possible; use YYYY-MM or YYYY if day/month unknown
- Normalise names to Title Case
- Do not guess or fabricate values

JSON schema (keys: ${jsonKeys}):
{
${fields.map((f) => `  "${f.key}": string or null`).join(',\n')}
}`;

  // Build image content blocks — send all pages
  const imageBlocks = pages.slice(0, 5).map((b64) => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' as const },
  }));

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageBlocks,
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const raw  = JSON.parse(text.replace(/```json|```/g, '').trim()) as Record<string, string | null>;

    // Build output: skip null values, assign default confidence
    const extractedData: Partial<FormData> = {};
    const confidence: Partial<Record<keyof FormData, number>> = {};

    for (const field of fields) {
      const val = raw[field.key];
      if (val && val !== 'null' && val !== 'N/A' && val !== '') {
        (extractedData as Record<string, string>)[field.key] = val;
        confidence[field.key] = 0.88;
      }
    }

    return { extractedData, confidence };
  } catch (err) {
    console.error('[extractDocumentData] error:', err);
    // Fail open — document is still accepted; user fills form manually
    return { extractedData: {}, confidence: {} };
  }
}
