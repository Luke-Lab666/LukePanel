import { useEffect } from 'react';
import { Card, EmptyState, ErrorState, Loading, MetricCard, PageHeader, ResourceRow, Status } from '../components/UI';
import { Icon } from '../components/Icon';
import { useApiData } from '../lib/useApiData';
import { asArray, asRecord, formatBytes, formatDate, formatPercent, formatRate, formatUptime } from '../lib/format';

export function DashboardPage({ navigate }: { navigate: (path: string) => void }) {
  const overview = useApiData<Record<string, any>>('/api/v1/system/overview', { interval: 10_000 });
  const dockerStatus = useApiData<Record<string, any>>('/api/v1/docker/status', { interval: 15_000 });
  const containers = useApiData<Record<string, any>>(dockerStatus.data?.available ? '/api/v1/docker/containers' : null, { interval: 10_000 });

  useEffect(() => {
    if (!('EventSource' in window)) return;
    const stream = new EventSource('/api/v1/system/overview/stream');
    stream.addEventListener('overview', event => {
      try { overview.setData(JSON.parse((event as MessageEvent).data)); } catch { /* keep polling fallback */ }
    });
    return () => stream.close();
  }, [overview.setData]);

  if (overview.loading && !overview.data) return <><PageHeader title="概览" description="正在读取服务器状态"/><Loading label="正在采集系统信息"/></>;
  if (overview.error && !overview.data) return <><PageHeader title="概览" description="系统状态读取失败"/><ErrorState message={overview.error} retry={() => void overview.reload()}/></>;

  const data = asRecord(overview.data);
  const memory = asRecord(data.memory);
  const disk = asRecord(data.disk);
  const network = asRecord(data.network);
  const memoryPercent = formatPercent(memory.Used, memory.Total);
  const diskPercent = formatPercent(disk.Used, disk.Total);
  const swapPercent = formatPercent(memory.SwapUsed, memory.SwapTotal);
  const list = asArray<Record<string, any>>(containers.data?.containers);
  const running = list.filter(item => item.state === 'running');

  return <div className="page-stack">
    <PageHeader title="概览" description={`${data.hostname ?? '当前服务器'} · ${formatDate(data.collected_at)}`} actions={<button className="button button--secondary button--compact" onClick={() => void overview.reload()}><Icon name="refresh" size={17}/>刷新</button>}/>
    {overview.error ? <ErrorState message={overview.error} retry={() => void overview.reload()}/> : null}
    <div className="live-strip"><span><i/>实时监控</span><small>优先 SSE 推送，断开后自动轮询</small></div>
    <section className="metric-grid">
      <MetricCard icon="clock" label="运行时间" value={formatUptime(data.uptime_seconds)} detail="持续在线"/>
      <MetricCard icon="activity" label="系统负载" value={Number(data.load_1 ?? 0).toFixed(2)} detail={`5 分钟 ${Number(data.load_5 ?? 0).toFixed(2)} · 15 分钟 ${Number(data.load_15 ?? 0).toFixed(2)}`}/>
      <MetricCard icon="server" label="CPU" value={`${Number(data.cpu_percent ?? 0).toFixed(1)}%`} detail={`${data.cpu_cores ?? 0} 核`} percent={Number(data.cpu_percent ?? 0)}/>
      <MetricCard icon="drive" label="内存" value={`${memoryPercent.toFixed(1)}%`} detail={`${formatBytes(memory.Used)} / ${formatBytes(memory.Total)}`} percent={memoryPercent}/>
    </section>
    <section className="dashboard-grid">
      <Card className="panel-card"><header><div><h2>资源使用</h2><p>实时资源占用</p></div></header><ResourceMeter label="CPU" value={`${Number(data.cpu_percent ?? 0).toFixed(1)}%`} detail={`${data.cpu_cores ?? 0} 核心`} percent={Number(data.cpu_percent ?? 0)}/><ResourceMeter label="内存" value={`${memoryPercent.toFixed(1)}%`} detail={`${formatBytes(memory.Used)} / ${formatBytes(memory.Total)}`} percent={memoryPercent}/><ResourceMeter label="系统盘" value={`${diskPercent.toFixed(1)}%`} detail={`${formatBytes(disk.Used)} / ${formatBytes(disk.Total)}`} percent={diskPercent}/><ResourceMeter label="Swap" value={Number(memory.SwapTotal ?? 0) ? `${swapPercent.toFixed(1)}%` : '未启用'} detail={Number(memory.SwapTotal ?? 0) ? `${formatBytes(memory.SwapUsed)} / ${formatBytes(memory.SwapTotal)}` : '当前系统没有 Swap'} percent={swapPercent}/></Card>
      <Card className="panel-card"><header><div><h2>系统状态</h2><p>基础运行环境</p></div><Icon name="server"/></header><dl className="info-list"><div><dt>操作系统</dt><dd>{data.os ?? '-'}</dd></div><div><dt>内核版本</dt><dd>{data.kernel ?? '-'}</dd></div><div><dt>架构</dt><dd>{data.architecture ?? '-'}</dd></div><div><dt>实时下载</dt><dd>{formatRate(network.download_bps)}</dd></div><div><dt>实时上传</dt><dd>{formatRate(network.upload_bps)}</dd></div></dl></Card>
      <Card className="panel-card dashboard-docker"><header><div><h2>Docker 概览</h2><p>容器运行状态</p></div>{dockerStatus.data?.available ? <Status value="active" label={dockerStatus.data.version ?? '可用'}/> : <Status value="inactive" label="不可用"/>}</header>{dockerStatus.loading ? <Loading label="正在读取 Docker"/> : !dockerStatus.data?.available ? <EmptyState title="Docker 不可用" description={dockerStatus.data?.error ?? '未检测到 Docker Engine'}/> : <><div className="docker-counts"><div><strong>{running.length}</strong><span>运行中</span></div><div><strong>{list.length - running.length}</strong><span>已停止</span></div><div><strong>{list.length}</strong><span>总容器</span></div></div><div className="compact-list">{list.slice(0, 5).map(item => <ResourceRow key={item.id} title={String(item.name ?? item.names ?? item.id)} meta={item.status} status={<Status value={item.state}/>} />)}{!list.length ? <EmptyState title="暂无容器"/> : null}</div></>}<button className="text-link" onClick={() => navigate('/docker')}>管理 Docker <Icon name="chevron" size={15}/></button></Card>
      <Card className="panel-card"><header><div><h2>快捷操作</h2><p>进入真实管理页面</p></div></header><div className="quick-links">{([['文件管理','浏览、编辑与上传','/files','folder'],['软件管理','APT 更新与软件源','/updates','package'],['日志审计','操作记录与系统日志','/audit','logs'],['诊断工具','固定安全诊断动作','/tools','terminal']] as const).map(([title, detail, path, icon]) => <button key={path} onClick={() => navigate(path)}><Icon name={icon}/><span><strong>{title}</strong><small>{detail}</small></span><Icon name="chevron" size={16}/></button>)}</div></Card>
    </section>
  </div>;
}

function ResourceMeter({ label, value, detail, percent }: { label: string; value: string; detail: string; percent: number }) {
  return <div className="resource-meter"><div><strong>{label}</strong><span>{value}</span></div><div className="progress"><i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}/></div><small>{detail}</small></div>;
}
