import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Button({ tone = 'secondary', compact = false, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' | 'ghost'; compact?: boolean }) {
  return <button className={`button button--${tone}${compact ? ' button--compact' : ''} ${className}`.trim()} {...props}>{children}</button>;
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`.trim()} {...props}>{children}</section>;
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: () => void }) {
  return <header className="page-header">
    <div className="page-header__title">
      {back ? <button className="icon-button page-header__back" onClick={back} aria-label="返回"><Icon name="back" /></button> : null}
      <div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
    </div>
    {actions ? <div className="page-header__actions">{actions}</div> : null}
  </header>;
}

export function Loading({ label = '正在读取数据' }: { label?: string }) {
  return <Card className="state-card"><span className="spinner"/><strong>{label}</strong></Card>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <Card className="state-card state-card--error"><Icon name="warning" size={24}/><div><strong>读取失败</strong><pre>{message}</pre></div>{retry ? <Button compact onClick={retry}>重试</Button> : null}</Card>;
}

export function EmptyState({ title = '暂无数据', description }: { title?: string; description?: string }) {
  return <div className="empty-state"><strong>{title}</strong>{description ? <span>{description}</span> : null}</div>;
}

export function Status({ value, label }: { value: unknown; label?: string }) {
  const text = String(label ?? value ?? 'unknown');
  const normalized = String(value ?? '').toLowerCase();
  const tone = ['active', 'running', 'enabled', 'available', 'healthy', 'success', 'true'].includes(normalized) ? 'success' : ['failed', 'error', 'dead', 'blocked'].includes(normalized) ? 'danger' : ['inactive', 'stopped', 'disabled', 'false', 'exited'].includes(normalized) ? 'muted' : 'warning';
  return <span className={`status status--${tone}`}><i/>{text}</span>;
}

export function MetricCard({ icon, label, value, detail, percent }: { icon: IconName; label: string; value: ReactNode; detail?: ReactNode; percent?: number }) {
  return <Card className="metric-card"><div className="metric-card__top"><span className="metric-card__icon"><Icon name={icon}/></span><span>{label}</span></div><strong>{value}</strong>{typeof percent === 'number' ? <div className="progress"><i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}/></div> : null}{detail ? <small>{detail}</small> : null}</Card>;
}

export function InfoList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className="info-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: Array<{ value: T; label: string; count?: number }>; onChange: (value: T) => void }) {
  return <div className="tabs">{items.map(item => <button key={item.value} className={value === item.value ? 'active' : ''} onClick={() => onChange(item.value)}>{item.label}{typeof item.count === 'number' ? <span>{item.count}</span> : null}</button>)}</div>;
}

export function SearchBox({ value, onChange, placeholder = '搜索' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-box"><Icon name="search" size={18}/><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/></label>;
}

export function CodeBlock({ value, copy }: { value: unknown; copy?: (text: string) => void }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <div className="code-block">{copy ? <button className="icon-button" onClick={() => copy(text)} aria-label="复制"><Icon name="copy" size={17}/></button> : null}<pre>{text || '暂无内容'}</pre></div>;
}

export function ResourceRow({ title, subtitle, meta, status, actions, icon }: { title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; status?: ReactNode; actions?: ReactNode; icon?: IconName }) {
  return <article className="resource-row">{icon ? <span className="resource-row__icon"><Icon name={icon}/></span> : null}<div className="resource-row__main"><div><strong>{title}</strong>{status}</div>{subtitle ? <p>{subtitle}</p> : null}{meta ? <small>{meta}</small> : null}</div>{actions ? <div className="resource-row__actions">{actions}</div> : null}</article>;
}
