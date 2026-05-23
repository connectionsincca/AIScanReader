import { useApp } from '../context/AppContext';
import type { FieldConfig } from '../config/formFields';
import type { FormData } from '../types';

interface Props {
  field: FieldConfig;
}

export default function FormField({ field }: Props) {
  const { state, setFormField } = useApp();
  const value   = (state.formData[field.id] as string) ?? '';
  const meta    = state.fieldMeta[field.id];
  const isAI    = meta?.aiPopulated === true;
  const lowConf = isAI && meta.confidence < 0.65;

  const inputClass = [
    'field-input',
    isAI && !lowConf ? 'ai-filled' : '',
    lowConf           ? 'low-confidence' : '',
  ].filter(Boolean).join(' ');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormField(field.id as keyof FormData, e.target.value);
  };

  return (
    <div className="flex flex-col gap-0.5">
      {/* Label row */}
      <div className="flex items-center gap-1.5">
        <label htmlFor={field.id} className="field-label mb-0">
          {field.label}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {isAI && !lowConf && (
          <span
            title={`Auto-filled from ${meta?.sourceDocument ?? 'document'} (${Math.round((meta?.confidence ?? 0) * 100)}% confidence)`}
            className="flex items-center gap-0.5 text-xs text-green-600 font-medium ml-auto"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            AI filled
          </span>
        )}
        {lowConf && (
          <span
            title="Low confidence — please verify this value"
            className="flex items-center gap-0.5 text-xs text-amber-600 font-medium ml-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            </svg>
            Please verify
          </span>
        )}
      </div>

      {/* Input */}
      {field.type === 'select' ? (
        <select
          id={field.id}
          value={value}
          onChange={handleChange}
          className={inputClass}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          id={field.id}
          type={field.type}
          value={value}
          onChange={handleChange}
          placeholder={field.placeholder}
          className={inputClass}
          autoComplete="off"
        />
      )}
    </div>
  );
}
