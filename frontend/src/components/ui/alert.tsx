import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const VARIANT_STYLES: Record<string, string> = {
  default: 'border border-gray-200 bg-white text-gray-900',
  destructive: 'border border-red-200 bg-red-50 text-red-700',
  success: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
  subtle: 'border border-gray-100 bg-gray-50 text-gray-700',
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof VARIANT_STYLES;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn('rounded-2xl px-4 py-3 text-sm shadow-sm', VARIANT_STYLES[variant], className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 text-base font-semibold', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm leading-relaxed text-gray-700', className)} {...props} />
  ),
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
