import type { DocumentConfig } from '../types';

export const DOCUMENTS: DocumentConfig[] = [
  // ── Applicant — Data Extraction ──────────────────────────────────────────────

  {
    id: 'passport',
    name: 'Passport',
    description: 'Valid travel passport — biographical data page required',
    required: true,
    aiLabel: 'passport (official travel document booklet with MRZ strip)',
    extractedFields: [
      'firstName', 'lastName', 'dateOfBirth', 'cityOfBirth', 'countryOfBirth',
      'citizenship', 'passportNumber', 'passportIssueDate', 'passportExpiry',
      'passportIssuingCountry',
    ],
  },
  {
    id: 'marriageCertificate',
    name: 'Marriage Certificate',
    description: 'Official marriage certificate (if married)',
    required: false,
    aiLabel: 'marriage certificate or certificate of marriage',
    extractedFields: ['dateOfMarriage'],
  },
  {
    id: 'addressProof',
    name: 'Address Proof',
    description: 'Aadhar card, driving licence, passport, or rent agreement showing current address',
    required: true,
    aiLabel: 'address proof document (Aadhar card, driving licence, or rent agreement)',
    extractedFields: ['currentAddress'],
  },
  {
    id: 'workExperienceCert',
    name: 'Work Experience Certificate',
    description: 'Employment letter or experience certificate — one upload per employer (optional)',
    required: false,
    aiLabel: 'employment letter or work experience certificate on company letterhead',
    extractedFields: ['currentOccupation', 'workHistory'],
  },
  {
    id: 'degreeCertificate',
    name: 'Degree / Diploma Certificate',
    description: 'Degree, diploma, or academic certificate — one upload per institution (optional)',
    required: false,
    aiLabel: 'educational degree certificate or diploma from a university or college',
    extractedFields: ['educationHistory'],
  },
  {
    id: 'ieltsScoreSheet',
    name: 'IELTS Score Sheet',
    description: 'IELTS Test Report Form showing band scores (if applicable)',
    required: false,
    aiLabel: 'IELTS Test Report Form or IELTS score certificate',
    extractedFields: [
      'ieltsTestDate', 'ieltsResultDate',
      'ieltsListening', 'ieltsReading', 'ieltsWriting', 'ieltsSpeaking', 'ieltsOverall',
    ],
  },
  {
    id: 'celpipScoreSheet',
    name: 'CELPIP Score Sheet',
    description: 'CELPIP Score Report showing component scores (if applicable)',
    required: false,
    aiLabel: 'CELPIP Score Report or CELPIP results certificate',
    extractedFields: [
      'celpipTestDate', 'celpipResultDate',
      'celpipListening', 'celpipReading', 'celpipWriting', 'celpipSpeaking', 'celpipOverall',
    ],
  },

  // ── Applicant — Proof of Funds (upload only) ─────────────────────────────────

  {
    id: 'bankStatement',
    name: 'Bank Statement',
    description: 'Recent bank statement(s) showing account balance',
    required: false,
    aiLabel: 'bank statement or account statement from a financial institution',
    extractedFields: [],
  },
  {
    id: 'salarySlips',
    name: 'Salary Slips',
    description: 'Recent salary slips or pay stubs',
    required: false,
    aiLabel: 'salary slip, pay stub, or payslip',
    extractedFields: [],
  },
  {
    id: 'taxReturn',
    name: 'Tax Return / ITR',
    description: 'Income tax return or ITR acknowledgement',
    required: false,
    aiLabel: 'income tax return or ITR document',
    extractedFields: [],
  },
  {
    id: 'netWorthStatement',
    name: 'Net Worth Statement',
    description: 'CA-certified net worth statement',
    required: false,
    aiLabel: 'net worth statement or chartered accountant certificate',
    extractedFields: [],
  },
  {
    id: 'propertyOwnership',
    name: 'Property Ownership Document',
    description: 'Property deed or ownership documents',
    required: false,
    aiLabel: 'property ownership deed or title document',
    extractedFields: [],
  },

  // ── Applicant — Upload Only ───────────────────────────────────────────────────

  {
    id: 'birthCertificate',
    name: 'Birth Certificate',
    description: 'Official birth certificate',
    required: false,
    aiLabel: 'birth certificate or certificate of birth',
    extractedFields: [],
  },
  {
    id: 'eventInvitationLetter',
    name: 'Event Invitation Letter',
    description: 'Official invitation letter for the event or conference',
    required: false,
    aiLabel: 'event invitation letter or conference invitation',
    extractedFields: [],
  },
  {
    id: 'travelTickets',
    name: 'Travel Tickets',
    description: 'Flight or travel booking confirmations',
    required: false,
    aiLabel: 'flight ticket, travel itinerary, or booking confirmation',
    extractedFields: [],
  },
  {
    id: 'digitalPicture',
    name: 'Digital Picture',
    description: 'Passport-style photograph (white background, front-facing)',
    required: false,
    aiLabel: 'passport-style photograph or headshot',
    extractedFields: [],
  },

  // ── Spouse / Partner ──────────────────────────────────────────────────────────

  {
    id: 'spousePassport',
    name: "Spouse's Passport",
    description: "Spouse's valid travel passport — biographical data page required",
    required: false,
    aiLabel: 'passport (official travel document booklet with MRZ strip)',
    extractedFields: [
      'spouseLastName', 'spouseFirstName', 'spouseDateOfBirth', 'spousePlaceOfBirth',
      'spouseCitizenship', 'spousePassportNumber', 'spousePassportIssueDate',
      'spousePassportExpiry', 'spousePassportIssuingCountry',
    ],
  },
  {
    id: 'spouseWorkExperienceCert',
    name: "Spouse's Work Experience Certificate",
    description: "Spouse's employment letter or experience certificate (optional)",
    required: false,
    aiLabel: 'employment letter or work experience certificate on company letterhead',
    extractedFields: ['spouseCurrentOccupation', 'spouseWorkHistory'],
  },
  {
    id: 'spouseDegreeCertificate',
    name: "Spouse's Degree / Diploma Certificate",
    description: "Spouse's degree or diploma certificate (optional)",
    required: false,
    aiLabel: 'educational degree certificate or diploma from a university or college',
    extractedFields: ['spouseEducationHistory'],
  },
  {
    id: 'spouseEventInvitationLetter',
    name: "Spouse's Event Invitation Letter",
    description: "Event invitation letter for spouse (optional)",
    required: false,
    aiLabel: 'event invitation letter or conference invitation',
    extractedFields: [],
  },
  {
    id: 'spouseTravelTickets',
    name: "Spouse's Travel Tickets",
    description: "Flight or travel booking for spouse (optional)",
    required: false,
    aiLabel: 'flight ticket, travel itinerary, or booking confirmation',
    extractedFields: [],
  },
  {
    id: 'spouseDigitalPicture',
    name: "Spouse's Digital Picture",
    description: "Passport-style photograph for spouse (optional)",
    required: false,
    aiLabel: 'passport-style photograph or headshot',
    extractedFields: [],
  },

  // ── Child 1 ───────────────────────────────────────────────────────────────────

  {
    id: 'child1Passport',
    name: "Child 1 — Passport",
    description: "Child 1's valid travel passport — biographical data page required",
    required: false,
    aiLabel: 'passport (official travel document booklet with MRZ strip)',
    extractedFields: [
      'child1LastName', 'child1FirstName', 'child1DateOfBirth', 'child1PlaceOfBirth',
      'child1Citizenship', 'child1PassportNumber', 'child1PassportIssueDate',
      'child1PassportExpiry', 'child1PassportIssuingCountry',
    ],
  },
  {
    id: 'child1TravelTickets',
    name: "Child 1 — Travel Tickets",
    description: "Flight or travel booking for child 1 (optional)",
    required: false,
    aiLabel: 'flight ticket, travel itinerary, or booking confirmation',
    extractedFields: [],
  },
  {
    id: 'child1DigitalPicture',
    name: "Child 1 — Digital Picture",
    description: "Passport-style photograph for child 1 (optional)",
    required: false,
    aiLabel: 'passport-style photograph or headshot',
    extractedFields: [],
  },

  // ── Child 2 ───────────────────────────────────────────────────────────────────

  {
    id: 'child2Passport',
    name: "Child 2 — Passport",
    description: "Child 2's valid travel passport — biographical data page required",
    required: false,
    aiLabel: 'passport (official travel document booklet with MRZ strip)',
    extractedFields: [
      'child2LastName', 'child2FirstName', 'child2DateOfBirth', 'child2PlaceOfBirth',
      'child2Citizenship', 'child2PassportNumber', 'child2PassportIssueDate',
      'child2PassportExpiry', 'child2PassportIssuingCountry',
    ],
  },
  {
    id: 'child2TravelTickets',
    name: "Child 2 — Travel Tickets",
    description: "Flight or travel booking for child 2 (optional)",
    required: false,
    aiLabel: 'flight ticket, travel itinerary, or booking confirmation',
    extractedFields: [],
  },
  {
    id: 'child2DigitalPicture',
    name: "Child 2 — Digital Picture",
    description: "Passport-style photograph for child 2 (optional)",
    required: false,
    aiLabel: 'passport-style photograph or headshot',
    extractedFields: [],
  },

  // ── Child 3 ───────────────────────────────────────────────────────────────────

  {
    id: 'child3Passport',
    name: "Child 3 — Passport",
    description: "Child 3's valid travel passport — biographical data page required",
    required: false,
    aiLabel: 'passport (official travel document booklet with MRZ strip)',
    extractedFields: [
      'child3LastName', 'child3FirstName', 'child3DateOfBirth', 'child3PlaceOfBirth',
      'child3Citizenship', 'child3PassportNumber', 'child3PassportIssueDate',
      'child3PassportExpiry', 'child3PassportIssuingCountry',
    ],
  },
  {
    id: 'child3TravelTickets',
    name: "Child 3 — Travel Tickets",
    description: "Flight or travel booking for child 3 (optional)",
    required: false,
    aiLabel: 'flight ticket, travel itinerary, or booking confirmation',
    extractedFields: [],
  },
  {
    id: 'child3DigitalPicture',
    name: "Child 3 — Digital Picture",
    description: "Passport-style photograph for child 3 (optional)",
    required: false,
    aiLabel: 'passport-style photograph or headshot',
    extractedFields: [],
  },

  // ── Child 4 ───────────────────────────────────────────────────────────────────

  {
    id: 'child4Passport',
    name: "Child 4 — Passport",
    description: "Child 4's valid travel passport — biographical data page required",
    required: false,
    aiLabel: 'passport (official travel document booklet with MRZ strip)',
    extractedFields: [
      'child4LastName', 'child4FirstName', 'child4DateOfBirth', 'child4PlaceOfBirth',
      'child4Citizenship', 'child4PassportNumber', 'child4PassportIssueDate',
      'child4PassportExpiry', 'child4PassportIssuingCountry',
    ],
  },
  {
    id: 'child4TravelTickets',
    name: "Child 4 — Travel Tickets",
    description: "Flight or travel booking for child 4 (optional)",
    required: false,
    aiLabel: 'flight ticket, travel itinerary, or booking confirmation',
    extractedFields: [],
  },
  {
    id: 'child4DigitalPicture',
    name: "Child 4 — Digital Picture",
    description: "Passport-style photograph for child 4 (optional)",
    required: false,
    aiLabel: 'passport-style photograph or headshot',
    extractedFields: [],
  },
];

export const DOCUMENT_MAP = Object.fromEntries(
  DOCUMENTS.map((d) => [d.id, d])
) as Record<string, DocumentConfig>;
