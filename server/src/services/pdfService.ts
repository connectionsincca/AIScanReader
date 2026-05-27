import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import type { FormData, SubmittedDocument } from '../types';

// ─── Documents PDF ────────────────────────────────────────────────────────────
// Merges all scanned pages from all documents into a single PDF

export async function generateDocumentsPdf(documents: SubmittedDocument[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Scanned Immigration Documents');
  pdf.setAuthor('Immigration Intake Portal');

  const helvetica     = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const doc of documents) {
    for (let i = 0; i < doc.pages.length; i++) {
      const b64 = doc.pages[i];

      let image;
      try {
        const bytes = Buffer.from(b64, 'base64');
        if (bytes[0] === 0xff && bytes[1] === 0xd8) {
          image = await pdf.embedJpg(bytes);
        } else {
          image = await pdf.embedPng(bytes);
        }
      } catch {
        continue;
      }

      const margin  = 40;
      const pageW   = PageSizes.A4[0];
      const pageH   = PageSizes.A4[1];
      const maxW    = pageW - margin * 2;
      const maxH    = pageH - margin * 2 - 60;
      const scale   = Math.min(maxW / image.width, maxH / image.height, 1);
      const imgW    = image.width  * scale;
      const imgH    = image.height * scale;
      const x       = margin + (maxW - imgW) / 2;
      const y       = margin;

      const page = pdf.addPage(PageSizes.A4);

      page.drawText(`${doc.name} — Page ${i + 1} of ${doc.pages.length}`, {
        x: margin, y: pageH - margin - 20,
        size: 11, font: helveticaBold, color: rgb(0.2, 0.2, 0.2),
      });
      page.drawLine({
        start: { x: margin, y: pageH - margin - 28 },
        end:   { x: pageW - margin, y: pageH - margin - 28 },
        thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
      });
      page.drawImage(image, { x, y, width: imgW, height: imgH });
      page.drawText('Immigration Intake Portal — Confidential', {
        x: margin, y: 20, size: 8, font: helvetica, color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  if (pdf.getPageCount() === 0) {
    const page = pdf.addPage(PageSizes.A4);
    page.drawText('No documents scanned.', {
      x: 40, y: PageSizes.A4[1] / 2,
      size: 14, font: helvetica, color: rgb(0.5, 0.5, 0.5),
    });
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  return Buffer.from(bytes);
}

// ─── Intake form PDF — 7-page structured layout ───────────────────────────────

// ── Parsed complex types ──────────────────────────────────────────────────────

interface EduEntry {
  institution: string; fieldOfStudy: string; certificate: string;
  startDate: string; endDate: string; hrsPerWeek: string; cityCountry: string;
}
interface WorkEntry {
  employer: string; jobTitle: string; jobType: string; salary: string;
  startDate: string; endDate: string; cityCountry: string; responsibilities: string;
}
interface AddrRow {
  fromYear: string; fromMonth: string; toYear: string; toMonth: string;
  address: string; ownership: string; cityCountry: string; activity: string;
}
interface PersonRow {
  familyName: string; givenNames: string; dob: string;
  placeOfBirth: string; countryOfResidence: string;
  citizenship: string; emailPhone: string;
  maritalStatus: string; dateOfMarriage: string;
  passportInfo: string; address: string;
  nativeLang: string; occupation: string;
}
interface TravelersInfo { hasSpouse: boolean; childCount: number; }

function parseJson<T>(json: string | undefined, def: T): T {
  try { return json ? JSON.parse(json) as T : def; }
  catch { return def; }
}

const EMPTY_PERSON: PersonRow = {
  familyName: '', givenNames: '', dob: '', placeOfBirth: '', countryOfResidence: '',
  citizenship: '', emailPhone: '', maritalStatus: '', dateOfMarriage: '',
  passportInfo: '', address: '', nativeLang: '', occupation: '',
};

// ── Drawing helpers ───────────────────────────────────────────────────────────

type RGB3 = [number, number, number];

// Color palette matching the on-screen form
const BG = {
  navy:   [0.106, 0.227, 0.420] as RGB3,  // section headers
  lbl:    [0.925, 0.925, 0.925] as RGB3,  // label cells
  blue:   [0.925, 0.945, 0.988] as RGB3,
  orange: [1.000, 0.949, 0.871] as RGB3,
  green:  [0.925, 0.980, 0.925] as RGB3,
  pink:   [1.000, 0.929, 0.929] as RGB3,
  violet: [0.965, 0.929, 1.000] as RGB3,
  sky:    [0.925, 0.965, 1.000] as RGB3,
  slate:  [0.949, 0.949, 0.980] as RGB3,
  amber:  [1.000, 0.965, 0.871] as RGB3,
  white:  [1.000, 1.000, 1.000] as RGB3,
  gray50: [0.980, 0.980, 0.980] as RGB3,
};

const A4W = PageSizes.A4[0]; // 595.28
const A4H = PageSizes.A4[1]; // 841.89
const ML  = 28;              // left margin
const MR  = 28;              // right margin
const UW  = A4W - ML - MR;  // usable width  = 539.28

/** Truncate text to fit approximately within maxPts points at fontSize sz */
function trunc(text: string | undefined | null, maxPts: number, sz: number): string {
  const s = (text ?? '').trim();
  const approxCharW = sz * 0.54;
  const maxChars = Math.max(1, Math.floor((maxPts - 4) / approxCharW));
  return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
}

interface DrawCell {
  x: number; y: number;    // top-left: y = top edge of cell (pdf coords: bottom of rect = y - h)
  w: number; h: number;
  text: string;
  isLbl?: boolean;         // label style (bold gray)
  bg: RGB3;
  fonts: { r: PDFFont; b: PDFFont };
  sz?: number;
  align?: 'left' | 'center';
}

function drawCell({ x, y, w, h, text, isLbl, bg, fonts, sz = 8.5, align = 'left' }: DrawCell, page: PDFPage) {
  // Background + border
  page.drawRectangle({
    x, y: y - h, width: w, height: h,
    color: rgb(bg[0], bg[1], bg[2]),
    borderWidth: 0.4,
    borderColor: rgb(0.65, 0.65, 0.65),
  });
  if (!text) return;
  const truncated = trunc(text, w, sz);
  let tx = x + 3;
  if (align === 'center') {
    tx = x + Math.max(2, (w - truncated.length * sz * 0.54) / 2);
  }
  page.drawText(truncated, {
    x: tx,
    y: y - h + (h > 12 ? 4 : 2),
    size: sz,
    font: isLbl ? fonts.b : fonts.r,
    color: rgb(isLbl ? 0.28 : 0.08, isLbl ? 0.28 : 0.08, isLbl ? 0.28 : 0.08),
  });
}

/** Draw a navy-blue section heading bar */
function drawSectionHeader(page: PDFPage, y: number, text: string, fonts: { r: PDFFont; b: PDFFont }) {
  const h = 15;
  page.drawRectangle({ x: ML, y: y - h, width: UW, height: h, color: rgb(...BG.navy) });
  page.drawText(text, {
    x: ML + 4, y: y - h + 3,
    size: 8, font: fonts.b, color: rgb(1, 1, 1),
  });
  return h;
}

/** Draw the orange page-number badge (bottom-right of page) */
function drawPageBadge(page: PDFPage, num: number, fonts: { r: PDFFont; b: PDFFont }) {
  page.drawRectangle({ x: A4W - ML - 16, y: ML - 4, width: 18, height: 18, color: rgb(0.851, 0.325, 0.035) });
  page.drawText(String(num), {
    x: A4W - ML - 10, y: ML - 1,
    size: 9, font: fonts.b, color: rgb(1, 1, 1),
  });
}

/** Draw page header title bar + page counter label */
function drawPageHeader(page: PDFPage, title: string, pageNum: number, fonts: { r: PDFFont; b: PDFFont }): number {
  const h = 20;
  const y = A4H - ML;
  // Title bar
  page.drawRectangle({ x: ML, y: y - h, width: UW, height: h, color: rgb(...BG.navy) });
  page.drawText(title.toUpperCase(), {
    x: ML + 6, y: y - h + 5,
    size: 9, font: fonts.b, color: rgb(1, 1, 1),
  });
  // "PAGE X OF 7" right-aligned
  const label = `PAGE ${pageNum} OF 7`;
  page.drawText(label, {
    x: A4W - MR - label.length * 6, y: y - h + 5,
    size: 8, font: fonts.r, color: rgb(0.8, 0.85, 1),
  });
  // Footer
  page.drawText('Tanon Immigration — Detailed Information Sheet  |  Confidential', {
    x: ML, y: 14, size: 7, font: fonts.r, color: rgb(0.6, 0.6, 0.6),
  });
  drawPageBadge(page, pageNum, fonts);
  return y - h; // return new y (bottom of header)
}

/** Two-column key-value row: lbl1 | val1 | lbl2 | val2 */
function draw2ColRow(
  page: PDFPage, y: number, h: number,
  lbl1: string, val1: string, bg1: RGB3,
  lbl2: string, val2: string, bg2: RGB3,
  fonts: { r: PDFFont; b: PDFFont },
) {
  const lw = 128; // label width
  const vw = (UW - lw * 2) / 2; // value width ≈ 141.64
  drawCell({ x: ML,           y, w: lw, h, text: lbl1, isLbl: true,  bg: BG.lbl, fonts }, page);
  drawCell({ x: ML + lw,      y, w: vw, h, text: val1, isLbl: false, bg: bg1, fonts, sz: 8 }, page);
  drawCell({ x: ML + lw + vw, y, w: lw, h, text: lbl2, isLbl: true,  bg: BG.lbl, fonts }, page);
  drawCell({ x: ML + lw + vw + lw, y, w: vw, h, text: val2, isLbl: false, bg: bg2, fonts, sz: 8 }, page);
  return h;
}

/** Full-width label + value row (used for long questions) */
function drawWideRow(
  page: PDFPage, y: number, h: number,
  lbl: string, val: string, valBg: RGB3,
  fonts: { r: PDFFont; b: PDFFont },
  lblW = 200,
) {
  drawCell({ x: ML,        y, w: lblW,    h, text: lbl, isLbl: true,  bg: BG.lbl, fonts, sz: 8 }, page);
  drawCell({ x: ML + lblW, y, w: UW - lblW, h, text: val, isLbl: false, bg: valBg, fonts, sz: 8 }, page);
  return h;
}

/** Full-width label (used for section separators within a table) */
function drawFullLblRow(
  page: PDFPage, y: number, h: number, text: string,
  fonts: { r: PDFFont; b: PDFFont },
) {
  drawCell({ x: ML, y, w: UW, h, text, isLbl: true, bg: BG.lbl, fonts, sz: 8 }, page);
  return h;
}

// ─── Retrieve person attribute values as a string array ───────────────────────

function personVals(row: PersonRow): string[] {
  return [
    row.familyName, row.givenNames, row.dob,
    row.placeOfBirth, row.countryOfResidence,
    row.citizenship, row.emailPhone,
    row.maritalStatus, row.dateOfMarriage,
    row.passportInfo, row.address,
    row.nativeLang, row.occupation,
  ];
}

function applicantVals(fd: Partial<FormData>): string[] {
  return [
    fd.lastName ?? '', fd.firstName ?? '', fd.dateOfBirth ?? '',
    fd.cityOfBirth ?? '', fd.countryOfResidence ?? '',
    fd.citizenship ?? '', fd.phone ?? '',
    fd.maritalStatus ?? '', fd.dateOfMarriage ?? '',
    `${fd.passportNumber ?? ''}${fd.passportIssuingCountry ? ' / ' + fd.passportIssuingCountry : ''}`,
    fd.currentAddress ?? '', fd.nativeLanguage ?? '', fd.currentOccupation ?? '',
  ];
}

function spouseVals(fd: Partial<FormData>): string[] {
  return [
    fd.spouseLastName ?? '', fd.spouseFirstName ?? '', fd.spouseDateOfBirth ?? '',
    fd.spousePlaceOfBirth ?? '', '',
    fd.spouseCitizenship ?? '', '',
    '', '',
    `${fd.spousePassportNumber ?? ''}${fd.spousePassportIssuingCountry ? ' / ' + fd.spousePassportIssuingCountry : ''}`,
    '', '', fd.spouseCurrentOccupation ?? '',
  ];
}

function childVals(fd: Partial<FormData>, n: 1|2|3|4): string[] {
  const p = `child${n}` as 'child1'|'child2'|'child3'|'child4';
  return [
    (fd[`${p}LastName` as keyof FormData] ?? '') as string,
    (fd[`${p}FirstName` as keyof FormData] ?? '') as string,
    (fd[`${p}DateOfBirth` as keyof FormData] ?? '') as string,
    (fd[`${p}PlaceOfBirth` as keyof FormData] ?? '') as string,
    '',
    (fd[`${p}Citizenship` as keyof FormData] ?? '') as string,
    '', '', '',
    `${(fd[`${p}PassportNumber` as keyof FormData] ?? '') as string}${fd[`${p}PassportIssuingCountry` as keyof FormData] ? ' / ' + fd[`${p}PassportIssuingCountry` as keyof FormData] : ''}`,
    '', '', '',
  ];
}

// ─── Person matrix (used for pages 5, 6, 7) ──────────────────────────────────

const PERSON_ATTRS_FULL = [
  'Family Name / Surname', 'Given Names', 'Date of Birth',
  'Place of Birth', 'Country of Residence', 'Citizenship / Nationality',
  'Email / Telephone', 'Marital Status', 'Date of Marriage',
  'Passport No. / Country', 'Current Address', 'Native Language', 'Current Occupation',
];
const PERSON_ATTRS_NO_PASSPORT = PERSON_ATTRS_FULL.filter((_, i) => i !== 9);

function drawPersonMatrix(
  page: PDFPage,
  y: number,
  attrs: string[],
  headers: string[],
  columns: string[][],  // each column is an array of cell values matching attrs
  fonts: { r: PDFFont; b: PDFFont },
  headerBgs: RGB3[],
): number {
  const rowH = 15;
  const lblW = 130;
  const colW = (UW - lblW) / headers.length;

  // Header row
  drawCell({ x: ML, y, w: lblW, h: rowH, text: 'Attribute', isLbl: true, bg: BG.lbl, fonts }, page);
  headers.forEach((hdr, ci) => {
    drawCell({ x: ML + lblW + ci * colW, y, w: colW, h: rowH, text: hdr, isLbl: true, bg: headerBgs[ci] ?? BG.lbl, fonts, align: 'center' }, page);
  });
  y -= rowH;

  // Data rows
  attrs.forEach((attr, ai) => {
    drawCell({ x: ML, y, w: lblW, h: rowH, text: attr, isLbl: true, bg: BG.lbl, fonts, sz: 7.5 }, page);
    headers.forEach((_, ci) => {
      const val = (columns[ci] ?? [])[ai] ?? '';
      const cellBg = ci === 0 ? BG.blue : (ci % 2 === 0 ? BG.gray50 : BG.amber);
      drawCell({ x: ML + lblW + ci * colW, y, w: colW, h: rowH, text: val, bg: cellBg, fonts, sz: 7.5 }, page);
    });
    y -= rowH;
  });

  return y;
}

// ─── Main PDF generator ───────────────────────────────────────────────────────

export async function generateFormPdf(
  formData: Partial<FormData>,
  submissionId: string,
  submittedAt: Date,
): Promise<Buffer> {
  const pdf  = await PDFDocument.create();
  pdf.setTitle('Tanon Immigration — Detailed Information Sheet');
  pdf.setAuthor('Immigration Intake Portal');

  const fontR = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const f     = { r: fontR, b: fontB };

  // Parse complex fields
  const eduList   = parseJson<EduEntry[]>(formData.educationHistory, []);
  const workList  = parseJson<WorkEntry[]>(formData.workHistory, [])
    .sort((a, b) => (b.startDate > a.startDate ? 1 : -1));
  const addrRows  = parseJson<AddrRow[]>(formData.addressHistory, []);
  const father    = parseJson<PersonRow>(formData.fatherInfo, { ...EMPTY_PERSON });
  const mother    = parseJson<PersonRow>(formData.motherInfo, { ...EMPTY_PERSON });
  const spFather  = parseJson<PersonRow>(formData.spouseFatherInfo, { ...EMPTY_PERSON });
  const spMother  = parseJson<PersonRow>(formData.spouseMotherInfo, { ...EMPTY_PERSON });
  const siblings  = parseJson<PersonRow[]>(formData.siblingInfo, []);
  const travelers = parseJson<TravelersInfo>(formData.travelersInfo, { hasSpouse: false, childCount: 0 });

  const ieltsRemarks  = formData.ieltsRemarks  ?? '';
  const celpipRemarks = formData.celpipRemarks ?? '';

  const ROW = 17;   // standard row height
  const HDR = 15;   // table header row height

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Detailed Information Sheet
  // ════════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = drawPageHeader(page, 'Tanon Immigration — Detailed Information Sheet', 1, f);
    y -= 4;

    const fd = formData;
    const v  = (k: keyof FormData) => (fd[k] ?? '') as string;

    // 2-column info rows
    const infoRows: [string, string, RGB3, string, string, RGB3][] = [
      ['Family Name / Surname',    v('lastName'),              BG.blue,   'Given Names',                 v('firstName'),             BG.blue  ],
      ['Telephone Number',         v('phone'),                 BG.slate,  'Email Address',               v('email'),                 BG.slate ],
      ['Passport Number',          v('passportNumber'),        BG.blue,   'Country of Issuance',         v('passportIssuingCountry'),BG.blue  ],
      ['Passport Issue Date',      v('passportIssueDate'),     BG.blue,   'Passport Expiry Date',        v('passportExpiry'),        BG.blue  ],
      ['Current Address',          v('currentAddress'),        BG.orange, 'Country of Residence',        v('countryOfResidence'),    BG.slate ],
      ['City of Birth',            v('cityOfBirth'),           BG.blue,   'Country of Birth',            v('countryOfBirth'),        BG.blue  ],
      ['Marital Status',           v('maritalStatus'),         BG.slate,  'Date of Marriage',            v('dateOfMarriage'),        BG.violet],
      ['Date of Birth',            v('dateOfBirth'),           BG.blue,   'Citizenship / Nationality',   v('citizenship'),           BG.blue  ],
      ['Eye Color',                v('eyeColor'),              BG.slate,  'Height',                      v('height'),                BG.slate ],
      ['Current Occupation',       v('currentOccupation'),     BG.green,  'Current Status in Canada',    v('currentStatusInCanada'), BG.slate ],
      ['Native Language',          v('nativeLanguage'),        BG.slate,  'Current Status Expiry',       v('currentStatusExpiry'),   BG.slate ],
      ['Referred By',              v('referredBy'),            BG.slate,  'Number of Children',          v('numberOfChildren'),      BG.slate ],
      ['Course Start Date',        v('courseStartDate'),       BG.slate,  'Course End Date',             v('courseEndDate'),         BG.slate ],
    ];

    for (const [l1, v1, b1, l2, v2, b2] of infoRows) {
      y -= draw2ColRow(page, y, ROW, l1, v1, b1, l2, v2, b2, f);
    }

    // Wide rows
    const wideRows: [string, string, string, RGB3][] = [
      ['Initially Entered Canada as: Visitor / Refugee / Student / Worker — Please Provide Your UCI Number',
        v('entryCategory'), v('uciNumber'), BG.slate],
      ['Date First Entered Canada and Port of Entry',
        v('dateFirstEnteredCanada'), v('portOfEntry'), BG.slate],
    ];
    for (const [lbl, val1, val2, bg] of wideRows) {
      const combined = [val1, val2].filter(Boolean).join(' / ');
      y -= drawWideRow(page, y, ROW, lbl, combined, bg, f);
    }

    // Yes/No rows
    const ynRows: [string, string, string][] = [
      ['Deported / Refused Visa / Refused Entry to any country?', v('deportedFlag').toUpperCase(), v('deportedDetails')],
      ['Applied to IRCC before in past?', v('irccAppliedBefore').toUpperCase(), ''],
      ['Applied to any PNP before in past?', v('pnpAppliedBefore').toUpperCase(), ''],
      ['Any relative in Canada?', v('hasRelativeInCanada').toUpperCase(), ''],
    ];
    for (const [lbl, flag, detail] of ynRows) {
      const combined = [flag, detail].filter(Boolean).join(' — ');
      y -= drawWideRow(page, y, ROW, lbl, combined, BG.slate, f);
    }

    // Education summary rows
    y -= drawWideRow(page, y, ROW, 'Highest Education (Canadian Equivalency)', v('highestEducationCanadian'), BG.slate, f);
    y -= drawWideRow(page, y, ROW, 'Total Years of Education (primary + secondary + post-secondary)', v('totalYearsEducation'), BG.slate, f);

    y -= 6;
    y -= drawSectionHeader(page, y, 'List all Educational Institutes — most recent first, no gaps.  Source: Educational Degree Certificates', f);

    // Education table header
    const eduCols = ['From', 'To', 'Name of Institution', 'Hrs/wk', 'Field of Study', 'City / Country', 'Certificate / Diploma'];
    const eduW    = [44, 44, 120, 40, 90, 90, 111]; // total = 539
    y -= HDR;
    let cx = ML;
    for (let ci = 0; ci < eduCols.length; ci++) {
      drawCell({ x: cx, y, w: eduW[ci], h: HDR, text: eduCols[ci], isLbl: true, bg: BG.lbl, fonts: f, sz: 7.5 }, page);
      cx += eduW[ci];
    }

    // Education rows 1-4
    const eduSlice1 = eduList.slice(0, 4);
    while (eduSlice1.length < 4) eduSlice1.push({ institution: '', fieldOfStudy: '', certificate: '', startDate: '', endDate: '', hrsPerWeek: '', cityCountry: '' });
    for (const e of eduSlice1) {
      y -= ROW;
      cx = ML;
      const cells = [e.startDate, e.endDate, e.institution, e.hrsPerWeek, e.fieldOfStudy, e.cityCountry, e.certificate];
      for (let ci = 0; ci < cells.length; ci++) {
        drawCell({ x: cx, y, w: eduW[ci], h: ROW, text: cells[ci], bg: BG.pink, fonts: f, sz: 7.5 }, page);
        cx += eduW[ci];
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Education continued + Language Tests
  // ════════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = drawPageHeader(page, 'Educational Institutes — Continued', 2, f);
    y -= 4;

    y -= drawSectionHeader(page, y, 'Entries 5 and above — most recent first', f);

    // Education table header (same columns)
    const eduCols = ['From', 'To', 'Name of Institution', 'Hrs/wk', 'Field of Study', 'City / Country', 'Certificate / Diploma'];
    const eduW    = [44, 44, 120, 40, 90, 90, 111];
    y -= HDR;
    let cx = ML;
    for (let ci = 0; ci < eduCols.length; ci++) {
      drawCell({ x: cx, y, w: eduW[ci], h: HDR, text: eduCols[ci], isLbl: true, bg: BG.lbl, fonts: f, sz: 7.5 }, page);
      cx += eduW[ci];
    }

    const eduSlice2 = eduList.slice(4);
    while (eduSlice2.length < 4) eduSlice2.push({ institution: '', fieldOfStudy: '', certificate: '', startDate: '', endDate: '', hrsPerWeek: '', cityCountry: '' });
    for (const e of eduSlice2) {
      y -= ROW;
      cx = ML;
      const cells = [e.startDate, e.endDate, e.institution, e.hrsPerWeek, e.fieldOfStudy, e.cityCountry, e.certificate];
      for (let ci = 0; ci < cells.length; ci++) {
        drawCell({ x: cx, y, w: eduW[ci], h: ROW, text: cells[ci], bg: BG.pink, fonts: f, sz: 7.5 }, page);
        cx += eduW[ci];
      }
    }

    y -= 10;
    y -= drawSectionHeader(page, y, 'English Language Test Results', f);

    // Language test header
    const langCols = ['Test', 'Date of Test', 'Date of Result', 'Listening', 'Reading', 'Writing', 'Speaking', 'Overall', 'Remarks'];
    const langW    = [46, 62, 62, 50, 50, 50, 50, 50, 119]; // total = 539
    y -= HDR;
    cx = ML;
    for (let ci = 0; ci < langCols.length; ci++) {
      drawCell({ x: cx, y, w: langW[ci], h: HDR, text: langCols[ci], isLbl: true, bg: BG.lbl, fonts: f, sz: 7.5 }, page);
      cx += langW[ci];
    }

    const fd = formData;
    const v  = (k: keyof FormData) => (fd[k] ?? '') as string;

    // IELTS row
    y -= ROW;
    cx = ML;
    const ieltsCells = ['IELTS', v('ieltsTestDate'), v('ieltsResultDate'), v('ieltsListening'), v('ieltsReading'), v('ieltsWriting'), v('ieltsSpeaking'), v('ieltsOverall'), ieltsRemarks];
    for (let ci = 0; ci < ieltsCells.length; ci++) {
      drawCell({ x: cx, y, w: langW[ci], h: ROW, text: ieltsCells[ci], bg: BG.violet, fonts: f, sz: ci === 0 ? 8 : 7.5, isLbl: ci === 0 }, page);
      cx += langW[ci];
    }

    // CELPIP row
    y -= ROW;
    cx = ML;
    const celpipCells = ['CELPIP', v('celpipTestDate'), v('celpipResultDate'), v('celpipListening'), v('celpipReading'), v('celpipWriting'), v('celpipSpeaking'), v('celpipOverall'), celpipRemarks];
    for (let ci = 0; ci < celpipCells.length; ci++) {
      drawCell({ x: cx, y, w: langW[ci], h: ROW, text: celpipCells[ci], bg: BG.sky, fonts: f, sz: ci === 0 ? 8 : 7.5, isLbl: ci === 0 }, page);
      cx += langW[ci];
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 3 — Employment History
  // ════════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = drawPageHeader(page, 'Employment History', 3, f);
    y -= 4;

    y -= drawSectionHeader(page, y, 'List all employment — most recent first, no gaps.  Source: Work Experience Certificates', f);

    const workCols = ['From', 'To', 'Name of Employer', 'Job Title / NOC', 'Job Type', 'Salary', 'City / Country', 'Responsibilities'];
    const workW    = [44, 55, 100, 80, 60, 55, 75, 70]; // total = 539
    let cx = ML;
    y -= HDR;
    for (let ci = 0; ci < workCols.length; ci++) {
      drawCell({ x: cx, y, w: workW[ci], h: HDR, text: workCols[ci], isLbl: true, bg: BG.lbl, fonts: f, sz: 7.5 }, page);
      cx += workW[ci];
    }

    const workRows = workList.length > 0 ? workList : Array(6).fill({ employer: '', jobTitle: '', jobType: '', salary: '', startDate: '', endDate: '', cityCountry: '', responsibilities: '' });

    for (const e of workRows as WorkEntry[]) {
      // Check for page overflow
      if (y - ROW < 45) break; // don't overflow onto the footer
      y -= ROW;
      cx = ML;
      const cells = [e.startDate, e.endDate, e.employer, e.jobTitle, e.jobType, e.salary, e.cityCountry, e.responsibilities];
      for (let ci = 0; ci < cells.length; ci++) {
        drawCell({ x: cx, y, w: workW[ci], h: ROW, text: cells[ci], bg: BG.green, fonts: f, sz: 7.5 }, page);
        cx += workW[ci];
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 4 — Address History
  // ════════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = drawPageHeader(page, 'Address History', 4, f);
    y -= 4;

    y -= drawSectionHeader(page, y, 'List all addresses for the last 10 years — most recent first, no gaps.', f);

    const addrCols = ['From (YYYY/MM)', 'To (YYYY/MM)', 'Complete Address incl. Postal Code', 'Owned / Rented / Shared', 'City and Country', 'Activity'];
    const addrW    = [60, 60, 180, 80, 80, 79]; // total = 539
    let cx = ML;
    y -= HDR;
    for (let ci = 0; ci < addrCols.length; ci++) {
      drawCell({ x: cx, y, w: addrW[ci], h: HDR, text: addrCols[ci], isLbl: true, bg: BG.lbl, fonts: f, sz: 7.5 }, page);
      cx += addrW[ci];
    }

    const addrData = addrRows.length > 0 ? addrRows : Array(5).fill({ fromYear: '', fromMonth: '', toYear: '', toMonth: '', address: '', ownership: '', cityCountry: '', activity: '' });
    for (const r of addrData as AddrRow[]) {
      if (y - ROW < 45) break;
      y -= ROW;
      cx = ML;
      const from = [r.fromYear, r.fromMonth].filter(Boolean).join('/');
      const to   = [r.toYear, r.toMonth].filter(Boolean).join('/');
      const cells = [from, to, r.address, r.ownership, r.cityCountry, r.activity];
      for (let ci = 0; ci < cells.length; ci++) {
        drawCell({ x: cx, y, w: addrW[ci], h: ROW, text: cells[ci], bg: BG.orange, fonts: f, sz: 7.5 }, page);
        cx += addrW[ci];
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 5 — Details of Children and Spouse
  // ════════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = drawPageHeader(page, 'Details of Children and Spouse', 5, f);
    y -= 8;

    const headers: string[] = ['Applicant'];
    const columns: string[][] = [applicantVals(formData)];
    const hdrBgs: RGB3[] = [BG.blue];

    if (travelers.hasSpouse) {
      headers.push('Spouse / Partner');
      columns.push(spouseVals(formData));
      hdrBgs.push(BG.amber);
    }
    for (let n = 1; n <= travelers.childCount; n++) {
      headers.push(`Son/Daughter ${n}`);
      columns.push(childVals(formData, n as 1|2|3|4));
      hdrBgs.push(BG.amber);
    }

    drawPersonMatrix(page, y, PERSON_ATTRS_FULL, headers, columns, f, hdrBgs);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 6 — Details of Brothers and Sisters
  // ════════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = drawPageHeader(page, 'Details of Brothers and Sisters', 6, f);
    y -= 8;

    const sibHeaders = ['Applicant', 'Brother/Sister 1', 'Brother/Sister 2', 'Brother/Sister 3', 'Brother/Sister 4', 'Brother/Sister 5'];
    const sibCols: string[][] = [applicantVals(formData)];
    for (let i = 0; i < 5; i++) {
      sibCols.push(personVals(siblings[i] ?? EMPTY_PERSON));
    }
    const sibHdrBgs: RGB3[] = [BG.blue, BG.gray50, BG.gray50, BG.gray50, BG.gray50, BG.gray50];

    drawPersonMatrix(page, y, PERSON_ATTRS_NO_PASSPORT, sibHeaders, sibCols.map((c) => c.filter((_, i) => i !== 9)), f, sibHdrBgs);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 7 — Details of Parents + Canada Entry Dates
  // ════════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    const fd = formData;
    const v  = (k: keyof FormData) => (fd[k] ?? '') as string;
    let y = drawPageHeader(page, 'Details of Parents', 7, f);
    y -= 8;

    const parentHeaders: string[] = ['Applicant', 'Father', 'Mother'];
    const parentCols: string[][] = [applicantVals(formData), personVals(father), personVals(mother)];
    const parentHdrBgs: RGB3[] = [BG.blue, BG.gray50, BG.gray50];

    if (travelers.hasSpouse) {
      parentHeaders.push('Spouse', "Spouse's Father", "Spouse's Mother");
      parentCols.push(spouseVals(formData), personVals(spFather), personVals(spMother));
      parentHdrBgs.push(BG.amber, BG.gray50, BG.gray50);
    }

    y = drawPersonMatrix(page, y, PERSON_ATTRS_FULL, parentHeaders, parentCols, f, parentHdrBgs);

    y -= 10;
    y -= drawSectionHeader(page, y, 'Canada Entry Dates', f);
    y -= drawWideRow(page, y, ROW, 'Date of Entry in Canada',              v('dateEntryCanada'),       BG.slate, f, 180);
    y -= drawWideRow(page, y, ROW, 'Date of Most Recent Entry in Canada',  v('dateRecentEntryCanada'), BG.slate, f, 180);

    // Submission metadata at the bottom
    y -= 20;
    const metaLines = [
      `Submitted: ${submittedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      `Submission ID: ${submissionId}`,
      `Applicant: ${[formData.firstName, formData.lastName].filter(Boolean).join(' ')}`,
    ];
    for (const line of metaLines) {
      if (y - 12 < 35) break;
      page.drawText(line, { x: ML, y: y - 10, size: 7.5, font: fontR, color: rgb(0.5, 0.5, 0.5) });
      y -= 12;
    }
  }

  // ── Add page-count footer to all pages ──────────────────────────────────────
  const pageCount = pdf.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    // footer already drawn per page in drawPageHeader
    // just update with correct total if needed (already says "PAGE X OF 7")
    void pageCount; // suppress unused warning
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  return Buffer.from(bytes);
}
