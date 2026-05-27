// ─── Document IDs ─────────────────────────────────────────────────────────────
// Mirrors tanan_immigration_form_v2.html document structure exactly.

export type DocumentId =
  // ── Applicant — Data Extraction ───────────────────────────────────────────
  | 'passport'               // REQUIRED — hard stop
  | 'marriageCertificate'    // if married; extracts dateOfMarriage
  | 'addressProof'           // REQUIRED — any one of: Aadhar / DL / Passport / Rent Agmt
  | 'workExperienceCert'     // REQUIRED — one upload per employer; multi-page extraction
  | 'degreeCertificate'      // REQUIRED — one upload per institution; multi-page extraction
  | 'ieltsScoreSheet'        // if applicable
  | 'celpipScoreSheet'       // if applicable

  // ── Applicant — Proof of Funds (upload only, no extraction) ───────────────
  | 'bankStatement'
  | 'salarySlips'
  | 'taxReturn'
  | 'netWorthStatement'
  | 'propertyOwnership'

  // ── Applicant — Upload Only (no extraction) ───────────────────────────────
  | 'birthCertificate'
  | 'eventInvitationLetter'
  | 'travelTickets'
  | 'digitalPicture'

  // ── Spouse / Partner (accompanying traveler) ──────────────────────────────
  | 'spousePassport'            // REQUIRED if spouse declared — hard stop
  | 'spouseWorkExperienceCert'  // optional
  | 'spouseDegreeCertificate'   // optional
  | 'spouseEventInvitationLetter'
  | 'spouseTravelTickets'
  | 'spouseDigitalPicture'

  // ── Children (accompanying travelers, up to 4) ────────────────────────────
  | 'child1Passport'  | 'child1TravelTickets'  | 'child1DigitalPicture'
  | 'child2Passport'  | 'child2TravelTickets'  | 'child2DigitalPicture'
  | 'child3Passport'  | 'child3TravelTickets'  | 'child3DigitalPicture'
  | 'child4Passport'  | 'child4TravelTickets'  | 'child4DigitalPicture';

// ─── Form Data ─────────────────────────────────────────────────────────────────
// All extractable fields (from scanned documents) + manual-entry fields needed
// to populate the Tanon Detailed Information Sheet (7 pages).
//
// Multi-value fields (workHistory, educationHistory, spouseWorkHistory,
// spouseEducationHistory) are stored as JSON-array strings.
// Format:
//   workHistory:       [{employer, jobTitle, jobType, salary, startDate, endDate, cityCountry, responsibilities}]
//   educationHistory:  [{institution, fieldOfStudy, certificate, startDate, endDate, hrsPerWeek, cityCountry}]

export interface FormData {
  // ── From APPLICANT PASSPORT (Page 1) ────────────────────────────────────
  firstName:               string;
  lastName:                string;
  dateOfBirth:             string;  // YYYY-MM-DD
  cityOfBirth:             string;
  countryOfBirth:          string;
  citizenship:             string;
  passportNumber:          string;
  passportIssueDate:       string;  // YYYY-MM-DD
  passportExpiry:          string;  // YYYY-MM-DD
  passportIssuingCountry:  string;

  // ── From ADDRESS PROOF (Page 1) ─────────────────────────────────────────
  // Accepts: Aadhar Card / Driving Licence / Passport / Rent Agreement
  currentAddress:          string;  // full address as printed on the document

  // ── From MARRIAGE CERTIFICATE (Page 1) ──────────────────────────────────
  dateOfMarriage:          string;  // YYYY-MM-DD

  // ── From WORK EXPERIENCE CERTIFICATES (Page 3) ──────────────────────────
  workHistory:             string;  // JSON array of job objects (see above)
  currentOccupation:       string;  // job title from most-recent certificate (Page 1)

  // ── From DEGREE CERTIFICATES (Pages 1 & 2) ──────────────────────────────
  educationHistory:        string;  // JSON array of education objects (see above)

  // ── From IELTS SCORE SHEET (Page 2) ─────────────────────────────────────
  ieltsTestDate:           string;
  ieltsResultDate:         string;
  ieltsListening:          string;
  ieltsReading:            string;
  ieltsWriting:            string;
  ieltsSpeaking:           string;
  ieltsOverall:            string;

  // ── From CELPIP SCORE SHEET (Page 2) ────────────────────────────────────
  celpipTestDate:          string;
  celpipResultDate:        string;
  celpipListening:         string;
  celpipReading:           string;
  celpipWriting:           string;
  celpipSpeaking:          string;
  celpipOverall:           string;

  // ── From SPOUSE PASSPORT (Pages 5 & 7) ──────────────────────────────────
  spouseLastName:               string;
  spouseFirstName:              string;
  spouseDateOfBirth:            string;
  spousePlaceOfBirth:           string;
  spouseCitizenship:            string;
  spousePassportNumber:         string;
  spousePassportIssueDate:      string;
  spousePassportExpiry:         string;
  spousePassportIssuingCountry: string;

  // ── From SPOUSE WORK EXPERIENCE CERTS (optional) ────────────────────────
  spouseWorkHistory:       string;  // JSON array
  spouseCurrentOccupation: string;

  // ── From SPOUSE DEGREE CERTIFICATES (optional) ──────────────────────────
  spouseEducationHistory:  string;  // JSON array

  // ── From CHILD 1 PASSPORT (Page 5) ──────────────────────────────────────
  child1LastName:               string;
  child1FirstName:              string;
  child1DateOfBirth:            string;
  child1PlaceOfBirth:           string;
  child1Citizenship:            string;
  child1PassportNumber:         string;
  child1PassportIssueDate:      string;
  child1PassportExpiry:         string;
  child1PassportIssuingCountry: string;

  // ── From CHILD 2 PASSPORT ───────────────────────────────────────────────
  child2LastName:               string;
  child2FirstName:              string;
  child2DateOfBirth:            string;
  child2PlaceOfBirth:           string;
  child2Citizenship:            string;
  child2PassportNumber:         string;
  child2PassportIssueDate:      string;
  child2PassportExpiry:         string;
  child2PassportIssuingCountry: string;

  // ── From CHILD 3 PASSPORT ───────────────────────────────────────────────
  child3LastName:               string;
  child3FirstName:              string;
  child3DateOfBirth:            string;
  child3PlaceOfBirth:           string;
  child3Citizenship:            string;
  child3PassportNumber:         string;
  child3PassportIssueDate:      string;
  child3PassportExpiry:         string;
  child3PassportIssuingCountry: string;

  // ── From CHILD 4 PASSPORT ───────────────────────────────────────────────
  child4LastName:               string;
  child4FirstName:              string;
  child4DateOfBirth:            string;
  child4PlaceOfBirth:           string;
  child4Citizenship:            string;
  child4PassportNumber:         string;
  child4PassportIssueDate:      string;
  child4PassportExpiry:         string;
  child4PassportIssuingCountry: string;

  // ── MANUAL ENTRY FIELDS (Page 1 + family pages) ─────────────────────────
  phone:                   string;
  email:                   string;
  countryOfResidence:      string;
  maritalStatus:           string;
  eyeColor:                string;
  height:                  string;
  nativeLanguage:          string;
  currentStatusInCanada:   string;
  currentStatusExpiry:     string;
  referredBy:              string;
  numberOfChildren:        string;
  courseStartDate:         string;
  courseEndDate:           string;

  // ── Page 1 — additional manual entry fields ──────────────────────────────
  entryCategory:            string;  // Visitor / Refugee / Student / Worker
  uciNumber:                string;
  dateFirstEnteredCanada:   string;
  portOfEntry:              string;
  deportedFlag:             string;  // 'yes' | 'no'
  deportedDetails:          string;
  irccAppliedBefore:        string;  // 'yes' | 'no'
  pnpAppliedBefore:         string;  // 'yes' | 'no'
  hasRelativeInCanada:      string;  // 'yes' | 'no'
  highestEducationCanadian: string;
  totalYearsEducation:      string;

  // ── Page 7 — Canada entry dates ─────────────────────────────────────────
  dateEntryCanada:          string;
  dateRecentEntryCanada:    string;

  // ── Accompanying flags (Pages 5/6/7) ────────────────────────────────────
  spouseAccompanying:  string;
  child1Accompanying:  string;
  child2Accompanying:  string;
  child3Accompanying:  string;
  child4Accompanying:  string;

  // ── Local state serialised for PDF generation ────────────────────────────
  // Synced via useEffect in IntakeForm so the server can build all 7 pages.
  addressHistory:     string;  // JSON AddrRow[]
  fatherInfo:         string;  // JSON PersonRow (applicant's father)
  motherInfo:         string;  // JSON PersonRow (applicant's mother)
  spouseFatherInfo:   string;  // JSON PersonRow (spouse's father)
  spouseMotherInfo:   string;  // JSON PersonRow (spouse's mother)
  siblingInfo:        string;  // JSON PersonRow[] (up to 5 siblings)
  ieltsRemarks:       string;
  celpipRemarks:      string;
  travelersInfo:      string;  // JSON {hasSpouse: boolean, childCount: number}
}

// ─── DocumentId whitelist ──────────────────────────────────────────────────────
// Kept in sync with the DocumentId union above. Used server-side to reject
// unknown documentId values before they reach OpenAI or are used as object keys.

export const VALID_DOCUMENT_IDS: ReadonlySet<DocumentId> = new Set([
  'passport', 'marriageCertificate', 'addressProof', 'workExperienceCert',
  'degreeCertificate', 'ieltsScoreSheet', 'celpipScoreSheet',
  'bankStatement', 'salarySlips', 'taxReturn', 'netWorthStatement', 'propertyOwnership',
  'birthCertificate', 'eventInvitationLetter', 'travelTickets', 'digitalPicture',
  'spousePassport', 'spouseWorkExperienceCert', 'spouseDegreeCertificate',
  'spouseEventInvitationLetter', 'spouseTravelTickets', 'spouseDigitalPicture',
  'child1Passport', 'child1TravelTickets', 'child1DigitalPicture',
  'child2Passport', 'child2TravelTickets', 'child2DigitalPicture',
  'child3Passport', 'child3TravelTickets', 'child3DigitalPicture',
  'child4Passport', 'child4TravelTickets', 'child4DigitalPicture',
]);

// ─── API request / response types ─────────────────────────────────────────────

export interface ValidateScanRequest {
  documentId: DocumentId;
  imageBase64: string;
}

export interface ValidateScanResponse {
  valid: boolean;
  confidence: number;
  message: string;
  validationSkipped?: boolean;
}

export interface ExtractDataRequest {
  documentId: DocumentId;
  pages: string[];
}

export interface ExtractDataResponse {
  extractedData: Partial<FormData>;
  confidence: Partial<Record<keyof FormData, number>>;
}

export interface SubmittedDocument {
  id: DocumentId;
  name: string;
  pages: string[];
}

export interface SubmitRequest {
  submissionId: string;
  formData: Partial<FormData>;
  documents: SubmittedDocument[];
}

export interface SubmitResponse {
  success: boolean;
  message: string;
}
