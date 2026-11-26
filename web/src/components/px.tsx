import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ICONS, type IconName } from './icons';

export type { IconName };

const pathCache = new Map<string, { solid: string; half: string }>();
function paths(name: IconName) {
  let p = pathCache.get(name);
  if (!p) {
    let solid = '', half = '';
    ICONS[name].forEach((row, y) => [...row].forEach((c, x) => {
      const d = `M${x} ${y}h1v1h-1z`;
      if (c === '#') solid += d; else if (c === '+') half += d;
    }));
    p = { solid, half };
    pathCache.set(name, p);
  }
  return p;
}

export function PixelIcon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  const p = paths(name);
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} shapeRendering="crispEdges" fill="currentColor" aria-hidden className={className} style={{ flex: 'none' }}>
      <path d={p.solid} />
      {p.half && <path d={p.half} opacity=".5" />}
    </svg>
  );
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function Panel({ title, icon, actions, children, className, tone }: { title?: string; icon?: IconName; actions?: ReactNode; children?: ReactNode; className?: string; tone?: 'soft' }) {
  return (
    <section className={cx('px p-4', tone === 'soft' && 'px-soft', className)}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[11px] text-primary">{icon && <PixelIcon name={icon} size={18} />}{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'alt' | 'danger' | 'gold' | 'grass'; sm?: boolean; icon?: IconName };
export function Button({ variant, sm, icon, className, children, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={cx('px-btn', variant, sm && 'sm', className)} {...rest}>
      {icon && <PixelIcon name={icon} size={sm ? 14 : 16} />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="ml-1 text-sm text-muted">{label}</span>
      {children}
      {hint && !error && <span className="ml-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="ml-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}

export const Tag = ({ children, color, dark }: { children: ReactNode; color?: string; dark?: boolean }) => (
  <span className="px-tag" style={color ? ({ '--tag': color, '--tag-text': dark ? '#fff' : '#172b4d' } as React.CSSProperties) : undefined}>{children}</span>
);

export const Bar = ({ value, color, label }: { value: number; color?: string; label?: string }) => (
  <div className="px-bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, ['--c' as string]: color }} />
  </div>
);

export function Loading({ full }: { full?: boolean }) {
  return <div className={cx('grid place-items-center', full ? 'min-h-screen' : 'py-8')}><div className="loader" role="status" aria-label="Memuat" /></div>;
}

export function Empty({ icon = 'star', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 py-8 text-center">
      <PixelIcon name={icon} size={40} className="text-muted" />
      <p className="font-pixel text-[10px]">{title}</p>
      {hint && <p className="max-w-xs text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="px px-soft p-4 text-center" role="alert">
      <p className="mb-2 text-danger">{(error as Error)?.message ?? 'Terjadi kesalahan.'}</p>
      {retry && <Button sm variant="alt" onClick={retry}>Coba lagi</Button>}
    </div>
  );
}

export function PageHead({ title, icon, children }: { title: string; icon: IconName; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-3 text-sm text-primary sm:text-base"><PixelIcon name={icon} size={26} />{title}</h1>
      <div className="flex flex-wrap items-center">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="px-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cx('px pop my-auto w-full p-5', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[11px] text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="text-muted hover:text-text"><PixelIcon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, text, yes = 'Hapus', onYes, onClose }: { title: string; text: string; yes?: string; onYes: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-4">{text}</p>
      <div className="flex justify-end">
        <Button variant="alt" onClick={onClose}>Batal</Button>
        <Button variant="danger" onClick={() => { onYes(); onClose(); }}>{yes}</Button>
      </div>
    </Modal>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon?: IconName }[] }) {
  return (
    <div className="mb-4 flex flex-wrap" role="tablist">
      {items.map((i) => (
        <Button key={i.id} sm icon={i.icon} variant={value === i.id ? 'gold' : 'alt'} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)}>{i.label}</Button>
      ))}
    </div>
  );
}

export const SWATCHES = ['#3988D7', '#3FA86B', '#F2B63D', '#D94F4F', '#8A5CCF', '#E8803A', '#2BA6A6', '#C9588F'];
export function ColorPick({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Warna">
      {SWATCHES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)} className="h-7 w-7"
          style={{ background: c, boxShadow: `0 -3px 0 0 var(--line), 0 3px 0 0 var(--line), -3px 0 0 0 var(--line), 3px 0 0 0 var(--line)${value === c ? ', 0 0 0 7px var(--gold)' : ''}` }} />
      ))}
    </div>
  );
}

export const Check = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
  <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange} className="px-check">{checked && <PixelIcon name="check" size={18} />}</button>
);

// ---- Toast ----
type ToastKind = 'ok' | 'error';
const ToastCtx = createContext<{ toast: (msg: string, kind?: ToastKind) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const toast = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-20 right-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col gap-3 md:bottom-4" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={cx('px pop flex items-center gap-2 p-3', i.kind === 'error' && 'text-danger')}>
            <PixelIcon name={i.kind === 'error' ? 'x' : 'check'} size={16} />{i.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
