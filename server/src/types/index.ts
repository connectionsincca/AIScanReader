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

export interface FormData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  placeOfBirth?: string;
  countryOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  passportIssuingCountry?: string;
  visaNumber?: string;
  visaType?: string;
  visaExpiry?: string;
  visaIssuingCountry?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  employerName?: string;
  jobTitle?: string;
  salary?: string;
  employmentStartDate?: string;
  institution?: string;
  degree?: string;
  graduationDate?: string;
  bankName?: string;
  maritalStatus?: string;
  spouseName?: string;
  marriageDate?: string;
  marriageLocation?: string;
}

export interface ValidateScanRequest {
  documentId: DocumentId;
  imageBase64: string;
}

export interface ValidateScanResponse {
  valid: boolean;
  confidence: number;
  message: string;
  validationSkipped?: boolean; // true when AI could not validate (API error) — client shows warning
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
