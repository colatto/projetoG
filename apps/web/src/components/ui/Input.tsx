import React, { InputHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id || reactId;

    return (
      <div className="form-group w-full">
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
          </label>
        )}
        <input id={inputId} ref={ref} className={cn('form-input', className)} {...props} />
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
