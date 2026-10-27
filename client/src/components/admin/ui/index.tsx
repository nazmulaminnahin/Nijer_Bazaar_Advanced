import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export {
  Button, LinkButton, Input, Select, Textarea, Switch, Checkbox, Card, CardHeader, Badge,
  Spinner, Skeleton, EmptyState, ErrorState, SmartImage, Modal, ConfirmDialog, Table, Thead,
  Tbody, Pagination, StatCard, Tabs, DataRow,
} from '@/components/ui';

/** Table header cell used across every admin table. */
export function Th({ children, className, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500', className)}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-gray-100 px-3 py-2.5 text-sm text-ink-700', className)} {...rest}>
      {children}
    </td>
  );
}

/** Full-panel loading state. */
export function PageSpinner({ label = 'লোড হচ্ছে…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-gray-500">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Filter/search bar wrapper. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-3 flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function Section({ title, subtitle, actions, children, className }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn('card p-4', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
