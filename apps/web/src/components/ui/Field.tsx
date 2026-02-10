import { p } from "@/styles/theme";

/* ── Text Input ── */
type InputProps = {
  label: string;
  description?: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  suffix?: string;
};

export function InputField({
  label,
  description,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  suffix,
}: InputProps) {
  return (
    <label className="block">
      <span className={p.label}>{label}</span>
      {description && <span className={`block mt-1 ${p.caption}`}>{description}</span>}
      <div className="relative mt-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={p.input}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/* ── Textarea ── */
type TextareaProps = {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export function TextareaField({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 3,
}: TextareaProps) {
  return (
    <label className="block">
      <span className={p.label}>{label}</span>
      {description && <span className={`block mt-1 ${p.caption}`}>{description}</span>}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 ${p.textarea}`}
      />
    </label>
  );
}

/* ── Select ── */
type SelectProps = {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
};

export function SelectField({
  label,
  description,
  value,
  onChange,
  options,
  disabled,
}: SelectProps) {
  return (
    <label className="block">
      <span className={p.label}>{label}</span>
      {description && <span className={`block mt-1 ${p.caption}`}>{description}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`mt-2 ${p.select}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
