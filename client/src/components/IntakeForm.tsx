import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { FormData } from '../types';

// ─── Types for complex table entries ──────────────────────────────────────────

interface EduEntry {
  institution: string;
  fieldOfStudy: string;
  certificate: string;
  startDate: string;
  endDate: string;
  hrsPerWeek: string;
  cityCountry: string;
}

interface WorkEntry {
  employer: string;
  jobTitle: string;
  jobType: string;
  salary: string;
  startDate: string;
  endDate: string;
  cityCountry: string;
  responsibilities: string;
}

interface AddrRow {
  fromYear: string; fromMonth: string;
  toYear: string; toMonth: string;
  address: string;
  ownership: string;
  cityCountry: string;
  activity: string;
}

interface PersonRow {
  familyName: string; givenNames: string; dob: string;
  placeOfBirth: string; countryOfResidence: string;
  citizenship: string; emailPhone: string;
  maritalStatus: string; dateOfMarriage: string;
  passportInfo: string; address: string;
  nativeLang: string; occupation: string;
}

const emptyPerson = (): PersonRow => ({
  familyName: '', givenNames: '', dob: '',
  placeOfBirth: '', countryOfResidence: '',
  citizenship: '', emailPhone: '',
  maritalStatus: '', dateOfMarriage: '',
  passportInfo: '', address: '',
  nativeLang: '', occupation: '',
});

// ─── Required fields ───────────────────────────────────────────────────────────

const BASE_REQUIRED: Array<keyof FormData> = [
  // Identity & passport
  'firstName', 'lastName',
  'passportNumber', 'passportIssuingCountry', 'passportIssueDate', 'passportExpiry',
  'dateOfBirth', 'cityOfBirth', 'countryOfBirth', 'citizenship',
  // Contact & address
  'currentAddress', 'countryOfResidence',
  'phone', 'email',
  // Physical
  'eyeColor', 'height',
  // Status
  'maritalStatus',
  'nativeLanguage', 'currentOccupation', 'numberOfChildren',
  // Education summary
  'highestEducationCanadian', 'totalYearsEducation',
  // Yes/No flags — all mandatory (user must answer)
  'deportedFlag', 'irccAppliedBefore', 'pnpAppliedBefore', 'hasRelativeInCanada',
];

// ─── Page wrapper component ────────────────────────────────────────────────────

function Page({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="relative">
      <p className="text-xs text-center text-gray-400 mb-1 font-mono">PAGE {num} OF 7</p>
      <div className="bg-white border border-gray-300 shadow-sm p-5 relative overflow-x-auto mb-6">
        {children}
        <div className="absolute bottom-2 right-3 bg-orange-600 text-white text-xs font-bold w-6 h-6 rounded flex items-center justify-center">
          {num}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1B3A6B] text-white font-semibold text-xs px-2 py-1 my-2">
      {children}
    </div>
  );
}

// ─── Main IntakeForm ──────────────────────────────────────────────────────────

export default function IntakeForm() {
  const { state, setFormField, travelers } = useApp();
  const { formData, fieldMeta, submitAttempted } = state;

  // ── Local state for address, siblings, parents ──────────────────────────────

  const [addrRows, setAddrRows] = useState<AddrRow[]>([
    { fromYear: '', fromMonth: '', toYear: '', toMonth: '', address: '', ownership: '', cityCountry: '', activity: '' },
  ]);

  const [siblingRows, setSiblingRows] = useState<PersonRow[]>(
    Array(5).fill(null).map(() => emptyPerson())
  );

  const [fatherRow, setFatherRow] = useState<PersonRow>(emptyPerson());
  const [motherRow, setMotherRow] = useState<PersonRow>(emptyPerson());
  const [spouseFatherRow, setSpouseFatherRow] = useState<PersonRow>(emptyPerson());
  const [spouseMotherRow, setSpouseMotherRow] = useState<PersonRow>(emptyPerson());

  const [ieltsRemarks, setIeltsRemarks] = useState('');
  const [celpipRemarks, setCelpipRemarks] = useState('');

  // ── Auto-fill address row 0 from address proof scan ────────────────────────
  useEffect(() => {
    const addr = formData.currentAddress?.trim();
    if (!addr) return;
    setAddrRows((prev) => {
      const updated = [...prev];
      updated[0] = { ...updated[0], address: addr };
      return updated;
    });
  }, [formData.currentAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync local state → formData so server PDF builder receives all data ─────
  useEffect(() => { setFormField('addressHistory',   JSON.stringify(addrRows));       }, [addrRows]);       // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('fatherInfo',        JSON.stringify(fatherRow));      }, [fatherRow]);      // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('motherInfo',        JSON.stringify(motherRow));      }, [motherRow]);      // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('spouseFatherInfo',  JSON.stringify(spouseFatherRow));}, [spouseFatherRow]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('spouseMotherInfo',  JSON.stringify(spouseMotherRow));}, [spouseMotherRow]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('siblingInfo',       JSON.stringify(siblingRows));    }, [siblingRows]);    // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('ieltsRemarks',   ieltsRemarks);  }, [ieltsRemarks]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('celpipRemarks',  celpipRemarks); }, [celpipRemarks]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFormField('travelersInfo', JSON.stringify(travelers)); }, [travelers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Required keys ───────────────────────────────────────────────────────────

  const requiredKeys = useMemo<Set<keyof FormData>>(() => {
    const s = new Set<keyof FormData>(BASE_REQUIRED);
    if (travelers.hasSpouse) {
      (['spouseLastName', 'spouseFirstName', 'spouseDateOfBirth', 'spousePassportNumber'] as Array<keyof FormData>).forEach((k) => s.add(k));
    }
    for (let i = 1; i <= travelers.childCount; i++) {
      ([`child${i}LastName`, `child${i}FirstName`, `child${i}DateOfBirth`, `child${i}PassportNumber`] as Array<keyof FormData>).forEach((k) => s.add(k));
    }
    if (formData.maritalStatus?.toLowerCase().includes('married')) {
      s.add('dateOfMarriage');
    }
    return s;
  }, [travelers, formData.maritalStatus]);

  const autoFilledCount = Object.values(fieldMeta).filter((m) => m?.aiPopulated).length;

  const missingLabels = submitAttempted
    ? [...requiredKeys].filter((k) => !formData[k]?.trim())
    : [];

  // ── Field input helper ──────────────────────────────────────────────────────

  const fi = (key: keyof FormData, type = 'text') => {
    const val = formData[key] ?? '';
    const meta = fieldMeta[key];
    const isReq = requiredKeys.has(key);
    const isEmpty = submitAttempted && isReq && !String(val).trim();
    return (
      <input
        type={type}
        value={val}
        onChange={(e) => setFormField(key, e.target.value)}
        className={`w-full bg-transparent text-[12px] outline-none ${
          isEmpty
            ? 'border-2 border-red-500 rounded px-1 py-0.5 placeholder:text-red-400'
            : 'border-b border-gray-300 py-0.5 focus:border-blue-400'
        } ${meta?.aiPopulated ? 'text-blue-900 font-medium' : 'text-gray-900'}`}
      />
    );
  };

  // ── Yes/No helper ───────────────────────────────────────────────────────────

  const yn = (key: keyof FormData) => {
    const v = formData[key] ?? '';
    const isReq  = requiredKeys.has(key);
    const isEmpty = submitAttempted && isReq && !v;
    return (
      <div className={`flex items-center justify-center gap-4 text-xs py-0.5 ${
        isEmpty ? 'border-2 border-red-500 rounded px-1' : ''
      }`}>
        {(['no', 'yes'] as const).map((opt) => (
          <label key={opt} className="flex flex-col items-center gap-0.5 cursor-pointer text-[11px] font-semibold">
            <input
              type="radio"
              name={key}
              value={opt}
              checked={v === opt}
              onChange={() => setFormField(key, opt)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            {opt.toUpperCase()}
          </label>
        ))}
      </div>
    );
  };

  // ── Parent / sibling validation helpers ────────────────────────────────────

  // All PersonRow fields except familyName and passportInfo are mandatory for parents
  const PARENT_REQUIRED_KEYS: Array<keyof PersonRow> = [
    'givenNames', 'dob', 'placeOfBirth', 'countryOfResidence',
    'citizenship', 'emailPhone', 'maritalStatus', 'dateOfMarriage',
    'address', 'nativeLang', 'occupation',
  ];

  // familyName is optional for siblings; all others required when givenNames is filled
  const SIBLING_REQUIRED_KEYS: Array<keyof PersonRow> = [
    'givenNames', 'dob', 'placeOfBirth', 'countryOfResidence',
    'citizenship', 'emailPhone', 'maritalStatus', 'dateOfMarriage',
    'address', 'nativeLang', 'occupation',
  ];

  const parentErr = (row: PersonRow, key: keyof PersonRow): boolean =>
    submitAttempted && PARENT_REQUIRED_KEYS.includes(key) && !row[key]?.trim();

  const siblingErr = (row: PersonRow, key: keyof PersonRow): boolean =>
    submitAttempted && !!row.givenNames?.trim() && SIBLING_REQUIRED_KEYS.includes(key) && !row[key]?.trim();

  const personInputCls = (isErr: boolean) =>
    `w-full bg-transparent text-[11px] outline-none ${
      isErr ? 'border-2 border-red-500 rounded px-0.5' : 'border-b border-gray-300'
    }`;

  // ── Cell wrappers ───────────────────────────────────────────────────────────

  const lbl = (text: string, colSpan = 1) => (
    <td
      colSpan={colSpan}
      className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 whitespace-nowrap text-[12px]"
      style={{ minWidth: 140 }}
    >
      {text}
    </td>
  );

  function valTd(bgCls: string, colSpan = 1, children?: React.ReactNode) {
    return (
      <td colSpan={colSpan} className={`border border-gray-400 px-1.5 py-0.5 min-h-[22px] relative ${bgCls}`}>
        {children}
      </td>
    );
  }

  // ── Education helpers ───────────────────────────────────────────────────────

  const parseEdu = (): EduEntry[] => {
    try { return JSON.parse(formData.educationHistory ?? '[]') as EduEntry[]; }
    catch { return []; }
  };

  const saveEdu = (entries: EduEntry[]) => setFormField('educationHistory', JSON.stringify(entries));

  const updateEduEntry = (i: number, field: keyof EduEntry, value: string) => {
    const entries = parseEdu();
    while (entries.length <= i) entries.push({ institution: '', fieldOfStudy: '', certificate: '', startDate: '', endDate: '', hrsPerWeek: '', cityCountry: '' });
    entries[i] = { ...entries[i], [field]: value };
    saveEdu(entries);
  };

  const addEduRow = () => {
    const entries = parseEdu();
    entries.push({ institution: '', fieldOfStudy: '', certificate: '', startDate: '', endDate: '', hrsPerWeek: '', cityCountry: '' });
    saveEdu(entries);
  };

  const deleteEduRow = (idx: number) => {
    const entries = parseEdu();
    entries.splice(idx, 1);
    saveEdu(entries);
  };

  const renderEduRows = () =>
    parseEdu().map((e, i) => (
      <tr key={i}>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50">
          <input value={e.startDate} onChange={(ev) => updateEduEntry(i, 'startDate', ev.target.value)}
            className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" placeholder="YYYY/MM" />
        </td>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50">
          <input value={e.endDate} onChange={(ev) => updateEduEntry(i, 'endDate', ev.target.value)}
            className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" placeholder="YYYY/MM" />
        </td>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50">
          <input value={e.institution} onChange={(ev) => updateEduEntry(i, 'institution', ev.target.value)}
            className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
        </td>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50">
          <input value={e.hrsPerWeek} onChange={(ev) => updateEduEntry(i, 'hrsPerWeek', ev.target.value)}
            className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
        </td>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50">
          <input value={e.fieldOfStudy} onChange={(ev) => updateEduEntry(i, 'fieldOfStudy', ev.target.value)}
            className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
        </td>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50">
          <input value={e.cityCountry} onChange={(ev) => updateEduEntry(i, 'cityCountry', ev.target.value)}
            className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
        </td>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50">
          <input value={e.certificate} onChange={(ev) => updateEduEntry(i, 'certificate', ev.target.value)}
            className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
        </td>
        <td className="border border-gray-400 px-1 py-0.5 bg-pink-50 text-center">
          <button onClick={() => deleteEduRow(i)} title="Remove row"
            className="text-red-400 hover:text-red-600 font-bold text-sm leading-none">×</button>
        </td>
      </tr>
    ));

  // ── Work history helpers ────────────────────────────────────────────────────

  const parseWork = (): WorkEntry[] => {
    try { return JSON.parse(formData.workHistory ?? '[]') as WorkEntry[]; }
    catch { return []; }
  };

  const saveWork = (entries: WorkEntry[]) => setFormField('workHistory', JSON.stringify(entries));

  const updateWorkEntry = (i: number, field: keyof WorkEntry, value: string) => {
    const entries = parseWork();
    while (entries.length <= i) entries.push({ employer: '', jobTitle: '', jobType: '', salary: '', startDate: '', endDate: '', cityCountry: '', responsibilities: '' });
    entries[i] = { ...entries[i], [field]: value };
    saveWork(entries);
  };

  const addWorkRow = () => {
    const entries = parseWork();
    entries.push({ employer: '', jobTitle: '', jobType: '', salary: '', startDate: '', endDate: '', cityCountry: '', responsibilities: '' });
    saveWork(entries);
  };

  const renderWorkRows = () => {
    const entries = [...parseWork()].sort((a, b) => (b.startDate > a.startDate ? 1 : -1));
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      // Gap detection
      if (i > 0) {
        const prevEnd = entries[i - 1].endDate;
        const curStart = e.startDate;
        if (prevEnd && curStart) {
          const gapMs = new Date(curStart).getTime() - new Date(prevEnd).getTime();
          if (gapMs > 30 * 24 * 60 * 60 * 1000) {
            rows.push(
              <tr key={`gap-${i}`}>
                <td colSpan={8} className="border border-dashed border-amber-400 bg-amber-50 text-amber-800 text-center text-[10px] italic py-1">
                  ⚠ Gap detected between {prevEnd} and {curStart}
                </td>
              </tr>
            );
          }
        }
      }
      rows.push(
        <tr key={i}>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.startDate} onChange={(ev) => updateWorkEntry(i, 'startDate', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" placeholder="YYYY/MM" />
          </td>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.endDate} onChange={(ev) => updateWorkEntry(i, 'endDate', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" placeholder="YYYY/MM or Present" />
          </td>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.employer} onChange={(ev) => updateWorkEntry(i, 'employer', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
          </td>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.jobTitle} onChange={(ev) => updateWorkEntry(i, 'jobTitle', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
          </td>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.jobType} onChange={(ev) => updateWorkEntry(i, 'jobType', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
          </td>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.salary} onChange={(ev) => updateWorkEntry(i, 'salary', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
          </td>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.cityCountry} onChange={(ev) => updateWorkEntry(i, 'cityCountry', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
          </td>
          <td className="border border-gray-400 px-1 py-0.5 bg-green-50">
            <input value={e.responsibilities} onChange={(ev) => updateWorkEntry(i, 'responsibilities', ev.target.value)}
              className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
          </td>
        </tr>
      );
    }
    return rows;
  };

  // ── Person matrix helpers ───────────────────────────────────────────────────

  const personAttrs = [
    'Family Name / Surname',
    'Given Names',
    'Date of Birth',
    'Place of Birth',
    'Country of Residence',
    'Citizenship / Nationality',
    'Email / Telephone',
    'Marital Status',
    'Date of Marriage',
    'Passport No. / Country',
    'Current Address',
    'Native Language',
    'Current Occupation',
  ];

  // Applicant values for person matrix
  const applicantPersonValues = [
    <span className="text-blue-900 font-medium text-[11px]">{formData.lastName ?? ''}</span>,
    <span className="text-blue-900 font-medium text-[11px]">{formData.firstName ?? ''}</span>,
    <span className="text-blue-900 font-medium text-[11px]">{formData.dateOfBirth ?? ''}</span>,
    <span className="text-blue-900 font-medium text-[11px]">{formData.cityOfBirth ?? ''}</span>,
    fi('countryOfResidence'),
    <span className="text-blue-900 font-medium text-[11px]">{formData.citizenship ?? ''}</span>,
    fi('phone'),
    fi('maritalStatus'),
    fi('dateOfMarriage'),
    <span className="text-blue-900 font-medium text-[11px]">{formData.passportNumber ?? ''} / {formData.passportIssuingCountry ?? ''}</span>,
    fi('currentAddress'),
    fi('nativeLanguage'),
    fi('currentOccupation'),
  ];

  const spousePersonValues = travelers.hasSpouse ? [
    <span className="text-amber-900 font-medium text-[11px]">{formData.spouseLastName ?? ''}</span>,
    <span className="text-amber-900 font-medium text-[11px]">{formData.spouseFirstName ?? ''}</span>,
    <span className="text-amber-900 font-medium text-[11px]">{formData.spouseDateOfBirth ?? ''}</span>,
    <span className="text-amber-900 font-medium text-[11px]">{formData.spousePlaceOfBirth ?? ''}</span>,
    <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
    <span className="text-amber-900 font-medium text-[11px]">{formData.spouseCitizenship ?? ''}</span>,
    <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
    <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
    <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
    <span className="text-amber-900 font-medium text-[11px]">{formData.spousePassportNumber ?? ''} / {formData.spousePassportIssuingCountry ?? ''}</span>,
    <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
    <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
    <span className="text-amber-900 font-medium text-[11px]">{formData.spouseCurrentOccupation ?? ''}</span>,
  ] : null;

  function childPersonValues(n: number): React.ReactNode[] {
    const prefix = `child${n}` as 'child1' | 'child2' | 'child3' | 'child4';
    return [
      <span className="text-amber-900 font-medium text-[11px]">{formData[`${prefix}LastName` as keyof FormData] ?? ''}</span>,
      <span className="text-amber-900 font-medium text-[11px]">{formData[`${prefix}FirstName` as keyof FormData] ?? ''}</span>,
      <span className="text-amber-900 font-medium text-[11px]">{formData[`${prefix}DateOfBirth` as keyof FormData] ?? ''}</span>,
      <span className="text-amber-900 font-medium text-[11px]">{formData[`${prefix}PlaceOfBirth` as keyof FormData] ?? ''}</span>,
      <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
      <span className="text-amber-900 font-medium text-[11px]">{formData[`${prefix}Citizenship` as keyof FormData] ?? ''}</span>,
      <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
      <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
      <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
      <span className="text-amber-900 font-medium text-[11px]">{formData[`${prefix}PassportNumber` as keyof FormData] ?? ''} / {formData[`${prefix}PassportIssuingCountry` as keyof FormData] ?? ''}</span>,
      <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
      <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
      <input value={''} readOnly className="w-full bg-transparent text-[11px] border-b border-gray-300" />,
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <section className="card p-5 sm:p-6 fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Tanon Immigration — Detailed Information Sheet</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and complete all fields below. Auto-filled fields are highlighted in blue.
          </p>
        </div>
      </div>

      {/* Auto-filled banner */}
      {autoFilledCount > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800">
          <strong>{autoFilledCount} field{autoFilledCount !== 1 ? 's' : ''}</strong> automatically filled from your scanned documents. Review for accuracy.
        </div>
      )}

      {/* Missing fields banner */}
      {submitAttempted && missingLabels.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <strong>{missingLabels.length} required field{missingLabels.length > 1 ? 's' : ''} need attention</strong> — scroll down to fields with red borders.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 1 — Detailed Information Sheet                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Page num={1}>
        <h2 className="font-serif text-base font-bold uppercase tracking-wide border-b-2 border-gray-900 pb-1 mb-3 text-center">
          Tanon Immigration — Detailed Information Sheet
        </h2>

        <table className="w-full border-collapse text-[12px] mb-3">
          <tbody>
            {/* Row 1 */}
            <tr>
              {lbl('Family Name / Surname')}
              {valTd('bg-blue-50', 1, fi('lastName'))}
              {lbl('Given Names')}
              {valTd('bg-blue-50', 1, fi('firstName'))}
            </tr>
            {/* Row 2 */}
            <tr>
              {lbl('Telephone Number')}
              {valTd('bg-slate-50', 1, fi('phone'))}
              {lbl('Email Address')}
              {valTd('bg-slate-50', 1, fi('email'))}
            </tr>
            {/* Row 3 */}
            <tr>
              {lbl('Passport Number')}
              {valTd('bg-blue-50', 1, fi('passportNumber'))}
              {lbl('Country of Issuance')}
              {valTd('bg-blue-50', 1, fi('passportIssuingCountry'))}
            </tr>
            {/* Row 4 */}
            <tr>
              {lbl('Passport Issue Date')}
              {valTd('bg-blue-50', 1, fi('passportIssueDate', 'date'))}
              {lbl('Passport Expiry Date')}
              {valTd('bg-blue-50', 1, fi('passportExpiry', 'date'))}
            </tr>
            {/* Row 5 */}
            <tr>
              {lbl('Current Address (Aadhar / DL / Passport / Rent Agmt)')}
              {valTd('bg-orange-50', 1, fi('currentAddress'))}
              {lbl('Country of Residence (city and country)')}
              {valTd('bg-slate-50', 1, fi('countryOfResidence'))}
            </tr>
            {/* Row 6 */}
            <tr>
              {lbl('City of Birth')}
              {valTd('bg-blue-50', 1, fi('cityOfBirth'))}
              {lbl('Country of Birth')}
              {valTd('bg-blue-50', 1, fi('countryOfBirth'))}
            </tr>
            {/* Row 7 */}
            <tr>
              {lbl('Marital Status')}
              {valTd('bg-slate-50', 1, fi('maritalStatus'))}
              {lbl('Date of Marriage')}
              {valTd('bg-purple-50', 1, fi('dateOfMarriage', 'date'))}
            </tr>
            {/* Row 8 */}
            <tr>
              {lbl('Date of Birth')}
              {valTd('bg-blue-50', 1, fi('dateOfBirth', 'date'))}
              {lbl('Citizenship / Nationality')}
              {valTd('bg-blue-50', 1, fi('citizenship'))}
            </tr>
            {/* Row 9 */}
            <tr>
              {lbl('Eye Color')}
              {valTd('bg-slate-50', 1, fi('eyeColor'))}
              {lbl('Height')}
              {valTd('bg-slate-50', 1, fi('height'))}
            </tr>
            {/* Row 10 */}
            <tr>
              {lbl('Current Occupation')}
              {valTd('bg-green-50', 1, fi('currentOccupation'))}
              {lbl('Current Status in Canada')}
              {valTd('bg-slate-50', 1, fi('currentStatusInCanada'))}
            </tr>
            {/* Row 11 */}
            <tr>
              {lbl('Native Language')}
              {valTd('bg-slate-50', 1, fi('nativeLanguage'))}
              {lbl('Current Status Expiry')}
              {valTd('bg-slate-50', 1, fi('currentStatusExpiry', 'date'))}
            </tr>
            {/* Row 12 */}
            <tr>
              {lbl('Referred By')}
              {valTd('bg-slate-50', 1, fi('referredBy'))}
              {lbl('Number of Children')}
              {valTd('bg-slate-50', 1, fi('numberOfChildren'))}
            </tr>
            {/* Row 13 */}
            <tr>
              {lbl('Course Start Date')}
              {valTd('bg-slate-50', 1, fi('courseStartDate', 'date'))}
              {lbl('Course End Date')}
              {valTd('bg-slate-50', 1, fi('courseEndDate', 'date'))}
            </tr>
            {/* Row 14 — Entry category + UCI */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Initially Entered Canada as: Visitor / Refugee / Student / Worker — Please Provide Your UCI Number
              </td>
              {valTd('bg-slate-50', 1, fi('entryCategory'))}
              {valTd('bg-slate-50', 1, fi('uciNumber'))}
            </tr>
            {/* Row 15 — First entry date + port */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Date First Entered Canada and Port of Entry
              </td>
              {valTd('bg-slate-50', 1, fi('dateFirstEnteredCanada', 'date'))}
              {valTd('bg-slate-50', 1, fi('portOfEntry'))}
            </tr>
            {/* Row 16 — Deported */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Have you ever been Deported / Refused Visa / Refused Entry to any country?
              </td>
              {valTd('bg-slate-50', 1, yn('deportedFlag'))}
              {valTd('bg-slate-50', 1, <>
                <span className="text-[11px] text-gray-500">Provide Details: </span>
                {fi('deportedDetails')}
              </>)}
            </tr>
            {/* Row 17 — IRCC */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Have You Applied to IRCC before in past?
              </td>
              {valTd('bg-slate-50', 2, yn('irccAppliedBefore'))}
            </tr>
            {/* Row 18 — PNP */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Have You Applied to any PNP before in past?
              </td>
              {valTd('bg-slate-50', 2, yn('pnpAppliedBefore'))}
            </tr>
            {/* Row 19 — Relative in Canada */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Do you have any relative in Canada?
              </td>
              {valTd('bg-slate-50', 2, yn('hasRelativeInCanada'))}
            </tr>
            {/* Row 20 — Highest education */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Highest Education Completed (Canadian Equivalency)
              </td>
              {valTd('bg-slate-50', 2, fi('highestEducationCanadian'))}
            </tr>
            {/* Row 21 — Total years */}
            <tr>
              <td colSpan={2} className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Total Number of Years of Education including primary, secondary and post-secondary education
              </td>
              {valTd('bg-slate-50', 2, fi('totalYearsEducation'))}
            </tr>
          </tbody>
        </table>

        <SectionHeading>
          List all Educational Institutes attended — most recent first, no gaps. Source: Educational Degree Certificates
        </SectionHeading>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">From (YY/MM)</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">To (YY/MM)</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Name of Educational Institution</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">Yrs/hrs/week</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Field of Study</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">City and Country</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Certificate/Diploma</th>
              <th className="border border-gray-400 px-1 py-1 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {renderEduRows()}
          </tbody>
        </table>
        {parseEdu().length === 0 && (
          <p className="text-[11px] text-gray-400 italic mt-1">
            No entries yet — rows are added automatically when you scan education certificates, or click below to add manually.
          </p>
        )}
        <button
          onClick={addEduRow}
          className="mt-2 text-[11px] text-blue-600 underline hover:text-blue-800"
        >
          + Add education row
        </button>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 2 — Education continued + Language Tests                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Page num={2}>
        <h2 className="font-serif text-base font-bold uppercase tracking-wide border-b-2 border-gray-900 pb-1 mb-3">
          English Language Test Results
        </h2>

        <SectionHeading>English Language Test Results</SectionHeading>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Test</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">Date of Test</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">Date of Result</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Listening</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Reading</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Writing</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Speaking</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">Overall Score</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {/* IELTS */}
            <tr>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50 font-semibold text-[11px]">
                IELTS
              </td>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50">{fi('ieltsTestDate', 'date')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50">{fi('ieltsResultDate', 'date')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50">{fi('ieltsListening')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50">{fi('ieltsReading')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50">{fi('ieltsWriting')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50">{fi('ieltsSpeaking')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-violet-50">{fi('ieltsOverall')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-slate-50">
                <input value={ieltsRemarks} onChange={(e) => setIeltsRemarks(e.target.value)}
                  className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
              </td>
            </tr>
            {/* CELPIP */}
            <tr>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50 font-semibold text-[11px]">
                CELPIP
              </td>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50">{fi('celpipTestDate', 'date')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50">{fi('celpipResultDate', 'date')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50">{fi('celpipListening')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50">{fi('celpipReading')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50">{fi('celpipWriting')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50">{fi('celpipSpeaking')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-sky-50">{fi('celpipOverall')}</td>
              <td className="border border-gray-400 px-1 py-0.5 bg-slate-50">
                <input value={celpipRemarks} onChange={(e) => setCelpipRemarks(e.target.value)}
                  className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
              </td>
            </tr>
          </tbody>
        </table>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 3 — Employment History                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Page num={3}>
        <h2 className="font-serif text-base font-bold uppercase tracking-wide border-b-2 border-gray-900 pb-1 mb-3">
          Employment History
        </h2>

        <SectionHeading>
          List all employment — most recent first, no gaps. Source: Work Experience Certificates
        </SectionHeading>

        <table className="w-full border-collapse text-[12px] mb-2">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">From</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">To</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Name of Employer</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">Job Title / NOC</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left whitespace-nowrap">Job Type</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Salary</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">City and Country</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold text-left">Responsibilities</th>
            </tr>
          </thead>
          <tbody>
            {renderWorkRows()}
          </tbody>
        </table>

        <button onClick={addWorkRow} className="mt-1 mb-3 text-[11px] text-blue-600 underline hover:text-blue-800">
          + Add employment record
        </button>

        <div className="mt-3 p-2 bg-blue-50 border border-blue-100 rounded text-[11px] text-blue-700">
          <strong>How this section works:</strong> Upload ALL employment letters in the Document Scanning step.
          Your job history is automatically extracted. You can edit any entry above.
          Sort order: most recent employment first. Gaps between jobs are flagged automatically.
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 4 — Address History                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Page num={4}>
        <h2 className="font-serif text-base font-bold uppercase tracking-wide border-b-2 border-gray-900 pb-1 mb-3">
          Address History
        </h2>

        <SectionHeading>
          List all addresses lived during last 10 years — most recent first, no gaps.
          Most recent address auto-filled from Address Proof scan; remaining entries: Manual.
        </SectionHeading>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold whitespace-nowrap">From (YY/MM)</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold whitespace-nowrap">To (YY/MM)</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold">Complete Address incl. Postal Code</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold whitespace-nowrap">Owned/Rented/Shared</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold">City and Country</th>
              <th className="border border-gray-400 px-1 py-1 text-[11px] font-semibold">Activity</th>
              <th className="border border-gray-400 px-1 py-1 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {addrRows.map((row, i) => (
              <tr key={i}>
                <td className="border border-gray-400 px-1 py-0.5 bg-orange-50">
                  <div className="flex gap-1">
                    <input value={row.fromYear} placeholder="YYYY"
                      onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], fromYear: e.target.value }; setAddrRows(r); }}
                      className="w-12 bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                    <span className="text-[11px]">/</span>
                    <input value={row.fromMonth} placeholder="MM"
                      onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], fromMonth: e.target.value }; setAddrRows(r); }}
                      className="w-8 bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                  </div>
                </td>
                <td className="border border-gray-400 px-1 py-0.5 bg-orange-50">
                  <div className="flex gap-1">
                    <input value={row.toYear} placeholder="YYYY"
                      onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], toYear: e.target.value }; setAddrRows(r); }}
                      className="w-12 bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                    <span className="text-[11px]">/</span>
                    <input value={row.toMonth} placeholder="MM"
                      onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], toMonth: e.target.value }; setAddrRows(r); }}
                      className="w-8 bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                  </div>
                </td>
                <td className="border border-gray-400 px-1 py-0.5 bg-orange-50">
                  <input value={row.address}
                    onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], address: e.target.value }; setAddrRows(r); }}
                    className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                </td>
                <td className="border border-gray-400 px-1 py-0.5 bg-orange-50">
                  <input value={row.ownership}
                    onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], ownership: e.target.value }; setAddrRows(r); }}
                    className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                </td>
                <td className="border border-gray-400 px-1 py-0.5 bg-orange-50">
                  <input value={row.cityCountry}
                    onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], cityCountry: e.target.value }; setAddrRows(r); }}
                    className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                </td>
                <td className="border border-gray-400 px-1 py-0.5 bg-orange-50">
                  <input value={row.activity}
                    onChange={(e) => { const r = [...addrRows]; r[i] = { ...r[i], activity: e.target.value }; setAddrRows(r); }}
                    className="w-full bg-transparent text-[11px] border-b border-gray-300 outline-none" />
                </td>
                <td className="border border-gray-400 px-1 py-0.5 bg-orange-50 text-center">
                  {addrRows.length > 1 && (
                    <button
                      onClick={() => setAddrRows((r) => r.filter((_, idx) => idx !== i))}
                      title="Remove row"
                      className="text-red-400 hover:text-red-600 font-bold text-sm leading-none"
                    >×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={() => setAddrRows((r) => [...r, { fromYear: '', fromMonth: '', toYear: '', toMonth: '', address: '', ownership: '', cityCountry: '', activity: '' }])}
          className="mt-2 text-[11px] text-blue-600 underline hover:text-blue-800"
        >
          + Add address row
        </button>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 5 — Details of Children and Spouse                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Page num={5}>
        <h2 className="font-serif text-base font-bold uppercase tracking-wide border-b-2 border-gray-900 pb-1 mb-3 text-center">
          Details of Children and Spouse
        </h2>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="border border-gray-400 bg-gray-100 px-1.5 py-1 text-[11px] font-semibold text-left" style={{ minWidth: 140 }}>
                Attribute
              </th>
              <th className="border border-gray-400 bg-blue-100 text-blue-700 px-1.5 py-1 text-[11px] font-semibold text-center">
                Applicant
              </th>
              {travelers.hasSpouse && (
                <th className="border border-gray-400 bg-amber-100 text-amber-700 px-1.5 py-1 text-[11px] font-semibold text-center">
                  Spouse / Partner
                </th>
              )}
              {Array.from({ length: travelers.childCount }, (_, i) => (
                <th key={i} className="border border-gray-400 bg-amber-100 text-amber-700 px-1.5 py-1 text-[11px] font-semibold text-center">
                  Son/Daughter {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personAttrs.map((attr, ai) => (
              <tr key={ai}>
                <td className="border border-gray-400 bg-gray-100 px-1.5 py-1 text-[12px] font-semibold text-gray-700 whitespace-nowrap">
                  {attr}
                </td>
                <td className="border border-gray-400 px-1.5 py-0.5 bg-blue-50">
                  {applicantPersonValues[ai]}
                </td>
                {travelers.hasSpouse && spousePersonValues && (
                  <td className="border border-gray-400 px-1.5 py-0.5 bg-amber-50">
                    {spousePersonValues[ai]}
                  </td>
                )}
                {Array.from({ length: travelers.childCount }, (_, ci) => (
                  <td key={ci} className="border border-gray-400 px-1.5 py-0.5 bg-amber-50">
                    {childPersonValues(ci + 1)[ai]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 6 — Details of Brothers and Sisters                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Page num={6}>
        <h2 className="font-serif text-base font-bold uppercase tracking-wide border-b-2 border-gray-900 pb-1 mb-3 text-center">
          Details of Brothers and Sisters
        </h2>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="border border-gray-400 bg-gray-100 px-1.5 py-1 text-[11px] font-semibold text-left" style={{ minWidth: 140 }}>
                Attribute
              </th>
              <th className="border border-gray-400 bg-blue-100 text-blue-700 px-1.5 py-1 text-[11px] font-semibold text-center">
                Applicant
              </th>
              {[1, 2, 3, 4, 5].map((n) => (
                <th key={n} className="border border-gray-400 bg-gray-100 text-gray-600 px-1.5 py-1 text-[11px] font-semibold text-center">
                  Brother/Sister {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personAttrs.filter((_, i) => i !== 9 /* skip passport row */).map((attr, ai) => {
              // Map filtered index back to full index
              const fullIdx = ai < 9 ? ai : ai + 1;
              return (
                <tr key={ai}>
                  <td className="border border-gray-400 bg-gray-100 px-1.5 py-1 text-[12px] font-semibold text-gray-700 whitespace-nowrap">
                    {attr}
                  </td>
                  <td className="border border-gray-400 px-1.5 py-0.5 bg-blue-50">
                    {applicantPersonValues[fullIdx]}
                  </td>
                  {[0, 1, 2, 3, 4].map((si) => {
                    const row = siblingRows[si];
                    const sibKey = ['familyName', 'givenNames', 'dob', 'placeOfBirth', 'countryOfResidence', 'citizenship', 'emailPhone', 'maritalStatus', 'dateOfMarriage', 'address', 'nativeLang', 'occupation'][ai] as keyof PersonRow;
                    const isErr = siblingErr(row, sibKey);
                    return (
                      <td key={si} className="border border-gray-400 px-1.5 py-0.5 bg-gray-50">
                        <input
                          value={row[sibKey] ?? ''}
                          onChange={(e) => {
                            const updated = [...siblingRows];
                            updated[si] = { ...updated[si], [sibKey]: e.target.value };
                            setSiblingRows(updated);
                          }}
                          className={personInputCls(isErr)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAGE 7 — Details of Parents + Canada Entry Dates                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Page num={7}>
        <h2 className="font-serif text-base font-bold uppercase tracking-wide border-b-2 border-gray-900 pb-1 mb-3 text-center">
          Details of Parents
        </h2>

        <table className="w-full border-collapse text-[12px] mb-4">
          <thead>
            <tr>
              <th className="border border-gray-400 bg-gray-100 px-1.5 py-1 text-[11px] font-semibold text-left" style={{ minWidth: 130 }}>
                Attribute
              </th>
              <th className="border border-gray-400 bg-blue-100 text-blue-700 px-1.5 py-1 text-[11px] font-semibold text-center">
                Applicant
              </th>
              <th className="border border-gray-400 bg-gray-100 text-gray-600 px-1.5 py-1 text-[11px] font-semibold text-center">
                Father
              </th>
              <th className="border border-gray-400 bg-gray-100 text-gray-600 px-1.5 py-1 text-[11px] font-semibold text-center">
                Mother
              </th>
              {travelers.hasSpouse && (
                <>
                  <th className="border border-gray-400 bg-amber-100 text-amber-700 px-1.5 py-1 text-[11px] font-semibold text-center">
                    Spouse
                  </th>
                  <th className="border border-gray-400 bg-gray-100 text-gray-600 px-1.5 py-1 text-[11px] font-semibold text-center">
                    Spouse's Father
                  </th>
                  <th className="border border-gray-400 bg-gray-100 text-gray-600 px-1.5 py-1 text-[11px] font-semibold text-center">
                    Spouse's Mother
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {personAttrs.map((attr, ai) => {
              const parentRowKey = ['familyName', 'givenNames', 'dob', 'placeOfBirth', 'countryOfResidence', 'citizenship', 'emailPhone', 'maritalStatus', 'dateOfMarriage', 'passportInfo', 'address', 'nativeLang', 'occupation'][ai] as keyof PersonRow;
              return (
                <tr key={ai}>
                  <td className="border border-gray-400 bg-gray-100 px-1.5 py-1 text-[12px] font-semibold text-gray-700 whitespace-nowrap">
                    {attr}
                  </td>
                  <td className="border border-gray-400 px-1.5 py-0.5 bg-blue-50">
                    {applicantPersonValues[ai]}
                  </td>
                  {/* Father */}
                  <td className="border border-gray-400 px-1.5 py-0.5 bg-gray-50">
                    <input value={fatherRow[parentRowKey] ?? ''}
                      onChange={(e) => setFatherRow((r) => ({ ...r, [parentRowKey]: e.target.value }))}
                      className={personInputCls(parentErr(fatherRow, parentRowKey))} />
                  </td>
                  {/* Mother */}
                  <td className="border border-gray-400 px-1.5 py-0.5 bg-gray-50">
                    <input value={motherRow[parentRowKey] ?? ''}
                      onChange={(e) => setMotherRow((r) => ({ ...r, [parentRowKey]: e.target.value }))}
                      className={personInputCls(parentErr(motherRow, parentRowKey))} />
                  </td>
                  {travelers.hasSpouse && (
                    <>
                      <td className="border border-gray-400 px-1.5 py-0.5 bg-amber-50">
                        {spousePersonValues ? spousePersonValues[ai] : null}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-0.5 bg-gray-50">
                        <input value={spouseFatherRow[parentRowKey] ?? ''}
                          onChange={(e) => setSpouseFatherRow((r) => ({ ...r, [parentRowKey]: e.target.value }))}
                          className={personInputCls(parentErr(spouseFatherRow, parentRowKey))} />
                      </td>
                      <td className="border border-gray-400 px-1.5 py-0.5 bg-gray-50">
                        <input value={spouseMotherRow[parentRowKey] ?? ''}
                          onChange={(e) => setSpouseMotherRow((r) => ({ ...r, [parentRowKey]: e.target.value }))}
                          className={personInputCls(parentErr(spouseMotherRow, parentRowKey))} />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Canada Entry Dates */}
        <SectionHeading>Canada Entry Dates</SectionHeading>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]" style={{ minWidth: 200 }}>
                Date of Entry in Canada
              </td>
              {valTd('bg-slate-50', 1, fi('dateEntryCanada', 'date'))}
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-semibold text-gray-700 px-1.5 py-1 text-[12px]">
                Date of Most Recent Entry in Canada
              </td>
              {valTd('bg-slate-50', 1, fi('dateRecentEntryCanada', 'date'))}
            </tr>
          </tbody>
        </table>
      </Page>
    </section>
  );
}
