import type { DocumentConfig } from '../types';

export const DOCUMENTS: DocumentConfig[] = [
  {
    id: 'passport',
    name: 'Passport',
    description: 'Valid travel passport — include all pages with stamps',
    required: true,
    aiLabel: 'passport (official travel document with MRZ strip)',
    extractedFields: [
      'firstName', 'lastName', 'dateOfBirth', 'gender',
      'nationality', 'placeOfBirth', 'countryOfBirth',
      'passportNumber', 'passportExpiry', 'passportIssuingCountry',
    ],
  },
  {
    id: 'visa',
    name: 'Visa',
    description: 'Current or previous visa documents',
    required: false,
    aiLabel: 'visa sticker or visa approval document',
    extractedFields: ['visaNumber', 'visaType', 'visaExpiry', 'visaIssuingCountry'],
  },
  {
    id: 'driverLicense',
    name: "Driver's License",
    description: "Valid driver's license — scan front and back",
    required: false,
    aiLabel: "driver's license or government-issued ID card",
    extractedFields: ['address', 'city', 'province', 'postalCode', 'licenseNumber', 'licenseExpiry'],
  },
  {
    id: 'educationalCredential',
    name: 'Educational Credential',
    description: 'Diplomas, degrees, certificates, or transcripts',
    required: false,
    aiLabel: 'educational diploma, degree certificate, or academic transcript',
    extractedFields: ['institution', 'degree', 'graduationDate'],
  },
  {
    id: 'employmentLetter',
    name: 'Employment Letter',
    description: 'Official letter from your employer confirming employment',
    required: false,
    aiLabel: 'employment verification letter or letter of employment',
    extractedFields: ['employerName', 'jobTitle', 'salary', 'employmentStartDate'],
  },
  {
    id: 'financialProof',
    name: 'Financial Proof',
    description: 'Bank statements or other financial documents',
    required: false,
    aiLabel: 'bank statement or financial proof document',
    extractedFields: ['bankName'],
  },
  {
    id: 'marriageCertificate',
    name: 'Marriage Certificate',
    description: 'Official marriage certificate (if applicable)',
    required: false,
    aiLabel: 'marriage certificate or certificate of marriage',
    extractedFields: ['spouseName', 'marriageDate', 'marriageLocation'],
  },
  {
    id: 'birthCertificate',
    name: 'Birth Certificate',
    description: 'Official birth certificate',
    required: false,
    aiLabel: 'birth certificate or certificate of birth',
    extractedFields: ['placeOfBirth', 'dateOfBirth'],
  },
  {
    id: 'supportingDocuments',
    name: 'Supporting Documents',
    description: 'Any additional documents requested by the agency',
    required: false,
    aiLabel: 'official document',
    extractedFields: [],
  },
];

export const DOCUMENT_MAP = Object.fromEntries(
  DOCUMENTS.map((d) => [d.id, d])
) as Record<string, DocumentConfig>;
