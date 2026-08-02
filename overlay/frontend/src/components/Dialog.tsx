import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Button } from './UI';

type PromptOption = { value: string; label: string };
type PromptOptions = { title: string; message?: string; value?: string; placeholder?: string; type?: string; required?: boolean; confirmText?: string; options?: PromptOption[] };
type ConfirmOptions = { title: string; message?: string; confirmText?: string; danger?: boolean };
type DialogState =
  | { type: 'alert'; title: string; message: string; resolve: () => void }
  | { type: 'confirm'; title: string; message: string; confirmText: string; danger: boolean; resolve: (value: boolean) => void }
  | { type: 'prompt'; options: PromptOptions; value: string; resolve: (value: string | null) => void }
  | null;

type DialogAPI = {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const Context = createContext<DialogAPI | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);

  const alert = useCallback((message: string, title = '提示') => new Promise<void>(resolve => setDialog({ type: 'alert', title, message, resolve })), []);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setDialog({ type: 'confirm', title: options.title, message: options.message ?? '', confirmText: options.confirmText ?? '继续', danger: options.danger ?? false, resolve })), []);
  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>(resolve => setDialog({ type: 'prompt', options, value: options.value ?? '', resolve })), []);
  const api = useMemo(() => ({ alert, confirm, prompt }), [alert, confirm, prompt]);

  const close = (value: unknown) => {
    if (!dialog) return;
    if (dialog.type === 'alert') dialog.resolve();
    else if (dialog.type === 'confirm') dialog.resolve(Boolean(value));
    else dialog.resolve(value === null ? null : String(value));
    setDialog(null);
  };

  return <Context.Provider value={api}>{children}{dialog ? <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(dialog.type === 'confirm' ? false : null); }}><section className="dialog-card" role="dialog" aria-modal="true"><header><h2>{dialog.type === 'prompt' ? dialog.options.title : dialog.title}</h2></header><div className="dialog-card__body">{dialog.type === 'prompt' ? <><p>{dialog.options.message}</p>{dialog.options.options?.length ? <select autoFocus value={dialog.value} onChange={event => setDialog({ ...dialog, value: event.target.value })}>{dialog.options.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input autoFocus type={dialog.options.type ?? 'text'} value={dialog.value} placeholder={dialog.options.placeholder} onChange={event => setDialog({ ...dialog, value: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && (!dialog.options.required || dialog.value.trim())) close(dialog.value); }}/>}</> : <pre>{dialog.message}</pre>}</div><footer>{dialog.type !== 'alert' ? <Button onClick={() => close(dialog.type === 'confirm' ? false : null)}>取消</Button> : null}<Button tone={dialog.type === 'confirm' && dialog.danger ? 'danger' : 'primary'} onClick={() => { if (dialog.type === 'prompt' && dialog.options.required && !dialog.value.trim()) return; close(dialog.type === 'prompt' ? dialog.value : true); }}>{dialog.type === 'alert' ? '知道了' : dialog.type === 'confirm' ? dialog.confirmText : dialog.options.confirmText ?? '确定'}</Button></footer></section></div> : null}</Context.Provider>;
}

export function useDialog() {
  const value = useContext(Context);
  if (!value) throw new Error('DialogProvider is missing');
  return value;
}
