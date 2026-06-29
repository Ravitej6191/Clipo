import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'pastel' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = "inline-flex items-center justify-center font-medium rounded-clipo-btn transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-gradient-to-br from-[#111827] to-[#7C3AED] text-white hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-[#7C3AED]",
    secondary: "bg-[#FFFFFF] text-clipo-text-primary border border-clipo-border hover:bg-[#F9FAFB] active:bg-[#F3F4F6] shadow-soft-sm",
    pastel: "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] active:bg-[#D1D5DB]",
    danger: "bg-clipo-error text-white hover:bg-[#DC2626] active:bg-[#B91C1C] focus-visible:outline-clipo-error",
    ghost: "text-clipo-text-secondary hover:text-clipo-text-primary hover:bg-[#F3F4F6] active:bg-[#E5E7EB] focus-visible:outline-clipo-text-primary"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs h-9",
    md: "px-4 py-2.5 text-sm h-11",
    lg: "px-6 py-3.5 text-base h-13"
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </>
      ) : children}
    </button>
  );
};
export default Button;
