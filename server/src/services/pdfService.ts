import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import type { FormData, SubmittedDocument } from '../types';

// ─── Documents PDF ────────────────────────────────────────────────────────────
// Merges all scanned pages from all documents into a single PDF

export async function generateDocumentsPdf(documents: SubmittedDocument[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Scanned Immigration Documents');
  pdf.setAuthor('Immigration Intake Portal');

  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const doc of documents) {
    for (let i = 0; i < doc.pages.length; i++) {
      const b64 = doc.pages[i];

      // Try JPEG first, fall back to PNG
      let image;
      try {
        const bytes = Buffer.from(b64, 'base64');
        // Detect JPEG by magic bytes
        if (bytes[0] === 0xff && bytes[1] === 0xd8) {
          image = await pdf.embedJpg(bytes);
        } else {
          image = await pdf.embedPng(bytes);
        }
      } catch {
        // Skip unreadable images
        continue;
      }

      // Scale image to fit A4 with margins
      const margin  = 40;
      const pageW   = PageSizes.A4[0];
      const pageH   = PageSizes.A4[1];
      const maxW    = pageW - margin * 2;
      const maxH    = pageH - margin * 2 - 60; // leave room for label
      const scale   = Math.min(maxW / image.width, maxH / image.height, 1);
      const imgW    = image.width  * scale;
      const imgH    = image.height * scale;
      const x       = margin + (maxW - imgW) / 2;
      const y       = margin;

      const page = pdf.addPage(PageSizes.A4);

      // Document label header
      page.drawText(`${doc.name} — Page ${i + 1} of ${doc.pages.length}`, {
        x: margin,
        y: pageH - margin - 20,
        size: 11,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawLine({
        start: { x: margin, y: pageH - margin - 28 },
        end:   { x: pageW - margin, y: pageH - margin - 28 },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });

      // Image
      page.drawImage(image, { x, y, width: imgW, height: imgH });

      // Footer
      page.drawText('Immigration Intake Portal — Confidential', {
        x: margin,
        y: 20,
        size: 8,
        font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  // If no pages were added, add a placeholder
  if (pdf.getPageCount() === 0) {
    const page = pdf.addPage(PageSizes.A4);
    page.drawText('No documents scanned.', {
      x: 40,
      y: PageSizes.A4[1] / 2,
      size: 14,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  return Buffer.from(bytes);
}

// ─── Intake form PDF ──────────────────────────────────────────────────────────

interface FormSection {
  title: string;
  rows: { label: string; value: string }[];
}

const FORM_SECTIONS: { id: string; title: string; fields: { key: keyof FormData; label: string }[] }[] = [
  // ── Page 1 — Applicant Identity ─────────────────────────────────────────────
  {
    id: 'identity', title: 'Applicant — Identity',
    fields: [
      { key: 'firstName',         label: 'First Name'            },
      { key: 'lastName',          label: 'Last Name'             },
      { key: 'dateOfBirth',       label: 'Date of Birth'         },
      { key: 'cityOfBirth',       label: 'City of Birth'         },
      { key: 'countryOfBirth',    label: 'Country of Birth'      },
      { key: 'citizenship',       label: 'Citizenship'           },
      { key: 'eyeColor',          label: 'Eye Colour'            },
      { key: 'height',            label: 'Height'                },
      { key: 'nativeLanguage',    label: 'Native Language'       },
    ],
  },
  // ── Passport ─────────────────────────────────────────────────────────────────
  {
    id: 'passport', title: 'Applicant — Passport',
    fields: [
      { key: 'passportNumber',         label: 'Passport Number'          },
      { key: 'passportIssueDate',      label: 'Issue Date'               },
      { key: 'passportExpiry',         label: 'Expiry Date'              },
      { key: 'passportIssuingCountry', label: 'Issuing Country'          },
    ],
  },
  // ── Contact & Address ────────────────────────────────────────────────────────
  {
    id: 'contact', title: 'Applicant — Contact & Address',
    fields: [
      { key: 'currentAddress',     label: 'Current Address'       },
      { key: 'countryOfResidence', label: 'Country of Residence'  },
      { key: 'phone',              label: 'Phone'                  },
      { key: 'email',              label: 'Email'                  },
    ],
  },
  // ── Family ───────────────────────────────────────────────────────────────────
  {
    id: 'family', title: 'Applicant — Family',
    fields: [
      { key: 'maritalStatus',   label: 'Marital Status'    },
      { key: 'dateOfMarriage',  label: 'Date of Marriage'  },
      { key: 'numberOfChildren',label: 'Number of Children'},
    ],
  },
  // ── Employment ───────────────────────────────────────────────────────────────
  {
    id: 'employment', title: 'Applicant — Current Employment',
    fields: [
      { key: 'currentOccupation', label: 'Current Occupation' },
    ],
  },
  // ── IELTS ─────────────────────────────────────────────────────────────────────
  {
    id: 'ielts', title: 'Language Test — IELTS',
    fields: [
      { key: 'ieltsTestDate',   label: 'Test Date'    },
      { key: 'ieltsResultDate', label: 'Result Date'  },
      { key: 'ieltsListening',  label: 'Listening'    },
      { key: 'ieltsReading',    label: 'Reading'      },
      { key: 'ieltsWriting',    label: 'Writing'      },
      { key: 'ieltsSpeaking',   label: 'Speaking'     },
      { key: 'ieltsOverall',    label: 'Overall Band' },
    ],
  },
  // ── CELPIP ────────────────────────────────────────────────────────────────────
  {
    id: 'celpip', title: 'Language Test — CELPIP',
    fields: [
      { key: 'celpipTestDate',   label: 'Test Date'     },
      { key: 'celpipResultDate', label: 'Result Date'   },
      { key: 'celpipListening',  label: 'Listening'     },
      { key: 'celpipReading',    label: 'Reading'       },
      { key: 'celpipWriting',    label: 'Writing'       },
      { key: 'celpipSpeaking',   label: 'Speaking'      },
      { key: 'celpipOverall',    label: 'Overall Score' },
    ],
  },
  // ── Immigration Status ────────────────────────────────────────────────────────
  {
    id: 'immigration', title: 'Immigration & Application',
    fields: [
      { key: 'currentStatusInCanada', label: 'Status in Canada' },
      { key: 'currentStatusExpiry',   label: 'Status Expiry'    },
      { key: 'courseStartDate',       label: 'Course Start'     },
      { key: 'courseEndDate',         label: 'Course End'       },
      { key: 'referredBy',            label: 'Referred By'      },
    ],
  },
  // ── Spouse ───────────────────────────────────────────────────────────────────
  {
    id: 'spouse', title: 'Spouse / Partner',
    fields: [
      { key: 'spouseFirstName',              label: "First Name"      },
      { key: 'spouseLastName',               label: "Last Name"       },
      { key: 'spouseDateOfBirth',            label: "Date of Birth"   },
      { key: 'spousePlaceOfBirth',           label: "Place of Birth"  },
      { key: 'spouseCitizenship',            label: "Citizenship"     },
      { key: 'spousePassportNumber',         label: "Passport No."    },
      { key: 'spousePassportIssueDate',      label: "Passport Issue"  },
      { key: 'spousePassportExpiry',         label: "Passport Expiry" },
      { key: 'spousePassportIssuingCountry', label: "Issuing Country" },
      { key: 'spouseCurrentOccupation',      label: "Occupation"      },
    ],
  },
  // ── Child 1 ──────────────────────────────────────────────────────────────────
  {
    id: 'child1', title: 'Child 1',
    fields: [
      { key: 'child1FirstName',              label: 'First Name'      },
      { key: 'child1LastName',               label: 'Last Name'       },
      { key: 'child1DateOfBirth',            label: 'Date of Birth'   },
      { key: 'child1PlaceOfBirth',           label: 'Place of Birth'  },
      { key: 'child1Citizenship',            label: 'Citizenship'     },
      { key: 'child1PassportNumber',         label: 'Passport No.'    },
      { key: 'child1PassportIssueDate',      label: 'Passport Issue'  },
      { key: 'child1PassportExpiry',         label: 'Passport Expiry' },
      { key: 'child1PassportIssuingCountry', label: 'Issuing Country' },
    ],
  },
  // ── Child 2 ──────────────────────────────────────────────────────────────────
  {
    id: 'child2', title: 'Child 2',
    fields: [
      { key: 'child2FirstName',              label: 'First Name'      },
      { key: 'child2LastName',               label: 'Last Name'       },
      { key: 'child2DateOfBirth',            label: 'Date of Birth'   },
      { key: 'child2PlaceOfBirth',           label: 'Place of Birth'  },
      { key: 'child2Citizenship',            label: 'Citizenship'     },
      { key: 'child2PassportNumber',         label: 'Passport No.'    },
      { key: 'child2PassportIssueDate',      label: 'Passport Issue'  },
      { key: 'child2PassportExpiry',         label: 'Passport Expiry' },
      { key: 'child2PassportIssuingCountry', label: 'Issuing Country' },
    ],
  },
  // ── Child 3 ──────────────────────────────────────────────────────────────────
  {
    id: 'child3', title: 'Child 3',
    fields: [
      { key: 'child3FirstName',              label: 'First Name'      },
      { key: 'child3LastName',               label: 'Last Name'       },
      { key: 'child3DateOfBirth',            label: 'Date of Birth'   },
      { key: 'child3PlaceOfBirth',           label: 'Place of Birth'  },
      { key: 'child3Citizenship',            label: 'Citizenship'     },
      { key: 'child3PassportNumber',         label: 'Passport No.'    },
      { key: 'child3PassportIssueDate',      label: 'Passport Issue'  },
      { key: 'child3PassportExpiry',         label: 'Passport Expiry' },
      { key: 'child3PassportIssuingCountry', label: 'Issuing Country' },
    ],
  },
  // ── Child 4 ──────────────────────────────────────────────────────────────────
  {
    id: 'child4', title: 'Child 4',
    fields: [
      { key: 'child4FirstName',              label: 'First Name'      },
      { key: 'child4LastName',               label: 'Last Name'       },
      { key: 'child4DateOfBirth',            label: 'Date of Birth'   },
      { key: 'child4PlaceOfBirth',           label: 'Place of Birth'  },
      { key: 'child4Citizenship',            label: 'Citizenship'     },
      { key: 'child4PassportNumber',         label: 'Passport No.'    },
      { key: 'child4PassportIssueDate',      label: 'Passport Issue'  },
      { key: 'child4PassportExpiry',         label: 'Passport Expiry' },
      { key: 'child4PassportIssuingCountry', label: 'Issuing Country' },
    ],
  },
];

export async function generateFormPdf(
  formData: Partial<FormData>,
  submissionId: string,
  submittedAt: Date
): Promise<Buffer> {
  const pdf  = await PDFDocument.create();
  pdf.setTitle('Immigration Intake Form');
  pdf.setAuthor('Immigration Intake Portal');

  const fontR = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

  const [pageW, pageH] = PageSizes.A4;
  const marginL = 50;
  const marginR = 50;
  const usableW = pageW - marginL - marginR;

  let page = pdf.addPage(PageSizes.A4);
  let y    = pageH - 50;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const newPage = () => {
    page = pdf.addPage(PageSizes.A4);
    y    = pageH - 50;
  };

  const checkY = (needed: number) => {
    if (y - needed < 50) newPage();
  };

  const drawText = (text: string, opts: { x: number; size: number; bold?: boolean; color?: ReturnType<typeof rgb> }) => {
    page.drawText(text, {
      x: opts.x,
      y,
      size: opts.size,
      font: opts.bold ? fontB : fontR,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    });
  };

  // ── Cover header ───────────────────────────────────────────────────────────

  page.drawRectangle({ x: 0, y: pageH - 80, width: pageW, height: 80, color: rgb(0.118, 0.306, 0.847) });
  page.drawText('Immigration Intake Form', {
    x: marginL, y: pageH - 32, size: 18, font: fontB, color: rgb(1, 1, 1),
  });
  page.drawText('Confidential — For Agency Use', {
    x: marginL, y: pageH - 52, size: 10, font: fontR, color: rgb(0.8, 0.85, 1),
  });

  y = pageH - 100;

  // Submission info
  const name = [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'Unknown Applicant';

  const infoRows = [
    ['Applicant',       name],
    ['Submission ID',   submissionId],
    ['Submitted At',    submittedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'],
  ];

  for (const [label, value] of infoRows) {
    checkY(18);
    page.drawText(`${label}:`, { x: marginL, y, size: 9, font: fontB, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value,       { x: marginL + 90, y, size: 9, font: fontR, color: rgb(0.2, 0.2, 0.2) });
    y -= 15;
  }

  y -= 15;
  page.drawLine({ start: { x: marginL, y }, end: { x: pageW - marginR, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // ── Form sections ──────────────────────────────────────────────────────────

  for (const section of FORM_SECTIONS) {
    const rows = section.fields
      .map((f) => ({ label: f.label, value: (formData[f.key] ?? '') as string }))
      .filter((r) => r.value.trim() !== '');

    if (rows.length === 0) continue;

    checkY(30 + rows.length * 22);

    // Section header
    page.drawRectangle({ x: marginL, y: y - 2, width: usableW, height: 18, color: rgb(0.94, 0.96, 1) });
    page.drawText(section.title.toUpperCase(), {
      x: marginL + 6, y: y + 1, size: 8, font: fontB, color: rgb(0.118, 0.306, 0.847),
    });
    y -= 22;

    // Fields in a two-column layout
    const mid = marginL + usableW / 2 + 5;
    let leftRows: typeof rows = [];
    let rightRows: typeof rows = [];
    rows.forEach((r, i) => (i % 2 === 0 ? leftRows : rightRows).push(r));

    const maxRows = Math.max(leftRows.length, rightRows.length);
    for (let i = 0; i < maxRows; i++) {
      checkY(22);

      if (leftRows[i]) {
        page.drawText(leftRows[i].label + ':', { x: marginL, y, size: 8, font: fontB, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(leftRows[i].value,       { x: marginL, y: y - 11, size: 10, font: fontR, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: marginL, y: y - 13 }, end: { x: mid - 10, y: y - 13 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
      }

      if (rightRows[i]) {
        page.drawText(rightRows[i].label + ':', { x: mid, y, size: 8, font: fontB, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(rightRows[i].value,        { x: mid, y: y - 11, size: 10, font: fontR, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: mid, y: y - 13 }, end: { x: pageW - marginR, y: y - 13 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
      }

      y -= 28;
    }

    y -= 10;
  }

  // ── Footer on every page ───────────────────────────────────────────────────

  const pageCount = pdf.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdf.getPage(i);
    p.drawText(`Page ${i + 1} of ${pageCount}  |  Immigration Intake Portal  |  Confidential`, {
      x: marginL,
      y: 22,
      size: 7,
      font: fontR,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  return Buffer.from(bytes);
}
