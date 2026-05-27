import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import type { FormData, SubmittedDocument } from '../types';

// ─── Documents PDF (unchanged) ────────────────────────────────────────────────

export async function generateDocumentsPdf(documents: SubmittedDocument[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Scanned Immigration Documents');
  pdf.setAuthor('Immigration Intake Portal');

  const helvR = await pdf.embedFont(StandardFonts.Helvetica);
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const doc of documents) {
    for (let i = 0; i < doc.pages.length; i++) {
      const b64 = doc.pages[i];
      let image;
      try {
        const bytes = Buffer.from(b64, 'base64');
        image = (bytes[0] === 0xff && bytes[1] === 0xd8) ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      } catch { continue; }

      const margin = 40, pageW = PageSizes.A4[0], pageH = PageSizes.A4[1];
      const maxW = pageW - margin * 2, maxH = pageH - margin * 2 - 60;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const imgW = image.width * scale, imgH = image.height * scale;
      const x = margin + (maxW - imgW) / 2;

      const page = pdf.addPage(PageSizes.A4);
      page.drawText(`${doc.name} — Page ${i + 1} of ${doc.pages.length}`, {
        x: margin, y: pageH - margin - 20, size: 11, font: helvB, color: rgb(0.2, 0.2, 0.2),
      });
      page.drawLine({ start: { x: margin, y: pageH - margin - 28 }, end: { x: pageW - margin, y: pageH - margin - 28 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      page.drawImage(image, { x, y: margin, width: imgW, height: imgH });
      page.drawText('Immigration Intake Portal — Confidential', { x: margin, y: 20, size: 8, font: helvR, color: rgb(0.6, 0.6, 0.6) });
    }
  }

  if (pdf.getPageCount() === 0) {
    const page = pdf.addPage(PageSizes.A4);
    page.drawText('No documents scanned.', { x: 40, y: PageSizes.A4[1] / 2, size: 14, font: helvR, color: rgb(0.5, 0.5, 0.5) });
  }

  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

// ─── Intake form PDF — matches tanan_immigration_form_v2.html exactly ─────────

// ── Parsed types ──────────────────────────────────────────────────────────────

interface EduEntry   { institution: string; fieldOfStudy: string; certificate: string; startDate: string; endDate: string; hrsPerWeek: string; cityCountry: string; }
interface WorkEntry  { employer: string; jobTitle: string; jobType: string; salary: string; startDate: string; endDate: string; cityCountry: string; responsibilities: string; }
interface AddrRow    { fromYear: string; fromMonth: string; toYear: string; toMonth: string; address: string; ownership: string; cityCountry: string; activity: string; }
interface PersonRow  { familyName: string; givenNames: string; dob: string; placeOfBirth: string; countryOfResidence: string; citizenship: string; emailPhone: string; maritalStatus: string; dateOfMarriage: string; passportInfo: string; address: string; nativeLang: string; occupation: string; }
interface Travelers  { hasSpouse: boolean; childCount: number; }

const EMPTY_PERSON: PersonRow = { familyName:'', givenNames:'', dob:'', placeOfBirth:'', countryOfResidence:'', citizenship:'', emailPhone:'', maritalStatus:'', dateOfMarriage:'', passportInfo:'', address:'', nativeLang:'', occupation:'' };

function safeJson<T>(s: string | undefined, def: T): T {
  try { return s ? JSON.parse(s) as T : def; } catch { return def; }
}

// Split "YYYY/MM" or "YYYY-MM" or plain "YYYY" into [year, month]
function ym(date: string): [string, string] {
  const d = (date ?? '').trim();
  if (!d) return ['', ''];
  const parts = d.split(/[-\/]/);
  return [parts[0] ?? '', parts[1] ?? ''];
}

// ── Drawing constants ─────────────────────────────────────────────────────────

const A4W = PageSizes.A4[0];  // 595.28
const A4H = PageSizes.A4[1];  // 841.89
const ML  = 28;               // left margin
const MR  = 28;               // right margin
const UW  = A4W - ML - MR;   // 539.28

type C3 = [number, number, number];

const C = {
  navy:   [0.106, 0.227, 0.420] as C3,  // #1B3A6B
  white:  [1.000, 1.000, 1.000] as C3,
  black:  [0.100, 0.100, 0.100] as C3,
  gray9:  [0.251, 0.251, 0.251] as C3,  // #404040 labels
  border: [0.667, 0.667, 0.667] as C3,  // #aaaaaa
  lbl:    [0.973, 0.973, 0.973] as C3,  // #f8f8f8 label bg
  hdr:    [0.910, 0.910, 0.910] as C3,  // #e8e8e8 table header
  orange: [0.878, 0.424, 0.000] as C3,  // #e06c00 badge

  // Row tints (value cell backgrounds)
  passport:   [0.941, 0.969, 1.000] as C3,  // #f0f7ff
  manual:     [0.973, 0.980, 0.984] as C3,  // #f8fafc
  employment: [0.941, 0.992, 0.957] as C3,  // #f0fdf4
  marriage:   [0.992, 0.957, 1.000] as C3,  // #fdf4ff
  address:    [1.000, 0.969, 0.929] as C3,  // #fff7ed
  degree:     [0.992, 0.949, 0.973] as C3,  // #fdf2f8
  ielts:      [0.961, 0.957, 1.000] as C3,  // #f5f3ff
  celpip:     [0.941, 0.973, 1.000] as C3,  // #f0f9ff
  col_app:    [0.859, 0.922, 0.996] as C3,  // col-applicant header #dbeafe
  col_trv:    [0.996, 0.953, 0.780] as C3,  // col-traveler header  #fef3c7
};

const mkc = (c: C3) => rgb(c[0], c[1], c[2]);

// ── Low-level cell drawing ────────────────────────────────────────────────────

function cell(
  page: PDFPage,
  x: number, y: number,  // y = top edge of cell
  w: number, h: number,
  text: string,
  bg: C3,
  f: PDFFont,
  sz = 8.5,
  center = false,
) {
  // Rectangle (border drawn as thin line)
  page.drawRectangle({
    x, y: y - h, width: w, height: h,
    color: mkc(bg),
    borderWidth: 0.4, borderColor: mkc(C.border),
  });
  if (!text) return;

  // Truncate to fit
  const approxCharW = sz * 0.54;
  const maxChars = Math.max(1, Math.floor((w - 5) / approxCharW));
  const disp = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;

  let tx = x + 3;
  if (center) {
    tx = x + Math.max(2, (w - disp.length * approxCharW) / 2);
  }

  page.drawText(disp, {
    x: tx,
    y: y - h + (h > 12 ? 3.5 : 2),
    size: sz,
    font: f,
    color: mkc(C.black),
  });
}

/** Thin horizontal divider line */
function hLine(page: PDFPage, y: number) {
  page.drawLine({ start: { x: ML, y }, end: { x: ML + UW, y }, thickness: 0.3, color: mkc(C.border) });
}

// ── Page chrome: badge, initials, footer ──────────────────────────────────────

function drawChrome(page: PDFPage, pageNum: number, withInitials: boolean, fB: PDFFont, fR: PDFFont) {
  // Orange badge bottom-right
  page.drawRectangle({ x: A4W - MR - 22, y: 8, width: 22, height: 22, color: mkc(C.orange) });
  page.drawText(String(pageNum), { x: A4W - MR - 14, y: 14, size: 10, font: fB, color: mkc(C.white) });

  // Initials box bottom-left (pages 2-7)
  if (withInitials) {
    page.drawRectangle({ x: ML, y: 8, width: 68, height: 18, color: mkc(C.white), borderWidth: 0.6, borderColor: mkc([0.533, 0.533, 0.533]) });
    page.drawText('Initials', { x: ML + 20, y: 13, size: 8, font: fR, color: mkc([0.400, 0.400, 0.400]) });
  }
}

// ── Navy section heading bar ──────────────────────────────────────────────────

function navyHead(page: PDFPage, y: number, text: string, fB: PDFFont, sz = 9, centered = false): number {
  const h = 16;
  page.drawRectangle({ x: ML, y: y - h, width: UW, height: h, color: mkc(C.navy) });
  const tx = centered ? ML + Math.max(4, (UW - text.length * sz * 0.58) / 2) : ML + 5;
  page.drawText(text, { x: tx, y: y - h + 3.5, size: sz, font: fB, color: mkc(C.white) });
  return h; // consumed height
}

// ── 2-column form row (label | value | label | value) ─────────────────────────

const LBL = 134;  // label cell width (×2 labels = 268)
const VAL = 135.5; // value cell width (×2 values = 271)  total = 539

function row2(
  page: PDFPage, y: number,
  l1: string, v1: string, vBg1: C3,
  l2: string, v2: string, vBg2: C3,
  h: number, fB: PDFFont, fR: PDFFont,
) {
  cell(page, ML,           y, LBL, h, l1, C.lbl, fB, 8.5);
  cell(page, ML + LBL,     y, VAL, h, v1, vBg1, fR, 8.5);
  cell(page, ML + LBL + VAL, y, LBL, h, l2, C.lbl, fB, 8.5);
  cell(page, ML + LBL * 2 + VAL, y, VAL, h, v2, vBg2, fR, 8.5);
  return h;
}

/** Full-width 2-cell row: (wide label | value) */
function rowWide(page: PDFPage, y: number, lbl: string, val: string, valBg: C3, h: number, fB: PDFFont, fR: PDFFont, lblW = 248) {
  cell(page, ML,        y, lblW,    h, lbl, C.lbl, fB, 8.5);
  cell(page, ML + lblW, y, UW-lblW, h, val, valBg, fR, 8.5);
  return h;
}

/** Yes/No display row: wide label + "YES" or "NO" value cell */
function rowYN(page: PDFPage, y: number, lbl: string, val: string, extra: string, h: number, fB: PDFFont, fR: PDFFont) {
  cell(page, ML,              y, 270, h, lbl, C.lbl, fB, 8.5);
  const display = val ? val.toUpperCase() + (extra ? ' — ' + extra : '') : '';
  cell(page, ML + 270, y, UW - 270, h, display, C.manual, fR, 8.5);
  return h;
}

// ── Complex tables: education / work / address ────────────────────────────────

// Education column widths (total = UW = 539.28)
const EC = { yr: 26, mo: 24, inst: 108, hrs: 40, field: 84, city: 84, cert: 115 };
// yr*4 + inst + hrs + field + city + cert = 104 + 108 + 40 + 84 + 84 + 115 = 535 → add 4 to inst→112
// Recalc: 26+24+26+24 = 100; 539-100 = 439; split: inst=108, hrs=40, field=85, city=85, cert=121 → 108+40+85+85+121=439 ✓
const EW = [26, 24, 26, 24, 108, 40, 85, 85, 121];

// Employment column widths (total = 539)
// yr mo yr mo = 100; remaining 439: emp=75, title=65, type=42, sal=38, city=60, resp=65, qual=14 = 359... need more
// Let me try: emp=82, title=70, type=44, sal=42, city=62, resp=70, qual=14 = 384... still off
// Total = 100 + 384 = 484 ≠ 539. Gap = 55. Distribute: emp+=15=97, title+=10=80, city+=15=77, resp+=15=85
// 97+80+44+42+77+85+14 = 439 ✓
const WW = [26, 24, 26, 24, 97, 80, 44, 42, 77, 85, 14];

// Address column widths (total = 539)
// yr mo yr mo = 100; remaining 439: addr=140, hrs=38, own=70, city=65, act=126 = 439 ✓
const AW = [26, 24, 26, 24, 140, 38, 70, 65, 126];

function drawTableHeaderRows(
  page: PDFPage, y: number,
  cols1: string[], widths: number[],  // row 1 headers (may have spanning)
  cols2: string[],                     // row 2 sub-headers (Year/Month/empty)
  fB: PDFFont,
): number {
  const h1 = 14, h2 = 12;

  // Row 1 — "From | To | col1 | col2 ..."
  // We know cols1[0]="From" spans cols2[0..1], cols1[1]="To" spans cols2[2..3]
  // then cols1[2..] are single-width headers for cols2[4..]
  let cx = ML;
  const w01 = widths[0] + widths[1]; // "From" span
  const w23 = widths[2] + widths[3]; // "To" span
  cell(page, cx, y, w01, h1, cols1[0], C.hdr, fB, 8, true); cx += w01;
  cell(page, cx, y, w23, h1, cols1[1], C.hdr, fB, 8, true); cx += w23;
  for (let i = 2; i < cols1.length; i++) {
    cell(page, cx, y, widths[4 + (i - 2)], h1, cols1[i], C.hdr, fB, 8); cx += widths[4 + (i - 2)];
  }
  y -= h1;

  // Row 2 — Year | Month | Year | Month | (empty spans for remaining)
  cx = ML;
  for (let i = 0; i < cols2.length; i++) {
    cell(page, cx, y, widths[i], h2, cols2[i], C.hdr, fB, 7.5, true); cx += widths[i];
  }
  y -= h2;

  return h1 + h2;
}

function drawEduRow(page: PDFPage, y: number, e: EduEntry, h: number, fR: PDFFont) {
  const [sy, sm] = ym(e.startDate), [ey, em] = ym(e.endDate);
  const vals = [sy, sm, ey, em, e.institution, e.hrsPerWeek, e.fieldOfStudy, e.cityCountry, e.certificate];
  let cx = ML;
  for (let i = 0; i < EW.length; i++) {
    cell(page, cx, y, EW[i], h, vals[i], C.degree, fR, 7.5); cx += EW[i];
  }
}

function drawWorkRow(page: PDFPage, y: number, e: WorkEntry, h: number, fR: PDFFont) {
  const [sy, sm] = ym(e.startDate), [ey, em] = ym(e.endDate);
  const vals = [sy, sm, ey, em, e.employer, e.jobTitle, e.jobType, e.salary, e.cityCountry, e.responsibilities, ''];
  let cx = ML;
  for (let i = 0; i < WW.length; i++) {
    cell(page, cx, y, WW[i], h, vals[i], C.employment, fR, 7.5); cx += WW[i];
  }
}

function drawAddrRow(page: PDFPage, y: number, r: AddrRow, h: number, fR: PDFFont) {
  const vals = [r.fromYear, r.fromMonth, r.toYear, r.toMonth, r.address, '', r.ownership, r.cityCountry, r.activity];
  let cx = ML;
  for (let i = 0; i < AW.length; i++) {
    cell(page, cx, y, AW[i], h, vals[i], C.manual, fR, 7.5); cx += AW[i];
  }
}

// ── Family / person matrices ──────────────────────────────────────────────────

const ATTR_LBL = 122; // attribute label column width

// Page 5 rows (13 rows, includes Date of Marriage)
const PAGE5_ATTRS = [
  'Family Name / Surname', 'Given Names', 'Date of Birth',
  'Place of Birth (city and country)', 'Country of Residence', 'Citizenship',
  'Email / Telephone', 'Marital Status', 'Date of Marriage',
  'Passport No. / Country', 'Address', 'Native Language', 'Current Occupation',
];

// Pages 6 & 7 rows (12 rows, no Date of Marriage, different order)
const PAGE67_ATTRS = [
  'Family Name / Surname', 'Given Names', 'Date of Birth',
  'Place of Birth', 'Country of Residence', 'Citizenship',
  'Email / Telephone', 'Marital Status', 'Address',
  'Passport No. / Country', 'Current Occupation', 'Native Language',
];

/** Get page-5-ordered values from a PersonRow */
function personValsP5(r: PersonRow): string[] {
  return [r.familyName, r.givenNames, r.dob, r.placeOfBirth, r.countryOfResidence,
    r.citizenship, r.emailPhone, r.maritalStatus, r.dateOfMarriage,
    r.passportInfo, r.address, r.nativeLang, r.occupation];
}

/** Get page-6/7-ordered values from a PersonRow */
function personValsP67(r: PersonRow): string[] {
  return [r.familyName, r.givenNames, r.dob, r.placeOfBirth, r.countryOfResidence,
    r.citizenship, r.emailPhone, r.maritalStatus,
    r.address, r.passportInfo, r.occupation, r.nativeLang];
}

/** Build applicant PersonRow from formData */
function applicantRow(fd: Partial<FormData>): PersonRow {
  const v = (k: keyof FormData) => (fd[k] ?? '') as string;
  return {
    familyName: v('lastName'), givenNames: v('firstName'), dob: v('dateOfBirth'),
    placeOfBirth: v('cityOfBirth'), countryOfResidence: v('countryOfResidence'),
    citizenship: v('citizenship'), emailPhone: v('phone'),
    maritalStatus: v('maritalStatus'), dateOfMarriage: v('dateOfMarriage'),
    passportInfo: `${v('passportNumber')}${v('passportIssuingCountry') ? ' / ' + v('passportIssuingCountry') : ''}`,
    address: v('currentAddress'), nativeLang: v('nativeLanguage'), occupation: v('currentOccupation'),
  };
}

/** Build spouse PersonRow from formData */
function spouseRow(fd: Partial<FormData>): PersonRow {
  const v = (k: keyof FormData) => (fd[k] ?? '') as string;
  return {
    familyName: v('spouseLastName'), givenNames: v('spouseFirstName'), dob: v('spouseDateOfBirth'),
    placeOfBirth: v('spousePlaceOfBirth'), countryOfResidence: '',
    citizenship: v('spouseCitizenship'), emailPhone: '',
    maritalStatus: '', dateOfMarriage: '',
    passportInfo: `${v('spousePassportNumber')}${v('spousePassportIssuingCountry') ? ' / ' + v('spousePassportIssuingCountry') : ''}`,
    address: '', nativeLang: '', occupation: v('spouseCurrentOccupation'),
  };
}

/** Build child PersonRow from formData */
function childRow(fd: Partial<FormData>, n: 1|2|3|4): PersonRow {
  const p = `child${n}` as const;
  const v = (k: keyof FormData) => (fd[k] ?? '') as string;
  return {
    familyName: v(`${p}LastName` as keyof FormData), givenNames: v(`${p}FirstName` as keyof FormData),
    dob: v(`${p}DateOfBirth` as keyof FormData), placeOfBirth: v(`${p}PlaceOfBirth` as keyof FormData),
    countryOfResidence: '', citizenship: v(`${p}Citizenship` as keyof FormData),
    emailPhone: '', maritalStatus: '', dateOfMarriage: '',
    passportInfo: `${v(`${p}PassportNumber` as keyof FormData)}${v(`${p}PassportIssuingCountry` as keyof FormData) ? ' / ' + v(`${p}PassportIssuingCountry` as keyof FormData) : ''}`,
    address: '', nativeLang: '', occupation: '',
  };
}

/** Draw a person matrix table (pages 5, 6, 7) */
function drawPersonMatrix(
  page: PDFPage,
  y: number,
  attrs: string[],
  headers: string[],
  headerBgs: C3[],
  colData: string[][],  // colData[personIdx][attrIdx]
  fB: PDFFont, fR: PDFFont,
  rowH = 17,
): number {
  const numPeople = headers.length;
  const colW = (UW - ATTR_LBL) / numPeople;

  // Header row
  cell(page, ML, y, ATTR_LBL, rowH, '', C.hdr, fB, 8.5);
  for (let ci = 0; ci < numPeople; ci++) {
    cell(page, ML + ATTR_LBL + ci * colW, y, colW, rowH, headers[ci], headerBgs[ci], fB, 7.5, true);
  }
  y -= rowH;

  // Attribute rows
  for (let ai = 0; ai < attrs.length; ai++) {
    cell(page, ML, y, ATTR_LBL, rowH, attrs[ai], C.lbl, fB, 7.5);
    for (let ci = 0; ci < numPeople; ci++) {
      const bg = ci === 0 ? C.passport : C.col_trv;
      cell(page, ML + ATTR_LBL + ci * colW, y, colW, rowH, (colData[ci] ?? [])[ai] ?? '', bg, fR, 7.5);
    }
    y -= rowH;
  }

  return y;
}

// ─── Main PDF generator ───────────────────────────────────────────────────────

export async function generateFormPdf(
  formData: Partial<FormData>,
  submissionId: string,
  submittedAt: Date,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Tanon Immigration — Detailed Information Sheet');
  pdf.setAuthor('Immigration Intake Portal');

  const fR  = await pdf.embedFont(StandardFonts.Helvetica);
  const fB  = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fSR = await pdf.embedFont(StandardFonts.TimesRomanBold);  // serif for page 1 title

  // Parse complex fields
  const eduList  = safeJson<EduEntry[]>(formData.educationHistory, []);
  const workList = safeJson<WorkEntry[]>(formData.workHistory, []).sort((a, b) => (b.startDate > a.startDate ? 1 : -1));
  const addrList = safeJson<AddrRow[]>(formData.addressHistory, []);
  const father   = safeJson<PersonRow>(formData.fatherInfo, { ...EMPTY_PERSON });
  const mother   = safeJson<PersonRow>(formData.motherInfo, { ...EMPTY_PERSON });
  const spFather = safeJson<PersonRow>(formData.spouseFatherInfo, { ...EMPTY_PERSON });
  const spMother = safeJson<PersonRow>(formData.spouseMotherInfo, { ...EMPTY_PERSON });
  const siblings = safeJson<PersonRow[]>(formData.siblingInfo, []);
  const travelers = safeJson<Travelers>(formData.travelersInfo, { hasSpouse: false, childCount: 0 });
  const ieltsRem = formData.ieltsRemarks ?? '';
  const celpipRem = formData.celpipRemarks ?? '';

  const fd = formData;
  const v  = (k: keyof FormData) => (fd[k] ?? '') as string;

  const ROW = 17; // standard form row height
  const CR  = 20; // complex table data row height
  const CH1 = 14, CH2 = 12; // complex table header row heights

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Detailed Information Sheet
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = A4H - ML;

    // Serif title with underline
    const titleText = 'Detailed Information Sheet';
    page.drawText(titleText, { x: ML, y: y - 20, size: 16, font: fSR, color: mkc(C.black) });
    y -= 22;
    page.drawLine({ start: { x: ML, y: y }, end: { x: ML + UW, y: y }, thickness: 1.2, color: mkc(C.black) });
    y -= 10;

    // Main info table — 22 data rows
    const infoRows: [string, string, C3, string, string, C3][] = [
      ['Family Name / Surname',         v('lastName'),              C.passport,   'Given Names',               v('firstName'),              C.passport  ],
      ['Telephone Number',              v('phone'),                 C.manual,     'Email Address',             v('email'),                  C.manual    ],
      ['Passport Number',               v('passportNumber'),        C.passport,   'Country of Issuance',       v('passportIssuingCountry'), C.passport  ],
      ['Passport Issue Date',           v('passportIssueDate'),     C.passport,   'Passport Expiry Date',      v('passportExpiry'),         C.passport  ],
      ['Current Address',               v('currentAddress'),        C.address,    'Country of Residence',      v('countryOfResidence'),     C.manual    ],
      ['City of Birth',                 v('cityOfBirth'),           C.passport,   'Country of Birth',          v('countryOfBirth'),         C.passport  ],
      ['Marital Status',                v('maritalStatus'),         C.manual,     'Date of Marriage',          v('dateOfMarriage'),         C.marriage  ],
      ['Date of Birth',                 v('dateOfBirth'),           C.passport,   'Citizenship',               v('citizenship'),            C.passport  ],
      ['Eye Color',                     v('eyeColor'),              C.manual,     'Height',                    v('height'),                 C.manual    ],
      ['Current Occupation',            v('currentOccupation'),     C.employment, 'Current Status in Canada',  v('currentStatusInCanada'),  C.manual    ],
      ['Native Language',               v('nativeLanguage'),        C.manual,     'Current Status Expiry',     v('currentStatusExpiry'),    C.manual    ],
      ['Referred By',                   v('referredBy'),            C.manual,     'Number of Children',        v('numberOfChildren'),       C.manual    ],
      ['Course Start Date',             v('courseStartDate'),       C.manual,     'Course End Date',           v('courseEndDate'),          C.manual    ],
    ];

    for (const [l1, v1, b1, l2, v2, b2] of infoRows) {
      y -= row2(page, y, l1, v1, b1, l2, v2, b2, ROW, fB, fR);
    }

    // Full-width special rows
    const entryVal = [v('entryCategory'), v('uciNumber')].filter(Boolean).join('  /  UCI: ');
    y -= rowWide(page, y, 'Initially Entered Canada as: Visitor / Refugee / Student / Worker — Provide UCI Number', entryVal, C.manual, ROW, fB, fR);
    y -= rowWide(page, y, 'Date First Entered Canada and Port of Entry', [v('dateFirstEnteredCanada'), v('portOfEntry')].filter(Boolean).join(' — '), C.manual, ROW, fB, fR);

    // Yes/No declaration rows
    y -= rowYN(page, y, 'Have you ever been Deported / Refused Visa / Refused Entry to any country?', v('deportedFlag'), v('deportedDetails'), ROW, fB, fR);
    y -= rowYN(page, y, 'Have You Applied to IRCC before in past?',        v('irccAppliedBefore'), '', ROW, fB, fR);
    y -= rowYN(page, y, 'Have You Applied to any PNP before in past?',      v('pnpAppliedBefore'),  '', ROW, fB, fR);
    y -= rowYN(page, y, 'Do you have any relative in Canada?',              v('hasRelativeInCanada'), '', ROW, fB, fR);
    y -= rowWide(page, y, 'Highest Education Completed (Canadian Equivalency)', v('highestEducationCanadian'), C.manual, ROW, fB, fR);
    y -= rowWide(page, y, 'Total Number of Years of Education (primary + secondary + post-secondary)', v('totalYearsEducation'), C.manual, ROW, fB, fR);

    y -= 6;
    y -= navyHead(page, y, 'List all Educational Institutes attended — most recent first, no gaps.  Source: Educational Degree Certificates', fB, 8);
    y -= drawTableHeaderRows(page, y, ['From', 'To', 'Name of Educational Institution', 'Years / hrs/week', 'Field of Study', 'City and Country', 'Certificate / Diploma Awarded'], EW, ['Year', 'Month', 'Year', 'Month', '', '', '', '', ''], fB);

    const edu1 = Array.from({ length: 4 }, (_, i) => eduList[i] ?? { institution:'', fieldOfStudy:'', certificate:'', startDate:'', endDate:'', hrsPerWeek:'', cityCountry:'' });
    for (const e of edu1) { y -= CR; drawEduRow(page, y, e, CR, fR); }

    drawChrome(page, 1, false, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Education continued + Language tests
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = A4H - ML;

    y -= navyHead(page, y, 'Educational Institutes — continued  (Source: Educational Degree Certificates)', fB, 8);
    y -= drawTableHeaderRows(page, y, ['From', 'To', 'Name of Educational Institution', 'Years / hrs/week', 'Field of Study', 'City and Country / Complete Address', 'Certificate / Diploma Awarded'], EW, ['Year', 'Month', 'Year', 'Month', '', '', '', '', ''], fB);

    const edu2 = Array.from({ length: 4 }, (_, i) => eduList[4 + i] ?? { institution:'', fieldOfStudy:'', certificate:'', startDate:'', endDate:'', hrsPerWeek:'', cityCountry:'' });
    for (const e of edu2) { y -= CR; drawEduRow(page, y, e, CR, fR); }

    y -= 12;

    // English Language Test full-width navy title
    {
      const h = 20;
      page.drawRectangle({ x: ML, y: y - h, width: UW, height: h, color: mkc(C.navy) });
      const title = 'English Language Test';
      page.drawText(title, { x: ML + (UW - title.length * 10.5) / 2, y: y - h + 5, size: 13, font: fB, color: mkc(C.white) });
      y -= h;
    }

    // Lang test header row
    const LANG_COLS = ['Test', 'Date of Test', 'Date of Result', 'Listening', 'Reading', 'Writing', 'Speaking', 'Overall Score', 'Remarks'];
    const LANG_W = [44, 60, 60, 48, 48, 48, 48, 52, 131]; // total = 539
    {
      const h = 14;
      let cx = ML;
      for (let i = 0; i < LANG_COLS.length; i++) {
        cell(page, cx, y, LANG_W[i], h, LANG_COLS[i], C.hdr, fB, 8, i !== 0); cx += LANG_W[i];
      }
      y -= h;
    }

    // IELTS row
    {
      const h = 20;
      const ieltsVals = ['IELTS', v('ieltsTestDate'), v('ieltsResultDate'), v('ieltsListening'), v('ieltsReading'), v('ieltsWriting'), v('ieltsSpeaking'), v('ieltsOverall'), ieltsRem];
      let cx = ML;
      for (let i = 0; i < LANG_COLS.length; i++) {
        cell(page, cx, y, LANG_W[i], h, ieltsVals[i], C.ielts, i === 0 ? fB : fR, 8.5, i > 0); cx += LANG_W[i];
      }
      y -= h;
    }

    // CELPIP row
    {
      const h = 20;
      const celpipVals = ['CELPIP', v('celpipTestDate'), v('celpipResultDate'), v('celpipListening'), v('celpipReading'), v('celpipWriting'), v('celpipSpeaking'), v('celpipOverall'), celpipRem];
      let cx = ML;
      for (let i = 0; i < LANG_COLS.length; i++) {
        cell(page, cx, y, LANG_W[i], h, celpipVals[i], C.celpip, i === 0 ? fB : fR, 8.5, i > 0); cx += LANG_W[i];
      }
      y -= h;
    }

    // Blank row
    {
      const h = 20;
      let cx = ML;
      for (let i = 0; i < LANG_COLS.length; i++) {
        cell(page, cx, y, LANG_W[i], h, '', C.white, fR, 8.5); cx += LANG_W[i];
      }
    }

    drawChrome(page, 2, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — Employment History
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = A4H - ML;

    y -= navyHead(page, y, 'List all positions held during last 10 years — most recent first, no gaps.  Source: Work Experience Certificates (one per employer).', fB, 8);
    y -= drawTableHeaderRows(page, y,
      ['From', 'To', 'Name of Employer', 'Job Title / NOC', 'Job Type', 'Salary', 'City and Country / Address', 'Responsibilities', 'When qualified'],
      WW, ['Year', 'Month', 'Year', 'Month', '', '', '', '', '', '', ''], fB);

    const minWork = 6;
    const workRows = [...workList];
    while (workRows.length < minWork) workRows.push({ employer:'', jobTitle:'', jobType:'', salary:'', startDate:'', endDate:'', cityCountry:'', responsibilities:'' });
    for (const e of workRows) {
      if (y - CR < 45) break;
      y -= CR;
      drawWorkRow(page, y, e, CR, fR);
    }

    // Note box
    y -= 8;
    if (y - 18 > 45) {
      page.drawRectangle({ x: ML, y: y - 18, width: UW, height: 18, color: rgb(1, 0.972, 0.878), borderWidth: 0.4, borderColor: rgb(0.984, 0.737, 0.000) });
      page.drawText('How this section works: Upload ALL employment letters — one per employer. Data extracted per letter, ordered by date (most recent first). Gaps between jobs are auto-detected.', {
        x: ML + 4, y: y - 14, size: 7, font: fR, color: rgb(0.573, 0.302, 0.000),
      });
    }

    drawChrome(page, 3, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — Address History
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = A4H - ML;

    y -= navyHead(page, y, 'List all addresses lived during last 10 years — most recent first, no gaps.  All entries: Manual.', fB, 8);
    y -= drawTableHeaderRows(page, y,
      ['From', 'To', 'Complete Address Including Postal Code', 'Years / hrs/week', 'Owned / Rented / Shared', 'City and Country', 'Activity'],
      AW, ['Year', 'Month', 'Year', 'Month', '', '', '', '', ''], fB);

    const minAddr = 5;
    const addrRows = [...addrList];
    while (addrRows.length < minAddr) addrRows.push({ fromYear:'', fromMonth:'', toYear:'', toMonth:'', address:'', ownership:'', cityCountry:'', activity:'' });
    for (const r of addrRows) {
      if (y - CR < 45) break;
      y -= CR;
      drawAddrRow(page, y, r, CR, fR);
    }

    drawChrome(page, 4, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — Details of Children and Spouse
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = A4H - ML;

    y -= navyHead(page, y, 'Details of Children and Spouse', fB, 12, true);
    y -= 4;

    const headers: string[] = ['Applicant'];
    const hdrBgs: C3[] = [C.col_app];
    const colData: string[][] = [personValsP5(applicantRow(fd))];

    if (travelers.hasSpouse) {
      headers.push('Spouse / Partner'); hdrBgs.push(C.col_trv);
      colData.push(personValsP5(spouseRow(fd)));
    }
    for (let n = 1; n <= travelers.childCount; n++) {
      headers.push(`Son / Daughter ${n}`); hdrBgs.push(C.col_trv);
      colData.push(personValsP5(childRow(fd, n as 1|2|3|4)));
    }
    // Always show at least 4 person columns (matching reference with all columns visible)
    const minCols = 4;
    while (headers.length < minCols) {
      headers.push('—'); hdrBgs.push(C.hdr);
      colData.push(Array(PAGE5_ATTRS.length).fill(''));
    }

    drawPersonMatrix(page, y, PAGE5_ATTRS, headers, hdrBgs, colData, fB, fR);
    drawChrome(page, 5, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 6 — Details of Brothers and Sisters
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = A4H - ML;

    y -= navyHead(page, y, 'Details of Brothers and Sisters', fB, 12, true);
    y -= 4;

    const headers = ['Applicant', 'Brother/Sister 1', 'Brother/Sister 2', 'Brother/Sister 3', 'Brother/Sister 4', 'Brother/Sister 5'];
    const hdrBgs: C3[] = [C.col_app, C.hdr, C.hdr, C.hdr, C.hdr, C.hdr];
    const colData: string[][] = [
      personValsP67(applicantRow(fd)),
      ...Array.from({ length: 5 }, (_, i) => personValsP67(siblings[i] ?? EMPTY_PERSON)),
    ];

    drawPersonMatrix(page, y, PAGE67_ATTRS, headers, hdrBgs, colData, fB, fR);
    drawChrome(page, 6, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 7 — Details of Parents + Canada Entry Dates
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.A4);
    let y = A4H - ML;

    y -= navyHead(page, y, 'Details of Parents', fB, 12, true);
    y -= 4;

    const headers: string[] = ['Applicant', 'Father', 'Mother'];
    const hdrBgs: C3[] = [C.col_app, C.hdr, C.hdr];
    const colData: string[][] = [
      personValsP67(applicantRow(fd)),
      personValsP67(father),
      personValsP67(mother),
    ];

    if (travelers.hasSpouse) {
      headers.push('Spouse', "Spouse's Father", "Spouse's Mother");
      hdrBgs.push(C.col_trv, C.hdr, C.hdr);
      colData.push(personValsP67(spouseRow(fd)), personValsP67(spFather), personValsP67(spMother));
    }

    y = drawPersonMatrix(page, y, PAGE67_ATTRS, headers, hdrBgs, colData, fB, fR);

    // Canada entry dates
    y -= 10;
    y -= rowWide(page, y, 'Date of Entry in Canada',              v('dateEntryCanada'),       C.manual, ROW, fB, fR, 220);
    y -= rowWide(page, y, 'Date of Most Recent Entry in Canada',  v('dateRecentEntryCanada'), C.manual, ROW, fB, fR, 220);

    // Submission metadata (small, near bottom)
    y -= 18;
    if (y - 30 > 45) {
      hLine(page, y);
      y -= 4;
      const meta = `Submission ID: ${submissionId}  |  Submitted: ${submittedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC  |  Applicant: ${v('firstName')} ${v('lastName')}`;
      page.drawText(meta, { x: ML, y: y - 9, size: 7, font: fR, color: mkc([0.5, 0.5, 0.5]) });
    }

    drawChrome(page, 7, true, fB, fR);
  }

  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}
