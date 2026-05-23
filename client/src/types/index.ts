// ─── Document types ────────────────────────────────────────────────────────────

export type DocumentId =
  | 'passport'
  | 'visa'
  | 'driverLicense'
  | 'educationalCredential'
  | 'employmentLetter'
  | 'financialProof'
  | 'marriageCertificate'
  | 'birthCertificate'
  | 'supportingDocuments';

export type DocumentStatus =
  | 'idle'         // not yet scanned
  | 'processing'   // OCR/AI in progress
  | 'done'         // OCR complete
  | 'error';       // something went wrong

export interface PageData {
  id: string;
  dataUrl: string;   // data:image/jpeg;base64,...
  capturedAt: number; // timestamp ms
}

export interface DocumentState {
  id: DocumentId;
  pages: PageData[];
  status: DocumentStatus;
  errorMessage?: string;
}

export interface DocumentConfig {
  id: DocumentId;
  name: string;
  description: string;
  required: boolean;
  aiLabel: string;           // phrase sent to OpenAI for type validation
  extractedFields: Array<keyof FormData>;
}

// ─── Form data ─────────────────────────────────────────────────────────────────

export interface FormData {
  // Personal
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  placeOfBirth: string;
  countryOfBirth: string;

  // Passport
  passportNumber: string;
  passportExpiry: string;
  passportIssuingCountry: string;

  // Visa
  visaNumber: string;
  visaType: string;
  visaExpiry: string;
  visaIssuingCountry: string;

  // Contact
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;

  // License
  licenseNumber: string;
  licenseExpiry: string;

  // Employment
  employerName: string;
  jobTitle: string;
  salary: string;
  employmentStartDate: string;

  // Education
  institution: string;
  degree: string;
  graduationDate: string;

  // Financial
  bankName: string;

  // Family
  maritalStatus: string;
  spouseName: string;
  marriageDate: string;
  marriageLocation: string;
}

export interface FieldMeta {
  aiPopulated: boolean;
  confidence: number;          // 0–1
  sourceDocument?: DocumentId;
}

// ─── App state ─────────────────────────────────────────────────────────────────

export type AppStep = 'consent' | 'scanning' | 'form' | 'complete';

export interface ConsentState {
  processing: boolean;
  noStorage: boolean;
  aiAssisted: boolean;
  submission: boolean;
}

export interface AppState {
  step: AppStep;
  consent: ConsentState;
  documents: Record<DocumentId, DocumentState>;
  formData: Partial<FormData>;
  fieldMeta: Partial<Record<keyof FormData, FieldMeta>>;
  submissionId: string;
  submitting: boolean;
  submitError: string | null;
}

// ─── API payloads ──────────────────────────────────────────────────────────────

export interface ValidateScanRequest {
  documentId: DocumentId;
  imageBase64: string;  // raw base64, no data URL prefix
}

export interface ValidateScanResponse {
  valid: boolean;
  confidence: number;
  message: string;
  validationSkipped?: boolean;
}

export interface ExtractDataRequest {
  documentId: DocumentId;
  pages: string[];  // raw base64 array
}

export interface ExtractDataResponse {
  extractedData: Partial<FormData>;
  confidence: Partial<Record<keyof FormData, number>>;
}

export interface SubmitRequest {
  submissionId: string;
  formData: Partial<FormData>;
  documents: Array<{
    id: DocumentId;
    name: string;
    pages: string[];  // raw base64
  }>;
}

export interface SubmitResponse {
  success: boolean;
  message: string;
}

// ─── Quality analysis ──────────────────────────────────────────────────────────

export interface QualityResult {
  isBlurry: boolean;
  isDark: boolean;
  hasGlare: boolean;
  blurScore: number;
  avgLuminance: number;
  glarePercent: number;
}

export interface QualityFeedback {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
