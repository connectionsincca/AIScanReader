import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import type { FormData, SubmittedDocument } from '../types';

// ─── Documents PDF ────────────────────────────────────────────────────────────

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

// ─── Intake Form PDF ──────────────────────────────────────────────────────────

interface EduEntry  { institution: string; fieldOfStudy: string; certificate: string; startDate: string; endDate: string; hrsPerWeek: string; cityCountry: string; }
interface WorkEntry { employer: string; jobTitle: string; jobType: string; salary: string; startDate: string; endDate: string; cityCountry: string; responsibilities: string; }
interface AddrRow   { fromYear: string; fromMonth: string; toYear: string; toMonth: string; address: string; ownership: string; cityCountry: string; activity: string; }
interface PersonRow { familyName: string; givenNames: string; dob: string; placeOfBirth: string; countryOfResidence: string; citizenship: string; emailPhone: string; maritalStatus: string; dateOfMarriage: string; passportInfo: string; address: string; nativeLang: string; occupation: string; }
interface Travelers { hasSpouse: boolean; childCount: number; }

const EMPTY_PERSON: PersonRow = { familyName:'', givenNames:'', dob:'', placeOfBirth:'', countryOfResidence:'', citizenship:'', emailPhone:'', maritalStatus:'', dateOfMarriage:'', passportInfo:'', address:'', nativeLang:'', occupation:'' };

function safeJson<T>(s: string | undefined, def: T): T {
  try { return s ? JSON.parse(s) as T : def; } catch { return def; }
}

function ym(date: string): [string, string] {
  const d = (date ?? '').trim();
  if (!d) return ['', ''];
  const parts = d.split(/[-\/]/);
  return [parts[0] ?? '', parts[1] ?? ''];
}

// ── Page / margin constants (US Letter to match reference PDF) ────────────────

const LTR_W = PageSizes.Letter[0];  // 612
const LTR_H = PageSizes.Letter[1];  // 792
const ML  = 28;
const MR  = 28;
const UW  = LTR_W - ML - MR;       // 556

// ── Colour palette ────────────────────────────────────────────────────────────

type C3 = [number, number, number];

const C = {
  navy:   [0.106, 0.227, 0.420] as C3,
  white:  [1.000, 1.000, 1.000] as C3,
  black:  [0.100, 0.100, 0.100] as C3,
  border: [0.600, 0.600, 0.600] as C3,
  lbl:    [0.910, 0.910, 0.910] as C3,  // label cell background (gray)
  hdr:    [0.870, 0.870, 0.870] as C3,  // table column header background
  orange: [0.878, 0.424, 0.000] as C3,  // page badge
  col_app:[0.839, 0.906, 0.980] as C3,  // Applicant column header
  col_trv:[0.839, 0.906, 0.980] as C3,  // traveler column headers (same shade)
};

const mkc = (c: C3) => rgb(c[0], c[1], c[2]);

// ── Word-wrap helper ──────────────────────────────────────────────────────────

function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (test.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Low-level cell drawing ────────────────────────────────────────────────────

/** Single-line cell (truncates if text overflows) */
function cell(
  page: PDFPage, x: number, y: number, w: number, h: number,
  text: string, bg: C3, f: PDFFont, sz = 8.5, center = false,
) {
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: mkc(bg), borderWidth: 0.4, borderColor: mkc(C.border) });
  if (!text) return;
  const approxCW = sz * 0.54;
  const maxCh = Math.max(1, Math.floor((w - 5) / approxCW));
  const disp = text.length > maxCh ? text.slice(0, maxCh - 1) + '…' : text;
  let tx = x + 3;
  if (center) tx = x + Math.max(2, (w - disp.length * approxCW) / 2);
  page.drawText(disp, { x: tx, y: y - h + (h > 12 ? 3.5 : 2), size: sz, font: f, color: mkc(C.black) });
}

/** Multi-line word-wrapped cell (auto-expands height if h is computed externally) */
function cellWrapped(
  page: PDFPage, x: number, y: number, w: number, h: number,
  text: string, bg: C3, f: PDFFont, sz = 8, center = false,
) {
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: mkc(bg), borderWidth: 0.4, borderColor: mkc(C.border) });
  if (!text) return;
  const approxCW = sz * 0.54;
  const maxCh = Math.max(1, Math.floor((w - 5) / approxCW));
  const lines = wrapWords(text, maxCh);
  const lineH = sz + 2;
  const totalTH = lines.length * lineH;
  let ty = y - Math.max(2, (h - totalTH) / 2) - sz + 1;
  for (const line of lines) {
    let tx = x + 2;
    if (center) tx = x + Math.max(2, (w - line.length * approxCW) / 2);
    page.drawText(line, { x: tx, y: ty, size: sz, font: f, color: mkc(C.black) });
    ty -= lineH;
  }
}

/** Auto-height cell: draws rectangle whose height fits wrapped text + padding */
function cellAuto(
  page: PDFPage, x: number, y: number, w: number,
  text: string, bg: C3, f: PDFFont, sz = 8.5, minH = 17,
): number {
  const approxCW = sz * 0.54;
  const maxCh = Math.max(1, Math.floor((w - 5) / approxCW));
  const lines = wrapWords(text, maxCh);
  const lineH = sz + 2.5;
  const h = Math.max(minH, lines.length * lineH + 5);
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: mkc(bg), borderWidth: 0.4, borderColor: mkc(C.border) });
  let ty = y - 4 - sz + 1;
  for (const line of lines) {
    page.drawText(line, { x: x + 3, y: ty, size: sz, font: f, color: mkc(C.black) });
    ty -= lineH;
  }
  return h;
}

// ── Yes/No checkbox cell ──────────────────────────────────────────────────────

function drawYNCell(page: PDFPage, x: number, y: number, w: number, h: number, label: string, checked: boolean, fB: PDFFont) {
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: mkc(C.white), borderWidth: 0.4, borderColor: mkc(C.border) });
  const approxCW = 8 * 0.58;
  const tx = x + Math.max(2, (w - label.length * approxCW) / 2);
  page.drawText(label, { x: tx, y: y - 10, size: 8, font: fB, color: mkc(C.black) });
  const cbSz = 9, cbX = x + (w - cbSz) / 2, cbY = y - h + 4;
  page.drawRectangle({ x: cbX, y: cbY, width: cbSz, height: cbSz, color: mkc(C.white), borderWidth: 0.8, borderColor: mkc(C.black) });
  if (checked) {
    page.drawLine({ start: { x: cbX + 1.5, y: cbY + cbSz / 2 - 0.5 }, end: { x: cbX + cbSz / 2 - 0.5, y: cbY + 1.5 }, thickness: 1.5, color: mkc(C.black) });
    page.drawLine({ start: { x: cbX + cbSz / 2 - 0.5, y: cbY + 1.5 }, end: { x: cbX + cbSz - 1, y: cbY + cbSz - 1 }, thickness: 1.5, color: mkc(C.black) });
  }
}

// ── Yes/No accompanying radio circle ─────────────────────────────────────────

function drawRadioCircle(page: PDFPage, cx: number, cy: number, r: number, filled: boolean) {
  page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, borderWidth: 0.8, borderColor: mkc(C.black), color: mkc(filled ? C.black : C.white) });
}

// ── Page chrome ───────────────────────────────────────────────────────────────

function drawChrome(page: PDFPage, pageNum: number, withInitials: boolean, fB: PDFFont, fR: PDFFont) {
  page.drawRectangle({ x: LTR_W - MR - 22, y: 8, width: 22, height: 22, color: mkc(C.orange) });
  page.drawText(String(pageNum), { x: LTR_W - MR - 14, y: 14, size: 10, font: fB, color: mkc(C.white) });
  if (withInitials) {
    page.drawRectangle({ x: ML, y: 8, width: 68, height: 18, color: mkc(C.white), borderWidth: 0.6, borderColor: mkc([0.533, 0.533, 0.533] as C3) });
    page.drawText('Initials', { x: ML + 20, y: 13, size: 8, font: fR, color: mkc([0.400, 0.400, 0.400] as C3) });
  }
}

// ── Navy section heading bar (for family-matrix page titles) ─────────────────

function navyHead(page: PDFPage, y: number, text: string, fB: PDFFont, sz = 9, centered = false): number {
  const h = 16;
  page.drawRectangle({ x: ML, y: y - h, width: UW, height: h, color: mkc(C.navy) });
  const tx = centered ? ML + Math.max(4, (UW - text.length * sz * 0.58) / 2) : ML + 5;
  page.drawText(text, { x: tx, y: y - h + 3.5, size: sz, font: fB, color: mkc(C.white) });
  return h;
}

// ── Table section title: white/bordered, centered, word-wrapped ───────────────

function tableTitleRow(page: PDFPage, y: number, text: string, fB: PDFFont): number {
  const approxCW = 8.5 * 0.54;
  const maxCh = Math.floor((UW - 8) / approxCW);
  const lines = wrapWords(text, maxCh);
  const lineH = 11;
  const h = Math.max(22, lines.length * lineH + 6);
  page.drawRectangle({ x: ML, y: y - h, width: UW, height: h, color: mkc(C.white), borderWidth: 0.7, borderColor: mkc(C.black) });
  let ty = y - Math.max(3, (h - lines.length * lineH) / 2) - 8.5 + 1;
  for (const line of lines) {
    const tw = line.length * approxCW;
    const tx = ML + Math.max(4, (UW - tw) / 2);
    page.drawText(line, { x: tx, y: ty, size: 8.5, font: fB, color: mkc(C.black) });
    ty -= lineH;
  }
  return h;
}

// ── 2-column form row ─────────────────────────────────────────────────────────

const LBL = 137;          // label width
const VAL = (UW - LBL * 2) / 2;  // value width = (556 - 274) / 2 = 141

function row2(
  page: PDFPage, y: number,
  l1: string, v1: string,
  l2: string, v2: string,
  h: number, fB: PDFFont, fR: PDFFont,
) {
  cell(page, ML,           y, LBL, h, l1, C.lbl, fB, 8.5);
  cell(page, ML + LBL,     y, VAL, h, v1, C.white, fR, 8.5);
  cell(page, ML + LBL + VAL, y, LBL, h, l2, C.lbl, fB, 8.5);
  cell(page, ML + LBL * 2 + VAL, y, VAL, h, v2, C.white, fR, 8.5);
  return h;
}

/** Auto-height 2-column row (grows if v1 or v2 overflow) */
function row2Auto(
  page: PDFPage, y: number,
  l1: string, v1: string,
  l2: string, v2: string,
  fB: PDFFont, fR: PDFFont,
  minH = 17,
): number {
  const approxCW = 8.5 * 0.54;
  const maxCh = Math.max(1, Math.floor((VAL - 5) / approxCW));
  const lh = 11;
  const h1 = Math.max(minH, wrapWords(v1, maxCh).length * lh + 5);
  const h2 = Math.max(minH, wrapWords(v2, maxCh).length * lh + 5);
  const h = Math.max(h1, h2);
  cell(page, ML,               y, LBL, h, l1, C.lbl, fB, 8.5);
  cellAuto(page, ML + LBL,     y, VAL, v1, C.white, fR, 8.5, h);
  cell(page, ML + LBL + VAL,   y, LBL, h, l2, C.lbl, fB, 8.5);
  cellAuto(page, ML + LBL * 2 + VAL, y, VAL, v2, C.white, fR, 8.5, h);
  return h;
}

/** Full-width 2-cell row: (wide label | auto-height value) */
function rowWide(page: PDFPage, y: number, lbl: string, val: string, h: number, fB: PDFFont, fR: PDFFont, lblW = 248): number {
  cell(page, ML,        y, lblW,     h, lbl, C.lbl, fB, 8.5);
  cell(page, ML + lblW, y, UW - lblW, h, val, C.white, fR, 8.5);
  return h;
}

/** Auto-height wide row */
function rowWideAuto(page: PDFPage, y: number, lbl: string, val: string, fB: PDFFont, fR: PDFFont, lblW = 248): number {
  const approxCW = 8.5 * 0.54;
  const valW = UW - lblW;
  const maxCh = Math.max(1, Math.floor((valW - 5) / approxCW));
  const h = Math.max(17, wrapWords(val, maxCh).length * 11 + 5);
  cell(page, ML, y, lblW, h, lbl, C.lbl, fB, 8.5);
  cellAuto(page, ML + lblW, y, valW, val, C.white, fR, 8.5, h);
  return h;
}

// ── Yes/No rows with checkboxes ───────────────────────────────────────────────

const YN_LBL_W = 265;   // question label width
const YN_NO_W  = 42;    // NO cell width
const YN_YES_W = 42;    // YES cell width
const YN_DET_W = UW - YN_LBL_W - YN_NO_W - YN_YES_W;  // details cell

/** Yes/No row with NO □ / YES □ checkboxes.
 *  showDetails = true → show "Provide Details" label + detail value in last cell */
function rowYN(
  page: PDFPage, y: number,
  label: string, val: string, details: string,
  showDetails: boolean,
  h: number, fB: PDFFont, fR: PDFFont,
): number {
  // Label
  cell(page, ML, y, YN_LBL_W, h, label, C.lbl, fB, 8.5);
  // NO checkbox
  drawYNCell(page, ML + YN_LBL_W, y, YN_NO_W, h, 'NO', val === 'no', fB);
  // YES checkbox
  drawYNCell(page, ML + YN_LBL_W + YN_NO_W, y, YN_YES_W, h, 'YES', val === 'yes', fB);
  // Details cell
  const dx = ML + YN_LBL_W + YN_NO_W + YN_YES_W;
  if (showDetails) {
    page.drawRectangle({ x: dx, y: y - h, width: YN_DET_W, height: h, color: mkc(C.white), borderWidth: 0.4, borderColor: mkc(C.border) });
    page.drawText('Provide Details', { x: dx + 3, y: y - 10, size: 7.5, font: fB, color: mkc(C.black) });
    if (details) {
      const approxCW = 7.5 * 0.54;
      const maxCh = Math.max(1, Math.floor((YN_DET_W - 6) / approxCW));
      const disp = details.length > maxCh ? details.slice(0, maxCh - 1) + '…' : details;
      page.drawText(disp, { x: dx + 3, y: y - h + 5, size: 7.5, font: fR, color: mkc(C.black) });
    }
  } else {
    cell(page, dx, y, YN_DET_W, h, '', C.white, fR, 8.5);
  }
  return h;
}

// ── Complex tables: Education / Work / Address ────────────────────────────────

// US Letter UW = 556; yr*4=100; remaining=456
// EW: inst=115, hrs=42, field=88, city=88, cert=123 → 115+42+88+88+123=456 ✓
const EW = [26, 24, 26, 24, 115, 42, 88, 88, 123];

// WW: emp=100, title=82, type=45, sal=42, city=80, resp=82, qual=25 → sum=456 ✓
const WW = [26, 24, 26, 24, 100, 82, 45, 42, 80, 82, 25];

// AW: addr=148, hrs=40, own=74, city=72, act=122 → 148+40+74+72+122=456 ✓
const AW = [26, 24, 26, 24, 148, 40, 74, 72, 122];

// Header h1 needs to accommodate multi-line text in narrow cells
const TH1 = 38;  // main header row height (accommodates 3-4 wrapped lines at 8pt)
const TH2 = 12;  // Year/Month sub-header row height
const CR  = 18;  // data row height

/** Draw the 2-row table header (title-span row + Year/Month row) */
function drawTableHeader(
  page: PDFPage, y: number,
  col2headers: string[],   // headers for cols index 2..n (after From/To spans)
  widths: number[],        // all column widths
  fB: PDFFont,
): number {
  // Row 1: "From" span | "To" span | col headers
  let cx = ML;
  const w01 = widths[0] + widths[1];
  const w23 = widths[2] + widths[3];
  cellWrapped(page, cx, y, w01, TH1, 'From', C.hdr, fB, 8, true); cx += w01;
  cellWrapped(page, cx, y, w23, TH1, 'To',   C.hdr, fB, 8, true); cx += w23;
  for (let i = 0; i < col2headers.length; i++) {
    cellWrapped(page, cx, y, widths[4 + i], TH1, col2headers[i], C.hdr, fB, 7.5);
    cx += widths[4 + i];
  }
  y -= TH1;

  // Row 2: Year | Month | Year | Month | (empty for remaining cols)
  cx = ML;
  const sub = ['Year', 'Month', 'Year', 'Month'];
  for (let i = 0; i < widths.length; i++) {
    cell(page, cx, y, widths[i], TH2, sub[i] ?? '', C.hdr, fB, 7, true);
    cx += widths[i];
  }
  y -= TH2;

  return TH1 + TH2;
}

function drawEduRow(page: PDFPage, y: number, e: EduEntry, fR: PDFFont) {
  const [sy, sm] = ym(e.startDate), [ey, em] = ym(e.endDate);
  const vals = [sy, sm, ey, em, e.institution, e.hrsPerWeek, e.fieldOfStudy, e.cityCountry, e.certificate];
  let cx = ML;
  for (let i = 0; i < EW.length; i++) { cell(page, cx, y, EW[i], CR, vals[i], C.white, fR, 7.5); cx += EW[i]; }
}

function drawWorkRow(page: PDFPage, y: number, e: WorkEntry, fR: PDFFont) {
  const [sy, sm] = ym(e.startDate), [ey, em] = ym(e.endDate);
  const vals = [sy, sm, ey, em, e.employer, e.jobTitle, e.jobType, e.salary, e.cityCountry, e.responsibilities, ''];
  let cx = ML;
  for (let i = 0; i < WW.length; i++) { cell(page, cx, y, WW[i], CR, vals[i], C.white, fR, 7.5); cx += WW[i]; }
}

function drawAddrRow(page: PDFPage, y: number, r: AddrRow, fR: PDFFont) {
  const vals = [r.fromYear, r.fromMonth, r.toYear, r.toMonth, r.address, '', r.ownership, r.cityCountry, r.activity];
  let cx = ML;
  for (let i = 0; i < AW.length; i++) { cell(page, cx, y, AW[i], CR, vals[i] ?? '', C.white, fR, 7.5); cx += AW[i]; }
}

// ── Person matrices (pages 5, 6, 7) ──────────────────────────────────────────

const ATTR_LBL = 120;   // attribute label column width

// Page 5 (Children & Spouse) — 13 attributes + Accompanying
const PAGE5_ATTRS = [
  'Family Name/ Surname', 'Given Names', 'Date of Birth',
  'Place of Birth (city and country)', 'Country of Residence', 'Citizenship',
  'Email / Telephone', 'Marital Status', 'Date of Marriage',
  'Passport No. / Country', 'Address', 'Native Language', 'Current Occupation',
];

// Pages 6 & 7 — 12 attributes + Accompanying
const PAGE67_ATTRS = [
  'Family Name/ Surname', 'Given Names', 'Date of Birth',
  'Place of Birth', 'Country of Residence', 'Citizenship',
  'Email / Telephone', 'Marital Status', 'Date of Marriage',
  'Passport No. / Country', 'Address', 'Native Language', 'Current Occupation',
];

function personValsP5(r: PersonRow): string[] {
  return [r.familyName, r.givenNames, r.dob, r.placeOfBirth, r.countryOfResidence,
    r.citizenship, r.emailPhone, r.maritalStatus, r.dateOfMarriage,
    r.passportInfo, r.address, r.nativeLang, r.occupation];
}

function personValsP67(r: PersonRow): string[] {
  return [r.familyName, r.givenNames, r.dob, r.placeOfBirth, r.countryOfResidence,
    r.citizenship, r.emailPhone, r.maritalStatus, r.dateOfMarriage,
    r.passportInfo, r.address, r.nativeLang, r.occupation];
}

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

/**
 * Draw a person-matrix table.
 * @param headers  — column header labels (always fixed length)
 * @param headerBgs — background colour per header cell
 * @param colData  — colData[personIdx][attrIdx]
 * @param accompanying — 'yes'|'no'|'' per person column (for Accompanying row)
 */
function drawPersonMatrix(
  page: PDFPage, y: number,
  attrs: string[],
  headers: string[],
  headerBgs: C3[],
  colData: string[][],
  accompanying: string[],
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

  // Attribute rows — white data cells
  for (let ai = 0; ai < attrs.length; ai++) {
    cell(page, ML, y, ATTR_LBL, rowH, attrs[ai], C.lbl, fB, 7.5);
    for (let ci = 0; ci < numPeople; ci++) {
      cell(page, ML + ATTR_LBL + ci * colW, y, colW, rowH, (colData[ci] ?? [])[ai] ?? '', C.white, fR, 7.5);
    }
    y -= rowH;
  }

  // Accompanying row
  const accH = 24;
  cell(page, ML, y, ATTR_LBL, accH, 'Accompanying', C.lbl, fB, 7.5);
  for (let ci = 0; ci < numPeople; ci++) {
    const cx = ML + ATTR_LBL + ci * colW;
    page.drawRectangle({ x: cx, y: y - accH, width: colW, height: accH, color: mkc(C.white), borderWidth: 0.4, borderColor: mkc(C.border) });
    const acc = accompanying[ci] ?? '';
    // "Yes" radio
    const yesX = cx + colW * 0.22, radioY = y - accH / 2;
    drawRadioCircle(page, yesX + 7, radioY, 4.5, acc === 'yes');
    page.drawText('Yes', { x: yesX, y: radioY - 3, size: 6.5, font: fR, color: mkc(C.black) });
    // "No" radio
    const noX = cx + colW * 0.58;
    drawRadioCircle(page, noX + 6, radioY, 4.5, acc === 'no');
    page.drawText('No', { x: noX, y: radioY - 3, size: 6.5, font: fR, color: mkc(C.black) });
  }
  y -= accH;

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
  const fSR = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const eduList  = safeJson<EduEntry[]>(formData.educationHistory, []);
  const workList = safeJson<WorkEntry[]>(formData.workHistory, []).sort((a, b) => b.startDate > a.startDate ? 1 : -1);
  const addrList = safeJson<AddrRow[]>(formData.addressHistory, []);
  const father   = safeJson<PersonRow>(formData.fatherInfo,      { ...EMPTY_PERSON });
  const mother   = safeJson<PersonRow>(formData.motherInfo,      { ...EMPTY_PERSON });
  const spFather = safeJson<PersonRow>(formData.spouseFatherInfo,{ ...EMPTY_PERSON });
  const spMother = safeJson<PersonRow>(formData.spouseMotherInfo,{ ...EMPTY_PERSON });
  const siblings = safeJson<PersonRow[]>(formData.siblingInfo, []);
  const travelers = safeJson<Travelers>(formData.travelersInfo, { hasSpouse: false, childCount: 0 });
  const ieltsRem  = formData.ieltsRemarks  ?? '';
  const celpipRem = formData.celpipRemarks ?? '';

  const v = (k: keyof FormData) => (formData[k] ?? '') as string;
  const ROW = 17;
  const YNH = 26;   // height for Yes/No rows (fits text + checkbox)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Detailed Information Sheet
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.Letter);
    let y = LTR_H - ML;

    // Serif title + underline
    const titleText = 'Detailed Information Sheet';
    page.drawText(titleText, { x: ML, y: y - 20, size: 16, font: fSR, color: mkc(C.black) });
    y -= 22;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + UW, y }, thickness: 1.2, color: mkc(C.black) });
    y -= 10;

    // Main info table rows (2-column, all value cells white)
    const pairs: [string, string, string, string][] = [
      ['Family Name/ Surname',       v('lastName'),              'Given Names',                v('firstName')              ],
      ['Telephone number',            v('phone'),                 'Email Address',              v('email')                  ],
      ['Passport Number',             v('passportNumber'),        'Country of issuance.',       v('passportIssuingCountry') ],
      ['Passport Issue date',         v('passportIssueDate'),     'Passport Expiry date',       v('passportExpiry')         ],
      ['Country of Residence\n(city and country)', v('countryOfResidence'), 'Place of Birth (city and\ncountry)', v('cityOfBirth') + (v('countryOfBirth') ? ', ' + v('countryOfBirth') : '') ],
      ['Marital Status',              v('maritalStatus'),         'Date of Marriage',           v('dateOfMarriage')         ],
      ['Date of Birth',               v('dateOfBirth'),           'Citizenship',                v('citizenship')            ],
      ['Eye Color',                   v('eyeColor'),              'Height',                     v('height')                 ],
      ['Current Occupation',          v('currentOccupation'),     'Current Status in Canada',   v('currentStatusInCanada')  ],
      ['Native Language',             v('nativeLanguage'),        'Current Status Expiry',      v('currentStatusExpiry')    ],
      ['Referred By',                 v('referredBy'),            'Number of Children',         v('numberOfChildren')       ],
      ['Course Start Date',           v('courseStartDate'),       'Course End Date',            v('courseEndDate')          ],
    ];

    // Use auto-height rows so long values expand the row
    for (const [l1, v1, l2, v2] of pairs) {
      y -= row2Auto(page, y, l1, v1, l2, v2, fB, fR);
    }

    // Current Address row (full-width label column + wide value)
    y -= rowWideAuto(page, y, 'Current Address (Aadhar / DL / Passport / Rent Agreement)', v('currentAddress'), fB, fR, 200);

    // Thick separator before UCI / Yes-No section
    y -= 2;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + UW, y }, thickness: 1.5, color: mkc(C.black) });
    y -= 2;

    // UCI row
    const entryVal = [v('entryCategory'), v('uciNumber')].filter(Boolean).join('  /  UCI: ');
    y -= rowWideAuto(page, y, 'Initially Entered Canada as: Visitor/ Refugee/ Student/Worker. Please Provide Your UCI number', entryVal, fB, fR, 320);
    y -= rowWide(page, y, 'Date First Entered Canada and Port of Entry', [v('dateFirstEnteredCanada'), v('portOfEntry')].filter(Boolean).join(' — '), ROW, fB, fR, 320);

    // Yes/No rows with checkboxes
    y -= rowYN(page, y, 'Have you ever been Deported/ Refused Visa/ refused entry to any country', v('deportedFlag'), v('deportedDetails'), true,  YNH, fB, fR);
    y -= rowYN(page, y, 'Have You Applied to IRCC before in past?',       v('irccAppliedBefore'), '', false, YNH, fB, fR);
    y -= rowYN(page, y, 'Have You Applied to any PNP before in past?',    v('pnpAppliedBefore'),  '', false, YNH, fB, fR);
    y -= rowYN(page, y, 'Do you have any relative in Canada?',            v('hasRelativeInCanada'), '', false, YNH, fB, fR);
    y -= rowWideAuto(page, y, 'Highest education completed (Canadian Equivalency)', v('highestEducationCanadian'), fB, fR, 320);
    y -= rowWideAuto(page, y, 'Total Number of years of education including primary, secondary and post-secondary education.', v('totalYearsEducation'), fB, fR, 320);

    // Education table — section title + header
    y -= 6;
    y -= tableTitleRow(page, y, 'List all Educational Institutes attended, without leaving gap in time beginning with the most recent one. If you were unemployed/ free during the period, please indicate.', fB);
    y -= drawTableHeader(page, y, [
      'Name of Educational Institution (Start from elementary)',
      'Number of Years/ Number of hrs. /week',
      'Field of Study',
      'City and Country',
      'Certificate, diploma Awarded',
    ], EW, fB);

    // Always 6 edu data rows
    const edu1 = Array.from({ length: 6 }, (_, i) => eduList[i] ?? { institution:'', fieldOfStudy:'', certificate:'', startDate:'', endDate:'', hrsPerWeek:'', cityCountry:'' });
    for (const e of edu1) {
      if (y - CR < 40) break;
      y -= CR; drawEduRow(page, y, e, fR);
    }

    drawChrome(page, 1, false, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Education continued + Language Tests
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.Letter);
    let y = LTR_H - ML;

    y -= tableTitleRow(page, y, 'List all Educational Institutes attended, without leaving gap in time beginning with the most recent one. If you were unemployed/ free during the period, please indicate.', fB);
    y -= drawTableHeader(page, y, [
      'Name of Educational Institution (Start from elementary)',
      'Number of Years/ Number of hrs. /week',
      'Field of Study',
      'City and Country / Complete Address',
      'Certificate, diploma Awarded',
    ], EW, fB);

    const edu2 = Array.from({ length: 4 }, (_, i) => eduList[6 + i] ?? { institution:'', fieldOfStudy:'', certificate:'', startDate:'', endDate:'', hrsPerWeek:'', cityCountry:'' });
    for (const e of edu2) { y -= CR; drawEduRow(page, y, e, fR); }

    y -= 14;

    // English Language Test — full-width navy title
    {
      const h = 20;
      page.drawRectangle({ x: ML, y: y - h, width: UW, height: h, color: mkc(C.navy) });
      const title = 'English Language Test';
      page.drawText(title, { x: ML + (UW - title.length * 10.5) / 2, y: y - h + 5, size: 13, font: fB, color: mkc(C.white) });
      y -= h;
    }

    const LANG_COLS = ['Test', 'Date of Test', 'Date of Result', 'Listening', 'Reading', 'Writing', 'Speaking', 'Overall Score', 'Remarks'];
    const LANG_W    = [44, 63, 63, 50, 50, 50, 50, 54, 132];  // total = 556
    {
      const h = 14; let cx = ML;
      for (let i = 0; i < LANG_COLS.length; i++) {
        cell(page, cx, y, LANG_W[i], h, LANG_COLS[i], C.hdr, fB, 8, i !== 0); cx += LANG_W[i];
      }
      y -= h;
    }
    const drawLangRow = (vals: string[]) => {
      const h = 20; let cx = ML;
      for (let i = 0; i < LANG_COLS.length; i++) {
        cell(page, cx, y, LANG_W[i], h, vals[i], C.white, i === 0 ? fB : fR, 8.5, i > 0); cx += LANG_W[i];
      }
      return h;
    };
    y -= drawLangRow(['IELTS',  v('ieltsTestDate'),   v('ieltsResultDate'),  v('ieltsListening'),  v('ieltsReading'),  v('ieltsWriting'),  v('ieltsSpeaking'),  v('ieltsOverall'),  ieltsRem]);
    y -= drawLangRow(['CELPIP', v('celpipTestDate'),  v('celpipResultDate'), v('celpipListening'), v('celpipReading'), v('celpipWriting'), v('celpipSpeaking'), v('celpipOverall'), celpipRem]);
    y -= drawLangRow(['', '', '', '', '', '', '', '', '']);

    drawChrome(page, 2, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — Employment History
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.Letter);
    let y = LTR_H - ML;

    y -= tableTitleRow(page, y, 'List all positions you have held during last 10 years without leaving gap in time beginning with the most recent one. If you were unemployed during the period, please indicate.', fB);
    y -= drawTableHeader(page, y, [
      'Name of Employer/ Name of Manager',
      'Number of Years/ Number of hours/week',
      'Position/ Occupation/ Title/NOC',
      'Salary',
      'City and Country/ Complete Address',
      'Responsibilities',
      'When you became qualified for this job',
    ], WW, fB);

    const minWork = 7;
    const workRows = [...workList];
    while (workRows.length < minWork) workRows.push({ employer:'', jobTitle:'', jobType:'', salary:'', startDate:'', endDate:'', cityCountry:'', responsibilities:'' });
    for (const e of workRows) {
      if (y - CR < 45) break;
      y -= CR; drawWorkRow(page, y, e, fR);
    }

    drawChrome(page, 3, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — Address History
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.Letter);
    let y = LTR_H - ML;

    y -= tableTitleRow(page, y, 'List all addresses you have lived during last 10 years without leaving gap in time beginning with the most recent one. If you were unemployed during the period, please indicate.', fB);
    y -= drawTableHeader(page, y, [
      'Complete Address Including Postal Code',
      'Number of Years/ Number of hours/week',
      'Owned/ Rented/ Shared',
      'City and Country',
      'Activity',
    ], AW, fB);

    const minAddr = 6;
    const addrRows = [...addrList];
    while (addrRows.length < minAddr) addrRows.push({ fromYear:'', fromMonth:'', toYear:'', toMonth:'', address:'', ownership:'', cityCountry:'', activity:'' });
    for (const r of addrRows) {
      if (y - CR < 45) break;
      y -= CR; drawAddrRow(page, y, r, fR);
    }

    drawChrome(page, 4, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — Details of Children and Spouse
  // Always show: Applicant + Spouse + 4×Son/Daughter = 6 columns
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.Letter);
    let y = LTR_H - ML;

    y -= navyHead(page, y, 'Details of Children and Spouse', fB, 12, true);
    y -= 4;

    // Build exactly 6 person columns
    const sp = spouseRow(formData);
    const ch1 = childRow(formData, 1), ch2 = childRow(formData, 2);
    const ch3 = childRow(formData, 3), ch4 = childRow(formData, 4);

    const headers  = ['Applicant', 'Spouse', 'Son/ Daughter', 'Son/ Daughter', 'Son/ Daughter', 'Son/ Daughter'];
    const hdrBgs: C3[] = [C.col_app, C.col_trv, C.col_trv, C.col_trv, C.col_trv, C.col_trv];
    const colData  = [personValsP5(applicantRow(formData)), personValsP5(sp), personValsP5(ch1), personValsP5(ch2), personValsP5(ch3), personValsP5(ch4)];
    const accompanying = ['', '', '', '', '', ''];

    drawPersonMatrix(page, y, PAGE5_ATTRS, headers, hdrBgs, colData, accompanying, fB, fR);
    drawChrome(page, 5, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 6 — Details of Brothers and Sisters
  // Always show: Applicant + 5×Brother/Sister = 6 columns
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.Letter);
    let y = LTR_H - ML;

    y -= navyHead(page, y, 'Details of Brothers and Sisters', fB, 12, true);
    y -= 4;

    const headers  = ['Applicant', 'Brother/ Sister', 'Brother/ Sister', 'Brother/ Sister', 'Brother/ Sister', 'Brother/ Sister'];
    const hdrBgs: C3[] = [C.col_app, C.hdr, C.hdr, C.hdr, C.hdr, C.hdr];
    const colData  = [
      personValsP67(applicantRow(formData)),
      ...Array.from({ length: 5 }, (_, i) => personValsP67(siblings[i] ?? EMPTY_PERSON)),
    ];
    const accompanying = ['', '', '', '', '', ''];

    drawPersonMatrix(page, y, PAGE67_ATTRS, headers, hdrBgs, colData, accompanying, fB, fR);
    drawChrome(page, 6, true, fB, fR);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 7 — Details of Parents
  // Always show: Applicant + Father + Mother + Spouse + Spouse's Father + Spouse's Mother = 6 columns
  // ══════════════════════════════════════════════════════════════════════════
  {
    const page = pdf.addPage(PageSizes.Letter);
    let y = LTR_H - ML;

    y -= navyHead(page, y, 'Details of Parents', fB, 12, true);
    y -= 4;

    const headers  = ['Applicant', 'Father', 'Mother', 'Spouse', "Spouse's Father", "Spouse's Mother"];
    const hdrBgs: C3[] = [C.col_app, C.hdr, C.hdr, C.col_trv, C.hdr, C.hdr];
    const colData  = [
      personValsP67(applicantRow(formData)),
      personValsP67(father),
      personValsP67(mother),
      personValsP67(spouseRow(formData)),
      personValsP67(spFather),
      personValsP67(spMother),
    ];
    const accompanying = ['', '', '', '', '', ''];

    y = drawPersonMatrix(page, y, PAGE67_ATTRS, headers, hdrBgs, colData, accompanying, fB, fR);

    // Canada entry dates
    y -= 10;
    y -= rowWide(page, y, 'Date of Entry in Canada',             v('dateEntryCanada'),       ROW, fB, fR, 220);
    y -= rowWide(page, y, 'Date of Most Recent Entry in Canada', v('dateRecentEntryCanada'), ROW, fB, fR, 220);

    // Submission metadata
    y -= 16;
    if (y - 26 > 40) {
      page.drawLine({ start: { x: ML, y }, end: { x: ML + UW, y }, thickness: 0.3, color: mkc([0.6, 0.6, 0.6] as C3) });
      const meta = `Submission ID: ${submissionId}  |  Submitted: ${submittedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC  |  Applicant: ${v('firstName')} ${v('lastName')}`;
      page.drawText(meta, { x: ML, y: y - 12, size: 7, font: fR, color: mkc([0.5, 0.5, 0.5] as C3) });
    }

    drawChrome(page, 7, true, fB, fR);
  }

  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}
