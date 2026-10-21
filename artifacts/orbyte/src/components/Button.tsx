import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'wouter';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  ghost: 'text-accent hover:bg-accent/10',
  danger: 'border border-shortfall/40 bg-surface text-shortfall hover:bg-shortfall/10',
};

const BASE = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-input px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string; // renders a link that looks like a button
  children: ReactNode;
}

export function Button({ variant = 'primary', href, className = '', children, type = 'button', ...rest }: Props) {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
