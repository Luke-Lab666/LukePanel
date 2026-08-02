import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, apiBlob, errorText, jsonBody, secureApi } from '../lib/api';
import { asArray, downloadBlob, formatBytes, formatDate } from '../lib/format';
import { useDialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Button, Card, CodeBlock, EmptyState, ErrorState, Loading, PageHeader, ResourceRow, SearchBox, Tabs } from '../components/UI';
import type { PageNavProps } from './SystemPages';

type Entry = { name: string; path: string; is_dir: boolean; size?: number; modified_at?: string; mode?: string; owner?: string; group?: string };
type Listing = { path: string; parent?: string; entries: Entry[] };
type Editor = { path: string; name: string; content: string; dirty: boolean };
type Preview = { path: string; name: string; kind: string; mime?: string; size?: number; url: string };
type Preferences = { favorites: Entry[]; recent: Entry[] };
type View = 'files' | 'search' | 'favorites' | 'recent' | 'recycle';

function joinPath(base: string, name: string) { return `${base === '/' ? '' : base.replace(/\/$/, '')}/${name}` || '/'; }
function copiedName(name: string, isDir: boolean) { if (isDir) return `${name}-副本`; const dot = name.lastIndexOf('.'); return dot > 0 ? `${name.slice(0, dot)}-副本${name.slice(dot)}` : `${name}-副本`; }

export function FilesPage({ back }: PageNavProps) {
  const [view, setView] = useState<View>('files');
  const [listing, setListing] = useState<Listing | null>(null);
  const [recycle, setRecycle] = useState<Record<string, any>[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({ favorites: [], recent: [] });
  const [filter, setFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRoot, setSearchRoot] = useState('/');
  const [searchResults, setSearchResults] = useState<Entry[]>([]);
  const [searchLimited, setSearchLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [menu, setMenu] = useState<Entry | null>(null);
  const [history, setHistory] = useState<{ path: string; versions: Record<string, any>[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const dialog = useDialog();
  const toast = useToast();

  async function load(path = listing?.path || '/') {
    setLoading(true); setError('');
    try {
      const out = await api<Listing>(`/api/v1/files?path=${encodeURIComponent(path)}`);
      setListing({ ...out, entries: asArray<Entry>(out.entries) });
      setSearchRoot(out.path || path);
      setFilter('');
      await loadPreferences(false);
    } catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }

  async function loadRecycle() {
    setLoading(true); setError('');
    try {
      const out = await api<Record<string, any>>('/api/v1/files/recycle');
      setRecycle(asArray(out.entries));
    } catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }

  async function loadPreferences(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const out = await api<Record<string, any>>('/api/v1/files/preferences');
      setPreferences({ favorites: asArray<Entry>(out.favorites), recent: asArray<Entry>(out.recent) });
    } catch (err) { setError(errorText(err)); }
    finally { if (showLoading) setLoading(false); }
  }

  useEffect(() => {
    if (view === 'files') void load(listing?.path || '/');
    else if (view === 'recycle') void loadRecycle();
    else if (view === 'favorites' || view === 'recent') void loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview?.url]);

  const entries = useMemo(() => asArray<Entry>(listing?.entries).filter(item => !filter || item.name.toLowerCase().includes(filter.toLowerCase())), [listing, filter]);
  const favoritePaths = useMemo(() => new Set(preferences.favorites.map(item => item.path)), [preferences.favorites]);

  async function open(item: Entry) {
    if (item.is_dir) { setView('files'); await load(item.path); return; }
    setBusy(true);
    try {
      const info = await secureApi<Omit<Preview, 'url'>>(`/api/v1/files/preview?path=${encodeURIComponent(item.path)}`);
      if (['text', 'markdown'].includes(info.kind)) {
        const out = await secureApi<Record<string, any>>(`/api/v1/files/content?path=${encodeURIComponent(item.path)}`);
        setEditor({ path: String(out.path || item.path), name: String(out.name || item.name), content: String(out.content || ''), dirty: false });
      } else if (['image', 'pdf'].includes(info.kind)) {
        const blob = await apiBlob(`/api/v1/files/preview/raw?path=${encodeURIComponent(item.path)}`, {}, true);
        const url = URL.createObjectURL(blob);
        setPreview({ ...info, path: item.path, name: info.name || item.name, url });
      } else if (info.kind === 'archive') {
        const out = await secureApi<Record<string, any>>(`/api/v1/files/archive/list?path=${encodeURIComponent(item.path)}`);
        const items = asArray<Record<string, any>>(out.entries);
        const body = items.map(entry => `${entry.is_dir ? '目录' : formatBytes(entry.size)}\t${entry.name}`).join('\n');
        await dialog.alert(`${body || '压缩包为空'}${out.limited ? '\n\n仅显示前 1000 项。' : ''}`, `${item.name} 内容`);
      } else await download(item);
    } catch (err) { await dialog.alert(errorText(err), '无法打开文件'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!editor) return;
    setBusy(true);
    try {
      await secureApi('/api/v1/files/content', { method: 'PUT', body: jsonBody({ path: editor.path, content: editor.content }) });
      setEditor({ ...editor, dirty: false });
      toast('文件已保存并创建历史版本');
      await loadPreferences(false);
    } catch (err) { await dialog.alert(errorText(err), '保存失败'); }
    finally { setBusy(false); }
  }

  async function download(item: Entry) {
    try {
      const blob = await apiBlob(`/api/v1/files/download?path=${encodeURIComponent(item.path)}`, {}, true);
      downloadBlob(blob, item.name);
      await loadPreferences(false);
    } catch (err) { await dialog.alert(errorText(err), '下载失败'); }
  }

  async function upload(files: FileList | null, preserve = false) {
    const list = Array.from(files || []);
    if (!listing || !list.length) return;
    setBusy(true); let done = 0;
    try {
      for (const file of list) {
        const body = new FormData();
        body.append('directory', listing.path);
        body.append('relative_path', preserve ? (file.webkitRelativePath || file.name) : file.name);
        body.append('overwrite', 'false');
        body.append('file', file);
        await secureApi('/api/v1/files/upload', { method: 'POST', body });
        done++;
      }
      toast(`已上传 ${done} 个文件`);
      await load(listing.path);
    } catch (err) { await dialog.alert(`已上传 ${done}/${list.length}\n\n${errorText(err)}`, '上传未全部完成'); }
    finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = '';
      if (folderRef.current) folderRef.current.value = '';
    }
  }

  async function uploadZip(files: FileList | null) {
    const file = files?.[0]; if (!file || !listing) return;
    if (!await dialog.confirm({ title: '上传并解压 ZIP', message: `${file.name}\n目标：${listing.path}\n同名文件默认不覆盖。`, confirmText: '上传并解压' })) return;
    const body = new FormData(); body.append('directory', listing.path); body.append('overwrite', 'false'); body.append('file', file);
    setBusy(true);
    try {
      const out = await secureApi<Record<string, any>>('/api/v1/files/archive/extract', { method: 'POST', body });
      toast(`已解压 ${out.files || 0} 个文件`); await load(listing.path);
    } catch (err) { await dialog.alert(errorText(err), '解压失败'); }
    finally { setBusy(false); if (zipRef.current) zipRef.current.value = ''; }
  }

  async function create(kind: 'file' | 'folder') {
    if (!listing) return;
    const name = await dialog.prompt({ title: kind === 'folder' ? '新建文件夹' : '新建文件', placeholder: kind === 'folder' ? 'config' : 'config.yaml', required: true });
    if (!name) return;
    try {
      await secureApi(kind === 'folder' ? '/api/v1/files/mkdir' : '/api/v1/files/create', { method: 'POST', body: jsonBody({ path: joinPath(listing.path, name) }) });
      toast(kind === 'folder' ? '文件夹已创建' : '文件已创建'); await load(listing.path);
    } catch (err) { await dialog.alert(errorText(err), '创建失败'); }
  }

  async function toggleFavorite(item: Entry) {
    const enabled = !favoritePaths.has(item.path);
    try {
      const out = await api<Record<string, any>>('/api/v1/files/preferences', { method: 'POST', body: jsonBody({ action: enabled ? 'favorite' : 'unfavorite', path: item.path, is_dir: item.is_dir }) });
      setPreferences({ favorites: asArray<Entry>(out.favorites), recent: asArray<Entry>(out.recent) });
      toast(enabled ? '已收藏' : '已取消收藏');
    } catch (err) { await dialog.alert(errorText(err), '收藏操作失败'); }
  }

  async function action(item: Entry, next: string) {
    if (!listing) return;
    try {
      if (next === 'rename') {
        const name = await dialog.prompt({ title: '重命名', value: item.name, required: true });
        if (!name || name === item.name) return;
        await secureApi('/api/v1/files/rename', { method: 'POST', body: jsonBody({ source: item.path, destination: joinPath(listing.path, name) }) });
      } else if (next === 'copy' || next === 'move') {
        const destination = await dialog.prompt({ title: next === 'copy' ? '复制到完整路径' : '移动到完整路径', value: next === 'copy' ? joinPath(listing.path, copiedName(item.name, item.is_dir)) : item.path, required: true });
        if (!destination || destination === item.path) return;
        await secureApi(`/api/v1/files/${next}`, { method: 'POST', body: jsonBody({ source: item.path, destination }) });
      } else if (next === 'chmod') {
        const mode = await dialog.prompt({ title: '修改八进制权限', value: String(item.mode || '').match(/[0-7]{3,4}$/)?.[0] || (item.is_dir ? '755' : '644'), required: true });
        if (!mode) return;
        await secureApi('/api/v1/files/chmod', { method: 'POST', body: jsonBody({ path: item.path, mode }) });
      } else if (next === 'chown') {
        const value = await dialog.prompt({ title: '修改所有者', message: '格式：用户:用户组，可留空其中一项', placeholder: 'root:root', required: true });
        if (!value) return;
        const [owner = '', group = ''] = value.split(':', 2);
        await secureApi('/api/v1/files/chown', { method: 'POST', body: jsonBody({ path: item.path, owner: owner.trim(), group: group.trim() }) });
      } else if (next === 'delete') {
        if (!await dialog.confirm({ title: '移入回收站', message: item.path, confirmText: '删除', danger: true })) return;
        await secureApi('/api/v1/files/delete', { method: 'POST', body: jsonBody({ path: item.path }) });
      } else if (next === 'archive') {
        const format = await dialog.prompt({ title: '压缩格式', message: '输入 zip 或 tar.gz', value: 'zip', required: true });
        if (format !== 'zip' && format !== 'tar.gz') { await dialog.alert('只支持 zip 或 tar.gz', '格式无效'); return; }
        const name = await dialog.prompt({ title: '压缩包名称', value: `${item.name}.${format}`, required: true });
        if (!name) return;
        await secureApi('/api/v1/files/archive/create', { method: 'POST', body: jsonBody({ sources: [item.path], destination: joinPath(listing.path, name), format }) });
      }
      setMenu(null); toast('文件操作已完成'); await load(listing.path);
    } catch (err) { await dialog.alert(errorText(err), '操作失败'); }
  }

  async function recycleAction(item: Record<string, any>, next: 'restore' | 'purge') {
    if (next === 'purge' && !await dialog.confirm({ title: '永久删除', message: String(item.original_path || item.name), confirmText: '永久删除', danger: true })) return;
    try {
      await secureApi('/api/v1/files/recycle', { method: 'POST', body: jsonBody({ id: item.id, action: next, destination: '' }) });
      toast(next === 'restore' ? '文件已恢复' : '文件已永久删除'); await loadRecycle();
    } catch (err) {
      if (next === 'restore' && errorText(err).includes('恢复目标已存在')) {
        const destination = await dialog.prompt({ title: '原位置已有同名文件', value: `${item.original_path}-恢复`, required: true });
        if (destination) { await secureApi('/api/v1/files/recycle', { method: 'POST', body: jsonBody({ id: item.id, action: next, destination }) }); await loadRecycle(); }
      } else await dialog.alert(errorText(err), '操作失败');
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const query = searchQuery.trim(); if (!query) return;
    setLoading(true); setError('');
    try {
      const out = await api<Record<string, any>>(`/api/v1/files/search?root=${encodeURIComponent(searchRoot || '/')}&q=${encodeURIComponent(query)}`);
      setSearchResults(asArray<Entry>(out.entries)); setSearchLimited(Boolean(out.limited));
    } catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }

  async function showHistory(item: Entry) {
    if (item.is_dir) return;
    setBusy(true);
    try {
      const out = await secureApi<Record<string, any>>(`/api/v1/files/backups?path=${encodeURIComponent(item.path)}`);
      setHistory({ path: item.path, versions: asArray(out.versions) }); setMenu(null);
    } catch (err) { await dialog.alert(errorText(err), '读取历史版本失败'); }
    finally { setBusy(false); }
  }

  async function showDiff(version: Record<string, any>) {
    if (!history) return;
    try {
      const out = await secureApi<Record<string, any>>(`/api/v1/files/backups/diff?path=${encodeURIComponent(history.path)}&id=${encodeURIComponent(String(version.id))}`);
      await dialog.alert(String(out.diff || '没有差异'), `与 ${formatDate(version.created_at)} 的差异`);
    } catch (err) { await dialog.alert(errorText(err), '对比失败'); }
  }

  async function restoreVersion(version: Record<string, any>) {
    if (!history || !await dialog.confirm({ title: '恢复历史版本', message: `${history.path}\n版本：${formatDate(version.created_at)}\n恢复前会自动备份当前内容。`, confirmText: '恢复', danger: true })) return;
    try {
      await secureApi('/api/v1/files/backups/restore', { method: 'POST', body: jsonBody({ path: history.path, id: version.id }) });
      toast('历史版本已恢复'); setHistory(null);
      if (editor?.path === history.path) {
        const out = await secureApi<Record<string, any>>(`/api/v1/files/content?path=${encodeURIComponent(history.path)}`);
        setEditor({ path: history.path, name: String(out.name || editor.name), content: String(out.content || ''), dirty: false });
      }
      if (listing) await load(listing.path);
    } catch (err) { await dialog.alert(errorText(err), '恢复失败'); }
  }

  function breadcrumbs() {
    const path = listing?.path || '/'; if (path === '/') return <button onClick={() => load('/')}>根目录</button>;
    let current = '';
    return <><button onClick={() => load('/')}>/</button>{path.split('/').filter(Boolean).map(part => { current += `/${part}`; const target = current; return <span key={target}><i>/</i><button onClick={() => load(target)}>{part}</button></span>; })}</>;
  }

  function preferenceList(items: Entry[], emptyTitle: string) {
    return items.length ? <Card className="resource-list">{items.map(item => <ResourceRow key={item.path} icon={item.is_dir ? 'folder' : 'logs'} title={item.name || item.path.split('/').pop() || item.path} subtitle={item.path} meta={item.modified_at ? formatDate(item.modified_at) : ''} actions={<><Button compact onClick={() => open(item)}>打开</Button><Button compact onClick={() => toggleFavorite(item)}>{favoritePaths.has(item.path) ? '取消收藏' : '收藏'}</Button></>}/>)}</Card> : <Card><EmptyState title={emptyTitle}/></Card>;
  }

  return <div className="page files-page">
    <PageHeader
      title="文件管理"
      description="浏览、搜索、收藏、版本回滚与真实文件系统操作"
      back={back}
      actions={view === 'files' ? <><Button compact onClick={() => create('folder')}><Icon name="plus" size={17}/>文件夹</Button><Button compact onClick={() => create('file')}><Icon name="plus" size={17}/>文件</Button><Button compact tone="primary" onClick={() => uploadRef.current?.click()} disabled={busy}><Icon name="upload" size={17}/>上传</Button></> : undefined}
    />
    <Tabs value={view} onChange={setView} items={[{ value: 'files', label: '文件' }, { value: 'search', label: '全局搜索' }, { value: 'favorites', label: '收藏', count: preferences.favorites.length }, { value: 'recent', label: '最近', count: preferences.recent.length }, { value: 'recycle', label: '回收站', count: recycle.length }]}/>
    {error ? <ErrorState message={error} retry={() => view === 'files' ? load() : view === 'recycle' ? loadRecycle() : loadPreferences()}/> : null}
    {loading ? <Loading/> : view === 'files' && listing ? <>
      <Card className="file-toolbar"><Button compact tone="ghost" disabled={!listing.parent} onClick={() => listing.parent && load(listing.parent)}><Icon name="back" size={18}/></Button><div className="breadcrumbs">{breadcrumbs()}</div><Button compact tone="ghost" onClick={() => navigator.clipboard.writeText(listing.path).then(() => toast('路径已复制'))}><Icon name="copy" size={17}/></Button><Button compact tone="ghost" onClick={() => load(listing.path)}><Icon name="refresh" size={17}/></Button></Card>
      <SearchBox value={filter} onChange={setFilter} placeholder="筛选当前目录"/>
      {entries.length ? <Card className="file-list">{entries.map(item => <article className="file-row" key={item.path}><button className="file-row__open" onClick={() => open(item)}><span className="file-row__icon"><Icon name={item.is_dir ? 'folder' : 'logs'} size={21}/></span><span className="file-row__main"><strong>{item.name}</strong><small>{item.is_dir ? '文件夹' : formatBytes(item.size)} · {formatDate(item.modified_at)} · {item.mode || ''}</small></span><Icon name="chevron" size={17}/></button><button className="icon-button" onClick={() => setMenu(item)} aria-label="更多操作"><Icon name="more"/></button></article>)}</Card> : <Card><EmptyState title="这个目录是空的"/></Card>}
      <div className="upload-extras"><Button onClick={() => folderRef.current?.click()} disabled={busy}>上传文件夹</Button><Button onClick={() => zipRef.current?.click()} disabled={busy}>上传并解压 ZIP</Button></div>
    </> : view === 'search' ? <><Card><form className="form-grid" onSubmit={search}><label>搜索范围<input value={searchRoot} onChange={event => setSearchRoot(event.target.value)} required/></label><label>文件名关键词<input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} required maxLength={120}/></label><div className="form-actions span-2"><Button tone="primary" type="submit">搜索</Button></div></form></Card>{searchResults.length ? <Card className="resource-list">{searchResults.map(item => <ResourceRow key={item.path} icon={item.is_dir ? 'folder' : 'logs'} title={item.name} subtitle={item.path} meta={`${item.is_dir ? '文件夹' : formatBytes(item.size)} · ${formatDate(item.modified_at)}`} actions={<Button compact onClick={() => open(item)}>打开</Button>}/>)}</Card> : <Card><EmptyState title="暂无搜索结果" description={searchLimited ? '结果达到上限，请缩小搜索范围。' : '输入文件名关键词搜索授权目录。'}/></Card>}</> : view === 'favorites' ? preferenceList(preferences.favorites, '暂无收藏') : view === 'recent' ? preferenceList(preferences.recent, '暂无最近记录') : view === 'recycle' ? (recycle.length ? <Card className="resource-list">{recycle.map(item => <article className="recycle-row" key={String(item.id)}><div><strong>{String(item.name || String(item.original_path || '').split('/').pop())}</strong><p>{String(item.original_path || '')}</p><small>{formatDate(item.deleted_at)} · {item.is_dir ? '文件夹' : formatBytes(item.size)}</small></div><div><Button compact onClick={() => recycleAction(item, 'restore')}>恢复</Button><Button compact tone="danger" onClick={() => recycleAction(item, 'purge')}>永久删除</Button></div></article>)}</Card> : <Card><EmptyState title="回收站是空的"/></Card>) : null}

    <input ref={uploadRef} hidden type="file" multiple onChange={event => upload(event.target.files)}/>
    <input ref={folderRef} hidden type="file" multiple {...({ webkitdirectory: '', directory: '' } as any)} onChange={event => upload(event.target.files, true)}/>
    <input ref={zipRef} hidden type="file" accept=".zip,application/zip" onChange={event => uploadZip(event.target.files)}/>

    {menu ? <div className="sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setMenu(null); }}><section className="action-sheet"><header><div><strong>{menu.name}</strong><small>{menu.path}</small></div><Button compact tone="ghost" onClick={() => setMenu(null)}>关闭</Button></header><div className="action-grid">{!menu.is_dir ? <><Button onClick={() => download(menu)}><Icon name="download"/>下载</Button><Button onClick={() => open(menu)}><Icon name="edit"/>打开</Button><Button onClick={() => showHistory(menu)}><Icon name="clock"/>历史</Button></> : null}<Button onClick={() => toggleFavorite(menu)}><Icon name="star"/>{favoritePaths.has(menu.path) ? '取消收藏' : '收藏'}</Button><Button onClick={() => action(menu, 'rename')}><Icon name="edit"/>重命名</Button><Button onClick={() => action(menu, 'copy')}><Icon name="copy"/>复制</Button><Button onClick={() => action(menu, 'move')}><Icon name="chevron"/>移动</Button><Button onClick={() => action(menu, 'archive')}><Icon name="package"/>压缩</Button><Button onClick={() => action(menu, 'chmod')}><Icon name="key"/>权限</Button><Button onClick={() => action(menu, 'chown')}><Icon name="user"/>所有者</Button><Button tone="danger" onClick={() => action(menu, 'delete')}><Icon name="trash"/>删除</Button></div></section></div> : null}

    {editor ? <div className="editor-overlay"><section className="editor-dialog"><header><div><strong>{editor.name}</strong><small>{editor.path}</small></div><div><Button compact onClick={() => showHistory({ name: editor.name, path: editor.path, is_dir: false })}>历史</Button><Button compact onClick={() => setEditor(null)}>关闭</Button><Button compact tone="primary" disabled={busy || !editor.dirty} onClick={save}>保存</Button></div></header><textarea value={editor.content} onChange={event => setEditor({ ...editor, content: event.target.value, dirty: true })} spellCheck={false}/></section></div> : null}
    {preview ? <div className="editor-overlay"><section className="preview-dialog"><header><div><strong>{preview.name}</strong><small>{preview.kind} · {formatBytes(preview.size)}</small></div><Button compact onClick={() => setPreview(null)}>关闭</Button></header>{preview.kind === 'image' ? <img src={preview.url} alt={preview.name}/> : <iframe src={preview.url} title={preview.name}/>}</section></div> : null}
    {history ? <div className="editor-overlay"><section className="editor-dialog history-dialog"><header><div><strong>历史版本</strong><small>{history.path}</small></div><Button compact onClick={() => setHistory(null)}>关闭</Button></header>{history.versions.length ? <div className="resource-list">{history.versions.map(version => <ResourceRow key={String(version.id)} title={formatDate(version.created_at)} subtitle={String(version.id)} meta={formatBytes(version.size)} actions={<><Button compact onClick={() => showDiff(version)}>对比</Button><Button compact tone="danger" onClick={() => restoreVersion(version)}>恢复</Button></>}/>)}</div> : <EmptyState title="暂无历史版本" description="文件第一次保存后才会产生版本。"/>}</section></div> : null}
  </div>;
}
