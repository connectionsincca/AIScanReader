import OpenAI from 'openai';
import { config } from '../config';
import type { DocumentId, FormData, ValidateScanResponse, ExtractDataResponse } from '../types';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// ─── Document labels for UI messages ────────────────────────────────────────

const DOC_LABELS: Record<DocumentId, string> = {
  // Applicant — extraction
  passport:              'passport',
  marriageCertificate:   'marriage certificate',
  addressProof:          'address proof document (Aadhar card, driving licence, or rent agreement)',
  workExperienceCert:    'work experience certificate or employment letter',
  degreeCertificate:     'degree or diploma certificate',
  ieltsScoreSheet:       'IELTS Test Report Form',
  celpipScoreSheet:      'CELPIP Score Report',
  // Applicant — proof of funds (upload only)
  bankStatement:         'bank statement',
  salarySlips:           'salary slips or pay stubs',
  taxReturn:             'income tax return or ITR',
  netWorthStatement:     'net worth statement',
  propertyOwnership:     'property ownership document',
  // Applicant — upload only
  birthCertificate:      'birth certificate',
  eventInvitationLetter: 'event invitation letter',
  travelTickets:         'travel tickets or flight booking',
  digitalPicture:        'passport-style photograph',
  // Spouse
  spousePassport:             "spouse's passport",
  spouseWorkExperienceCert:   "spouse's work experience certificate",
  spouseDegreeCertificate:    "spouse's degree certificate",
  spouseEventInvitationLetter:"spouse's event invitation letter",
  spouseTravelTickets:        "spouse's travel tickets",
  spouseDigitalPicture:       "spouse's photograph",
  // Children
  child1Passport:        "child 1's passport",
  child1TravelTickets:   "child 1's travel tickets",
  child1DigitalPicture:  "child 1's photograph",
  child2Passport:        "child 2's passport",
  child2TravelTickets:   "child 2's travel tickets",
  child2DigitalPicture:  "child 2's photograph",
  child3Passport:        "child 3's passport",
  child3TravelTickets:   "child 3's travel tickets",
  child3DigitalPicture:  "child 3's photograph",
  child4Passport:        "child 4's passport",
  child4TravelTickets:   "child 4's travel tickets",
  child4DigitalPicture:  "child 4's photograph",
};

// ─── Per-type visual characteristics injected into the validation prompt ────

const PASSPORT_TRAITS = `A passport is a BOOKLET — multiple pages bound together like a small book, NOT a flat card.
Required visual markers (at least 2 must be clearly visible):
• The word "PASSPORT" on the cover or data page
• A biographical data page with holder's photo and personal details in printed fields
• A Machine Readable Zone (MRZ): two lines of monospaced alphanumeric characters at the bottom of the data page (e.g. "P<IND..." or "P<GBR...")
• An embossed country seal or national emblem on the cover
• Lamination or holographic overlay on the data page

IMPORTANT — the following documents are NOT passports and must be rejected:
- Driver's licence or national ID card (flat plastic card, credit-card size)
- Visa sticker alone (affixed to a passport page but not the passport itself)
- Any flat A4/letter paper document`;

const DOC_VISUAL_TRAITS: Record<DocumentId, string> = {

  passport: PASSPORT_TRAITS,

  marriageCertificate: `A marriage certificate is an official document recording a marriage.
Required visual markers (at least 2 must be visible):
• Title "Certificate of Marriage", "Marriage Certificate", or equivalent in any language
• Full names of both spouses
• Date and place/location of marriage
• Signatures of officiant and/or witnesses
• Official government seal or stamp, or registration number`,

  addressProof: `An address proof document is one of: Aadhar card, driving licence, passport, or rent agreement.
Required visual markers (at least 2 must be visible):
• Holder's full name
• A complete residential address (house/flat number, street, city, pincode/postal code)
• Aadhar: 12-digit Aadhar number; driving licence: DL number and state; rent agreement: landlord/tenant names and property address
• Official logo, seal, or issuing authority name`,

  workExperienceCert: `A work experience certificate or employment letter is issued by a company on official letterhead.
Required visual markers (at least 2 must be visible):
• Company name, logo, and/or address in the letterhead
• Employee's full name
• Job title / designation
• Employment period (start date and/or end date) OR a statement of current employment
• Authorised signatory with name, title, and signature or company stamp`,

  degreeCertificate: `An educational degree certificate or diploma is issued by a university, college, or institute.
Required visual markers (at least 2 must be visible):
• Institution's name and/or logo
• Recipient's full name
• Degree, diploma, or certificate title (e.g. "Bachelor of Engineering", "Diploma in Business Administration")
• Date of conferral or graduation
• Signatures of dean, registrar, or authorised signatory
• Official institutional seal or stamp`,

  ieltsScoreSheet: `An IELTS Test Report Form (TRF) is issued by British Council, IDP, or Cambridge Assessment English.
Required visual markers (at least 2 must be visible):
• "IELTS" logo or the words "International English Language Testing System"
• Test taker's full name and date of birth
• Four component scores: Listening, Reading, Writing, Speaking (each 0–9)
• Overall Band Score (e.g. 7.0)
• Test date`,

  celpipScoreSheet: `A CELPIP Score Report is issued by Paragon Testing Enterprises.
Required visual markers (at least 2 must be visible):
• "CELPIP" logo or the words "Canadian English Language Proficiency Index Program"
• Test taker's name
• Four component scores: Listening, Reading, Writing, Speaking (each 1–12)
• Overall/composite score
• Test date`,

  // ── Upload-only docs — visual validation is permissive ──────────────────────

  bankStatement: `A bank statement is an official document from a bank or financial institution.
Required visual markers (at least 2 must be visible):
• Bank or institution name and/or logo
• Account holder's name
• Account number (may be partially masked)
• Statement period or transaction history
• Running balance figures`,

  salarySlips: `A salary slip or pay stub is issued by an employer showing monthly or periodic pay.
Required visual markers (at least 2 must be visible):
• Employer/company name
• Employee's name
• Pay period or month
• Salary components (basic pay, allowances, deductions)
• Net pay / take-home amount`,

  taxReturn: `An income tax return (ITR) or tax acknowledgement issued by a tax authority.
Required visual markers (at least 1 must be visible):
• Tax authority name (e.g. Income Tax Department)
• Taxpayer's name or PAN
• Assessment year or financial year
• ITR form number or acknowledgement number`,

  netWorthStatement: `A net worth statement or CA certificate issued by a Chartered Accountant.
Required visual markers (at least 2 must be visible):
• CA's name, membership number, and/or firm name
• Client's / applicant's name
• Net worth figure or asset/liability statement
• CA signature and stamp/seal`,

  propertyOwnership: `A property ownership document such as a sale deed, title deed, or property registration certificate.
Required visual markers (at least 2 must be visible):
• Property address or survey number
• Owner's name
• Registration authority or sub-registrar stamp/seal
• Registration number and/or date`,

  birthCertificate: `A birth certificate is an official document recording a birth.
Required visual markers (at least 2 must be visible):
• Title "Certificate of Birth", "Birth Certificate", or equivalent
• Full name of the registered person
• Date and place of birth
• Names of parents
• Official government seal or stamp, or registration number`,

  eventInvitationLetter: `An event invitation letter or conference invitation issued by an organiser.
Required visual markers (at least 2 must be visible):
• Organiser's name, institution, or company
• Invitee's name
• Event name, dates, and/or venue
• Signature or official stamp of the organiser`,

  travelTickets: `A flight ticket, travel itinerary, or booking confirmation.
Required visual markers (at least 2 must be visible):
• Airline or travel company name
• Passenger name
• Flight/route details (origin and destination)
• Travel date(s)
• Booking reference or PNR`,

  digitalPicture: `A passport-style photograph or headshot — accept any clearly visible photograph of a person.
Required: the image shows a person's face clearly. Accept any well-lit photograph.`,

  // ── Spouse documents ─────────────────────────────────────────────────────────

  spousePassport:             PASSPORT_TRAITS,
  spouseWorkExperienceCert:   `A work experience certificate or employment letter issued by a company on official letterhead.
Required visual markers (at least 2 must be visible):
• Company name, logo, and/or address in the letterhead
• Employee's full name and job title / designation
• Employment period or statement of current employment
• Authorised signatory with name, title, and signature or company stamp`,

  spouseDegreeCertificate: `An educational degree certificate or diploma issued by a university, college, or institute.
Required visual markers (at least 2 must be visible):
• Institution's name and/or logo
• Recipient's full name
• Degree or certificate title
• Date of conferral / graduation
• Official institutional seal or stamp`,

  spouseEventInvitationLetter: `An event invitation letter or conference invitation issued by an organiser.
Required visual markers (at least 2 must be visible):
• Organiser's name or institution
• Invitee's name and event name or dates`,

  spouseTravelTickets: `A flight ticket, travel itinerary, or booking confirmation.
Required visual markers (at least 2 must be visible):
• Airline or travel company name
• Passenger name, flight/route details, and travel date(s)`,

  spouseDigitalPicture: `A passport-style photograph. Accept any clearly visible photograph showing a person's face.`,

  // ── Child documents ──────────────────────────────────────────────────────────

  child1Passport: PASSPORT_TRAITS,
  child1TravelTickets: `A flight ticket, travel itinerary, or booking confirmation for the child.
Required: passenger name, flight/route, and travel date(s).`,
  child1DigitalPicture: `A passport-style photograph. Accept any clearly visible photograph showing a person's face.`,

  child2Passport: PASSPORT_TRAITS,
  child2TravelTickets: `A flight ticket, travel itinerary, or booking confirmation for the child.
Required: passenger name, flight/route, and travel date(s).`,
  child2DigitalPicture: `A passport-style photograph. Accept any clearly visible photograph showing a person's face.`,

  child3Passport: PASSPORT_TRAITS,
  child3TravelTickets: `A flight ticket, travel itinerary, or booking confirmation for the child.
Required: passenger name, flight/route, and travel date(s).`,
  child3DigitalPicture: `A passport-style photograph. Accept any clearly visible photograph showing a person's face.`,

  child4Passport: PASSPORT_TRAITS,
  child4TravelTickets: `A flight ticket, travel itinerary, or booking confirmation for the child.
Required: passenger name, flight/route, and travel date(s).`,
  child4DigitalPicture: `A passport-style photograph. Accept any clearly visible photograph showing a person's face.`,
};

// ─── Extraction field schemas per document ──────────────────────────────────
// Fields with isArray:true expect the LLM to output a JSON array value.
// The extractor will JSON.stringify arrays before storing in FormData.

type FieldSpec = {
  key: keyof FormData;
  desc: string;
  isArray?: boolean;
};

const EXTRACT_FIELDS: Record<DocumentId, FieldSpec[]> = {

  // ── Applicant ────────────────────────────────────────────────────────────────

  passport: [
    { key: 'firstName',            desc: 'Given / first name(s) as printed'                },
    { key: 'lastName',             desc: 'Surname / family name'                            },
    { key: 'dateOfBirth',          desc: 'Date of birth (YYYY-MM-DD)'                       },
    { key: 'cityOfBirth',          desc: 'City or place of birth'                           },
    { key: 'countryOfBirth',       desc: 'Country of birth'                                 },
    { key: 'citizenship',          desc: 'Nationality / citizenship as printed'             },
    { key: 'passportNumber',       desc: 'Passport number'                                  },
    { key: 'passportIssueDate',    desc: 'Date of issue (YYYY-MM-DD)'                       },
    { key: 'passportExpiry',       desc: 'Expiry / expiration date (YYYY-MM-DD)'            },
    { key: 'passportIssuingCountry', desc: 'Country that issued the passport'               },
    { key: 'currentAddress',       desc: 'Full residential address if printed in the passport (some passports include an address page — include flat/house number, street, city, pincode/postal code). Leave empty if no address is present.' },
  ],

  marriageCertificate: [
    { key: 'dateOfMarriage', desc: 'Date of marriage (YYYY-MM-DD)' },
  ],

  addressProof: [
    { key: 'currentAddress', desc: 'Full residential address as printed on the document (include flat/house number, street, city, pincode / postal code)' },
  ],

  workExperienceCert: [
    { key: 'currentOccupation', desc: 'Job title / designation from the most recent certificate' },
    {
      key: 'workHistory',
      isArray: true,
      desc: `JSON array of all jobs found across all provided certificates.
Each element: { "employer": string, "jobTitle": string, "jobType": "Full-time" | "Part-time" | "Contract" | "Other", "salary": string, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD or Present", "cityCountry": string, "responsibilities": string }
Include one entry per employer. If only one certificate is provided, the array will have one element.`,
    },
  ],

  degreeCertificate: [
    {
      key: 'educationHistory',
      isArray: true,
      desc: `JSON array of all qualifications found across all provided certificates.
Each element: { "institution": string, "fieldOfStudy": string, "certificate": string, "startDate": "YYYY-MM-DD or YYYY", "endDate": "YYYY-MM-DD or YYYY", "hrsPerWeek": string, "cityCountry": string }
Include one entry per certificate / degree. "certificate" is the full degree/diploma name (e.g. "Bachelor of Engineering").`,
    },
  ],

  ieltsScoreSheet: [
    { key: 'ieltsTestDate',    desc: 'Date the test was taken (YYYY-MM-DD)'                  },
    { key: 'ieltsResultDate',  desc: 'Date results were issued (YYYY-MM-DD)'                 },
    { key: 'ieltsListening',   desc: 'Listening band score (number, e.g. 7.5)'               },
    { key: 'ieltsReading',     desc: 'Reading band score (number, e.g. 7.0)'                 },
    { key: 'ieltsWriting',     desc: 'Writing band score (number, e.g. 6.5)'                 },
    { key: 'ieltsSpeaking',    desc: 'Speaking band score (number, e.g. 7.0)'                },
    { key: 'ieltsOverall',     desc: 'Overall band score (number, e.g. 7.0)'                 },
  ],

  celpipScoreSheet: [
    { key: 'celpipTestDate',    desc: 'Date the test was taken (YYYY-MM-DD)'                 },
    { key: 'celpipResultDate',  desc: 'Date results were issued (YYYY-MM-DD)'                },
    { key: 'celpipListening',   desc: 'Listening score (integer 1–12)'                       },
    { key: 'celpipReading',     desc: 'Reading score (integer 1–12)'                         },
    { key: 'celpipWriting',     desc: 'Writing score (integer 1–12)'                         },
    { key: 'celpipSpeaking',    desc: 'Speaking score (integer 1–12)'                        },
    { key: 'celpipOverall',     desc: 'Overall / composite score'                            },
  ],

  // ── Upload-only: no extraction ───────────────────────────────────────────────
  bankStatement:         [],
  salarySlips:           [],
  taxReturn:             [],
  netWorthStatement:     [],
  propertyOwnership:     [],
  birthCertificate:      [],
  eventInvitationLetter: [],
  travelTickets:         [],
  digitalPicture:        [],

  // ── Spouse ───────────────────────────────────────────────────────────────────

  spousePassport: [
    { key: 'spouseFirstName',              desc: "Spouse's given / first name(s)"              },
    { key: 'spouseLastName',               desc: "Spouse's surname / family name"              },
    { key: 'spouseDateOfBirth',            desc: "Spouse's date of birth (YYYY-MM-DD)"         },
    { key: 'spousePlaceOfBirth',           desc: "Spouse's city or place of birth"             },
    { key: 'spouseCitizenship',            desc: "Spouse's nationality / citizenship"          },
    { key: 'spousePassportNumber',         desc: "Spouse's passport number"                    },
    { key: 'spousePassportIssueDate',      desc: "Spouse's passport date of issue (YYYY-MM-DD)"},
    { key: 'spousePassportExpiry',         desc: "Spouse's passport expiry date (YYYY-MM-DD)"  },
    { key: 'spousePassportIssuingCountry', desc: "Country that issued the spouse's passport"   },
  ],

  spouseWorkExperienceCert: [
    { key: 'spouseCurrentOccupation', desc: "Spouse's job title from most recent certificate" },
    {
      key: 'spouseWorkHistory',
      isArray: true,
      desc: `JSON array of all jobs found across all certificates for the spouse.
Each element: { "employer": string, "jobTitle": string, "jobType": "Full-time" | "Part-time" | "Contract" | "Other", "salary": string, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD or Present", "cityCountry": string, "responsibilities": string }`,
    },
  ],

  spouseDegreeCertificate: [
    {
      key: 'spouseEducationHistory',
      isArray: true,
      desc: `JSON array of all qualifications found across all certificates for the spouse.
Each element: { "institution": string, "fieldOfStudy": string, "certificate": string, "startDate": "YYYY-MM-DD or YYYY", "endDate": "YYYY-MM-DD or YYYY", "hrsPerWeek": string, "cityCountry": string }`,
    },
  ],

  spouseEventInvitationLetter: [],
  spouseTravelTickets:         [],
  spouseDigitalPicture:        [],

  // ── Child 1 ──────────────────────────────────────────────────────────────────

  child1Passport: [
    { key: 'child1FirstName',              desc: "Child 1's given / first name(s)"              },
    { key: 'child1LastName',               desc: "Child 1's surname / family name"              },
    { key: 'child1DateOfBirth',            desc: "Child 1's date of birth (YYYY-MM-DD)"         },
    { key: 'child1PlaceOfBirth',           desc: "Child 1's city or place of birth"             },
    { key: 'child1Citizenship',            desc: "Child 1's nationality / citizenship"          },
    { key: 'child1PassportNumber',         desc: "Child 1's passport number"                    },
    { key: 'child1PassportIssueDate',      desc: "Child 1's passport date of issue (YYYY-MM-DD)"},
    { key: 'child1PassportExpiry',         desc: "Child 1's passport expiry date (YYYY-MM-DD)"  },
    { key: 'child1PassportIssuingCountry', desc: "Country that issued child 1's passport"       },
  ],
  child1TravelTickets:  [],
  child1DigitalPicture: [],

  // ── Child 2 ──────────────────────────────────────────────────────────────────

  child2Passport: [
    { key: 'child2FirstName',              desc: "Child 2's given / first name(s)"              },
    { key: 'child2LastName',               desc: "Child 2's surname / family name"              },
    { key: 'child2DateOfBirth',            desc: "Child 2's date of birth (YYYY-MM-DD)"         },
    { key: 'child2PlaceOfBirth',           desc: "Child 2's city or place of birth"             },
    { key: 'child2Citizenship',            desc: "Child 2's nationality / citizenship"          },
    { key: 'child2PassportNumber',         desc: "Child 2's passport number"                    },
    { key: 'child2PassportIssueDate',      desc: "Child 2's passport date of issue (YYYY-MM-DD)"},
    { key: 'child2PassportExpiry',         desc: "Child 2's passport expiry date (YYYY-MM-DD)"  },
    { key: 'child2PassportIssuingCountry', desc: "Country that issued child 2's passport"       },
  ],
  child2TravelTickets:  [],
  child2DigitalPicture: [],

  // ── Child 3 ──────────────────────────────────────────────────────────────────

  child3Passport: [
    { key: 'child3FirstName',              desc: "Child 3's given / first name(s)"              },
    { key: 'child3LastName',               desc: "Child 3's surname / family name"              },
    { key: 'child3DateOfBirth',            desc: "Child 3's date of birth (YYYY-MM-DD)"         },
    { key: 'child3PlaceOfBirth',           desc: "Child 3's city or place of birth"             },
    { key: 'child3Citizenship',            desc: "Child 3's nationality / citizenship"          },
    { key: 'child3PassportNumber',         desc: "Child 3's passport number"                    },
    { key: 'child3PassportIssueDate',      desc: "Child 3's passport date of issue (YYYY-MM-DD)"},
    { key: 'child3PassportExpiry',         desc: "Child 3's passport expiry date (YYYY-MM-DD)"  },
    { key: 'child3PassportIssuingCountry', desc: "Country that issued child 3's passport"       },
  ],
  child3TravelTickets:  [],
  child3DigitalPicture: [],

  // ── Child 4 ──────────────────────────────────────────────────────────────────

  child4Passport: [
    { key: 'child4FirstName',              desc: "Child 4's given / first name(s)"              },
    { key: 'child4LastName',               desc: "Child 4's surname / family name"              },
    { key: 'child4DateOfBirth',            desc: "Child 4's date of birth (YYYY-MM-DD)"         },
    { key: 'child4PlaceOfBirth',           desc: "Child 4's city or place of birth"             },
    { key: 'child4Citizenship',            desc: "Child 4's nationality / citizenship"          },
    { key: 'child4PassportNumber',         desc: "Child 4's passport number"                    },
    { key: 'child4PassportIssueDate',      desc: "Child 4's passport date of issue (YYYY-MM-DD)"},
    { key: 'child4PassportExpiry',         desc: "Child 4's passport expiry date (YYYY-MM-DD)"  },
    { key: 'child4PassportIssuingCountry', desc: "Country that issued child 4's passport"       },
  ],
  child4TravelTickets:  [],
  child4DigitalPicture: [],
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

  // Array fields are returned inline as JSON arrays; scalars as strings.
  const schemaLines = fields.map((f) =>
    f.isArray
      ? `  "${f.key}": array (JSON array, not a string)`
      : `  "${f.key}": string or null`
  ).join(',\n');

  const prompt = `You are an OCR system for immigration document processing. Extract information from the provided ${DOC_LABELS[documentId]} image(s).

Extract the following fields:
${fieldList}

Rules:
- Return ONLY valid JSON, no markdown, no extra text
- Use null for fields you cannot find or read
- Dates must be in YYYY-MM-DD format when possible; use YYYY-MM or YYYY if day/month unknown
- Normalise names to Title Case
- Do not guess or fabricate values
- For array fields, output a real JSON array (not a stringified array)

JSON schema (keys: ${jsonKeys}):
{
${schemaLines}
}`;

  const imageBlocks = pages.slice(0, 5).map((b64) => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' as const },
  }));

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1200,
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
    const raw  = JSON.parse(text.replace(/```json|```/g, '').trim()) as Record<string, unknown>;

    const extractedData: Partial<FormData> = {};
    const confidence: Partial<Record<keyof FormData, number>> = {};

    for (const field of fields) {
      const val = raw[field.key];
      if (val === null || val === undefined || val === 'null' || val === 'N/A' || val === '') continue;

      // Stringify arrays; coerce scalars to string
      const stored = Array.isArray(val) ? JSON.stringify(val) : String(val);
      if (!stored || stored === '[]') continue;

      (extractedData as Record<string, string>)[field.key] = stored;
      confidence[field.key] = 0.88;
    }

    return { extractedData, confidence };
  } catch (err) {
    console.error('[extractDocumentData] error:', err);
    return { extractedData: {}, confidence: {} };
  }
}
