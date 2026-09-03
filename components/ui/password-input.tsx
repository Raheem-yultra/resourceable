'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Password field with a show/hide toggle.
 *
 * Every password box on the site was a bare `type="password"` with no way to see
 * what had been typed. That is a small annoyance for most people and a real
 * barrier for the audience this site is built around and by: anyone using a
 * screen magnifier, anyone with a motor impairment that makes typing error-prone,
 * anyone on a phone keyboard. "Invalid email or password" with no way to check
 * the password is a dead end you can only escape by resetting.
 *
 * Deliberately not `<button>` inside a form without `type="button"` — the default
 * is `submit`, and revealing your password would have submitted the form.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  invalid,
  className,
  required,
  'aria-describedby': describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  className?: string;
  required?: boolean;
  'aria-describedby'?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={[describedBy, hintId].filter(Boolean).join(' ') || undefined}
        required={required}
        className={cn('pl-10 pr-11', invalid && 'border-destructive', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // A 44px target inside a 40px field: absolute positioning keeps the tap
        // area honest without stretching the input itself.
        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
      <span id={hintId} className="sr-only">
        {visible ? 'Password is visible' : 'Password is hidden'}
      </span>
    </div>
  );
}
