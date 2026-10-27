import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2, SearchX, X, AlertTriangle, ImageOff } from 'lucide-react';

// ── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-300 shadow-sm',
  secondary: 'bg-ink-900 text-white hover:bg-black focus-visible:ring-gray-400',
  outline: 'border border-gray-300 bg-white text-ink-700 hover:bg-gray-50 focus-visible:ring-brand-200',
  ghost: 'text-ink-700 hover:bg-gray-100 focus-visible:ring-gray-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-brand-200',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-8 px-2.5 text-xs gap-1',
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ElementType;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});

export function LinkButton({
  to, variant = 'primary', size = 'md', className, children, icon: Icon, ...rest
}: { to: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: React.ReactNode; icon?: React.ElementType } & Omit<React.ComponentProps<typeof Link>, 'to' | 'className' | 'children'>) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2',
        VARIANTS[variant], SIZES[size], className
      )}
      {...rest}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </Link>
  );
}

// ── Form fields ──────────────────────────────────────────────────────────────
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  requiredMark?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, FieldProps>(function Input(
  { label, error, hint, requiredMark, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label">
          {label} {requiredMark && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn('field', error && 'field-error', className)}
        {...props}
      />
      {error ? <p id={`${inputId}-error`} className="help">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  requiredMark?: boolean;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, requiredMark, options, placeholder, className, id, ...props },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="label">
          {label} {requiredMark && <span className="text-red-500">*</span>}
        </label>
      )}
      <select ref={ref} id={selectId} className={cn('field pr-8', error && 'field-error', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error ? <p className="help">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
});

export function Textarea({
  label, error, hint, requiredMark, className, id, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string; requiredMark?: boolean }) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={areaId} className="label">
          {label} {requiredMark && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea id={areaId} className={cn('field min-h-[90px]', error && 'field-error', className)} {...props} />
      {error ? <p className="help">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; hint?: string; disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start gap-3', disabled && 'opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
          checked ? 'bg-brand-500' : 'bg-gray-300'
        )}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
      {(label || hint) && (
        <span className="select-none">
          {label && <span className="block text-sm font-medium text-ink-700">{label}</span>}
          {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-300"
      />
      <span>{label}</span>
    </label>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5', className)}>
      <div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, className, tone = 'gray' }: { children: React.ReactNode; className?: string; tone?: 'gray' | 'brand' | 'green' | 'red' | 'blue' | 'amber' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-10 text-sm text-gray-500', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
      {label ?? 'লোড হচ্ছে…'}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200/70', className)} />;
}

export function EmptyState({ title, description, action, icon: Icon = SearchX }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-base font-semibold text-ink-900">{title}</p>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500"><AlertTriangle className="h-6 w-6" /></div>
      <p className="text-sm text-gray-600">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>আবার চেষ্টা করুন</Button>}
    </div>
  );
}

/** Image with graceful fallback when a product photo is missing. */
export function SmartImage({ src, alt, className, fallbackClassName }: { src?: string | null; alt: string; className?: string; fallbackClassName?: string }) {
  const [failed, setFailed] = useState(false);
  // Empty strings (e.g. a category with no image) must not render a broken <img>.
  if (!src || !String(src).trim() || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-100 text-gray-300', className, fallbackClassName)}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true,
}: {
  open: boolean; onClose: () => void; title: React.ReactNode; description?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the panel so keyboard users land inside the dialog.
    setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[min(96vw,1400px)]' };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'}>
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]"
        onClick={() => closeOnBackdrop && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-pop outline-none animate-slide-up',
          'rounded-t-2xl sm:rounded-2xl',
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'নিশ্চিত করুন', cancelLabel = 'বাতিল', danger, loading, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: React.ReactNode; confirmLabel?: string; cancelLabel?: string;
  danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-gray-600">{message}</p>
    </Modal>
  );
}

// ── Table + pagination ───────────────────────────────────────────────────────
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-full border-collapse">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-gray-200 bg-gray-50/80">{children}</thead>;
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function Pagination({ page, totalPages, total, onChange, limit }: { page: number; totalPages: number; total?: number; limit?: number; onChange: (p: number) => void }) {
  if (!totalPages || totalPages <= 1) {
    return total != null ? <p className="px-4 py-3 text-xs text-gray-500">মোট {total} টি এন্ট্রি</p> : null;
  }
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = useMemo(() => Array.from({ length: Math.min(5, totalPages) }, (_, i) => windowStart + i).filter((p) => p <= totalPages), [windowStart, totalPages]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-500">
        {total != null ? `মোট ${total} টি · ` : ''}পৃষ্ঠা {page} / {totalPages}
        {limit ? ` · প্রতি পৃষ্ঠায় ${limit}` : ''}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="xs" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="আগের পৃষ্ঠা">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn('h-8 min-w-8 rounded-lg px-2 text-xs font-medium', p === page ? 'bg-brand-500 text-white' : 'text-ink-700 hover:bg-gray-100')}
          >
            {p}
          </button>
        ))}
        <Button variant="outline" size="xs" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="পরের পৃষ্ঠা">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Stat card (clickable dashboard cards) ───────────────────────────────────
export function StatCard({
  label, value, icon: Icon, hint, trend, to, onClick, tone = 'brand',
}: {
  label: string; value: React.ReactNode; icon: React.ElementType; hint?: React.ReactNode;
  trend?: number | null; to?: string; onClick?: () => void; tone?: 'brand' | 'green' | 'blue' | 'violet' | 'amber' | 'red';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold text-ink-900 tnum">{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {trend != null && (
            <span className={cn('text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
            </span>
          )}
          {hint && <span className="truncate text-xs text-gray-400">{hint}</span>}
        </div>
      </div>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );

  const classes = 'card block w-full p-4 text-left transition hover:border-brand-200 hover:shadow-pop focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300';
  if (to) return <Link to={to} className={classes}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={classes}>{body}</button>;
  return <div className="card p-4">{body}</div>;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('scrollbar-thin flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value ? 'bg-white text-ink-900 shadow-sm' : 'text-gray-600 hover:text-ink-900'
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs', value === tab.value ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Drawer-ish sections for admin detail views ──────────────────────────────
export function DataRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 py-1.5 text-sm', className)}>
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right font-medium text-ink-900">{children}</span>
    </div>
  );
}
