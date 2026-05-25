import type { FormData } from '../types';

export type FieldType = 'text' | 'date' | 'email' | 'tel' | 'select';

export interface FieldConfig {
  id: keyof FormData;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface SectionConfig {
  id: string;
  title: string;
  fields: FieldConfig[];
}

// ─── Form sections — mirrors Tanon Detailed Information Sheet (7 pages) ────────
// Note: JSON-array fields (workHistory, educationHistory, spouseWorkHistory,
// spouseEducationHistory) are populated by scanning and displayed read-only;
// they are intentionally omitted here to avoid raw-JSON text fields in the UI.

export const FORM_SECTIONS: SectionConfig[] = [

  // ── Page 1 — Applicant Identity ─────────────────────────────────────────────
  {
    id: 'identity',
    title: 'Applicant — Identity',
    fields: [
      { id: 'firstName',    label: 'First Name',    type: 'text', placeholder: 'As on passport', required: true },
      { id: 'lastName',     label: 'Last Name',     type: 'text', placeholder: 'As on passport', required: true },
      { id: 'dateOfBirth',  label: 'Date of Birth', type: 'date', required: true },
      { id: 'cityOfBirth',  label: 'City of Birth', type: 'text', placeholder: 'e.g. Mumbai' },
      { id: 'countryOfBirth', label: 'Country of Birth', type: 'text', placeholder: 'e.g. India' },
      { id: 'citizenship',  label: 'Citizenship / Nationality', type: 'text', placeholder: 'e.g. Indian' },
      { id: 'eyeColor',     label: 'Eye Colour',    type: 'text', placeholder: 'e.g. Brown' },
      { id: 'height',       label: 'Height',        type: 'text', placeholder: 'e.g. 170 cm' },
      { id: 'nativeLanguage', label: 'Native Language', type: 'text', placeholder: 'e.g. Hindi' },
    ],
  },

  // ── Page 1 — Passport Details ────────────────────────────────────────────────
  {
    id: 'passport',
    title: 'Applicant — Passport',
    fields: [
      { id: 'passportNumber',         label: 'Passport Number',          type: 'text', placeholder: 'e.g. A1234567' },
      { id: 'passportIssueDate',      label: 'Passport Issue Date',      type: 'date' },
      { id: 'passportExpiry',         label: 'Passport Expiry Date',     type: 'date' },
      { id: 'passportIssuingCountry', label: 'Passport Issuing Country', type: 'text', placeholder: 'e.g. India' },
    ],
  },

  // ── Page 1 — Contact & Address ───────────────────────────────────────────────
  {
    id: 'contact',
    title: 'Applicant — Contact & Address',
    fields: [
      { id: 'currentAddress',    label: 'Current Address',    type: 'text', placeholder: 'Full address as on document', required: true },
      { id: 'countryOfResidence',label: 'Country of Residence',type: 'text', placeholder: 'e.g. India' },
      { id: 'phone',             label: 'Phone Number',       type: 'tel',  placeholder: '+91 98765 43210', required: true },
      { id: 'email',             label: 'Email Address',      type: 'email',placeholder: 'you@example.com', required: true },
    ],
  },

  // ── Page 1 — Marital Status & Family ────────────────────────────────────────
  {
    id: 'family',
    title: 'Applicant — Family',
    fields: [
      {
        id: 'maritalStatus', label: 'Marital Status', type: 'select',
        options: [
          { value: '',          label: 'Select status'   },
          { value: 'single',    label: 'Single'          },
          { value: 'married',   label: 'Married'         },
          { value: 'divorced',  label: 'Divorced'        },
          { value: 'widowed',   label: 'Widowed'         },
          { value: 'separated', label: 'Separated'       },
          { value: 'other',     label: 'Other'           },
        ],
      },
      { id: 'dateOfMarriage',  label: 'Date of Marriage',  type: 'date' },
      { id: 'numberOfChildren',label: 'Number of Children',type: 'text', placeholder: '0' },
    ],
  },

  // ── Page 1 — Employment (current occupation) ─────────────────────────────────
  {
    id: 'employment',
    title: 'Applicant — Current Employment',
    fields: [
      { id: 'currentOccupation', label: 'Current Occupation / Job Title', type: 'text', placeholder: 'e.g. Software Engineer' },
    ],
  },

  // ── Page 1 — Immigration Status ──────────────────────────────────────────────
  {
    id: 'immigration',
    title: 'Applicant — Immigration Status',
    fields: [
      { id: 'currentStatusInCanada', label: 'Current Status in Canada', type: 'text', placeholder: 'e.g. Visitor, Student, Worker' },
      { id: 'currentStatusExpiry',   label: 'Status Expiry Date',       type: 'date' },
    ],
  },

  // ── Page 2 — Language Tests — IELTS ─────────────────────────────────────────
  {
    id: 'ielts',
    title: 'Language Test — IELTS',
    fields: [
      { id: 'ieltsTestDate',    label: 'Test Date',      type: 'date' },
      { id: 'ieltsResultDate',  label: 'Result Date',    type: 'date' },
      { id: 'ieltsListening',   label: 'Listening',      type: 'text', placeholder: 'e.g. 7.5' },
      { id: 'ieltsReading',     label: 'Reading',        type: 'text', placeholder: 'e.g. 7.0' },
      { id: 'ieltsWriting',     label: 'Writing',        type: 'text', placeholder: 'e.g. 6.5' },
      { id: 'ieltsSpeaking',    label: 'Speaking',       type: 'text', placeholder: 'e.g. 7.0' },
      { id: 'ieltsOverall',     label: 'Overall Band',   type: 'text', placeholder: 'e.g. 7.0' },
    ],
  },

  // ── Page 2 — Language Tests — CELPIP ─────────────────────────────────────────
  {
    id: 'celpip',
    title: 'Language Test — CELPIP',
    fields: [
      { id: 'celpipTestDate',    label: 'Test Date',      type: 'date' },
      { id: 'celpipResultDate',  label: 'Result Date',    type: 'date' },
      { id: 'celpipListening',   label: 'Listening',      type: 'text', placeholder: 'e.g. 9' },
      { id: 'celpipReading',     label: 'Reading',        type: 'text', placeholder: 'e.g. 9' },
      { id: 'celpipWriting',     label: 'Writing',        type: 'text', placeholder: 'e.g. 8' },
      { id: 'celpipSpeaking',    label: 'Speaking',       type: 'text', placeholder: 'e.g. 9' },
      { id: 'celpipOverall',     label: 'Overall Score',  type: 'text', placeholder: 'e.g. 9' },
    ],
  },

  // ── Page 1 — Application Details ─────────────────────────────────────────────
  {
    id: 'application',
    title: 'Application Details',
    fields: [
      { id: 'courseStartDate', label: 'Course / Program Start Date', type: 'date' },
      { id: 'courseEndDate',   label: 'Course / Program End Date',   type: 'date' },
      { id: 'referredBy',      label: 'Referred By',                 type: 'text', placeholder: 'Name of referrer' },
    ],
  },

  // ── Pages 5 & 7 — Spouse ─────────────────────────────────────────────────────
  {
    id: 'spouse',
    title: 'Spouse / Partner',
    fields: [
      { id: 'spouseFirstName',              label: "Spouse's First Name",            type: 'text' },
      { id: 'spouseLastName',               label: "Spouse's Last Name",             type: 'text' },
      { id: 'spouseDateOfBirth',            label: "Spouse's Date of Birth",         type: 'date' },
      { id: 'spousePlaceOfBirth',           label: "Spouse's Place of Birth",        type: 'text' },
      { id: 'spouseCitizenship',            label: "Spouse's Citizenship",           type: 'text' },
      { id: 'spousePassportNumber',         label: "Spouse's Passport Number",       type: 'text' },
      { id: 'spousePassportIssueDate',      label: "Spouse's Passport Issue Date",   type: 'date' },
      { id: 'spousePassportExpiry',         label: "Spouse's Passport Expiry",       type: 'date' },
      { id: 'spousePassportIssuingCountry', label: "Spouse's Passport Issuing Country", type: 'text' },
      { id: 'spouseCurrentOccupation',      label: "Spouse's Current Occupation",   type: 'text' },
    ],
  },

  // ── Page 5 — Child 1 ─────────────────────────────────────────────────────────
  {
    id: 'child1',
    title: 'Child 1',
    fields: [
      { id: 'child1FirstName',              label: 'First Name',            type: 'text' },
      { id: 'child1LastName',               label: 'Last Name',             type: 'text' },
      { id: 'child1DateOfBirth',            label: 'Date of Birth',         type: 'date' },
      { id: 'child1PlaceOfBirth',           label: 'Place of Birth',        type: 'text' },
      { id: 'child1Citizenship',            label: 'Citizenship',           type: 'text' },
      { id: 'child1PassportNumber',         label: 'Passport Number',       type: 'text' },
      { id: 'child1PassportIssueDate',      label: 'Passport Issue Date',   type: 'date' },
      { id: 'child1PassportExpiry',         label: 'Passport Expiry',       type: 'date' },
      { id: 'child1PassportIssuingCountry', label: 'Passport Issuing Country', type: 'text' },
    ],
  },

  // ── Page 5 — Child 2 ─────────────────────────────────────────────────────────
  {
    id: 'child2',
    title: 'Child 2',
    fields: [
      { id: 'child2FirstName',              label: 'First Name',            type: 'text' },
      { id: 'child2LastName',               label: 'Last Name',             type: 'text' },
      { id: 'child2DateOfBirth',            label: 'Date of Birth',         type: 'date' },
      { id: 'child2PlaceOfBirth',           label: 'Place of Birth',        type: 'text' },
      { id: 'child2Citizenship',            label: 'Citizenship',           type: 'text' },
      { id: 'child2PassportNumber',         label: 'Passport Number',       type: 'text' },
      { id: 'child2PassportIssueDate',      label: 'Passport Issue Date',   type: 'date' },
      { id: 'child2PassportExpiry',         label: 'Passport Expiry',       type: 'date' },
      { id: 'child2PassportIssuingCountry', label: 'Passport Issuing Country', type: 'text' },
    ],
  },

  // ── Page 5 — Child 3 ─────────────────────────────────────────────────────────
  {
    id: 'child3',
    title: 'Child 3',
    fields: [
      { id: 'child3FirstName',              label: 'First Name',            type: 'text' },
      { id: 'child3LastName',               label: 'Last Name',             type: 'text' },
      { id: 'child3DateOfBirth',            label: 'Date of Birth',         type: 'date' },
      { id: 'child3PlaceOfBirth',           label: 'Place of Birth',        type: 'text' },
      { id: 'child3Citizenship',            label: 'Citizenship',           type: 'text' },
      { id: 'child3PassportNumber',         label: 'Passport Number',       type: 'text' },
      { id: 'child3PassportIssueDate',      label: 'Passport Issue Date',   type: 'date' },
      { id: 'child3PassportExpiry',         label: 'Passport Expiry',       type: 'date' },
      { id: 'child3PassportIssuingCountry', label: 'Passport Issuing Country', type: 'text' },
    ],
  },

  // ── Page 5 — Child 4 ─────────────────────────────────────────────────────────
  {
    id: 'child4',
    title: 'Child 4',
    fields: [
      { id: 'child4FirstName',              label: 'First Name',            type: 'text' },
      { id: 'child4LastName',               label: 'Last Name',             type: 'text' },
      { id: 'child4DateOfBirth',            label: 'Date of Birth',         type: 'date' },
      { id: 'child4PlaceOfBirth',           label: 'Place of Birth',        type: 'text' },
      { id: 'child4Citizenship',            label: 'Citizenship',           type: 'text' },
      { id: 'child4PassportNumber',         label: 'Passport Number',       type: 'text' },
      { id: 'child4PassportIssueDate',      label: 'Passport Issue Date',   type: 'date' },
      { id: 'child4PassportExpiry',         label: 'Passport Expiry',       type: 'date' },
      { id: 'child4PassportIssuingCountry', label: 'Passport Issuing Country', type: 'text' },
    ],
  },
];
