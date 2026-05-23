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

export const FORM_SECTIONS: SectionConfig[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    fields: [
      { id: 'firstName',      label: 'First Name',       type: 'text',   placeholder: 'As on passport',  required: true  },
      { id: 'lastName',       label: 'Last Name',        type: 'text',   placeholder: 'As on passport',  required: true  },
      { id: 'dateOfBirth',    label: 'Date of Birth',    type: 'date',   required: true  },
      { id: 'gender',         label: 'Gender',           type: 'select', required: false,
        options: [
          { value: '',   label: 'Select gender' },
          { value: 'M',  label: 'Male'           },
          { value: 'F',  label: 'Female'         },
          { value: 'X',  label: 'Non-binary / Other' },
        ],
      },
      { id: 'nationality',    label: 'Nationality',      type: 'text',   placeholder: 'e.g. Canadian' },
      { id: 'placeOfBirth',   label: 'Place of Birth',   type: 'text',   placeholder: 'City, Country'  },
      { id: 'countryOfBirth', label: 'Country of Birth', type: 'text',   placeholder: 'e.g. Canada'    },
    ],
  },
  {
    id: 'passport',
    title: 'Passport Details',
    fields: [
      { id: 'passportNumber',         label: 'Passport Number',         type: 'text', placeholder: 'e.g. AB123456' },
      { id: 'passportExpiry',         label: 'Passport Expiry Date',    type: 'date' },
      { id: 'passportIssuingCountry', label: 'Passport Issuing Country',type: 'text', placeholder: 'e.g. Canada'  },
    ],
  },
  {
    id: 'visa',
    title: 'Visa Information',
    fields: [
      { id: 'visaNumber',         label: 'Visa Number',         type: 'text', placeholder: 'e.g. V123456'    },
      { id: 'visaType',           label: 'Visa Type',           type: 'text', placeholder: 'e.g. Study, Work' },
      { id: 'visaExpiry',         label: 'Visa Expiry Date',    type: 'date' },
      { id: 'visaIssuingCountry', label: 'Visa Issuing Country',type: 'text', placeholder: 'e.g. Canada'     },
    ],
  },
  {
    id: 'contact',
    title: 'Contact Information',
    fields: [
      { id: 'address',    label: 'Street Address', type: 'text',  placeholder: '123 Main Street',     required: true },
      { id: 'city',       label: 'City',           type: 'text',  placeholder: 'e.g. Toronto',        required: true },
      { id: 'province',   label: 'Province / State',type: 'text', placeholder: 'e.g. Ontario, ON'               },
      { id: 'postalCode', label: 'Postal / ZIP Code',type: 'text',placeholder: 'e.g. M5V 3A8'                   },
      { id: 'phone',      label: 'Phone Number',   type: 'tel',   placeholder: '+1 (416) 555-0100',   required: true },
      { id: 'email',      label: 'Email Address',  type: 'email', placeholder: 'you@example.com',     required: true },
    ],
  },
  {
    id: 'license',
    title: "Driver's License",
    fields: [
      { id: 'licenseNumber', label: 'License Number',      type: 'text', placeholder: 'e.g. L1234-56789' },
      { id: 'licenseExpiry', label: 'License Expiry Date', type: 'date' },
    ],
  },
  {
    id: 'employment',
    title: 'Employment Details',
    fields: [
      { id: 'employerName',        label: 'Employer Name',        type: 'text', placeholder: 'Company name'    },
      { id: 'jobTitle',            label: 'Job Title',            type: 'text', placeholder: 'e.g. Engineer'   },
      { id: 'salary',              label: 'Annual Salary',        type: 'text', placeholder: 'e.g. $75,000 CAD'},
      { id: 'employmentStartDate', label: 'Employment Start Date',type: 'date' },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    fields: [
      { id: 'institution',    label: 'Institution Name',  type: 'text', placeholder: 'e.g. University of Toronto' },
      { id: 'degree',         label: 'Degree / Certificate',type: 'text',placeholder: 'e.g. Bachelor of Science'  },
      { id: 'graduationDate', label: 'Graduation Date',   type: 'date' },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Information',
    fields: [
      { id: 'bankName', label: 'Bank Name', type: 'text', placeholder: 'e.g. TD Bank' },
    ],
  },
  {
    id: 'family',
    title: 'Marital Status & Family',
    fields: [
      { id: 'maritalStatus', label: 'Marital Status', type: 'select',
        options: [
          { value: '',         label: 'Select status'   },
          { value: 'single',   label: 'Single'          },
          { value: 'married',  label: 'Married'         },
          { value: 'divorced', label: 'Divorced'        },
          { value: 'widowed',  label: 'Widowed'         },
          { value: 'separated',label: 'Separated'       },
          { value: 'other',    label: 'Other'           },
        ],
      },
      { id: 'spouseName',       label: 'Spouse Full Name',    type: 'text', placeholder: 'If married' },
      { id: 'marriageDate',     label: 'Marriage Date',       type: 'date' },
      { id: 'marriageLocation', label: 'Marriage Location',   type: 'text', placeholder: 'City, Country' },
    ],
  },
];
