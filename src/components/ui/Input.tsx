import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  icon,
  className = '',
  id,
  type = 'text',
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full flex flex-col items-start gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-clipo-text-primary tracking-wide"
        >
          {label}
        </label>
      )}
      <div className="relative w-full">
        {icon && (
          <div className="absolute inset-y-0 left-4 flex items-center justify-center pointer-events-none text-clipo-text-secondary">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          type={type}
          className={`
            w-full bg-[#FFFFFF] text-clipo-text-primary placeholder:text-[#9CA3AF]
            border ${error ? 'border-clipo-error focus:ring-clipo-error' : 'border-clipo-border focus:ring-[#111827]'}
            rounded-clipo-input text-sm px-4 ${icon ? 'pl-11' : 'pl-4'} py-3
            transition-all duration-200 outline-none
            focus:ring-2 focus:ring-opacity-10 focus:border-[#111827]
            disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:cursor-not-allowed
            shadow-soft-sm
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <span className="text-xs font-medium text-clipo-error flex items-center gap-1 animate-fade-in">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span className="text-xs text-clipo-text-secondary">{helperText}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
