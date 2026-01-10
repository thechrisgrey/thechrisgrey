interface FormInputProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  hideLabel?: boolean;
  className?: string;
}

export const FormInput = ({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  required,
  hideLabel,
  className = ''
}: FormInputProps) => (
  <div className={`relative ${className}`}>
    <label
      htmlFor={id}
      className={hideLabel ? 'sr-only' : 'block text-sm font-medium text-altivum-silver mb-2'}
    >
      {label}
      {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={error ? true : undefined}
      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/70 focus:border-altivum-gold focus:outline-none transition-colors"
    />
    {error && (
      <p id={`${id}-error`} className="mt-1 text-sm text-red-400" role="alert">
        {error}
      </p>
    )}
  </div>
);
