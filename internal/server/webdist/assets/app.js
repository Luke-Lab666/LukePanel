"use strict";
/* LukePanel v2.0.0 React 18 frontend. No runtime CDN, no direct DOM templating. */
(() => {
    'use strict';
    const { useCallback, useEffect, useMemo, useRef, useState } = React;
    const VERSION = window.__LUKEPANEL_VERSION__ || 'v2.0.0';
    const ROUTES = [
        { path: '/', title: '概览', subtitle: '服务器状态与关键指标', level: 1, nav: true, icon: 'dashboard' },
        { path: '/system', title: '系统', subtitle: '主机、服务、网络与维护', level: 1, nav: true, icon: 'system' },
        { path: '/system/services', title: '服务管理', subtitle: 'systemd 服务状态、控制与日志', level: 2, parent: '/system', icon: 'services' },
        { path: '/system/processes', title: '进程管理', subtitle: '进程资源、筛选与信号操作', level: 2, parent: '/system', icon: 'process' },
        { path: '/system/network', title: '网络状态', subtitle: '接口、地址与监听端口', level: 2, parent: '/system', icon: 'network' },
        { path: '/system/storage', title: '存储空间', subtitle: '文件系统、挂载点与容量', level: 2, parent: '/system', icon: 'storage' },
        { path: '/system/tasks', title: '计划任务', subtitle: '计划任务与 systemd timers', level: 2, parent: '/system', icon: 'tasks' },
        { path: '/system/updates', title: '软件管理', subtitle: 'APT 更新、软件包与软件源', level: 2, parent: '/system', icon: 'package' },
        { path: '/system/host', title: '主机设置', subtitle: '主机名、时区、DNS、Swap 与内核参数', level: 2, parent: '/system', icon: 'server' },
        { path: '/system/snapshots', title: '备份与快照', subtitle: '配置导出、导入与恢复点', level: 2, parent: '/system', icon: 'backup' },
        { path: '/docker', title: 'Docker', subtitle: '容器、镜像、Compose、网络与卷', level: 1, nav: true, icon: 'docker' },
        { path: '/files', title: '文件管理', subtitle: '浏览、编辑、上传与归档', level: 1, nav: true, icon: 'files' },
        { path: '/tools', title: '常用工具', subtitle: '网络诊断与安全维护工具', level: 1, nav: true, icon: 'tools' },
        { path: '/tools/github', title: 'GitHub 助手', subtitle: '仓库、Actions、Release 与导入', level: 2, parent: '/tools', icon: 'github' },
        { path: '/ssh', title: 'SSH 管理', subtitle: '登录方式、用户、密钥与端口', level: 1, nav: true, icon: 'ssh' },
        { path: '/audit', title: '日志中心', subtitle: '系统日志与操作审计', level: 1, nav: true, icon: 'audit' },
        { path: '/security', title: '安全中心', subtitle: '防火墙、Fail2ban 与登录防护', level: 1, nav: true, icon: 'security' },
        { path: '/settings', title: '我的', subtitle: '账户、认证、会话与面板设置', level: 1, nav: true, icon: 'settings' }
    ];
    const ROUTE_MAP = new Map(ROUTES.map(route => [route.path, route]));
    const LEGACY_REDIRECTS = {
        '/services': '/system/services', '/processes': '/system/processes', '/network': '/system/network',
        '/storage': '/system/storage', '/tasks': '/system/tasks', '/updates': '/system/updates',
        '/host': '/system/host', '/snapshots': '/system/snapshots', '/github': '/tools/github'
    };
    const PRIMARY_ROUTES = ROUTES.filter(route => route.nav);
    const MOBILE_ROUTES = ['/', '/system', '/docker', '/files', '/settings'];
    const ICONS = {
        dashboard: ['M4 13h6V4H4v9Z', 'M14 20h6v-9h-6v9Z', 'M14 4h6v3h-6V4Z', 'M4 17h6v3H4v-3Z'],
        system: ['M4 4h16v16H4z', 'M8 8h8', 'M8 12h5', 'M8 16h3'],
        services: ['M12 3v3', 'M12 18v3', 'M3 12h3', 'M18 12h3', 'M6.6 6.6l2.1 2.1', 'M15.3 15.3l2.1 2.1', 'M17.4 6.6l-2.1 2.1', 'M8.7 15.3l-2.1 2.1', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
        process: ['M4 7h16', 'M7 4v6', 'M4 17h16', 'M17 14v6', 'M10 12h4'],
        network: ['M5 12.6a10 10 0 0 1 14 0', 'M8.5 16a5 5 0 0 1 7 0', 'M12 20h.01', 'M2 9a15 15 0 0 1 20 0'],
        storage: ['M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Z', 'M4 6v6c0 1.1 3.6 2 8 2s8-.9 8-2V6', 'M4 12v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6'],
        tasks: ['M6 3v3', 'M18 3v3', 'M4 8h16', 'M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z', 'M8 12h3', 'M8 16h5'],
        package: ['M4 7 12 3l8 4-8 4-8-4Z', 'M4 7v10l8 4 8-4V7', 'M12 11v10'],
        server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01'],
        backup: ['M4 4v6h6', 'M5.5 15a8 8 0 1 0 1-8.5L4 10', 'M12 8v5l3 2'],
        docker: ['M4 11h16c0 5-3 9-8 9s-8-4-8-9Z', 'M7 8h3v3H7z', 'M11 8h3v3h-3z', 'M15 8h3v3h-3z', 'M11 4h3v3h-3z', 'M20 9c1-1 2-1 3-1'],
        files: ['M3 6h7l2 2h9v12H3z', 'M3 6V4h7l2 2'],
        tools: ['M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-3 3-4Z'],
        github: ['M12 2a10 10 0 0 0-3 19.5c.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.7 1.2 3.4.9.1-.7.4-1.2.7-1.5-2.2-.3-4.5-1.1-4.5-5A4 4 0 0 1 6 8.2 3.7 3.7 0 0 1 6.1 5s.9-.3 3 1.1a10.5 10.5 0 0 1 5.5 0c2.1-1.4 3-1.1 3-1.1a3.7 3.7 0 0 1 .1 3.2 4 4 0 0 1 1.1 2.8c0 3.9-2.3 4.7-4.5 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 12 2Z'],
        ssh: ['M4 5h16v14H4z', 'm8 9 3 3-3 3', 'M13 15h3'],
        audit: ['M6 4h12v16H6z', 'M9 8h6', 'M9 12h6', 'M9 16h4'],
        security: ['M12 3 4 6v5c0 5.2 3.4 8.4 8 10 4.6-1.6 8-4.8 8-10V6l-8-3Z', 'm9 12 2 2 4-4'],
        settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M4.9 19.1 7 17', 'M17 7l2.1-2.1', 'M4.9 4.9 7 7', 'M17 17l2.1 2.1', 'M2 12h3', 'M19 12h3', 'M12 2v3', 'M12 19v3'],
        back: ['m15 18-6-6 6-6'], refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'], menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
        close: ['M6 6l12 12', 'M18 6 6 18'], search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z', 'm20 20-4-4'],
        plus: ['M12 5v14', 'M5 12h14'], play: ['m8 5 11 7-11 7Z'], stop: ['M7 7h10v10H7z'], restart: ['M20 11a8 8 0 1 0-2 5', 'm20 4v7h-7'],
        trash: ['M4 7h16', 'M9 7V4h6v3', 'm7 7 1 13h8l1-13', 'M10 11v5', 'M14 11v5'], edit: ['m4 20 4-1 10-10-3-3L5 16l-1 4Z', 'm13 5 3 3'],
        download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'], upload: ['M12 21V9', 'm7 14 5-5 5 5', 'M5 3h14'],
        chevron: ['m9 18 6-6-6-6'], check: ['m5 12 4 4L19 6'], warning: ['M12 3 2 21h20L12 3Z', 'M12 9v5', 'M12 18h.01'],
        terminal: ['m5 7 4 4-4 4', 'M11 17h8'], user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21a8 8 0 0 1 16 0'],
        key: ['M21 2 13.6 9.4', 'M15 4l5 5', 'M11 13a5 5 0 1 1-7-7 5 5 0 0 1 7 7Z'], copy: ['M8 8h12v12H8z', 'M4 4h12v4', 'M4 4v12h4'],
        info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 10v7', 'M12 7h.01'], more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01']
    };
    function Icon({ name, size = 20, className = '' }) {
        const paths = ICONS[name] || ICONS.info;
        return React.createElement("svg", { className: `icon ${className}`, width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, paths.map((path, index) => React.createElement("path", { key: index, d: path })));
    }
    function asObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    function listOf(value, ...keys) {
        if (Array.isArray(value))
            return value;
        const object = asObject(value);
        for (const key of keys)
            if (Array.isArray(object[key]))
                return object[key];
        return [];
    }
    function boolText(value, yes = '已启用', no = '未启用') { return value ? yes : no; }
    function text(value, fallback = '—') { return value === undefined || value === null || value === '' ? fallback : String(value); }
    function number(value, fallback = 0) { const out = Number(value); return Number.isFinite(out) ? out : fallback; }
    function formatBytes(value) {
        let bytes = number(value);
        if (bytes <= 0)
            return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        let index = 0;
        while (bytes >= 1024 && index < units.length - 1) {
            bytes /= 1024;
            index++;
        }
        return `${bytes >= 100 || index === 0 ? bytes.toFixed(0) : bytes.toFixed(1)} ${units[index]}`;
    }
    function formatDuration(value) {
        let seconds = Math.max(0, Math.floor(number(value)));
        const days = Math.floor(seconds / 86400);
        seconds %= 86400;
        const hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        const minutes = Math.floor(seconds / 60);
        return [days ? `${days}天` : '', hours ? `${hours}小时` : '', minutes ? `${minutes}分钟` : '', !days && !hours && !minutes ? `${seconds}秒` : ''].filter(Boolean).join(' ');
    }
    function formatDate(value) { if (!value)
        return '—'; const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false }); }
    function query(params) { const search = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '')
        search.set(key, String(value)); }); const out = search.toString(); return out ? `?${out}` : ''; }
    function jsonBody(value) { return JSON.stringify(value); }
    function lines(value) { return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean); }
    function truncate(value, length = 80) { const out = text(value, ''); return out.length > length ? `${out.slice(0, length)}…` : out; }
    function taskTypeLabel(type) { return { 'service-restart': '重启 systemd 服务', 'docker-restart': '重启 Docker 容器', 'docker-cleanup-safe': '安全清理 Docker', 'panel-backup': '创建面板备份' }[String(type)] || text(type); }
    function taskTargetLabel(task) { if (task.type === 'docker-cleanup-safe')
        return '删除未使用且不影响运行容器的 Docker 资源'; if (task.type === 'panel-backup')
        return '保存到定时备份目录'; return text(task.target); }
    function taskScheduleLabel(task) { const minute = String(number(task.minute)).padStart(2, '0'); const hour = String(number(task.hour)).padStart(2, '0'); if (task.frequency === 'hourly')
        return `每小时第 ${minute} 分钟`; if (task.frequency === 'weekly') {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${days[number(task.weekday)] || '每周'} ${hour}:${minute}`;
    } return `每天 ${hour}:${minute}`; }
    function copyText(value) { return navigator.clipboard?.writeText(value) || Promise.reject(new Error('浏览器不支持剪贴板')); }
    class ApiError extends Error {
        constructor(message, status, payload) { super(message); this.name = 'ApiError'; this.status = status; this.code = text(payload.code, ''); this.command = text(payload.command || payload.details?.command, ''); this.output = text(payload.output || payload.details?.output, ''); }
        get detail() { return [this.message, this.command ? `执行命令：${this.command}` : '', this.output ? `命令输出：\n${this.output}` : ''].filter(Boolean).join('\n\n'); }
    }
    let csrfToken = '';
    let unauthorizedHandler = null;
    let elevationHandler = null;
    async function parsePayload(response) { const type = response.headers.get('content-type') || ''; if (type.includes('application/json'))
        return response.json().catch(() => ({})); return response.text().catch(() => ''); }
    async function api(url, init = {}) {
        const headers = new Headers(init.headers);
        const method = (init.method || 'GET').toUpperCase();
        if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type'))
            headers.set('Content-Type', 'application/json');
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken)
            headers.set('X-CSRF-Token', csrfToken);
        let response;
        try {
            response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
        }
        catch (cause) {
            throw new ApiError(cause instanceof Error ? cause.message : '网络连接失败', 0, {});
        }
        const payload = await parsePayload(response);
        if (response.status === 401)
            unauthorizedHandler?.();
        if (!response.ok) {
            const body = asObject(payload);
            throw new ApiError(text(body.error, `请求失败（${response.status}）`), response.status, body);
        }
        return payload;
    }
    async function secureApi(url, init = {}) {
        try {
            return await api(url, init);
        }
        catch (cause) {
            if (!(cause instanceof ApiError) || cause.status !== 403 || !cause.message.includes('二次验证') || !elevationHandler)
                throw cause;
            await elevationHandler();
            return api(url, init);
        }
    }
    function errorDetail(cause) { return cause instanceof ApiError ? cause.detail : cause instanceof Error ? cause.message : String(cause || '未知错误'); }
    function useRoute() {
        const normalize = useCallback((path) => LEGACY_REDIRECTS[path] || (ROUTE_MAP.has(path) ? path : '/'), []);
        const [path, setPath] = useState(() => normalize(window.__LUKEPANEL_TEST_PATH__ || location.pathname));
        useEffect(() => {
            if (location.origin !== 'null' && location.pathname !== path)
                history.replaceState({}, '', path);
            const onPop = () => setPath(normalize(location.pathname));
            window.addEventListener('popstate', onPop);
            return () => window.removeEventListener('popstate', onPop);
        }, [normalize, path]);
        const navigate = useCallback((next, replace = false) => {
            const target = normalize(next);
            if (target === path && !replace)
                return;
            if (location.origin !== 'null')
                history[replace ? 'replaceState' : 'pushState']({}, '', target);
            setPath(target);
            window.scrollTo({ top: 0, behavior: 'auto' });
        }, [normalize, path]);
        return { path, navigate };
    }
    function useResource(loader, deps = []) {
        const [data, setData] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState('');
        const generation = useRef(0);
        const reload = useCallback(async (silent = false) => {
            const current = ++generation.current;
            if (!silent)
                setLoading(true);
            setError('');
            try {
                const result = await loader();
                if (current === generation.current)
                    setData(result);
            }
            catch (cause) {
                if (current === generation.current)
                    setError(errorDetail(cause));
            }
            finally {
                if (current === generation.current)
                    setLoading(false);
            }
        }, deps);
        useEffect(() => { void reload(); return () => { generation.current++; }; }, [reload]);
        return { data, setData, loading, error, reload };
    }
    function Button({ children, icon, tone = 'default', busy = false, disabled = false, type = 'button', onClick, className = '', title, ariaLabel, ...buttonProps }) {
        const resolvedAriaLabel = ariaLabel || buttonProps['aria-label'] || (!children ? title : undefined);
        return React.createElement("button", { ...buttonProps, type: type, title: title, "aria-label": resolvedAriaLabel, className: `button button-${tone} ${className}`, disabled: disabled || busy, onClick: onClick },
            busy ? React.createElement("span", { className: "spinner" }) : icon ? React.createElement(Icon, { name: icon, size: 17 }) : null,
            children ? React.createElement("span", null, children) : null);
    }
    function Badge({ children, tone = 'neutral', title }) { return React.createElement("span", { className: `badge badge-${tone}`, title: title }, children); }
    function Card({ children, className = '' }) { return React.createElement("section", { className: `card ${className}` }, children); }
    function SectionTitle({ title, subtitle, actions }) { return React.createElement("div", { className: "section-title" },
        React.createElement("div", null,
            React.createElement("h2", null, title),
            subtitle ? React.createElement("p", null, subtitle) : null),
        actions ? React.createElement("div", { className: "section-actions" }, actions) : null); }
    function Field({ label, hint, children, className = '' }) { return React.createElement("label", { className: `field ${className}` },
        React.createElement("span", { className: "field-label" }, label),
        children,
        hint ? React.createElement("small", null, hint) : null); }
    function TextInput(props) { return React.createElement("input", { ...props, className: `input ${props.className || ''}` }); }
    function SelectInput(props) { return React.createElement("select", { ...props, className: `input ${props.className || ''}` }, props.children); }
    function TextArea(props) { return React.createElement("textarea", { ...props, className: `input textarea ${props.className || ''}` }); }
    function Toggle({ checked, onChange, label, description, disabled = false }) {
        return React.createElement("label", { className: `toggle-row ${disabled ? 'is-disabled' : ''}` },
            React.createElement("span", null,
                React.createElement("strong", null, label),
                description ? React.createElement("small", null, description) : null),
            React.createElement("input", { type: "checkbox", checked: checked, disabled: disabled, onChange: (event) => onChange(event.target.checked) }),
            React.createElement("span", { className: "switch" }));
    }
    function EmptyState({ icon = 'info', title, description, action }) { return React.createElement("div", { className: "empty-state" },
        React.createElement("span", { className: "empty-icon" },
            React.createElement(Icon, { name: icon, size: 27 })),
        React.createElement("strong", null, title),
        description ? React.createElement("p", null, description) : null,
        action); }
    function ErrorState({ error, retry }) { return React.createElement("div", { className: "error-state" },
        React.createElement(Icon, { name: "warning", size: 22 }),
        React.createElement("div", null,
            React.createElement("strong", null, "\u52A0\u8F7D\u5931\u8D25"),
            React.createElement("pre", null, error)),
        retry ? React.createElement(Button, { tone: "ghost", onClick: retry }, "\u91CD\u8BD5") : null); }
    function LoadingState({ rows = 4 }) { return React.createElement("div", { className: "skeleton-list" }, Array.from({ length: rows }, (_, index) => React.createElement("div", { className: "skeleton-row", key: index },
        React.createElement("span", null),
        React.createElement("span", null)))); }
    function Progress({ value, tone = 'primary' }) { const safe = Math.max(0, Math.min(100, value)); return React.createElement("div", { className: "progress" },
        React.createElement("span", { className: `progress-${tone}`, style: { width: `${safe}%` } })); }
    function KeyValue({ label, value, mono = false }) { return React.createElement("div", { className: "key-value" },
        React.createElement("dt", null, label),
        React.createElement("dd", { className: mono ? 'mono' : '' }, value)); }
    function Terminal({ children, maxHeight = 420 }) { return React.createElement("pre", { className: "terminal", style: { maxHeight } }, children || '暂无输出'); }
    function JsonDetails({ data, title = '原始数据' }) { return React.createElement("details", { className: "json-details" },
        React.createElement("summary", null, title),
        React.createElement(Terminal, null, JSON.stringify(data, null, 2))); }
    function PageHeader({ route, navigate, busy, onRefresh, actions }) {
        return React.createElement("header", { className: "page-header" },
            React.createElement("div", { className: "page-heading" },
                route.parent ? React.createElement("button", { className: "back-button", onClick: () => navigate(route.parent), "aria-label": `返回${ROUTE_MAP.get(route.parent)?.title || '上级页面'}` },
                    React.createElement(Icon, { name: "back", size: 21 })) : null,
                React.createElement("div", null,
                    React.createElement("h1", null, route.title),
                    React.createElement("p", null, route.subtitle))),
            React.createElement("div", { className: "page-actions" },
                actions,
                onRefresh ? React.createElement(Button, { tone: "ghost", icon: "refresh", busy: busy, onClick: onRefresh }, "\u5237\u65B0") : null));
    }
    function Modal({ state, onClose, returnFocus }) {
        const dialogRef = useRef(null);
        const onCloseRef = useRef(onClose);
        useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
        useEffect(() => {
            if (!state)
                return;
            const previousFocus = returnFocus || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
            const dialog = dialogRef.current;
            const focusables = () => Array.from(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || []).filter(element => element.offsetParent !== null);
            const initial = dialog?.querySelector('[autofocus]') || focusables()[0] || dialog;
            const focusTimer = window.setTimeout(() => initial?.focus(), 0);
            const onKey = (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onCloseRef.current();
                    return;
                }
                if (event.key !== 'Tab')
                    return;
                const items = focusables();
                if (!items.length) {
                    event.preventDefault();
                    dialog?.focus();
                    return;
                }
                const first = items[0];
                const last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            };
            document.body.classList.add('modal-open');
            window.addEventListener('keydown', onKey);
            return () => {
                window.clearTimeout(focusTimer);
                document.body.classList.remove('modal-open');
                window.removeEventListener('keydown', onKey);
                window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
                    if (!document.querySelector('.modal') && previousFocus?.isConnected)
                        previousFocus.focus({ preventScroll: true });
                }));
            };
        }, [state, returnFocus]);
        if (!state)
            return null;
        return React.createElement("div", { className: "modal-backdrop", role: "presentation", onMouseDown: (event) => { if (event.target === event.currentTarget)
                onClose(); } },
            React.createElement("section", { ref: dialogRef, tabIndex: -1, className: `modal modal-${state.size || 'medium'}`, role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title" },
                React.createElement("header", null,
                    React.createElement("h2", { id: "modal-title" }, state.title),
                    React.createElement("button", { className: "icon-button", onClick: onClose, "aria-label": "\u5173\u95ED" },
                        React.createElement(Icon, { name: "close" }))),
                React.createElement("div", { className: "modal-body" }, state.content)));
    }
    function Toasts({ items, dismiss }) { return React.createElement("div", { className: "toast-stack", "aria-live": "polite" }, items.map(item => React.createElement("article", { className: `toast toast-${item.kind}`, key: item.id },
        React.createElement(Icon, { name: item.kind === 'success' ? 'check' : item.kind === 'error' ? 'warning' : 'info', size: 20 }),
        React.createElement("div", null,
            React.createElement("strong", null, item.title),
            item.detail ? React.createElement("pre", null, item.detail) : null),
        React.createElement("button", { onClick: () => dismiss(item.id), "aria-label": "\u5173\u95ED" },
            React.createElement(Icon, { name: "close", size: 16 }))))); }
    function LoginPage({ onAuthenticated, notify }) {
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
        const [totp, setTotp] = useState('');
        const [totpRequired, setTotpRequired] = useState(false);
        const [busy, setBusy] = useState(false);
        const submit = async (event) => { event.preventDefault(); setBusy(true); try {
            const result = await api('/api/v1/auth/login', { method: 'POST', body: jsonBody({ username: username.trim(), password, otp: totp.trim() }) });
            if (result.totp_required) {
                setTotpRequired(true);
                notify('info', '请输入两步验证码');
                return;
            }
            onAuthenticated(result);
        }
        catch (cause) {
            if (cause instanceof ApiError && cause.code === 'totp_required') {
                setTotpRequired(true);
                notify('info', '请输入两步验证码');
            }
            else
                notify('error', '登录失败', errorDetail(cause));
        }
        finally {
            setBusy(false);
        } };
        const passkey = async () => {
            setBusy(true);
            try {
                const begin = await api('/api/v1/auth/passkey/login/begin', { method: 'POST', body: jsonBody({ username: username.trim() }) });
                const publicKey = normalizeRequestOptions(begin.public_key || begin.options || begin);
                const credential = await navigator.credentials.get({ publicKey });
                if (!credential)
                    throw new Error('未取得 Passkey 凭据');
                const result = await api('/api/v1/auth/passkey/login/finish', { method: 'POST', body: jsonBody({ flow_id: begin.flow_id, credential: serializeCredential(credential) }) });
                onAuthenticated(result);
            }
            catch (cause) {
                notify('error', 'Passkey 登录失败', errorDetail(cause));
            }
            finally {
                setBusy(false);
            }
        };
        return React.createElement("main", { className: "login-layout" },
            React.createElement("section", { className: "login-brand" },
                React.createElement("div", { className: "brand-mark" },
                    React.createElement("img", { src: "/assets/lukepanel-icon-192.png", alt: "" }),
                    React.createElement("div", null,
                        React.createElement("strong", null, "LukePanel"),
                        React.createElement("span", null, "SERVER CONTROL"))),
                React.createElement("div", { className: "login-hero" },
                    React.createElement("span", { className: "eyebrow" }, "LIGHTWEIGHT SERVER CONTROL"),
                    React.createElement("h1", null, "\u628A\u670D\u52A1\u5668\u7BA1\u7406\uFF0C\u6536\u8FDB\u4E00\u4E2A\u6E05\u6670\u7684\u754C\u9762\u3002"),
                    React.createElement("p", null, "LukePanel \u4E13\u6CE8\u4E8E VPS \u4E0E\u5BB6\u5EAD\u670D\u52A1\u5668\u7684\u65E5\u5E38\u8FD0\u7EF4\uFF0C\u6240\u6709\u9AD8\u98CE\u9669\u64CD\u4F5C\u90FD\u8981\u6C42\u4E8C\u6B21\u786E\u8BA4\u3002")),
                React.createElement("footer", null,
                    "LukePanel ",
                    VERSION,
                    " \u00B7 React 18")),
            React.createElement("section", { className: "login-panel" },
                React.createElement("form", { className: "login-card", onSubmit: submit },
                    React.createElement("div", { className: "login-card-title" },
                        React.createElement("img", { src: "/assets/favicon-64.png", alt: "" }),
                        React.createElement("div", null,
                            React.createElement("h2", null, "\u767B\u5F55 LukePanel"),
                            React.createElement("p", null, "\u4F7F\u7528\u9762\u677F\u8D26\u6237\u7EE7\u7EED"))),
                    React.createElement(Field, { label: "\u7528\u6237\u540D" },
                        React.createElement(TextInput, { name: "username", autoCapitalize: "none", autoCorrect: "off", autoComplete: "username", value: username, onChange: (event) => setUsername(event.target.value), required: true })),
                    React.createElement(Field, { label: "\u5BC6\u7801" },
                        React.createElement(TextInput, { name: "password", type: "password", autoComplete: "current-password", value: password, onChange: (event) => setPassword(event.target.value), required: true })),
                    totpRequired ? React.createElement(Field, { label: "\u4E24\u6B65\u9A8C\u8BC1\u7801", hint: "\u8F93\u5165\u9A8C\u8BC1\u5668\u4E2D\u7684 6 \u4F4D\u9A8C\u8BC1\u7801\u6216\u6062\u590D\u7801" },
                        React.createElement(TextInput, { name: "otp", inputMode: "numeric", autoComplete: "one-time-code", value: totp, onChange: (event) => setTotp(event.target.value), autoFocus: true, required: true })) : null,
                    React.createElement(Button, { type: "submit", tone: "primary", busy: busy, className: "full-width" }, "\u767B\u5F55"),
                    typeof PublicKeyCredential !== 'undefined' ? React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "login-divider" },
                            React.createElement("span", null, "\u6216")),
                        React.createElement(Button, { icon: "key", busy: busy, onClick: passkey, className: "full-width" }, "\u4F7F\u7528 Passkey")) : null,
                    React.createElement("p", { className: "login-note" },
                        React.createElement(Icon, { name: "security", size: 16 }),
                        "\u767B\u5F55\u72B6\u6001\u4EC5\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668\u5B89\u5168\u4F1A\u8BDD\u4E2D"))));
    }
    function normalizeRequestOptions(options) {
        const allow = options.allowCredentials || options.allow_credentials || [];
        return {
            challenge: typeof options.challenge === 'string' ? base64urlToBuffer(options.challenge) : options.challenge,
            rpId: options.rpId || options.rp_id,
            timeout: options.timeout || 60000,
            userVerification: options.userVerification || options.user_verification || 'preferred',
            allowCredentials: allow.map((item) => ({ type: item.type || 'public-key', id: typeof item.id === 'string' ? base64urlToBuffer(item.id) : item.id, transports: item.transports }))
        };
    }
    function normalizeCreationOptions(options) {
        const user = options.user || {};
        const selection = options.authenticatorSelection || options.authenticator_selection;
        const excluded = options.excludeCredentials || options.exclude_credentials || [];
        return {
            challenge: typeof options.challenge === 'string' ? base64urlToBuffer(options.challenge) : options.challenge,
            rp: options.rp,
            user: { id: typeof user.id === 'string' ? base64urlToBuffer(user.id) : user.id, name: user.name, displayName: user.displayName || user.display_name || user.name },
            pubKeyCredParams: options.pubKeyCredParams || options.pub_key_cred_params || [{ type: 'public-key', alg: -7 }],
            timeout: options.timeout || 60000,
            attestation: options.attestation || 'none',
            authenticatorSelection: selection ? { residentKey: selection.residentKey || selection.resident_key, userVerification: selection.userVerification || selection.user_verification } : undefined,
            excludeCredentials: excluded.map((item) => ({ type: item.type || 'public-key', id: typeof item.id === 'string' ? base64urlToBuffer(item.id) : item.id, transports: item.transports }))
        };
    }
    function base64urlToBuffer(value) { const normalized = value.replace(/-/g, '+').replace(/_/g, '/'); const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4); const binary = atob(padded); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index++)
        bytes[index] = binary.charCodeAt(index); return bytes.buffer; }
    function bufferToBase64url(value) { if (!value)
        return ''; const bytes = new Uint8Array(value); let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function serializeCredential(credential) {
        const response = credential.response;
        return {
            id: credential.id,
            raw_id: bufferToBase64url(credential.rawId),
            response: {
                client_data_json: bufferToBase64url(response.clientDataJSON),
                authenticator_data: response.authenticatorData ? bufferToBase64url(response.authenticatorData) : undefined,
                signature: response.signature ? bufferToBase64url(response.signature) : undefined,
                user_handle: response.userHandle ? bufferToBase64url(response.userHandle) : undefined,
                attestation_object: response.attestationObject ? bufferToBase64url(response.attestationObject) : undefined,
                transports: typeof response.getTransports === 'function' ? response.getTransports() : undefined
            }
        };
    }
    function DashboardPage(props) {
        const resource = useResource(async () => {
            const overview = asObject(await api('/api/v1/system/overview'));
            const [dockerResult, securityResult] = await Promise.allSettled([
                api('/api/v1/docker/status'),
                api('/api/v1/security/status')
            ]);
            const docker = dockerResult.status === 'fulfilled'
                ? asObject(dockerResult.value)
                : { _load_error: errorDetail(dockerResult.reason) };
            const security = securityResult.status === 'fulfilled'
                ? asObject(securityResult.value)
                : { _load_error: errorDetail(securityResult.reason) };
            return { overview, docker, security };
        }, []);
        const data = resource.data || { overview: {}, docker: {}, security: {} };
        const overview = data.overview;
        const cpu = number(overview.cpu_percent ?? overview.cpu?.percent);
        const memoryUsed = number(overview.memory?.used ?? overview.memory?.Used);
        const memoryTotal = number(overview.memory?.total ?? overview.memory?.Total);
        const memoryPct = number(overview.memory?.percent, memoryTotal ? memoryUsed / memoryTotal * 100 : 0);
        const swapUsed = number(overview.swap?.used ?? overview.swap?.Used);
        const swapTotal = number(overview.swap?.total ?? overview.swap?.Total);
        const swapPct = number(overview.swap?.percent, swapTotal ? swapUsed / swapTotal * 100 : 0);
        const disk = listOf(overview.disks)[0] || overview.disk || {};
        const diskPct = number(disk.percent, number(disk.total ?? disk.Total) ? number(disk.used ?? disk.Used) / number(disk.total ?? disk.Total) * 100 : 0);
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: resource.loading, onRefresh: () => resource.reload() }),
            resource.error ? React.createElement(ErrorState, { error: resource.error, retry: () => resource.reload() }) : resource.loading && !resource.data ? React.createElement(LoadingState, { rows: 6 }) : React.createElement(React.Fragment, null,
                React.createElement("div", { className: "status-line" },
                    React.createElement("span", { className: "live-dot" }),
                    React.createElement("strong", null, "\u5B9E\u65F6\u72B6\u6001"),
                    React.createElement("span", null, text(overview.hostname, '服务器')),
                    React.createElement("time", null, formatDate(overview.collected_at))),
                React.createElement("section", { className: "metric-grid" },
                    React.createElement(Metric, { title: "\u8FD0\u884C\u65F6\u95F4", value: formatDuration(overview.uptime_seconds), detail: text(overview.platform || overview.os, 'Linux'), icon: "server" }),
                    React.createElement(Metric, { title: "CPU \u4F7F\u7528\u7387", value: `${cpu.toFixed(1)}%`, detail: `${text(overview.cpu_cores ?? overview.cpu?.cores, '—')} 核 · 负载 ${number(overview.load_1 ?? overview.load?.[0]).toFixed(2)}`, icon: "process", tone: cpu > 90 ? 'danger' : cpu > 70 ? 'warning' : 'normal' }),
                    React.createElement(Metric, { title: "\u5185\u5B58\u4F7F\u7528\u7387", value: `${memoryPct.toFixed(1)}%`, detail: `${formatBytes(memoryUsed)} / ${formatBytes(memoryTotal)}`, icon: "storage", tone: memoryPct > 90 ? 'danger' : memoryPct > 75 ? 'warning' : 'normal' }),
                    React.createElement(Metric, { title: "\u7CFB\u7EDF\u76D8", value: `${diskPct.toFixed(1)}%`, detail: `${formatBytes(disk.used ?? disk.Used)} / ${formatBytes(disk.total ?? disk.Total)}`, icon: "storage", tone: diskPct > 90 ? 'danger' : diskPct > 80 ? 'warning' : 'normal' })),
                React.createElement("section", { className: "dashboard-grid" },
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u8D44\u6E90\u4F7F\u7528", subtitle: "\u670D\u52A1\u5668\u5F53\u524D\u8D44\u6E90\u5360\u7528", actions: React.createElement(Button, { tone: "ghost", onClick: () => props.navigate('/system/processes') }, "\u67E5\u770B\u8FDB\u7A0B") }),
                        React.createElement(ResourceRow, { label: "CPU", value: `${cpu.toFixed(1)}%`, detail: `${text(overview.cpu_cores ?? overview.cpu?.cores, '—')} 核心`, percent: cpu }),
                        React.createElement(ResourceRow, { label: "\u5185\u5B58", value: `${memoryPct.toFixed(1)}%`, detail: `${formatBytes(memoryUsed)} / ${formatBytes(memoryTotal)}`, percent: memoryPct }),
                        React.createElement(ResourceRow, { label: "\u7CFB\u7EDF\u76D8", value: `${diskPct.toFixed(1)}%`, detail: text(disk.mount ?? disk.mountpoint, '/'), percent: diskPct }),
                        React.createElement(ResourceRow, { label: "Swap", value: swapTotal ? `${swapPct.toFixed(1)}%` : '未配置', detail: swapTotal ? `${formatBytes(swapUsed)} / ${formatBytes(swapTotal)}` : '可在主机设置中创建', percent: swapPct })),
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u8FD0\u884C\u73AF\u5883", subtitle: "\u57FA\u7840\u7CFB\u7EDF\u4E0E\u5B89\u5168\u72B6\u6001" }),
                        React.createElement("dl", { className: "key-value-list" },
                            React.createElement(KeyValue, { label: "\u4E3B\u673A\u540D", value: text(overview.hostname) }),
                            React.createElement(KeyValue, { label: "\u7CFB\u7EDF", value: text(overview.os || overview.platform) }),
                            React.createElement(KeyValue, { label: "\u5185\u6838", value: text(overview.kernel), mono: true }),
                            React.createElement(KeyValue, { label: "\u67B6\u6784", value: text(overview.architecture || overview.arch) }),
                            React.createElement(KeyValue, { label: "Docker", value: data.docker._load_error
                                    ? React.createElement(Badge, { tone: "danger", title: text(data.docker._load_error) }, "\u8BFB\u53D6\u5931\u8D25")
                                    : data.docker.available === true
                                        ? React.createElement(Badge, { tone: "success" },
                                            "\u53EF\u7528 \u00B7 ",
                                            text(data.docker.version, '版本未知'))
                                        : data.docker.available === false
                                            ? React.createElement(Badge, { tone: "warning", title: text(data.docker.error) }, "\u4E0D\u53EF\u7528")
                                            : React.createElement(Badge, { tone: "neutral" }, "\u72B6\u6001\u672A\u77E5") }),
                            React.createElement(KeyValue, { label: "\u5B89\u5168\u8BC4\u5206", value: data.security._load_error
                                    ? React.createElement(Badge, { tone: "danger", title: text(data.security._load_error) }, "\u8BFB\u53D6\u5931\u8D25")
                                    : data.security.score === undefined || data.security.score === null
                                        ? React.createElement(Badge, { tone: "neutral" }, "\u672A\u8BC4\u4F30")
                                        : text(data.security.score) })))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u5FEB\u6377\u5165\u53E3", subtitle: "\u5E38\u7528\u7BA1\u7406\u80FD\u529B" }),
                    React.createElement("div", { className: "shortcut-grid" }, [['文件管理', '浏览、编辑与安全上传', '/files', 'files'], ['软件管理', '更新系统和管理软件源', '/system/updates', 'package'], ['日志中心', '审计操作和系统日志', '/audit', 'audit'], ['安全中心', '防火墙与登录防护', '/security', 'security']].map(item => React.createElement("button", { className: "shortcut", key: item[2], onClick: () => props.navigate(item[2]) },
                        React.createElement("span", null,
                            React.createElement(Icon, { name: item[3] })),
                        React.createElement("div", null,
                            React.createElement("strong", null, item[0]),
                            React.createElement("small", null, item[1])),
                        React.createElement(Icon, { name: "chevron", size: 17 })))))));
    }
    function Metric({ title, value, detail, icon, tone = 'normal' }) { return React.createElement(Card, { className: `metric metric-${tone}` },
        React.createElement("div", { className: "metric-icon" },
            React.createElement(Icon, { name: icon })),
        React.createElement("div", null,
            React.createElement("span", null, title),
            React.createElement("strong", null, value),
            React.createElement("small", null, detail))); }
    function ResourceRow({ label, value, detail, percent }) { return React.createElement("div", { className: "resource-row" },
        React.createElement("div", null,
            React.createElement("strong", null, label),
            React.createElement("span", null, value)),
        React.createElement(Progress, { value: percent, tone: percent > 90 ? 'danger' : percent > 75 ? 'warning' : 'primary' }),
        React.createElement("small", null, detail)); }
    function SystemPage(props) {
        const entries = ROUTES.filter(route => route.parent === '/system');
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props }),
            React.createElement(Card, null,
                React.createElement(SectionTitle, { title: "\u7CFB\u7EDF\u7BA1\u7406", subtitle: "\u8FDB\u5165\u5177\u4F53\u6A21\u5757\u540E\u624D\u663E\u793A\u8FD4\u56DE\u6309\u94AE\uFF1B\u5F53\u524D\u4E00\u7EA7\u9875\u9762\u4E0D\u663E\u793A\u8FD4\u56DE" }),
                React.createElement("div", { className: "module-grid" }, entries.map(route => React.createElement("button", { className: "module-card", key: route.path, onClick: () => props.navigate(route.path) },
                    React.createElement("span", { className: "module-icon" },
                        React.createElement(Icon, { name: route.icon })),
                    React.createElement("div", null,
                        React.createElement("strong", null, route.title),
                        React.createElement("p", null, route.subtitle)),
                    React.createElement(Icon, { name: "chevron", size: 18 }))))));
    }
    function ServicesPage(props) {
        const [search, setSearch] = useState('');
        const [working, setWorking] = useState('');
        const resource = useResource(() => api(`/api/v1/system/services${query({ query: search })}`), [search]);
        const services = listOf(resource.data, 'services', 'items');
        const act = async (service, action) => { const key = `${service.name}:${action}`; setWorking(key); try {
            await secureApi('/api/v1/system/services/action', { method: 'POST', body: jsonBody({ name: service.name, action }) });
            props.notify('success', `${service.name} 已${action === 'restart' ? '重启' : action === 'start' ? '启动' : '停止'}`);
            await resource.reload(true);
        }
        catch (cause) {
            props.notify('error', '服务操作失败', errorDetail(cause));
        }
        finally {
            setWorking('');
        } };
        const logs = async (service) => { try {
            const out = await api(`/api/v1/system/services/logs${query({ name: service.name, lines: 400 })}`);
            props.openModal({ title: `${service.name} · 日志`, size: 'large', content: React.createElement(Terminal, { maxHeight: 620 }, out.logs || out.output) });
        }
        catch (cause) {
            props.notify('error', '读取日志失败', errorDetail(cause));
        } };
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: resource.loading, onRefresh: () => resource.reload(), actions: React.createElement("div", { className: "search-box" },
                    React.createElement(Icon, { name: "search", size: 17 }),
                    React.createElement("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "\u641C\u7D22\u670D\u52A1" })) }),
            resource.error ? React.createElement(ErrorState, { error: resource.error, retry: () => resource.reload() }) : resource.loading && !resource.data ? React.createElement(LoadingState, null) : services.length ? React.createElement("div", { className: "card-list" }, services.map(service => { const active = String(service.active_state || service.active || '').toLowerCase() === 'active' || service.running; return React.createElement(Card, { className: "service-card", key: service.name },
                React.createElement("div", { className: "list-main" },
                    React.createElement("span", { className: `state-indicator ${active ? 'is-up' : 'is-down'}` }),
                    React.createElement("div", null,
                        React.createElement("strong", null, service.name),
                        React.createElement("p", null, text(service.description)),
                        React.createElement("div", { className: "inline-meta" },
                            React.createElement(Badge, { tone: active ? 'success' : 'neutral' }, text(service.active_state || service.active || service.status, active ? 'active' : 'inactive')),
                            React.createElement("span", null, text(service.sub_state || service.sub)),
                            React.createElement("span", null, text(service.enabled))))),
                React.createElement("div", { className: "list-actions" },
                    React.createElement(Button, { icon: "play", busy: working === `${service.name}:start`, disabled: active, onClick: () => act(service, 'start') }, "\u542F\u52A8"),
                    React.createElement(Button, { icon: "restart", busy: working === `${service.name}:restart`, onClick: () => act(service, 'restart') }, "\u91CD\u542F"),
                    React.createElement(Button, { icon: "stop", tone: "danger", busy: working === `${service.name}:stop`, disabled: !active, onClick: () => act(service, 'stop') }, "\u505C\u6B62"),
                    React.createElement(Button, { tone: "ghost", icon: "audit", onClick: () => logs(service) }, "\u65E5\u5FD7"))); })) : React.createElement(EmptyState, { icon: "services", title: "\u6CA1\u6709\u5339\u914D\u7684\u670D\u52A1", description: "\u8C03\u6574\u641C\u7D22\u6761\u4EF6\u540E\u91CD\u8BD5" }));
    }
    function ProcessesPage(props) {
        const [search, setSearch] = useState('');
        const [sort, setSort] = useState('cpu');
        const resource = useResource(() => api('/api/v1/system/processes'), []);
        const source = listOf(resource.data, 'processes', 'items');
        const processes = useMemo(() => { const value = (item) => sort === 'cpu' ? number(item.cpu_percent ?? item.cpu) : sort === 'memory' ? number(item.memory_bytes ?? item.memory_percent ?? item.memory) : number(item.pid); return source.filter(item => `${item.pid} ${item.user} ${item.command} ${item.name}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => value(b) - value(a)); }, [source, search, sort]);
        const signal = async (item, name) => { if (!await props.confirm(name === 'kill' ? '强制结束进程' : '结束进程', `PID ${item.pid} · ${text(item.command || item.name)}`, name === 'kill' ? '强制结束' : '发送 SIGTERM', name === 'kill'))
            return; try {
            await secureApi('/api/v1/system/processes/action', { method: 'POST', body: jsonBody({ pid: item.pid, signal: name }) });
            props.notify('success', '信号已发送');
            await resource.reload(true);
        }
        catch (cause) {
            props.notify('error', '进程操作失败', errorDetail(cause));
        } };
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: resource.loading, onRefresh: () => resource.reload(), actions: React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "search-box" },
                        React.createElement(Icon, { name: "search", size: 17 }),
                        React.createElement("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "PID\u3001\u7528\u6237\u6216\u547D\u4EE4" })),
                    React.createElement(SelectInput, { "aria-label": "\u8FDB\u7A0B\u6392\u5E8F\u65B9\u5F0F", value: sort, onChange: (event) => setSort(event.target.value) },
                        React.createElement("option", { value: "cpu" }, "CPU \u6392\u5E8F"),
                        React.createElement("option", { value: "memory" }, "\u5185\u5B58\u6392\u5E8F"),
                        React.createElement("option", { value: "pid" }, "PID \u6392\u5E8F"))) }),
            resource.error ? React.createElement(ErrorState, { error: resource.error, retry: () => resource.reload() }) : React.createElement(Card, { className: "table-card" },
                React.createElement("div", { className: "responsive-table process-table" },
                    React.createElement("div", { className: "table-head" },
                        React.createElement("span", null, "PID"),
                        React.createElement("span", null, "\u7528\u6237"),
                        React.createElement("span", null, "\u8FDB\u7A0B"),
                        React.createElement("span", null, "CPU"),
                        React.createElement("span", null, "\u5185\u5B58"),
                        React.createElement("span", null, "\u64CD\u4F5C")),
                    processes.map(item => React.createElement("div", { className: "table-row", key: item.pid },
                        React.createElement("span", { "data-label": "PID", className: "mono" }, item.pid),
                        React.createElement("span", { "data-label": "\u7528\u6237" }, text(item.user)),
                        React.createElement("span", { "data-label": "\u8FDB\u7A0B" },
                            React.createElement("strong", null, text(item.name || String(item.command || '').split(' ')[0])),
                            React.createElement("small", { className: "mono" }, truncate(item.command, 120))),
                        React.createElement("span", { "data-label": "CPU" },
                            number(item.cpu ?? item.cpu_percent).toFixed(1),
                            "%"),
                        React.createElement("span", { "data-label": "\u5185\u5B58" }, item.memory_bytes ? formatBytes(item.memory_bytes) : `${number(item.memory ?? item.memory_percent).toFixed(1)}%`),
                        React.createElement("span", { "data-label": "\u64CD\u4F5C", className: "row-buttons" },
                            React.createElement(Button, { tone: "ghost", onClick: () => signal(item, 'term') }, "\u7ED3\u675F"),
                            React.createElement(Button, { tone: "danger", onClick: () => signal(item, 'kill') }, "\u5F3A\u5236")))),
                    !processes.length && !resource.loading ? React.createElement(EmptyState, { icon: "process", title: "\u6CA1\u6709\u5339\u914D\u7684\u8FDB\u7A0B" }) : null)));
    }
    function NetworkPage(props) {
        const resource = useResource(() => api('/api/v1/system/network'), []);
        const interfaces = listOf(resource.data, 'interfaces');
        const object = asObject(resource.data);
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: resource.loading, onRefresh: () => resource.reload() }),
            resource.error ? React.createElement(ErrorState, { error: resource.error, retry: () => resource.reload() }) : resource.loading && !resource.data ? React.createElement(LoadingState, null) : React.createElement(React.Fragment, null,
                React.createElement("section", { className: "interface-grid" }, interfaces.map(item => React.createElement(Card, { className: "interface-card", key: item.name },
                    React.createElement("div", { className: "card-topline" },
                        React.createElement("strong", null, text(item.name)),
                        React.createElement(Badge, { tone: String(item.flags || '').toUpperCase().includes('UP') || item.up ? 'success' : 'neutral' }, item.up ? 'UP' : text(item.flags))),
                    React.createElement("div", { className: "address-list" },
                        listOf(item.addresses).map(address => React.createElement("code", { key: address }, address)),
                        !listOf(item.addresses).length ? React.createElement("span", null, "\u65E0\u5730\u5740") : null),
                    React.createElement("div", { className: "split-meta" },
                        React.createElement("span", null,
                            "MTU ",
                            text(item.mtu)),
                        React.createElement("span", null,
                            "\u2193 ",
                            formatBytes(item.received_bytes ?? item.rx_bytes)),
                        React.createElement("span", null,
                            "\u2191 ",
                            formatBytes(item.sent_bytes ?? item.tx_bytes)))))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u76D1\u542C\u7AEF\u53E3", subtitle: "\u6765\u81EA\u7CFB\u7EDF\u5F53\u524D\u76D1\u542C\u72B6\u6001" }),
                    React.createElement(Terminal, null, text(object.listening || object.listeners, '未读取到监听端口'))),
                object.connections ? React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u6D3B\u52A8\u8FDE\u63A5" }),
                    React.createElement(Terminal, null, typeof object.connections === 'string' ? object.connections : JSON.stringify(object.connections, null, 2))) : null));
    }
    function StoragePage(props) {
        const [showVirtual, setShowVirtual] = useState(false);
        const resource = useResource(() => api('/api/v1/system/storage'), []);
        const all = listOf(resource.data, 'mounts', 'filesystems');
        const mounts = showVirtual ? all : all.filter(item => !item.virtual);
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: resource.loading, onRefresh: () => resource.reload(), actions: React.createElement(Toggle, { checked: showVirtual, onChange: setShowVirtual, label: "\u663E\u793A\u865A\u62DF\u6302\u8F7D" }) }),
            resource.error ? React.createElement(ErrorState, { error: resource.error, retry: () => resource.reload() }) : React.createElement("section", { className: "storage-grid" },
                mounts.map(item => { const total = number(item.total); const used = number(item.used); const percent = number(item.percent, total ? used / total * 100 : 0); return React.createElement(Card, { className: "storage-card", key: `${item.mountpoint || item.mount}-${item.device}` },
                    React.createElement("div", { className: "card-topline" },
                        React.createElement("strong", null, text(item.mountpoint || item.mount)),
                        item.virtual ? React.createElement(Badge, null, "\u865A\u62DF") : React.createElement(Badge, { tone: percent > 90 ? 'danger' : percent > 80 ? 'warning' : 'success' },
                            percent.toFixed(1),
                            "%")),
                    React.createElement("code", null, text(item.device)),
                    React.createElement(Progress, { value: percent, tone: percent > 90 ? 'danger' : percent > 80 ? 'warning' : 'primary' }),
                    React.createElement("div", { className: "split-meta" },
                        React.createElement("span", null, text(item.filesystem)),
                        React.createElement("span", null,
                            formatBytes(used),
                            " / ",
                            formatBytes(total)))); }),
                !mounts.length && !resource.loading ? React.createElement(EmptyState, { icon: "storage", title: "\u6682\u65E0\u6302\u8F7D\u70B9" }) : null));
    }
    function TaskCreateForm({ props, reload }) {
        const [type, setType] = useState('service-restart');
        const [frequency, setFrequency] = useState('daily');
        const [working, setWorking] = useState(false);
        const needsTarget = type === 'service-restart' || type === 'docker-restart';
        return React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); setWorking(true); try {
                await secureApi('/api/v1/system/tasks/create', { method: 'POST', body: jsonBody({ name: values.get('name'), type, target: needsTarget ? values.get('target') : '', frequency, hour: number(values.get('hour')), minute: number(values.get('minute')), weekday: number(values.get('weekday')) }) });
                props.closeModal();
                props.notify('success', '计划任务已创建并启用');
                await reload();
            }
            catch (cause) {
                props.notify('error', '创建失败', errorDetail(cause));
            }
            finally {
                setWorking(false);
            } } },
            React.createElement(Field, { label: "\u540D\u79F0" },
                React.createElement(TextInput, { name: "name", required: true, maxLength: "80", placeholder: "\u4F8B\u5982\uFF1A\u6BCF\u65E5\u914D\u7F6E\u5907\u4EFD" })),
            React.createElement(Field, { label: "\u4EFB\u52A1\u7C7B\u578B" },
                React.createElement(SelectInput, { value: type, onChange: (event) => setType(event.target.value) },
                    React.createElement("option", { value: "service-restart" }, "\u91CD\u542F systemd \u670D\u52A1"),
                    React.createElement("option", { value: "docker-restart" }, "\u91CD\u542F Docker \u5BB9\u5668"),
                    React.createElement("option", { value: "docker-cleanup-safe" }, "\u5B89\u5168\u6E05\u7406 Docker"),
                    React.createElement("option", { value: "panel-backup" }, "\u521B\u5EFA\u9762\u677F\u5907\u4EFD"))),
            needsTarget ? React.createElement(Field, { label: type === 'service-restart' ? '服务名称' : '容器名称', hint: type === 'service-restart' ? '必须是完整的 .service 单元名' : '填写现有 Docker 容器名称' },
                React.createElement(TextInput, { name: "target", required: true, placeholder: type === 'service-restart' ? 'nginx.service' : 'nginx' })) : React.createElement("div", { className: "notice" }, type === 'docker-cleanup-safe' ? '只执行 docker system prune -f，不会删除正在使用的资源。' : '由 LukePanel 创建配置备份并按定时备份策略保留。'),
            React.createElement(Field, { label: "\u6267\u884C\u9891\u7387" },
                React.createElement(SelectInput, { value: frequency, onChange: (event) => setFrequency(event.target.value) },
                    React.createElement("option", { value: "hourly" }, "\u6BCF\u5C0F\u65F6"),
                    React.createElement("option", { value: "daily" }, "\u6BCF\u5929"),
                    React.createElement("option", { value: "weekly" }, "\u6BCF\u5468"))),
            React.createElement("div", { className: "form-grid" },
                frequency !== 'hourly' ? React.createElement(Field, { label: "\u5C0F\u65F6\uFF080-23\uFF09" },
                    React.createElement(TextInput, { name: "hour", type: "number", min: "0", max: "23", defaultValue: "3", required: true })) : React.createElement("input", { type: "hidden", name: "hour", value: "0" }),
                frequency === 'weekly' ? React.createElement(Field, { label: "\u661F\u671F" },
                    React.createElement(SelectInput, { name: "weekday", defaultValue: "1" },
                        React.createElement("option", { value: "0" }, "\u5468\u65E5"),
                        React.createElement("option", { value: "1" }, "\u5468\u4E00"),
                        React.createElement("option", { value: "2" }, "\u5468\u4E8C"),
                        React.createElement("option", { value: "3" }, "\u5468\u4E09"),
                        React.createElement("option", { value: "4" }, "\u5468\u56DB"),
                        React.createElement("option", { value: "5" }, "\u5468\u4E94"),
                        React.createElement("option", { value: "6" }, "\u5468\u516D"))) : React.createElement("input", { type: "hidden", name: "weekday", value: "0" }),
                React.createElement(Field, { label: "\u5206\u949F\uFF080-59\uFF09" },
                    React.createElement(TextInput, { name: "minute", type: "number", min: "0", max: "59", defaultValue: "0", required: true }))),
            React.createElement("div", { className: "form-actions" },
                React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u521B\u5EFA\u5E76\u542F\u7528")));
    }
    function TasksPage(props) {
        const [data, setData] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState('');
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            const [tasks, timers] = await Promise.all([api('/api/v1/system/tasks'), api('/api/v1/system/timers')]);
            setData({ tasks, timers });
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, []);
        useEffect(() => { void reload(); }, [reload]);
        const taskList = listOf(data?.tasks, 'tasks');
        const timerOutput = text(asObject(data?.timers).timers, '未读取到 systemd timer 输出');
        const createDialog = () => props.openModal({ title: '创建计划任务', content: React.createElement(TaskCreateForm, { props: props, reload: reload }) });
        const act = async (item, action) => { if (action === 'delete' && !await props.confirm('删除计划任务', '对应的 systemd service 和 timer 会一起移除。', '删除', true))
            return; try {
            await secureApi('/api/v1/system/tasks/action', { method: 'POST', body: jsonBody({ id: item.id, action }) });
            props.notify('success', action === 'run' ? '任务已开始' : action === 'delete' ? '任务已删除' : '任务状态已更新');
            await reload();
        }
        catch (cause) {
            props.notify('error', '任务操作失败', errorDetail(cause));
        } };
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload, actions: React.createElement(Button, { tone: "primary", icon: "plus", onClick: createDialog }, "\u65B0\u5EFA\u4EFB\u52A1") }),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : React.createElement(React.Fragment, null,
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u8BA1\u5212\u4EFB\u52A1", subtitle: "\u7531 LukePanel \u7BA1\u7406\u5E76\u751F\u6210\u72EC\u7ACB\u7684 systemd service \u4E0E timer" }),
                    taskList.length ? React.createElement("div", { className: "card-list compact-list" }, taskList.map(item => React.createElement("div", { className: "task-row", key: item.id },
                        React.createElement("div", null,
                            React.createElement("strong", null, text(item.name || item.id)),
                            React.createElement("code", null, taskScheduleLabel(item)),
                            React.createElement("small", null,
                                taskTypeLabel(item.type),
                                " \u00B7 ",
                                taskTargetLabel(item)),
                            item.next_run ? React.createElement("small", null,
                                "\u4E0B\u6B21\uFF1A",
                                text(item.next_run)) : null),
                        React.createElement("div", { className: "inline-meta" },
                            React.createElement(Badge, { tone: item.enabled ? 'success' : 'neutral' }, boolText(item.enabled)),
                            React.createElement("span", null, item.last_run ? `上次：${text(item.last_run)}` : '尚未运行')),
                        React.createElement("div", { className: "row-buttons" },
                            React.createElement(Button, { icon: "play", onClick: () => act(item, 'run') }, "\u8FD0\u884C"),
                            React.createElement(Button, { tone: "ghost", onClick: () => act(item, item.enabled ? 'disable' : 'enable') }, item.enabled ? '停用' : '启用'),
                            React.createElement(Button, { tone: "danger", icon: "trash", onClick: () => act(item, 'delete') }, "\u5220\u9664"))))) : !loading ? React.createElement(EmptyState, { icon: "tasks", title: "\u6682\u65E0\u8BA1\u5212\u4EFB\u52A1", description: "LukePanel \u4EC5\u5141\u8BB8\u9884\u5B9A\u4E49\u7684\u5B89\u5168\u4EFB\u52A1\u7C7B\u578B\uFF0C\u4E0D\u652F\u6301\u4EFB\u610F\u547D\u4EE4\u6267\u884C", action: React.createElement(Button, { tone: "primary", icon: "plus", onClick: createDialog }, "\u521B\u5EFA\u4EFB\u52A1") }) : React.createElement(LoadingState, null)),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u7CFB\u7EDF Timers", subtitle: "\u540E\u7AEF\u8FD4\u56DE systemctl list-timers \u7684\u539F\u59CB\u8F93\u51FA\uFF0C\u4E0D\u4F2A\u9020\u7ED3\u6784\u5316\u72B6\u6001" }),
                    React.createElement(Terminal, null, timerOutput))));
    }
    function UpdatesPage(props) {
        const [preflight, setPreflight] = useState({});
        const [sources, setSources] = useState([]);
        const [loading, setLoading] = useState(true);
        const [search, setSearch] = useState('');
        const [results, setResults] = useState([]);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            const [check, sourceData] = await Promise.all([api('/api/v1/system/apt/preflight'), api('/api/v1/system/apt/sources')]);
            setPreflight(asObject(check));
            setSources(listOf(sourceData, 'sources'));
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, []);
        useEffect(() => { void reload(); }, [reload]);
        const aptBlocked = preflight.available === false || !!preflight.locked;
        const find = async () => { if (search.trim().length < 2)
            return; setWorking(true); try {
            const out = await api(`/api/v1/system/apt/search${query({ q: search.trim() })}`);
            setResults(listOf(out, 'packages', 'results'));
        }
        catch (cause) {
            props.notify('error', '搜索失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const action = async (name, packages = []) => { const label = { download: '只下载更新', upgrade: '执行系统升级', install: '安装软件包', remove: '卸载软件包' }; if (aptBlocked) {
            props.notify('warning', preflight.available === false ? '当前系统没有 apt-get' : 'APT 正被其他进程占用', text(preflight.lock_detail));
            return;
        } if (!await props.confirm(label[name] || name, packages.length ? packages.join(', ') : '该操作可能持续数分钟，期间请勿关闭服务器。', '确认', name === 'remove'))
            return; setWorking(true); try {
            const endpoint = name === 'download' ? '/api/v1/system/apt/download' : name === 'upgrade' ? '/api/v1/system/apt/upgrade' : '/api/v1/system/apt/package';
            const result = asObject(await secureApi(endpoint, { method: 'POST', body: jsonBody(name === 'install' || name === 'remove' ? { action: name, packages } : {}) }));
            props.notify('success', `${label[name]}已完成`);
            if (result.output)
                props.openModal({ title: `${label[name]}结果`, size: 'large', content: React.createElement(Terminal, { maxHeight: 620 }, String(result.output)) });
            await reload();
            if (search)
                await find();
        }
        catch (cause) {
            props.notify('error', '软件操作失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const sourceAction = async (name, source) => { if (name === 'delete' && !await props.confirm('删除软件源', text(source?.path), '删除', true))
            return; try {
            await secureApi('/api/v1/system/apt/sources', { method: 'POST', body: jsonBody({ action: name, path: source?.path }) });
            props.notify('success', '软件源已更新');
            await reload();
        }
        catch (cause) {
            props.notify('error', '软件源操作失败', errorDetail(cause));
        } };
        const addSource = () => props.openModal({ title: '添加软件源', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); try {
                    await secureApi('/api/v1/system/apt/sources', { method: 'POST', body: jsonBody({ action: 'add', content: values.get('content'), name: values.get('name') }) });
                    props.closeModal();
                    props.notify('success', '软件源已添加');
                    await reload();
                }
                catch (cause) {
                    props.notify('error', '添加失败', errorDetail(cause));
                } } },
                React.createElement(Field, { label: "\u6587\u4EF6\u540D", hint: "\u4EC5\u586B\u5199\u6587\u4EF6\u540D\uFF0C\u4F8B\u5982 custom.sources" },
                    React.createElement(TextInput, { name: "name", placeholder: "custom.sources", required: true })),
                React.createElement(Field, { label: "\u8F6F\u4EF6\u6E90\u5185\u5BB9" },
                    React.createElement(TextArea, { name: "content", rows: 6, placeholder: "deb https://... stable main", required: true })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary" }, "\u6DFB\u52A0"))) });
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload }),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : React.createElement(React.Fragment, null,
                preflight.available === false ? React.createElement("div", { className: "notice warning" }, "\u5F53\u524D\u7CFB\u7EDF\u672A\u68C0\u6D4B\u5230 apt-get\uFF0C\u8F6F\u4EF6\u66F4\u65B0\u4E0E\u5B89\u88C5\u529F\u80FD\u4E0D\u53EF\u7528\u3002") : null,
                preflight.locked ? React.createElement("div", { className: "notice warning" },
                    "APT \u6B63\u88AB\u5176\u4ED6\u8FDB\u7A0B\u5360\u7528\uFF1A",
                    text(preflight.lock_detail, '请稍后刷新')) : null,
                preflight.reboot_required ? React.createElement("div", { className: "notice warning" }, "\u7CFB\u7EDF\u68C0\u6D4B\u5230\u9700\u8981\u91CD\u542F\u624D\u80FD\u5B8C\u6210\u5DF2\u5B89\u88C5\u66F4\u65B0\u3002") : null,
                React.createElement("section", { className: "metric-grid small" },
                    React.createElement(Metric, { title: "\u53EF\u5347\u7EA7", value: text(preflight.upgrade_count, '0'), detail: "\u4E2A\u8F6F\u4EF6\u5305", icon: "package", tone: number(preflight.upgrade_count) ? 'warning' : 'normal' }),
                    React.createElement(Metric, { title: "\u65B0\u5B89\u88C5", value: text(preflight.install_count, '0'), detail: "\u5347\u7EA7\u8FC7\u7A0B\u4E2D\u65B0\u589E", icon: "plus", tone: number(preflight.install_count) ? 'warning' : 'normal' }),
                    React.createElement(Metric, { title: "\u5C06\u5220\u9664", value: text(preflight.remove_count, '0'), detail: "\u5347\u7EA7\u8FC7\u7A0B\u4E2D\u79FB\u9664", icon: "trash", tone: number(preflight.remove_count) ? 'danger' : 'normal' }),
                    React.createElement(Metric, { title: "\u9884\u8BA1\u4E0B\u8F7D", value: formatBytes(preflight.download_bytes), detail: `磁盘变化 ${formatBytes(Math.abs(number(preflight.disk_delta_bytes)))}`, icon: "download" })),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u7CFB\u7EDF\u66F4\u65B0", subtitle: "\u6570\u636E\u6765\u81EA apt-get \u6A21\u62DF\u6267\u884C\u7ED3\u679C\uFF1B\u64CD\u4F5C\u8FD4\u56DE\u540E\u624D\u8868\u793A\u5B8C\u6210", actions: React.createElement(React.Fragment, null,
                            React.createElement(Button, { busy: working, disabled: aptBlocked, icon: "download", onClick: () => action('download') }, "\u53EA\u4E0B\u8F7D"),
                            React.createElement(Button, { busy: working, disabled: aptBlocked, tone: "primary", icon: "package", onClick: () => action('upgrade') }, "\u6267\u884C\u5347\u7EA7")) }),
                    Array.isArray(preflight.packages) && preflight.packages.length ? React.createElement(Terminal, null, preflight.packages.join('\n')) : React.createElement("p", { className: "muted" }, "\u5F53\u524D\u6CA1\u6709\u5F85\u66F4\u65B0\u8F6F\u4EF6\u5305\uFF0C\u6216\u5C1A\u672A\u53D6\u5F97\u9884\u68C0\u7ED3\u679C\u3002"),
                    preflight.output ? React.createElement(JsonDetails, { data: { output: preflight.output }, title: "APT \u9884\u68C0\u539F\u59CB\u8F93\u51FA" }) : null),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u641C\u7D22\u8F6F\u4EF6\u5305", subtitle: "\u81F3\u5C11\u8F93\u5165\u4E24\u4E2A\u5B57\u7B26" }),
                    React.createElement("form", { className: "search-form", onSubmit: (event) => { event.preventDefault(); void find(); } },
                        React.createElement("div", { className: "search-box grow" },
                            React.createElement(Icon, { name: "search", size: 17 }),
                            React.createElement("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "\u4F8B\u5982 nginx\u3001curl" })),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working, disabled: preflight.available === false }, "\u641C\u7D22")),
                    React.createElement("div", { className: "package-list" }, results.map(item => React.createElement("div", { className: "package-row", key: item.name },
                        React.createElement("div", null,
                            React.createElement("strong", null, item.name),
                            React.createElement("p", null, text(item.description)),
                            React.createElement("small", null, text(item.version || item.candidate))),
                        React.createElement("div", null, item.installed ? React.createElement(Button, { tone: "danger", disabled: aptBlocked, onClick: () => action('remove', [item.name]) }, "\u5378\u8F7D") : React.createElement(Button, { tone: "primary", disabled: aptBlocked, onClick: () => action('install', [item.name]) }, "\u5B89\u88C5")))))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u8F6F\u4EF6\u6E90", subtitle: "\u542F\u505C\u6216\u7EF4\u62A4 APT \u6E90\u6587\u4EF6", actions: React.createElement(Button, { tone: "primary", icon: "plus", disabled: preflight.available === false, onClick: addSource }, "\u6DFB\u52A0\u8F6F\u4EF6\u6E90") }),
                    sources.length ? React.createElement("div", { className: "card-list compact-list" }, sources.map(source => React.createElement("div", { className: "source-row", key: source.path },
                        React.createElement("div", null,
                            React.createElement("strong", null, text(source.name || source.path)),
                            React.createElement("code", null, text(source.path)),
                            React.createElement("small", null, truncate(source.content, 180))),
                        React.createElement("div", { className: "row-buttons" },
                            React.createElement(Badge, { tone: source.enabled ? 'success' : 'neutral' }, boolText(source.enabled)),
                            React.createElement(Button, { tone: "ghost", onClick: () => sourceAction(source.enabled ? 'disable' : 'enable', source) }, source.enabled ? '停用' : '启用'),
                            React.createElement(Button, { tone: "danger", icon: "trash", onClick: () => sourceAction('delete', source) }, "\u5220\u9664"))))) : React.createElement(EmptyState, { icon: "package", title: "\u6CA1\u6709\u68C0\u6D4B\u5230\u53EF\u7BA1\u7406\u7684\u8F6F\u4EF6\u6E90" }))));
    }
    function HostPage(props) {
        const [data, setData] = useState({});
        const [ntp, setNtp] = useState({});
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            const [host, ntpData] = await Promise.all([api('/api/v1/system/host'), api('/api/v1/system/host/ntp')]);
            setData(asObject(host));
            setNtp(asObject(ntpData));
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, []);
        useEffect(() => { void reload(); }, [reload]);
        const mutate = async (endpoint, body, success = '主机设置已更新') => { setWorking(true); try {
            await secureApi(`/api/v1/system/host/${endpoint}`, { method: 'POST', body: jsonBody(body) });
            props.notify('success', success);
            await reload();
        }
        catch (cause) {
            props.notify('error', '修改失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const deleteSwap = async () => { if (!data.swap?.managed) {
            props.notify('warning', '当前 Swap 不是 LukePanel 管理的 /swapfile，不能自动删除');
            return;
        } if (!await props.confirm('删除 Swap', '将关闭并永久删除 LukePanel 管理的 /swapfile。', '删除 Swap', true))
            return; setWorking(true); try {
            await secureApi('/api/v1/system/host/swap', { method: 'DELETE' });
            props.notify('success', 'Swap 已删除');
            await reload();
        }
        catch (cause) {
            props.notify('error', '删除 Swap 失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload }),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : loading && !Object.keys(data).length ? React.createElement(LoadingState, null) : React.createElement("div", { className: "settings-grid" },
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u57FA\u7840\u4FE1\u606F", subtitle: "\u4E3B\u673A\u540D\u4E0E\u7CFB\u7EDF\u65F6\u533A" }),
                    React.createElement("form", { key: `${data.hostname}|${data.timezone}`, className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); setWorking(true); try {
                            const hostname = values.get('hostname');
                            const timezone = values.get('timezone');
                            if (hostname !== data.hostname)
                                await secureApi('/api/v1/system/host/hostname', { method: 'POST', body: jsonBody({ hostname }) });
                            if (timezone !== data.timezone)
                                await secureApi('/api/v1/system/host/timezone', { method: 'POST', body: jsonBody({ timezone }) });
                            props.notify('success', '基础设置已更新');
                            await reload();
                        }
                        catch (cause) {
                            props.notify('error', '修改失败', errorDetail(cause));
                        }
                        finally {
                            setWorking(false);
                        } } },
                        React.createElement(Field, { label: "\u4E3B\u673A\u540D" },
                            React.createElement(TextInput, { name: "hostname", defaultValue: text(data.hostname, ''), required: true })),
                        React.createElement(Field, { label: "\u65F6\u533A" },
                            React.createElement(TextInput, { name: "timezone", defaultValue: text(data.timezone, 'UTC'), required: true })),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u4FDD\u5B58\u57FA\u7840\u8BBE\u7F6E"))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "DNS \u670D\u52A1\u5668", subtitle: data.systemd_resolved ? '由 systemd-resolved 管理，每行一个地址' : '当前未运行 systemd-resolved，LukePanel 不会接管 resolv.conf' }),
                    !data.systemd_resolved ? React.createElement("div", { className: "notice warning" }, "\u5F53\u524D\u7CFB\u7EDF\u6CA1\u6709\u8FD0\u884C systemd-resolved\uFF0C\u6B64\u8868\u5355\u4E0D\u53EF\u7528\u3002") : null,
                    React.createElement("form", { key: JSON.stringify(data.dns || []), className: "form-stack", onSubmit: (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void mutate('dns', { servers: lines(String(values.get('servers') || '')) }, 'DNS 已更新并完成解析验证'); } },
                        React.createElement(Field, { label: "DNS \u5730\u5740" },
                            React.createElement(TextArea, { name: "servers", rows: 5, defaultValue: Array.isArray(data.dns) ? data.dns.join('\n') : text(data.dns, ''), placeholder: '1.1.1.1\n8.8.8.8', disabled: !data.systemd_resolved })),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working, disabled: !data.systemd_resolved }, "\u4FDD\u5B58 DNS"))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "NTP \u65F6\u95F4\u540C\u6B65", subtitle: "\u4EC5\u63A7\u5236\u7CFB\u7EDF NTP \u5F00\u5173\uFF1B\u5237\u65B0\u72B6\u6001\u4E0D\u4F1A\u4FEE\u6539\u670D\u52A1\u5668" }),
                    React.createElement("dl", { className: "key-value-list" },
                        React.createElement(KeyValue, { label: "\u670D\u52A1", value: text(ntp.service) }),
                        React.createElement(KeyValue, { label: "\u72B6\u6001", value: React.createElement(Badge, { tone: ntp.synchronized ? 'success' : ntp.enabled ? 'warning' : 'neutral' }, ntp.synchronized ? '已同步' : ntp.enabled ? '等待同步' : '已关闭') }),
                        React.createElement(KeyValue, { label: "\u670D\u52A1\u5668", value: text(ntp.server_name || ntp.server_address) }),
                        React.createElement(KeyValue, { label: "\u670D\u52A1\u5668\u5730\u5740", value: text(ntp.server_address), mono: true }),
                        React.createElement(KeyValue, { label: "\u4E0A\u6B21\u540C\u6B65", value: text(ntp.last_sync) }),
                        React.createElement(KeyValue, { label: "\u8F6E\u8BE2\u95F4\u9694", value: text(ntp.poll_interval) }),
                        React.createElement(KeyValue, { label: "\u65F6\u533A", value: text(ntp.timezone || data.timezone) })),
                    React.createElement("div", { className: "row-buttons" },
                        React.createElement(Button, { onClick: reload, busy: loading }, "\u5237\u65B0\u72B6\u6001"),
                        React.createElement(Button, { tone: "ghost", busy: working, onClick: () => mutate('ntp', { enabled: !ntp.enabled }, ntp.enabled ? 'NTP 已关闭' : 'NTP 已开启') }, ntp.enabled ? '关闭 NTP' : '开启 NTP'))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "Swap", subtitle: "\u53EA\u4F1A\u81EA\u52A8\u5220\u9664 LukePanel \u521B\u5EFA\u7684 /swapfile" }),
                    React.createElement("dl", { className: "key-value-list" },
                        React.createElement(KeyValue, { label: "\u72B6\u6001", value: React.createElement(Badge, { tone: data.swap?.enabled ? 'success' : 'neutral' }, data.swap?.enabled ? '已启用' : '未启用') }),
                        React.createElement(KeyValue, { label: "\u603B\u5BB9\u91CF", value: formatBytes(data.swap?.total) }),
                        React.createElement(KeyValue, { label: "\u5DF2\u4F7F\u7528", value: formatBytes(data.swap?.used) }),
                        React.createElement(KeyValue, { label: "\u8DEF\u5F84", value: text(data.swap?.path), mono: true }),
                        React.createElement(KeyValue, { label: "LukePanel \u7BA1\u7406", value: boolText(data.swap?.managed, '是', '否') })),
                    React.createElement("form", { className: "inline-form", onSubmit: (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void mutate('swap', { size_mb: number(values.get('size_mb'), 2048) }, 'Swap 已创建'); } },
                        React.createElement(TextInput, { name: "size_mb", type: "number", min: "256", max: "32768", step: "256", defaultValue: "2048", "aria-label": "Swap \u5927\u5C0F MB", disabled: !!data.swap?.enabled }),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working, disabled: !!data.swap?.enabled }, "\u521B\u5EFA Swap"),
                        React.createElement(Button, { tone: "danger", busy: working, disabled: !data.swap?.managed, onClick: () => void deleteSwap() }, "\u5220\u9664")),
                    data.swap?.enabled && !data.swap?.managed ? React.createElement("div", { className: "notice" }, "\u68C0\u6D4B\u5230\u7CFB\u7EDF\u5DF2\u6709 Swap\uFF0C\u4F46\u4E0D\u662F LukePanel \u7BA1\u7406\u7684 /swapfile\uFF0C\u56E0\u6B64\u4E0D\u4F1A\u63D0\u4F9B\u5220\u9664\u6216\u8C03\u6574\u64CD\u4F5C\u3002") : null),
                React.createElement(Card, { className: "span-2" },
                    React.createElement(SectionTitle, { title: "\u5185\u6838\u4F18\u5316\u65B9\u6848", subtitle: "\u4EC5\u5E94\u7528\u540E\u7AEF\u660E\u786E\u652F\u6301\u5E76\u53EF\u56DE\u6EDA\u7684\u9884\u8BBE\uFF0C\u4E0D\u5141\u8BB8\u4EFB\u610F\u5199\u5165 sysctl" }),
                    React.createElement("dl", { className: "key-value-list" },
                        React.createElement(KeyValue, { label: "\u5F53\u524D\u65B9\u6848", value: text(data.sysctl?.label, '系统默认') }),
                        React.createElement(KeyValue, { label: "\u7531 LukePanel \u7BA1\u7406", value: boolText(data.sysctl?.managed, '是', '否') }),
                        React.createElement(KeyValue, { label: "BBR", value: boolText(data.sysctl?.bbr, '已启用', '未启用') }),
                        React.createElement(KeyValue, { label: "\u62E5\u585E\u63A7\u5236", value: text(data.sysctl?.congestion_control), mono: true }),
                        React.createElement(KeyValue, { label: "\u9ED8\u8BA4\u961F\u5217", value: text(data.sysctl?.default_qdisc), mono: true }),
                        React.createElement(KeyValue, { label: "Swappiness", value: text(data.sysctl?.swappiness) })),
                    React.createElement("form", { className: "inline-form", onSubmit: (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void mutate('sysctl', { preset: values.get('preset') }, '内核优化方案已应用'); } },
                        React.createElement(SelectInput, { key: text(data.sysctl?.preset, 'reset'), name: "preset", defaultValue: text(data.sysctl?.preset, 'reset') },
                            React.createElement("option", { value: "reset" }, "\u7CFB\u7EDF\u9ED8\u8BA4\uFF08\u79FB\u9664 LukePanel \u914D\u7F6E\uFF09"),
                            React.createElement("option", { value: "balanced" }, "\u5747\u8861"),
                            React.createElement("option", { value: "network" }, "\u7F51\u7EDC\u541E\u5410 / BBR"),
                            React.createElement("option", { value: "low-memory" }, "\u5C0F\u5185\u5B58 VPS")),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u5E94\u7528\u65B9\u6848")))));
    }
    function SnapshotsPage(props) {
        const [data, setData] = useState({});
        const [scheduled, setScheduled] = useState({});
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            const [snapshots, scheduledBackups] = await Promise.all([api('/api/v1/system/snapshots'), api('/api/v1/backup/scheduled')]);
            setData(asObject(snapshots));
            setScheduled(asObject(scheduledBackups));
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, []);
        useEffect(() => { void reload(); }, [reload]);
        const snapshots = listOf(data, 'snapshots', 'items');
        const scheduledBackups = listOf(scheduled, 'backups');
        const action = async (item, operation) => { if (!await props.confirm(operation === 'restore' ? '恢复配置快照' : '删除配置快照', operation === 'restore' ? '恢复会覆盖快照涉及的配置文件；若恢复失败，后端会尝试回滚。' : '确认永久删除这个快照？', operation === 'restore' ? '恢复' : '删除', true))
            return; setWorking(true); try {
            await secureApi('/api/v1/system/snapshots', { method: 'POST', body: jsonBody({ id: item.id, action: operation }) });
            props.notify('success', operation === 'restore' ? '快照已恢复' : '快照已删除');
            await reload();
        }
        catch (cause) {
            props.notify('error', '操作失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const importFile = async (file) => { if (!await props.confirm('导入并恢复备份', '该操作会覆盖当前面板配置，请确认备份来源可信。', '导入恢复', true))
            return; setWorking(true); try {
            const form = new FormData();
            form.append('file', file);
            await secureApi('/api/v1/backup/import', { method: 'POST', body: form });
            props.notify('success', '备份已导入，请重新登录检查配置');
        }
        catch (cause) {
            props.notify('error', '导入失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const createScheduledBackup = async () => { setWorking(true); try {
            await secureApi('/api/v1/backup/scheduled', { method: 'POST', body: jsonBody({ action: 'create' }) });
            props.notify('success', '面板备份已创建');
            await reload();
        }
        catch (cause) {
            props.notify('error', '备份失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const deleteScheduledBackup = async (item) => { if (!await props.confirm('删除面板备份', text(item.name), '删除', true))
            return; setWorking(true); try {
            await secureApi('/api/v1/backup/scheduled', { method: 'POST', body: jsonBody({ action: 'delete', name: item.name }) });
            props.notify('success', '面板备份已删除');
            await reload();
        }
        catch (cause) {
            props.notify('error', '删除失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload }),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : React.createElement(React.Fragment, null,
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u914D\u7F6E\u5FEB\u7167", subtitle: "\u7531 LukePanel \u5728\u4FEE\u6539 SSH\u3001UFW\u3001APT\u3001DNS\u3001Swap\u3001sysctl \u548C Compose \u524D\u81EA\u52A8\u521B\u5EFA" }),
                    snapshots.length ? React.createElement("div", { className: "card-list compact-list" }, snapshots.map(item => React.createElement("div", { className: "snapshot-row", key: item.id },
                        React.createElement("div", null,
                            React.createElement("strong", null, text(item.name || item.id)),
                            React.createElement("p", null, text(item.note, `${text(item.kind, '配置')} 自动快照`)),
                            React.createElement("small", null,
                                formatDate(item.created_at),
                                " \u00B7 ",
                                formatBytes(item.size),
                                " \u00B7 ",
                                listOf(item.items).length,
                                " \u9879\u914D\u7F6E")),
                        React.createElement("div", { className: "row-buttons" },
                            React.createElement(Button, { busy: working, onClick: () => action(item, 'restore') }, "\u6062\u590D"),
                            React.createElement(Button, { busy: working, tone: "danger", icon: "trash", onClick: () => action(item, 'delete') }, "\u5220\u9664"))))) : !loading ? React.createElement(EmptyState, { icon: "backup", title: "\u6682\u65E0\u914D\u7F6E\u5FEB\u7167", description: "\u6267\u884C\u53D7\u652F\u6301\u7684\u9AD8\u98CE\u9669\u914D\u7F6E\u4FEE\u6539\u524D\u4F1A\u81EA\u52A8\u751F\u6210\uFF0C\u8FD9\u91CC\u4E0D\u63D0\u4F9B\u865A\u5047\u7684\u624B\u52A8\u521B\u5EFA\u6309\u94AE\u3002" }) : React.createElement(LoadingState, null)),
                React.createElement("div", { className: "settings-grid" },
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u5B8C\u6574\u5907\u4EFD", subtitle: "\u5BFC\u51FA\u6216\u5BFC\u5165\u9762\u677F\u914D\u7F6E" }),
                        React.createElement("div", { className: "stacked-actions" },
                            React.createElement("a", { className: "button button-default", href: "/api/v1/backup/export", download: true },
                                React.createElement(Icon, { name: "download", size: 17 }),
                                React.createElement("span", null, "\u5BFC\u51FA\u5907\u4EFD")),
                            React.createElement("label", { className: "button button-default file-button" },
                                React.createElement(Icon, { name: "upload", size: 17 }),
                                React.createElement("span", null, "\u5BFC\u5165\u5907\u4EFD"),
                                React.createElement("input", { type: "file", accept: ".tar.gz,.tgz", onChange: (event) => { const file = event.target.files?.[0]; if (file)
                                        void importFile(file); event.currentTarget.value = ''; } })))),
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u5B9A\u65F6\u5907\u4EFD\u6587\u4EF6", subtitle: `后端固定保留最近 ${number(scheduled.retention, 7)} 份；执行计划在“计划任务”中管理`, actions: React.createElement(Button, { tone: "primary", busy: working, onClick: () => void createScheduledBackup() }, "\u7ACB\u5373\u521B\u5EFA") }),
                        scheduledBackups.length ? React.createElement("div", { className: "compact-list" }, scheduledBackups.map(item => React.createElement("div", { className: "compact-row", key: item.name },
                            React.createElement("div", null,
                                React.createElement("strong", null, text(item.name)),
                                React.createElement("small", null,
                                    formatDate(item.modified_at),
                                    " \u00B7 ",
                                    formatBytes(item.size))),
                            React.createElement("div", { className: "row-buttons" },
                                React.createElement("a", { className: "button button-default", href: `/api/v1/backup/scheduled?download=${encodeURIComponent(item.name)}`, download: true },
                                    React.createElement(Icon, { name: "download", size: 17 }),
                                    React.createElement("span", null, "\u4E0B\u8F7D")),
                                React.createElement(Button, { tone: "danger", icon: "trash", busy: working, onClick: () => void deleteScheduledBackup(item) }, "\u5220\u9664"))))) : React.createElement(EmptyState, { icon: "backup", title: "\u6682\u65E0\u9762\u677F\u5907\u4EFD", description: "\u53EF\u7ACB\u5373\u521B\u5EFA\uFF0C\u6216\u5728\u8BA1\u5212\u4EFB\u52A1\u4E2D\u6DFB\u52A0\u201C\u521B\u5EFA\u9762\u677F\u5907\u4EFD\u201D\u4EFB\u52A1\u3002" }),
                        React.createElement("div", { className: "form-actions" },
                            React.createElement(Button, { tone: "ghost", onClick: () => props.navigate('/system/tasks') }, "\u524D\u5F80\u8BA1\u5212\u4EFB\u52A1"))))));
    }
    function ComposeEditorForm({ project, files, close, notify, reload }) {
        const initialFiles = useMemo(() => Object.fromEntries(files.map(file => [String(file.path), String(file.content || '')])), [files]);
        const paths = useMemo(() => Object.keys(initialFiles), [initialFiles]);
        const [selectedPath, setSelectedPath] = useState(paths[0] || '');
        const [contents, setContents] = useState(initialFiles);
        const [deploy, setDeploy] = useState(true);
        const [saving, setSaving] = useState(false);
        const submit = async (event) => {
            event.preventDefault();
            if (!selectedPath || paths.length === 0) {
                notify('error', '没有可编辑的 Compose 配置文件');
                return;
            }
            setSaving(true);
            try {
                const result = await secureApi('/api/v1/docker/compose/config', { method: 'PUT', body: jsonBody({ project, files: contents, deploy }) });
                notify('success', 'Compose 配置已校验并保存', result.output || undefined);
                await reload();
                close();
            }
            catch (cause) {
                notify('error', '保存 Compose 配置失败', errorDetail(cause));
            }
            finally {
                setSaving(false);
            }
        };
        return React.createElement("form", { className: "form-stack", onSubmit: submit },
            React.createElement(Field, { label: "\u914D\u7F6E\u6587\u4EF6" },
                React.createElement(SelectInput, { value: selectedPath, onChange: (event) => setSelectedPath(event.target.value) }, paths.map(path => React.createElement("option", { value: path, key: path }, path)))),
            React.createElement(Field, { label: "YAML \u5185\u5BB9" },
                React.createElement(TextArea, { className: "code-input", rows: 22, value: contents[selectedPath] || '', onChange: (event) => setContents(current => ({ ...current, [selectedPath]: event.target.value })), required: true })),
            React.createElement("label", { className: "check-field" },
                React.createElement("input", { type: "checkbox", checked: deploy, onChange: (event) => setDeploy(event.target.checked) }),
                "\u4FDD\u5B58\u540E\u6267\u884C\u90E8\u7F72"),
            React.createElement("p", { className: "muted" }, "\u4FDD\u5B58\u65F6\u4F1A\u63D0\u4EA4\u5E76\u6821\u9A8C\u8BE5\u9879\u76EE\u7684\u5168\u90E8 Compose \u914D\u7F6E\u6587\u4EF6\uFF1B\u6821\u9A8C\u5931\u8D25\u4F1A\u81EA\u52A8\u6062\u590D\u5FEB\u7167\u3002"),
            React.createElement("div", { className: "form-actions" },
                React.createElement(Button, { onClick: close }, "\u53D6\u6D88"),
                React.createElement(Button, { type: "submit", tone: "primary", busy: saving }, "\u6821\u9A8C\u5E76\u4FDD\u5B58")));
    }
    function DockerImageForm({ close, mutate, working, notify }) {
        const [mode, setMode] = useState('pull');
        return React.createElement("form", { className: "form-stack", onSubmit: async (event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                try {
                    if (mode === 'pull') {
                        const reference = String(values.get('reference') || '').trim();
                        if (!reference)
                            throw new Error('请输入镜像引用');
                        if (!await mutate('/api/v1/docker/images/pull', { reference }, '镜像拉取完成'))
                            return;
                    }
                    else {
                        const contextDir = String(values.get('context_dir') || '').trim();
                        const tag = String(values.get('tag') || '').trim();
                        if (!contextDir || !tag)
                            throw new Error('构建上下文和镜像标签不能为空');
                        if (!await mutate('/api/v1/docker/images/build', {
                            context_dir: contextDir,
                            dockerfile: String(values.get('dockerfile') || 'Dockerfile').trim() || 'Dockerfile',
                            tag,
                            no_cache: values.get('no_cache') === 'on',
                            pull: values.get('pull') === 'on'
                        }, '镜像构建完成'))
                            return;
                    }
                    close();
                }
                catch (cause) {
                    notify('error', '镜像操作失败', errorDetail(cause));
                }
            } },
            React.createElement(Field, { label: "\u64CD\u4F5C" },
                React.createElement(SelectInput, { name: "mode", value: mode, onChange: (event) => setMode(event.target.value) },
                    React.createElement("option", { value: "pull" }, "\u62C9\u53D6\u955C\u50CF"),
                    React.createElement("option", { value: "build" }, "\u4ECE\u670D\u52A1\u5668\u76EE\u5F55\u6784\u5EFA"))),
            mode === 'pull' ? React.createElement(Field, { label: "\u955C\u50CF\u5F15\u7528" },
                React.createElement(TextInput, { name: "reference", placeholder: "nginx:latest", autoCapitalize: "none", required: true, autoFocus: true })) : React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "\u6784\u5EFA\u4E0A\u4E0B\u6587", hint: "\u670D\u52A1\u5668\u4E0A\u7684\u7EDD\u5BF9\u76EE\u5F55" },
                    React.createElement(TextInput, { name: "context_dir", placeholder: "/opt/project", required: true, autoFocus: true })),
                React.createElement("div", { className: "form-grid" },
                    React.createElement(Field, { label: "Dockerfile" },
                        React.createElement(TextInput, { name: "dockerfile", defaultValue: "Dockerfile", required: true })),
                    React.createElement(Field, { label: "\u955C\u50CF\u6807\u7B7E" },
                        React.createElement(TextInput, { name: "tag", placeholder: "myapp:latest", required: true }))),
                React.createElement("div", { className: "inline-checks" },
                    React.createElement("label", { className: "check-field" },
                        React.createElement("input", { type: "checkbox", name: "pull", defaultChecked: true }),
                        "\u62C9\u53D6\u57FA\u7840\u955C\u50CF"),
                    React.createElement("label", { className: "check-field" },
                        React.createElement("input", { type: "checkbox", name: "no_cache" }),
                        "\u4E0D\u4F7F\u7528\u7F13\u5B58"))),
            React.createElement("div", { className: "form-actions" },
                React.createElement(Button, { onClick: close }, "\u53D6\u6D88"),
                React.createElement(Button, { type: "submit", tone: "primary", busy: working }, mode === 'pull' ? '拉取镜像' : '开始构建')));
    }
    function DockerPage(props) {
        const [tab, setTab] = useState('containers');
        const [state, setState] = useState({ status: {}, containers: [], images: [], networks: [], volumes: [], projects: [], stats: {}, statsError: '' });
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            const status = asObject(await api('/api/v1/docker/status'));
            if (status.available !== true) {
                setState({ status, containers: [], images: [], networks: [], volumes: [], projects: [], stats: {}, statsError: '' });
                return;
            }
            const [containers, images, networks, volumes, compose] = await Promise.all([api('/api/v1/docker/containers'), api('/api/v1/docker/images'), api('/api/v1/docker/networks'), api('/api/v1/docker/volumes'), api('/api/v1/docker/compose')]);
            const containerList = listOf(containers, 'containers');
            const ids = containerList.filter(item => item.state === 'running').slice(0, 40).map(item => item.id);
            let stats = {};
            let statsError = '';
            if (ids.length) {
                try {
                    const result = await api(`/api/v1/docker/stats?${ids.map(id => `id=${encodeURIComponent(id)}`).join('&')}`);
                    stats = Object.fromEntries(listOf(result, 'stats').map(item => [String(item.id), item]));
                }
                catch (cause) {
                    stats = {};
                    statsError = errorDetail(cause);
                }
            }
            setState({ status, containers: containerList, images: listOf(images, 'images'), networks: listOf(networks, 'networks'), volumes: listOf(volumes, 'volumes'), projects: listOf(compose, 'projects'), stats, statsError });
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, []);
        useEffect(() => { void reload(); const timer = window.setInterval(() => { if (!document.hidden)
            void reload(); }, 15000); return () => window.clearInterval(timer); }, [reload]);
        const mutate = async (endpoint, body, success) => { setWorking(true); try {
            const result = await secureApi(endpoint, { method: 'POST', body: jsonBody(body) });
            props.notify('success', success, result?.output || result?.warning);
            await reload();
            return result || { ok: true };
        }
        catch (cause) {
            props.notify('error', 'Docker 操作失败', errorDetail(cause));
            return null;
        }
        finally {
            setWorking(false);
        } };
        const containerName = (item) => String(item.names?.[0] || item.name || item.id || '').replace(/^\//, '').slice(0, 80);
        const containerAction = async (item, action) => { if (['stop', 'kill', 'remove'].includes(action)) {
            const ok = await props.confirm(action === 'remove' ? '删除容器' : action === 'kill' ? '强制终止容器' : '停止容器', containerName(item), '确认', action !== 'stop');
            if (!ok)
                return;
        } await mutate('/api/v1/docker/action', { id: item.id, action }, action === 'remove' ? '容器已删除' : '容器状态已更新'); };
        const showLogs = async (item) => { try {
            const result = await api(`/api/v1/docker/logs${query({ id: item.id, tail: 500 })}`);
            props.openModal({ title: `${containerName(item)} · 日志`, size: 'large', content: React.createElement(Terminal, { maxHeight: 650 }, result.logs) });
        }
        catch (cause) {
            props.notify('error', '读取日志失败', errorDetail(cause));
        } };
        const runDiagnostic = async (item) => { const commands = [['identity', '身份信息'], ['working-directory', '工作目录'], ['environment', '环境变量'], ['disk', '磁盘空间'], ['processes', '进程列表'], ['network', '网络统计'], ['os-release', '系统版本'], ['list-root', '根目录文件']]; props.openModal({ title: `${containerName(item)} · 安全诊断`, content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); try {
                    const out = await secureApi('/api/v1/docker/exec', { method: 'POST', body: jsonBody({ id: item.id, command: values.get('command') }) });
                    props.openModal({ title: `${containerName(item)} · 诊断结果`, size: 'large', content: React.createElement(Terminal, { maxHeight: 650 }, out.output) });
                }
                catch (cause) {
                    props.notify('error', '诊断失败', errorDetail(cause));
                } } },
                React.createElement(Field, { label: "\u56FA\u5B9A\u8BCA\u65AD\u547D\u4EE4" },
                    React.createElement(SelectInput, { name: "command" }, commands.map(([value, label]) => React.createElement("option", { value: value, key: value }, label)))),
                React.createElement("p", { className: "muted" }, "\u4EC5\u5141\u8BB8\u540E\u7AEF\u9884\u5B9A\u4E49\u7684\u5B89\u5168\u8BCA\u65AD\u547D\u4EE4\uFF0C\u4E0D\u63A5\u53D7\u4EFB\u610F Shell\u3002"),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", icon: "terminal" }, "\u6267\u884C"))) }); };
        const editContainer = async (item) => { try {
            const edit = asObject(await api(`/api/v1/docker/inspect${query({ id: item.id })}`));
            const ports = listOf(edit.ports).map(port => [port.host_ip, port.host_port, `${port.container_port}/${port.protocol || 'tcp'}`].filter(Boolean).join('|')).join('\n');
            const mounts = listOf(edit.mounts).map(mount => `${mount.type || 'bind'}|${mount.source}|${mount.target}|${mount.read_only ? 'ro' : 'rw'}`).join('\n');
            props.openModal({ title: `编辑容器 · ${containerName(item)}`, size: 'large', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const parsePorts = (value) => lines(value).map(line => { const fields = line.split('|').map(part => part.trim()); if (fields.length < 2 || fields.length > 3)
                        throw new Error(`端口格式错误：${line}`); const target = fields[fields.length - 1].split('/'); return { host_ip: fields.length === 3 ? fields[0] : '', host_port: fields.length === 3 ? fields[1] : fields[0], container_port: target[0], protocol: target[1] || 'tcp' }; }); const parseMounts = (value) => lines(value).map(line => { const [type = 'bind', source = '', target = '', mode = 'rw'] = line.split('|').map(part => part.trim()); if (!source || !target.startsWith('/'))
                        throw new Error(`挂载格式错误：${line}`); return { type, source, target, read_only: mode === 'ro' }; }); try {
                        const body = { id: edit.id || item.id, name: values.get('name'), image: values.get('image'), env: lines(String(values.get('env') || '')), cmd: lines(String(values.get('cmd') || '')), entrypoint: lines(String(values.get('entrypoint') || '')), working_dir: values.get('working_dir'), user: values.get('user'), hostname: values.get('hostname'), restart_policy: values.get('restart_policy'), restart_maximum_retry_count: Number(values.get('restart_maximum_retry_count') || 0), network_mode: values.get('network_mode'), privileged: values.get('privileged') === 'on', start: !!edit.running, ports: parsePorts(String(values.get('ports') || '')), mounts: parseMounts(String(values.get('mounts') || '')) };
                        if (await mutate('/api/v1/docker/recreate', body, '容器已安全重建'))
                            props.closeModal();
                    }
                    catch (cause) {
                        props.notify('error', '重建失败', errorDetail(cause));
                    } } },
                    React.createElement("div", { className: "form-grid" },
                        React.createElement(Field, { label: "\u5BB9\u5668\u540D\u79F0" },
                            React.createElement(TextInput, { name: "name", defaultValue: text(edit.name, containerName(item)) })),
                        React.createElement(Field, { label: "\u955C\u50CF" },
                            React.createElement(TextInput, { name: "image", defaultValue: text(edit.image), required: true })),
                        React.createElement(Field, { label: "\u91CD\u542F\u7B56\u7565" },
                            React.createElement(SelectInput, { name: "restart_policy", defaultValue: text(edit.restart_policy, 'unless-stopped') }, ['no', 'always', 'on-failure', 'unless-stopped'].map(value => React.createElement("option", { value: value, key: value }, value)))),
                        React.createElement(Field, { label: "\u6700\u5927\u91CD\u8BD5\u6B21\u6570", hint: "\u4EC5 on-failure \u7B56\u7565\u751F\u6548" },
                            React.createElement(TextInput, { name: "restart_maximum_retry_count", type: "number", min: "0", defaultValue: String(number(edit.restart_maximum_retry_count)) })),
                        React.createElement(Field, { label: "\u7F51\u7EDC\u6A21\u5F0F" },
                            React.createElement(TextInput, { name: "network_mode", defaultValue: text(edit.network_mode, 'default') })),
                        React.createElement(Field, { label: "\u4E3B\u673A\u540D" },
                            React.createElement(TextInput, { name: "hostname", defaultValue: text(edit.hostname, '') })),
                        React.createElement(Field, { label: "\u8FD0\u884C\u7528\u6237" },
                            React.createElement(TextInput, { name: "user", defaultValue: text(edit.user, '') })),
                        React.createElement(Field, { label: "\u5DE5\u4F5C\u76EE\u5F55" },
                            React.createElement(TextInput, { name: "working_dir", defaultValue: text(edit.working_dir, '') })),
                        React.createElement("label", { className: "check-field" },
                            React.createElement("input", { name: "privileged", type: "checkbox", defaultChecked: !!edit.privileged }),
                            "\u7279\u6743\u6A21\u5F0F")),
                    React.createElement(Field, { label: "\u73AF\u5883\u53D8\u91CF", hint: "\u6BCF\u884C\u4E00\u4E2A KEY=VALUE" },
                        React.createElement(TextArea, { name: "env", rows: 6, defaultValue: listOf(edit.env).join('\n') })),
                    React.createElement(Field, { label: "\u542F\u52A8\u53C2\u6570", hint: "\u6BCF\u884C\u4E00\u4E2A\u53C2\u6570" },
                        React.createElement(TextArea, { name: "cmd", rows: 4, defaultValue: listOf(edit.cmd).join('\n') })),
                    React.createElement(Field, { label: "Entrypoint", hint: "\u6BCF\u884C\u4E00\u4E2A\u53C2\u6570" },
                        React.createElement(TextArea, { name: "entrypoint", rows: 3, defaultValue: listOf(edit.entrypoint).join('\n') })),
                    React.createElement(Field, { label: "\u7AEF\u53E3\u6620\u5C04", hint: "hostPort|containerPort/protocol\uFF1B\u7ED1\u5B9A IP \u65F6 hostIP|hostPort|containerPort/protocol" },
                        React.createElement(TextArea, { name: "ports", rows: 5, defaultValue: ports })),
                    React.createElement(Field, { label: "\u6302\u8F7D", hint: "bind|\u6E90\u8DEF\u5F84|\u76EE\u6807\u8DEF\u5F84|rw \u6216 volume|\u5377\u540D|\u76EE\u6807\u8DEF\u5F84|ro" },
                        React.createElement(TextArea, { name: "mounts", rows: 5, defaultValue: mounts })),
                    edit.compose_managed ? React.createElement("div", { className: "notice warning" },
                        React.createElement(Icon, { name: "warning" }),
                        React.createElement("span", null,
                            "\u8BE5\u5BB9\u5668\u7531 Compose \u9879\u76EE ",
                            text(edit.compose_project),
                            " \u7BA1\u7406\uFF0C\u5EFA\u8BAE\u901A\u8FC7 Compose YAML \u4FEE\u6539\u3002")) : null,
                    React.createElement("div", { className: "form-actions" },
                        React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working, disabled: !!edit.compose_managed }, "\u5B89\u5168\u91CD\u5EFA"))) });
        }
        catch (cause) {
            props.notify('error', '读取容器配置失败', errorDetail(cause));
        } };
        const composeAction = async (project, action) => { if (action === 'down' && !await props.confirm('停止并移除 Compose 项目', project.name, '停止并移除', true))
            return; await mutate('/api/v1/docker/compose/action', { project: project.name, action }, 'Compose 操作完成'); };
        const editCompose = async (project) => {
            try {
                const config = asObject(await api(`/api/v1/docker/compose/config${query({ project: project.name })}`));
                const files = listOf(config, 'files');
                if (!files.length)
                    throw new Error('项目没有可编辑的 Compose 配置文件');
                props.openModal({ title: `Compose YAML · ${project.name}`, size: 'large', content: React.createElement(ComposeEditorForm, { project: project.name, files: files, close: props.closeModal, notify: props.notify, reload: reload }) });
            }
            catch (cause) {
                props.notify('error', '读取 Compose 配置失败', errorDetail(cause));
            }
        };
        const createCompose = () => props.openModal({ title: '新建 Compose 项目', size: 'large', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const service = { name: values.get('service'), image: values.get('image'), container_name: values.get('container_name'), restart: values.get('restart'), environment: lines(String(values.get('environment') || '')), ports: lines(String(values.get('ports') || '')), volumes: lines(String(values.get('volumes') || '')) }; try {
                    if (await mutate('/api/v1/docker/compose/create', { project: values.get('project'), directory: values.get('directory'), services: [service], start: values.get('start') === 'on' }, 'Compose 项目已创建'))
                        props.closeModal();
                }
                catch { /* reported */ } } },
                React.createElement("div", { className: "form-grid" },
                    React.createElement(Field, { label: "\u9879\u76EE\u540D\u79F0" },
                        React.createElement(TextInput, { name: "project", required: true })),
                    React.createElement(Field, { label: "\u4FDD\u5B58\u76EE\u5F55" },
                        React.createElement(TextInput, { name: "directory", defaultValue: "/opt/compose", required: true })),
                    React.createElement(Field, { label: "\u670D\u52A1\u540D\u79F0" },
                        React.createElement(TextInput, { name: "service", defaultValue: "app", required: true })),
                    React.createElement(Field, { label: "\u955C\u50CF" },
                        React.createElement(TextInput, { name: "image", placeholder: "nginx:latest", required: true })),
                    React.createElement(Field, { label: "\u5BB9\u5668\u540D\u79F0" },
                        React.createElement(TextInput, { name: "container_name" })),
                    React.createElement(Field, { label: "\u91CD\u542F\u7B56\u7565" },
                        React.createElement(SelectInput, { name: "restart", defaultValue: "unless-stopped" }, ['no', 'always', 'on-failure', 'unless-stopped'].map(value => React.createElement("option", { key: value }, value))))),
                React.createElement(Field, { label: "\u73AF\u5883\u53D8\u91CF" },
                    React.createElement(TextArea, { name: "environment", rows: 3 })),
                React.createElement(Field, { label: "\u7AEF\u53E3" },
                    React.createElement(TextArea, { name: "ports", rows: 3, placeholder: "8080:80" })),
                React.createElement(Field, { label: "\u6302\u8F7D" },
                    React.createElement(TextArea, { name: "volumes", rows: 3, placeholder: "./data:/data" })),
                React.createElement("label", { className: "check-field" },
                    React.createElement("input", { type: "checkbox", name: "start", defaultChecked: true }),
                    "\u521B\u5EFA\u540E\u7ACB\u5373\u542F\u52A8"),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u521B\u5EFA"))) });
        const imageDialog = () => props.openModal({ title: '镜像管理', content: React.createElement(DockerImageForm, { close: props.closeModal, mutate: mutate, working: working, notify: props.notify }) });
        const createResource = (kind) => props.openModal({ title: kind === 'network' ? '新建网络' : '新建存储卷', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const endpoint = kind === 'network' ? '/api/v1/docker/networks/create' : '/api/v1/docker/volumes/create'; const body = kind === 'network' ? { name: values.get('name'), driver: values.get('driver'), subnet: values.get('subnet'), gateway: values.get('gateway'), internal: values.get('internal') === 'on' } : { name: values.get('name'), driver: values.get('driver') }; try {
                    if (await mutate(endpoint, body, kind === 'network' ? '网络已创建' : '存储卷已创建'))
                        props.closeModal();
                }
                catch { /* reported */ } } },
                React.createElement(Field, { label: "\u540D\u79F0" },
                    React.createElement(TextInput, { name: "name", required: true })),
                React.createElement(Field, { label: "\u9A71\u52A8" },
                    React.createElement(TextInput, { name: "driver", defaultValue: kind === 'network' ? 'bridge' : 'local' })),
                kind === 'network' ? React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "\u5B50\u7F51" },
                        React.createElement(TextInput, { name: "subnet", placeholder: "172.30.0.0/16" })),
                    React.createElement(Field, { label: "\u7F51\u5173" },
                        React.createElement(TextInput, { name: "gateway", placeholder: "172.30.0.1" })),
                    React.createElement("label", { className: "check-field" },
                        React.createElement("input", { type: "checkbox", name: "internal" }),
                        "\u4EC5\u5185\u90E8\u7F51\u7EDC")) : null,
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u521B\u5EFA"))) });
        const volumeTools = async (selected) => { try {
            const usage = listOf(await api('/api/v1/docker/volumes/usage'), 'volumes');
            props.openModal({ title: '存储卷用量与备份', size: 'large', content: React.createElement("div", { className: "form-stack" },
                    React.createElement("div", { className: "responsive-table" },
                        React.createElement("div", { className: "table-head" },
                            React.createElement("span", null, "\u5377\u540D"),
                            React.createElement("span", null, "\u7528\u91CF"),
                            React.createElement("span", null, "\u5F15\u7528")),
                        usage.map(item => React.createElement("div", { className: "table-row", key: item.name },
                            React.createElement("span", { "data-label": "\u5377\u540D" }, item.name),
                            React.createElement("span", { "data-label": "\u7528\u91CF" }, formatBytes(item.size)),
                            React.createElement("span", { "data-label": "\u5F15\u7528" }, number(item.ref_count))))),
                    React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const action = String(values.get('action')); if (action === 'restore' && !await props.confirm('恢复存储卷', '恢复会覆盖卷内同名文件，请确认备份来源可信。', '确认恢复', true))
                            return; try {
                            if (await mutate('/api/v1/docker/volumes/archive', { action, name: values.get('name'), path: values.get('path') }, action === 'backup' ? '存储卷备份完成' : '存储卷恢复完成'))
                                props.closeModal();
                        }
                        catch { /* reported */ } } },
                        React.createElement("div", { className: "form-grid" },
                            React.createElement(Field, { label: "\u5B58\u50A8\u5377" },
                                React.createElement(SelectInput, { name: "name", defaultValue: selected?.name || usage[0]?.name }, usage.map(item => React.createElement("option", { key: item.name }, item.name)))),
                            React.createElement(Field, { label: "\u64CD\u4F5C" },
                                React.createElement(SelectInput, { name: "action", defaultValue: "backup" },
                                    React.createElement("option", { value: "backup" }, "\u5907\u4EFD\u4E3A tar.gz"),
                                    React.createElement("option", { value: "restore" }, "\u4ECE tar.gz \u6062\u590D")))),
                        React.createElement(Field, { label: "\u670D\u52A1\u5668\u7EDD\u5BF9\u8DEF\u5F84" },
                            React.createElement(TextInput, { name: "path", defaultValue: "/var/backups/lukepanel-volume.tar.gz", required: true })),
                        React.createElement("div", { className: "form-actions" },
                            React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                            React.createElement(Button, { type: "submit", tone: "primary" }, "\u6267\u884C")))) });
        }
        catch (cause) {
            props.notify('error', '读取卷用量失败', errorDetail(cause));
        } };
        const cleanup = async () => { try {
            const preview = asObject(await api('/api/v1/docker/cleanup/preview'));
            props.openModal({ title: 'Docker 清理', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); if (!await props.confirm('执行 Docker 清理', '清理不可恢复，请确认没有仍需使用的镜像、缓存或卷。', '开始清理', true))
                        return; try {
                        if (await mutate('/api/v1/docker/cleanup', { mode: values.get('mode'), include_volumes: values.get('volumes') === 'on' }, 'Docker 清理完成'))
                            props.closeModal();
                    }
                    catch { /* reported */ } } },
                    React.createElement(JsonDetails, { data: preview, title: "\u9884\u8BA1\u6E05\u7406\u5185\u5BB9" }),
                    React.createElement(Field, { label: "\u6E05\u7406\u6A21\u5F0F" },
                        React.createElement(SelectInput, { name: "mode" },
                            React.createElement("option", { value: "safe" }, "\u5B89\u5168\u6E05\u7406"),
                            React.createElement("option", { value: "deep" }, "\u6DF1\u5EA6\u6E05\u7406"))),
                    React.createElement("label", { className: "check-field" },
                        React.createElement("input", { type: "checkbox", name: "volumes" }),
                        "\u540C\u65F6\u6E05\u7406\u672A\u4F7F\u7528\u5B58\u50A8\u5377"),
                    React.createElement("div", { className: "form-actions" },
                        React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                        React.createElement(Button, { type: "submit", tone: "danger" }, "\u6267\u884C\u6E05\u7406"))) });
        }
        catch (cause) {
            props.notify('error', '读取清理预览失败', errorDetail(cause));
        } };
        const status = state.status || {};
        const available = status.available === true;
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload, actions: available ? React.createElement(Button, { tone: "ghost", icon: "trash", onClick: cleanup }, "\u6E05\u7406") : null }),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : !available ? React.createElement(Card, null,
                React.createElement(EmptyState, { icon: "docker", title: "Docker \u670D\u52A1\u4E0D\u53EF\u7528", description: text(status.error, 'Docker Engine 未运行或当前用户无法访问 Docker Socket'), action: React.createElement(Button, { tone: "primary", busy: working, onClick: () => mutate('/api/v1/docker/install', {}, 'Docker 安装或修复完成') }, "\u5B89\u88C5\u6216\u4FEE\u590D Docker") })) : React.createElement(React.Fragment, null,
                state.statsError ? React.createElement("div", { className: "notice warning" },
                    React.createElement(Icon, { name: "warning" }),
                    React.createElement("div", null,
                        React.createElement("strong", null, "\u5BB9\u5668\u5B9E\u65F6\u7EDF\u8BA1\u8BFB\u53D6\u5931\u8D25"),
                        React.createElement("span", null,
                            "\u57FA\u7840\u72B6\u6001\u4ECD\u53EF\u7BA1\u7406\uFF1BCPU \u548C\u5185\u5B58\u6682\u65F6\u663E\u793A\u4E3A\u201C\u2014\u201D\u3002",
                            state.statsError))) : null,
                React.createElement("div", { className: "tab-bar", role: "tablist" }, [['containers', `容器 ${state.containers.length}`], ['compose', `Compose ${state.projects.length}`], ['images', `镜像 ${state.images.length}`], ['networks', `网络 ${state.networks.length}`], ['volumes', `存储卷 ${state.volumes.length}`]].map(([value, label]) => React.createElement("button", { role: "tab", "aria-selected": tab === value, className: tab === value ? 'active' : '', key: value, onClick: () => setTab(value) }, label))),
                tab === 'containers' ? React.createElement("div", { className: "card-list" },
                    state.containers.map((item) => { const running = item.state === 'running'; const stats = state.stats[item.id] || {}; return React.createElement(Card, { className: "container-card", key: item.id },
                        React.createElement("div", { className: "list-main" },
                            React.createElement("span", { className: `state-indicator ${running ? 'is-up' : 'is-down'}` }),
                            React.createElement("div", null,
                                React.createElement("div", { className: "card-topline" },
                                    React.createElement("strong", null, containerName(item)),
                                    React.createElement(Badge, { tone: running ? 'success' : 'neutral' }, text(item.state))),
                                React.createElement("p", null, text(item.image)),
                                React.createElement("small", null, text(item.status)),
                                React.createElement("div", { className: "container-stats" },
                                    React.createElement("span", null,
                                        "CPU ",
                                        stats.cpu_percent === undefined || stats.cpu_percent === null ? '—' : `${number(stats.cpu_percent).toFixed(1)}%`),
                                    React.createElement("span", null,
                                        "\u5185\u5B58 ",
                                        stats.memory_usage ? formatBytes(stats.memory_usage) : '—'),
                                    React.createElement("span", null, listOf(item.ports).map(port => number(port.PublicPort) > 0 ? `${port.IP ? `${port.IP}:` : ''}${port.PublicPort}:${port.PrivatePort}/${port.Type || 'tcp'}` : `${port.PrivatePort}/${port.Type || 'tcp'}（仅容器内）`).join(' · ') || '无端口声明')))),
                        React.createElement("div", { className: "list-actions" },
                            running ? React.createElement(React.Fragment, null,
                                React.createElement(Button, { onClick: () => containerAction(item, 'restart'), icon: "restart" }, "\u91CD\u542F"),
                                React.createElement(Button, { onClick: () => containerAction(item, 'stop'), icon: "stop" }, "\u505C\u6B62")) : React.createElement(Button, { tone: "primary", onClick: () => containerAction(item, 'start'), icon: "play" }, "\u542F\u52A8"),
                            React.createElement(Button, { tone: "ghost", onClick: () => showLogs(item) }, "\u65E5\u5FD7"),
                            React.createElement(Button, { tone: "ghost", onClick: () => runDiagnostic(item) }, "\u8BCA\u65AD"),
                            React.createElement(Button, { tone: "ghost", onClick: () => editContainer(item) }, "\u7F16\u8F91"),
                            React.createElement(Button, { tone: "danger", onClick: () => containerAction(item, 'remove'), icon: "trash" }, "\u5220\u9664"))); }),
                    !state.containers.length ? React.createElement(EmptyState, { icon: "docker", title: "\u6682\u65E0\u5BB9\u5668" }) : null) : null,
                tab === 'compose' ? React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "toolbar-row" },
                        React.createElement(Button, { tone: "primary", icon: "plus", onClick: createCompose }, "\u65B0\u5EFA Compose")),
                    React.createElement("div", { className: "card-list" },
                        state.projects.map((project) => React.createElement(Card, { className: "compose-card", key: project.name },
                            React.createElement("div", null,
                                React.createElement("div", { className: "card-topline" },
                                    React.createElement("strong", null, project.name),
                                    React.createElement(Badge, { tone: number(project.running) === number(project.total) && number(project.total) > 0 ? 'success' : 'warning' },
                                        number(project.running),
                                        "/",
                                        number(project.total),
                                        " \u8FD0\u884C")),
                                React.createElement("p", { className: "mono" }, text(project.working_dir)),
                                React.createElement("small", null, listOf(project.config_files).join(', '))),
                            React.createElement("div", { className: "list-actions" },
                                React.createElement(Button, { onClick: () => composeAction(project, 'up'), icon: "play" }, "\u542F\u52A8"),
                                React.createElement(Button, { onClick: () => composeAction(project, 'restart'), icon: "restart" }, "\u91CD\u542F"),
                                React.createElement(Button, { tone: "ghost", onClick: () => editCompose(project), icon: "edit" }, "YAML"),
                                React.createElement(Button, { tone: "danger", onClick: () => composeAction(project, 'down'), icon: "stop" }, "Down")))),
                        !state.projects.length ? React.createElement(EmptyState, { icon: "docker", title: "\u6682\u65E0 Compose \u9879\u76EE", action: React.createElement(Button, { tone: "primary", icon: "plus", onClick: createCompose }, "\u521B\u5EFA\u9879\u76EE") }) : null)) : null,
                tab === 'images' ? React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "toolbar-row" },
                        React.createElement(Button, { tone: "primary", icon: "plus", onClick: imageDialog }, "\u62C9\u53D6/\u6784\u5EFA\u955C\u50CF")),
                    React.createElement("div", { className: "docker-card-grid" }, state.images.map((item) => { const name = item.repo_tags?.[0] || String(item.id).replace(/^sha256:/, '').slice(0, 12); return React.createElement(Card, { className: "docker-resource-card", key: item.id },
                        React.createElement("div", { className: "card-topline" },
                            React.createElement("strong", null, name),
                            React.createElement(Badge, null, formatBytes(item.size))),
                        React.createElement("code", null, String(item.id).replace(/^sha256:/, '').slice(0, 24)),
                        React.createElement("small", null,
                            formatDate(number(item.created) * 1000),
                            " \u00B7 ",
                            number(item.containers),
                            " \u4E2A\u5BB9\u5668\u5F15\u7528"),
                        React.createElement(Button, { tone: "danger", icon: "trash", onClick: async () => { if (await props.confirm('删除镜像', name, '删除', true))
                                await mutate('/api/v1/docker/images/delete', { id: item.id }, '镜像已删除'); } }, "\u5220\u9664\u955C\u50CF")); }))) : null,
                tab === 'networks' ? React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "toolbar-row" },
                        React.createElement(Button, { tone: "primary", icon: "plus", onClick: () => createResource('network') }, "\u65B0\u5EFA\u7F51\u7EDC")),
                    React.createElement("div", { className: "docker-card-grid" }, state.networks.map((item) => React.createElement(Card, { className: "docker-resource-card", key: item.id },
                        React.createElement("div", { className: "card-topline" },
                            React.createElement("strong", null, item.name),
                            React.createElement(Badge, null, text(item.driver))),
                        React.createElement("code", null, String(item.id).slice(0, 24)),
                        React.createElement("small", null,
                            text(item.scope),
                            " \u00B7 ",
                            item.internal ? '内部网络' : '可访问外部',
                            " \u00B7 ",
                            number(item.containers),
                            " \u4E2A\u5BB9\u5668"),
                        !['bridge', 'host', 'none'].includes(item.name) ? React.createElement(Button, { tone: "danger", icon: "trash", onClick: async () => { if (await props.confirm('删除网络', item.name, '删除', true))
                                await mutate('/api/v1/docker/networks/delete', { id: item.id }, '网络已删除'); } }, "\u5220\u9664\u7F51\u7EDC") : null)))) : null,
                tab === 'volumes' ? React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "toolbar-row" },
                        React.createElement(Button, { tone: "primary", icon: "plus", onClick: () => createResource('volume') }, "\u65B0\u5EFA\u5B58\u50A8\u5377"),
                        React.createElement(Button, { onClick: () => volumeTools() }, "\u7528\u91CF\u4E0E\u5907\u4EFD")),
                    React.createElement("div", { className: "docker-card-grid" }, state.volumes.map((item) => React.createElement(Card, { className: "docker-resource-card", key: item.name },
                        React.createElement("div", { className: "card-topline" },
                            React.createElement("strong", null, item.name),
                            React.createElement(Badge, null, text(item.driver))),
                        React.createElement("code", null, text(item.mountpoint)),
                        React.createElement("small", null, text(item.scope)),
                        React.createElement("div", { className: "row-buttons" },
                            React.createElement(Button, { onClick: () => volumeTools(item) }, "\u7528\u91CF/\u5907\u4EFD"),
                            React.createElement(Button, { tone: "danger", icon: "trash", onClick: async () => { if (await props.confirm('删除存储卷', `${item.name}\n确认其中不再包含需要的数据。`, '删除', true))
                                    await mutate('/api/v1/docker/volumes/delete', { name: item.name }, '存储卷已删除'); } }, "\u5220\u9664")))))) : null));
    }
    function FilesPage(props) {
        const [listing, setListing] = useState({ path: '/', parent: '', entries: [] });
        const [preferences, setPreferences] = useState({ favorites: [], recent: [] });
        const [recycle, setRecycle] = useState([]);
        const [mode, setMode] = useState('files');
        const [filter, setFilter] = useState('');
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
        const fileInput = useRef(null);
        const folderInput = useRef(null);
        const zipInput = useRef(null);
        const normalizePreferences = (value) => ({ favorites: listOf(value, 'favorites'), recent: listOf(value, 'recent') });
        const load = useCallback(async (path = listing.path || '/') => { setLoading(true); setError(''); try {
            const [next, prefs] = await Promise.all([api(`/api/v1/files${query({ path })}`), api('/api/v1/files/preferences')]);
            setListing({ ...asObject(next), entries: listOf(next, 'entries') });
            setPreferences(normalizePreferences(prefs));
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, [listing.path]);
        const loadRecycle = useCallback(async () => { setLoading(true); setError(''); try {
            setRecycle(listOf(await api('/api/v1/files/recycle'), 'entries'));
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, []);
        useEffect(() => { void load('/'); }, []);
        const switchMode = async (next) => { setMode(next); setFilter(''); if (next === 'recycle')
            await loadRecycle();
        else if (next === 'files')
            await load(listing.path);
        else {
            setLoading(true);
            try {
                setPreferences(normalizePreferences(await api('/api/v1/files/preferences')));
            }
            catch (cause) {
                setError(errorDetail(cause));
            }
            finally {
                setLoading(false);
            }
        } };
        const favorites = new Set(listOf(preferences, 'favorites').map(item => item.path));
        const sourceEntries = mode === 'favorites' ? listOf(preferences, 'favorites') : mode === 'recent' ? listOf(preferences, 'recent') : listOf(listing, 'entries');
        const entries = sourceEntries.map((item) => ({ ...item, name: item.name || String(item.path || '').split('/').pop(), is_dir: item.is_dir ?? item.directory })).filter((item) => !filter || `${item.name} ${item.path}`.toLowerCase().includes(filter.toLowerCase()));
        const breadcrumbs = useMemo(() => { const rows = [{ label: '根目录', path: '/' }]; let current = ''; for (const part of String(listing.path || '/').split('/').filter(Boolean)) {
            current += `/${part}`;
            rows.push({ label: part, path: current });
        } return rows; }, [listing.path]);
        const joinPath = (base, name) => `${base === '/' ? '' : base}/${name}`.replace(/\/+/g, '/') || '/';
        const parentOf = (path) => path.slice(0, path.lastIndexOf('/')) || '/';
        const mutate = async (endpoint, body, success) => {
            setWorking(true);
            try {
                await secureApi(endpoint, { method: 'POST', body: jsonBody(body) });
                const sourcePath = String(body.source || body.path || '');
                const favoriteEntry = listOf(preferences, 'favorites').find(item => item.path === sourcePath);
                if (favoriteEntry && endpoint === '/api/v1/files/delete') {
                    await api('/api/v1/files/preferences', { method: 'POST', body: jsonBody({ action: 'unfavorite', path: sourcePath, is_dir: !!favoriteEntry.is_dir }) });
                }
                else if (favoriteEntry && (endpoint === '/api/v1/files/rename' || endpoint === '/api/v1/files/move')) {
                    const destination = String(body.destination || '');
                    await api('/api/v1/files/preferences', { method: 'POST', body: jsonBody({ action: 'unfavorite', path: sourcePath, is_dir: !!favoriteEntry.is_dir }) });
                    await api('/api/v1/files/preferences', { method: 'POST', body: jsonBody({ action: 'favorite', path: destination, is_dir: !!favoriteEntry.is_dir }) });
                }
                props.notify('success', success);
                await load(listing.path);
                return true;
            }
            catch (cause) {
                props.notify('error', '文件操作失败', errorDetail(cause));
                return false;
            }
            finally {
                setWorking(false);
            }
        };
        const openEditor = async (item) => { try {
            const content = asObject(await secureApi(`/api/v1/files/content${query({ path: item.path })}`));
            const value = text(content.content, '');
            const editor = React.createElement(FileEditorModal, { item: item, initial: value, onClose: props.closeModal, onSave: async (next) => { await secureApi('/api/v1/files/content', { method: 'PUT', body: jsonBody({ path: item.path, content: next }) }); await load(listing.path); props.notify('success', '文件已保存，并生成历史版本'); }, onHistory: () => showHistory(item.path), confirm: props.confirm });
            props.openModal({ title: item.name, size: 'large', content: editor });
        }
        catch (cause) {
            props.notify('error', '读取文件失败', errorDetail(cause));
        } };
        const downloadEntry = async (item) => { try {
            await secureApi(`/api/v1/files/preview${query({ path: item.path })}`);
            location.assign(`/api/v1/files/download${query({ path: item.path })}`);
        }
        catch (cause) {
            props.notify('error', '下载准备失败', errorDetail(cause));
        } };
        const openEntry = async (item) => { if (item.is_dir) {
            setMode('files');
            await load(item.path);
            return;
        } setWorking(true); try {
            const preview = asObject(await secureApi(`/api/v1/files/preview${query({ path: item.path })}`));
            const kind = text(preview.kind, 'download');
            if (kind === 'text' || kind === 'markdown') {
                await openEditor(item);
            }
            else if (kind === 'image') {
                props.openModal({ title: item.name, size: 'large', content: React.createElement("div", { className: "preview-wrap" },
                        React.createElement("img", { className: "image-preview", src: `/api/v1/files/preview/raw${query({ path: item.path })}`, alt: item.name }),
                        React.createElement("a", { className: "button button-default", href: `/api/v1/files/download${query({ path: item.path })}` },
                            React.createElement(Icon, { name: "download", size: 17 }),
                            React.createElement("span", null, "\u4E0B\u8F7D"))) });
            }
            else if (kind === 'pdf') {
                props.openModal({ title: item.name, size: 'large', content: React.createElement("div", { className: "preview-wrap" },
                        React.createElement("iframe", { className: "pdf-preview", src: `/api/v1/files/preview/raw${query({ path: item.path })}`, title: item.name }),
                        React.createElement("a", { className: "button button-default", href: `/api/v1/files/download${query({ path: item.path })}` },
                            React.createElement(Icon, { name: "download", size: 17 }),
                            React.createElement("span", null, "\u4E0B\u8F7D"))) });
            }
            else if (kind === 'archive') {
                const archive = await secureApi(`/api/v1/files/archive/list${query({ path: item.path })}`);
                props.openModal({ title: `${item.name} · 压缩包内容`, size: 'large', content: React.createElement(React.Fragment, null,
                        React.createElement(JsonDetails, { data: archive, title: "\u5F52\u6863\u6761\u76EE" }),
                        React.createElement("a", { className: "button button-default", href: `/api/v1/files/download${query({ path: item.path })}` },
                            React.createElement(Icon, { name: "download", size: 17 }),
                            React.createElement("span", null, "\u4E0B\u8F7D"))) });
            }
            else {
                await downloadEntry(item);
            }
        }
        catch (cause) {
            props.notify('error', '无法打开文件', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const showHistory = async (path) => { try {
            const result = await secureApi(`/api/v1/files/backups${query({ path })}`);
            const versions = listOf(result, 'backups', 'versions');
            props.openModal({ title: '历史版本', size: 'large', content: versions.length ? React.createElement("div", { className: "card-list compact-list" }, versions.map(version => React.createElement("div", { className: "history-row", key: version.id },
                    React.createElement("div", null,
                        React.createElement("strong", null, formatDate(version.created_at)),
                        React.createElement("small", null,
                            formatBytes(version.size),
                            " \u00B7 ",
                            version.id)),
                    React.createElement("div", { className: "row-buttons" },
                        React.createElement(Button, { onClick: async () => { try {
                                const diff = asObject(await secureApi(`/api/v1/files/backups/diff${query({ path: version.path || path, id: version.id })}`));
                                props.openModal({ title: '版本差异', size: 'large', content: React.createElement("div", { className: "form-stack" },
                                        React.createElement(Terminal, { maxHeight: 600 }, diff.diff || '没有差异'),
                                        React.createElement("div", { className: "form-actions" },
                                            React.createElement(Button, { onClick: props.closeModal }, "\u5173\u95ED"),
                                            React.createElement(Button, { tone: "primary", onClick: async () => { if (await props.confirm('恢复历史版本', `恢复到 ${formatDate(version.created_at)}？当前内容会先自动备份。`, '恢复')) {
                                                    await secureApi('/api/v1/files/backups/restore', { method: 'POST', body: jsonBody({ path: version.path || path, id: version.id }) });
                                                    await load(listing.path);
                                                    props.notify('success', '历史版本已恢复');
                                                    props.closeModal();
                                                } } }, "\u6062\u590D\u6B64\u7248\u672C"))) });
                            }
                            catch (cause) {
                                props.notify('error', '版本对比失败', errorDetail(cause));
                            } } }, "\u5BF9\u6BD4"),
                        React.createElement(Button, { tone: "primary", onClick: async () => { if (await props.confirm('恢复历史版本', `恢复到 ${formatDate(version.created_at)}？`, '恢复')) {
                                try {
                                    await secureApi('/api/v1/files/backups/restore', { method: 'POST', body: jsonBody({ path: version.path || path, id: version.id }) });
                                    await load(listing.path);
                                    props.notify('success', '历史版本已恢复');
                                    props.closeModal();
                                }
                                catch (cause) {
                                    props.notify('error', '恢复失败', errorDetail(cause));
                                }
                            } } }, "\u6062\u590D"))))) : React.createElement(EmptyState, { icon: "backup", title: "\u8FD8\u6CA1\u6709\u5386\u53F2\u7248\u672C", description: "\u5728\u7EBF\u4FDD\u5B58\u6587\u4EF6\u524D\u4F1A\u81EA\u52A8\u751F\u6210\u5907\u4EFD" }) });
        }
        catch (cause) {
            props.notify('error', '历史版本读取失败', errorDetail(cause));
        } };
        const promptMutation = (title, label, initial, endpoint, body, success, pattern) => props.openModal({ title, content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get('value') || '').trim(); if (!value || (pattern && !pattern.test(value))) {
                    props.notify('warning', '输入内容不符合要求');
                    return;
                } if (await mutate(endpoint, body(value), success))
                    props.closeModal(); } },
                React.createElement(Field, { label: label },
                    React.createElement(TextInput, { name: "value", defaultValue: initial, autoFocus: true, required: true })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary" }, "\u786E\u8BA4"))) });
        const createEntry = (kind) => promptMutation(kind === 'file' ? '新建文件' : '新建文件夹', '名称', '', kind === 'file' ? '/api/v1/files/create' : '/api/v1/files/mkdir', value => ({ path: joinPath(listing.path, value) }), kind === 'file' ? '文件已创建' : '文件夹已创建');
        const actionMenu = (item) => props.openModal({ title: item.name, content: React.createElement("div", { className: "action-menu" },
                React.createElement("button", { onClick: () => { props.closeModal(); void openEntry(item); } },
                    React.createElement(Icon, { name: "edit" }),
                    React.createElement("span", null, "\u6253\u5F00")),
                React.createElement("button", { onClick: () => { void copyText(item.path).then(() => props.notify('success', '路径已复制')).catch(() => props.openModal({ title: '完整路径', content: React.createElement(Terminal, null, item.path) })); } },
                    React.createElement(Icon, { name: "copy" }),
                    React.createElement("span", null, "\u590D\u5236\u5B8C\u6574\u8DEF\u5F84")),
                !item.is_dir ? React.createElement(React.Fragment, null,
                    React.createElement("button", { onClick: () => void downloadEntry(item) },
                        React.createElement(Icon, { name: "download" }),
                        React.createElement("span", null, "\u4E0B\u8F7D")),
                    React.createElement("button", { onClick: () => showHistory(item.path) },
                        React.createElement(Icon, { name: "backup" }),
                        React.createElement("span", null, "\u5386\u53F2\u7248\u672C"))) : null,
                React.createElement("button", { onClick: () => promptMutation('重命名', '目标绝对路径', joinPath(parentOf(item.path), item.name), '/api/v1/files/rename', value => ({ source: item.path, destination: value }), '已重命名', /^\//) },
                    React.createElement(Icon, { name: "edit" }),
                    React.createElement("span", null, "\u91CD\u547D\u540D")),
                React.createElement("button", { onClick: () => promptMutation('复制到', '目标绝对路径', `${item.path}-副本`, '/api/v1/files/copy', value => ({ source: item.path, destination: value }), '复制完成', /^\//) },
                    React.createElement(Icon, { name: "copy" }),
                    React.createElement("span", null, "\u590D\u5236\u5230\u2026")),
                React.createElement("button", { onClick: () => promptMutation('移动到', '目标绝对路径', item.path, '/api/v1/files/move', value => ({ source: item.path, destination: value }), '移动完成', /^\//) },
                    React.createElement(Icon, { name: "files" }),
                    React.createElement("span", null, "\u79FB\u52A8\u5230\u2026")),
                React.createElement("button", { onClick: () => promptMutation('修改权限', '权限模式', item.mode?.match(/[0-7]{3,4}$/)?.[0] || (item.is_dir ? '755' : '644'), '/api/v1/files/chmod', value => ({ path: item.path, mode: value }), '权限已更新', /^[0-7]{3,4}$/) },
                    React.createElement(Icon, { name: "security" }),
                    React.createElement("span", null, "\u4FEE\u6539\u6743\u9650")),
                React.createElement("button", { onClick: () => props.openModal({ title: '修改所有者', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); if (await mutate('/api/v1/files/chown', { path: item.path, owner: values.get('owner'), group: values.get('group') }, '所有者已更新'))
                                props.closeModal(); } },
                            React.createElement(Field, { label: "\u7528\u6237" },
                                React.createElement(TextInput, { name: "owner", required: true })),
                            React.createElement(Field, { label: "\u7528\u6237\u7EC4" },
                                React.createElement(TextInput, { name: "group" })),
                            React.createElement("div", { className: "form-actions" },
                                React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                                React.createElement(Button, { type: "submit", tone: "primary" }, "\u4FDD\u5B58"))) }) },
                    React.createElement(Icon, { name: "user" }),
                    React.createElement("span", null, "\u4FEE\u6539\u6240\u6709\u8005")),
                React.createElement("button", { onClick: () => promptMutation('压缩包保存路径', '目标绝对路径', joinPath(parentOf(item.path), `${item.name.replace(/\.(tar\.gz|zip)$/i, '')}.tar.gz`), '/api/v1/files/archive/create', value => ({ destination: value, sources: [item.path], format: value.endsWith('.zip') ? 'zip' : 'tar.gz' }), '压缩完成', /^\//) },
                    React.createElement(Icon, { name: "package" }),
                    React.createElement("span", null, "\u521B\u5EFA\u538B\u7F29\u5305")),
                React.createElement("button", { className: "danger", onClick: async () => { if (await props.confirm('移到回收站', `确认删除“${item.name}”？可稍后恢复。`, '删除', true)) {
                        if (await mutate('/api/v1/files/delete', { path: item.path }, '已移到回收站'))
                            props.closeModal();
                    } } },
                    React.createElement(Icon, { name: "trash" }),
                    React.createElement("span", null, "\u79FB\u5230\u56DE\u6536\u7AD9"))) });
        const toggleFavorite = async (item) => { const enabled = !favorites.has(item.path); setWorking(true); try {
            setPreferences(normalizePreferences(await api('/api/v1/files/preferences', { method: 'POST', body: jsonBody({ action: enabled ? 'favorite' : 'unfavorite', path: item.path, is_dir: item.is_dir }) })));
            props.notify('success', enabled ? '已加入收藏' : '已取消收藏');
        }
        catch (cause) {
            props.notify('error', '收藏操作失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const upload = async (event, extract = false) => { const input = event.target; const files = Array.from(input.files || []); if (!files.length)
            return; setWorking(true); let completed = 0; try {
            if (extract) {
                const form = new FormData();
                form.set('directory', listing.path);
                form.set('overwrite', 'false');
                form.set('file', files[0]);
                const out = asObject(await secureApi('/api/v1/files/archive/extract', { method: 'POST', body: form }));
                props.notify('success', `已解压 ${number(out.files)} 个文件和 ${number(out.dirs)} 个目录`);
            }
            else {
                for (const file of files) {
                    const form = new FormData();
                    form.set('directory', listing.path);
                    form.set('relative_path', file.webkitRelativePath || file.name);
                    form.set('overwrite', 'false');
                    form.set('file', file);
                    await secureApi('/api/v1/files/upload', { method: 'POST', body: form });
                    completed++;
                }
                props.notify('success', `已上传 ${completed} 个文件`);
            }
            await load(listing.path);
        }
        catch (cause) {
            props.notify('error', extract ? 'ZIP 解压失败' : `上传中断（${completed}/${files.length}）`, errorDetail(cause));
        }
        finally {
            input.value = '';
            setWorking(false);
        } };
        const searchAll = () => props.openModal({ title: `在 ${listing.path} 中搜索`, content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const term = String(new FormData(event.currentTarget).get('term') || '').trim(); try {
                    const result = await api(`/api/v1/files/search${query({ root: listing.path, q: term })}`);
                    const rows = listOf(result, 'entries', 'results');
                    props.openModal({ title: `搜索结果（${rows.length}）`, size: 'large', content: rows.length ? React.createElement("div", { className: "card-list compact-list" }, rows.map(item => React.createElement("button", { className: "search-result", key: item.path, onClick: () => { props.closeModal(); void openEntry(item); } },
                            React.createElement(Icon, { name: item.is_dir ? 'files' : 'edit' }),
                            React.createElement("span", null,
                                React.createElement("strong", null, item.name),
                                React.createElement("small", null, item.path)),
                            React.createElement(Icon, { name: "chevron" })))) : React.createElement(EmptyState, { icon: "search", title: "\u6CA1\u6709\u5339\u914D\u9879" }) });
                }
                catch (cause) {
                    props.notify('error', '搜索失败', errorDetail(cause));
                } } },
                React.createElement(Field, { label: "\u6587\u4EF6\u540D\u6216\u8DEF\u5F84" },
                    React.createElement(TextInput, { name: "term", required: true, autoFocus: true })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", icon: "search" }, "\u641C\u7D22"))) });
        const recycleAction = async (item, action) => { if (action === 'purge' && !await props.confirm('永久删除', '此操作不可恢复。', '永久删除', true))
            return; setWorking(true); try {
            await secureApi('/api/v1/files/recycle', { method: 'POST', body: jsonBody({ id: item.id, action, destination: '' }) });
            props.notify('success', action === 'restore' ? '文件已恢复' : '已永久删除');
            await loadRecycle();
        }
        catch (cause) {
            props.notify('error', '回收站操作失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        return React.createElement("div", { className: "page-stack files-page" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: () => mode === 'recycle' ? loadRecycle() : load(listing.path), actions: React.createElement(React.Fragment, null,
                    mode !== 'recycle' ? React.createElement(Button, { tone: "ghost", icon: "search", onClick: searchAll }, "\u641C\u7D22") : null,
                    mode === 'files' ? React.createElement(React.Fragment, null,
                        React.createElement(Button, { tone: "ghost", icon: "plus", onClick: () => createEntry('file') }, "\u65B0\u5EFA\u6587\u4EF6"),
                        React.createElement(Button, { tone: "ghost", icon: "plus", onClick: () => createEntry('folder') }, "\u65B0\u5EFA\u6587\u4EF6\u5939"),
                        React.createElement(Button, { tone: "primary", icon: "upload", busy: working, onClick: () => fileInput.current?.click() }, "\u4E0A\u4F20"),
                        React.createElement("input", { ref: fileInput, className: "visually-hidden", type: "file", multiple: true, onChange: (event) => upload(event) }),
                        React.createElement("input", { ref: folderInput, className: "visually-hidden", type: "file", multiple: true, ...{ webkitdirectory: '' }, onChange: (event) => upload(event) }),
                        React.createElement("input", { ref: zipInput, className: "visually-hidden", type: "file", accept: ".zip,application/zip", onChange: (event) => upload(event, true) }),
                        React.createElement("div", { className: `dropdown ${uploadMenuOpen ? 'is-open' : ''}` },
                            React.createElement(Button, { tone: "ghost", icon: "more", title: "\u66F4\u591A\u4E0A\u4F20\u65B9\u5F0F", onClick: () => setUploadMenuOpen(current => !current), "aria-expanded": uploadMenuOpen }, "\u66F4\u591A"),
                            React.createElement("div", { className: "dropdown-menu" },
                                React.createElement("button", { onClick: () => { setUploadMenuOpen(false); folderInput.current?.click(); } }, "\u4E0A\u4F20\u6587\u4EF6\u5939"),
                                React.createElement("button", { onClick: () => { setUploadMenuOpen(false); zipInput.current?.click(); } }, "\u4E0A\u4F20 ZIP \u5E76\u89E3\u538B")))) : null) }),
            React.createElement("div", { className: "tab-bar", role: "tablist" }, [['files', '文件'], ['favorites', `收藏 ${listOf(preferences, 'favorites').length}`], ['recent', `最近 ${listOf(preferences, 'recent').length}`], ['recycle', `回收站 ${recycle.length || ''}`]].map(([value, label]) => React.createElement("button", { key: value, className: mode === value ? 'active' : '', onClick: () => void switchMode(value) }, label))),
            error ? React.createElement(ErrorState, { error: error, retry: () => mode === 'recycle' ? loadRecycle() : load(listing.path) }) : mode === 'recycle' ? React.createElement(Card, { className: "file-list-card" }, recycle.length ? recycle.map(item => React.createElement("div", { className: "file-row", key: item.id },
                React.createElement("span", { className: "file-icon" },
                    React.createElement(Icon, { name: item.is_dir ? 'files' : 'edit' })),
                React.createElement("div", { className: "file-main" },
                    React.createElement("strong", null, item.name),
                    React.createElement("small", null,
                        item.original_path,
                        " \u00B7 ",
                        formatDate(item.deleted_at))),
                React.createElement("div", { className: "row-buttons" },
                    React.createElement(Button, { tone: "primary", onClick: () => recycleAction(item, 'restore') }, "\u6062\u590D"),
                    React.createElement(Button, { tone: "danger", onClick: () => recycleAction(item, 'purge') }, "\u6C38\u4E45\u5220\u9664")))) : !loading ? React.createElement(EmptyState, { icon: "trash", title: "\u56DE\u6536\u7AD9\u662F\u7A7A\u7684" }) : React.createElement(LoadingState, null)) : React.createElement(React.Fragment, null,
                React.createElement(Card, { className: "file-toolbar" },
                    React.createElement(Button, { tone: "ghost", icon: "back", disabled: !listing.parent, onClick: () => listing.parent && load(listing.parent), title: "\u8FD4\u56DE\u4E0A\u7EA7\u76EE\u5F55" }),
                    React.createElement("nav", { className: "breadcrumbs", "aria-label": "\u5F53\u524D\u76EE\u5F55" }, breadcrumbs.map(crumb => React.createElement("button", { key: crumb.path, onClick: () => load(crumb.path) }, crumb.label))),
                    React.createElement(Button, { tone: "ghost", icon: "copy", onClick: () => copyText(listing.path).then(() => props.notify('success', '路径已复制')).catch(() => props.openModal({ title: '当前路径', content: React.createElement(Terminal, null, listing.path) })) }, "\u590D\u5236\u8DEF\u5F84")),
                React.createElement("div", { className: "file-filter" },
                    React.createElement("div", { className: "search-box" },
                        React.createElement(Icon, { name: "search", size: 17 }),
                        React.createElement("input", { value: filter, onChange: (event) => setFilter(event.target.value), placeholder: mode === 'files' ? '筛选当前目录' : mode === 'favorites' ? '筛选收藏' : '筛选最近访问' })),
                    React.createElement(Badge, null, entries.length)),
                React.createElement(Card, { className: "file-list-card" }, entries.length ? entries.map((item) => React.createElement("div", { className: "file-row", key: item.path },
                    React.createElement("button", { className: "file-open", onClick: () => openEntry(item) },
                        React.createElement("span", { className: "file-icon" },
                            React.createElement(Icon, { name: item.is_dir ? 'files' : 'edit' })),
                        React.createElement("span", { className: "file-main" },
                            React.createElement("strong", null, item.name),
                            React.createElement("small", null,
                                item.path,
                                mode === 'files' ? ` · ${item.is_dir ? '文件夹' : formatBytes(item.size)} · ${formatDate(item.modified_at)}` : ''))),
                    React.createElement("button", { className: `favorite-button ${favorites.has(item.path) ? 'active' : ''}`, onClick: () => toggleFavorite(item), "aria-label": favorites.has(item.path) ? '取消收藏' : '加入收藏' }, "\u2605"),
                    React.createElement("button", { className: "icon-button", onClick: () => actionMenu(item), "aria-label": "\u6587\u4EF6\u64CD\u4F5C" },
                        React.createElement(Icon, { name: "more" })))) : !loading ? React.createElement(EmptyState, { icon: "files", title: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6587\u4EF6" }) : React.createElement(LoadingState, null))));
    }
    function FileEditorModal({ item, initial, onClose, onSave, onHistory, confirm }) {
        const [value, setValue] = useState(initial);
        const [saved, setSaved] = useState(initial);
        const [busy, setBusy] = useState(false);
        const close = async () => { if (value !== saved && !await confirm('放弃未保存内容', '编辑器中仍有未保存的修改，关闭后这些修改会丢失。', '放弃修改', true))
            return; onClose(); };
        const history = async () => { if (value !== saved && !await confirm('打开历史版本', '当前修改尚未保存。打开历史版本会关闭编辑器并丢弃这些修改。', '继续打开', true))
            return; onHistory(); };
        return React.createElement("div", { className: "editor-layout" },
            React.createElement("div", { className: "editor-toolbar" },
                React.createElement("span", { className: "mono" }, item.path),
                React.createElement("div", null,
                    React.createElement(Button, { tone: "ghost", onClick: history }, "\u5386\u53F2\u7248\u672C"),
                    React.createElement(Button, { tone: "primary", busy: busy, disabled: value === saved, onClick: async () => { setBusy(true); try {
                            await onSave(value);
                            setSaved(value);
                        }
                        finally {
                            setBusy(false);
                        } } }, "\u4FDD\u5B58"),
                    React.createElement(Button, { tone: "ghost", onClick: close }, "\u5173\u95ED"))),
            React.createElement("textarea", { className: "code-editor", value: value, onChange: (event) => setValue(event.target.value), spellCheck: false }));
    }
    function ToolsPage(props) {
        const [tool, setTool] = useState('ping');
        const [target, setTarget] = useState('');
        const [port, setPort] = useState(443);
        const [result, setResult] = useState(null);
        const [running, setRunning] = useState(false);
        const options = { ping: ['Ping', '检查 ICMP 延迟与丢包'], dns: ['DNS', '解析域名的 A/AAAA 地址'], tcp: ['TCP', '测试目标端口可达性'], http: ['HTTP', '检查网址响应和重定向'], diagnostic: ['一键诊断', '汇总负载、磁盘、服务和端口'] };
        const run = async (event) => { event?.preventDefault(); setRunning(true); setResult(null); try {
            setResult(await api('/api/v1/tools/run', { method: 'POST', body: jsonBody({ tool, target: tool === 'diagnostic' ? '' : target, port: tool === 'tcp' ? port : 0 }) }));
        }
        catch (cause) {
            props.notify('error', '工具执行失败', errorDetail(cause));
        }
        finally {
            setRunning(false);
        } };
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props }),
            React.createElement("section", { className: "tools-grid" },
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u7F51\u7EDC\u8BCA\u65AD", subtitle: "\u5728\u670D\u52A1\u5668\u4FA7\u6267\u884C\uFF0C\u4E0D\u7ECF\u8FC7\u6D4F\u89C8\u5668\u7F51\u7EDC" }),
                    React.createElement("form", { className: "form-stack", onSubmit: run },
                        React.createElement(Field, { label: "\u5DE5\u5177" },
                            React.createElement(SelectInput, { value: tool, onChange: (event) => setTool(event.target.value) }, Object.entries(options).map(([value, item]) => React.createElement("option", { value: value, key: value }, item[0])))),
                        tool !== 'diagnostic' ? React.createElement(Field, { label: tool === 'http' ? '网址或域名' : '目标域名或 IP' },
                            React.createElement(TextInput, { value: target, onChange: (event) => setTarget(event.target.value), placeholder: "example.com", required: true })) : null,
                        tool === 'tcp' ? React.createElement(Field, { label: "\u7AEF\u53E3" },
                            React.createElement(TextInput, { type: "number", min: "1", max: "65535", value: port, onChange: (event) => setPort(number(event.target.value, 443)) })) : null,
                        React.createElement("p", { className: "field-hint" }, options[tool][1]),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: running, className: "full-width" }, "\u5F00\u59CB\u6267\u884C"))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u6267\u884C\u7ED3\u679C", subtitle: result ? `${text(result.target)} · ${text(result.duration_ms, '—')} ms` : '结果会完整显示在这里', actions: result?.output ? React.createElement(Button, { tone: "ghost", icon: "copy", onClick: () => copyText(result.output).then(() => props.notify('success', '结果已复制')) }, "\u590D\u5236") : null }),
                    running ? React.createElement(LoadingState, { rows: 5 }) : result ? React.createElement(Terminal, { maxHeight: 520 }, result.output || listOf(result.addresses).join('\n') || '命令没有返回内容') : React.createElement(EmptyState, { icon: "terminal", title: "\u7B49\u5F85\u6267\u884C", description: "\u9009\u62E9\u5DE5\u5177\u5E76\u586B\u5199\u76EE\u6807\u540E\u6267\u884C" }))),
            React.createElement(Card, null,
                React.createElement(SectionTitle, { title: "\u6269\u5C55\u5DE5\u5177" }),
                React.createElement("button", { className: "module-card full-module", onClick: () => props.navigate('/tools/github') },
                    React.createElement("span", { className: "module-icon" },
                        React.createElement(Icon, { name: "github" })),
                    React.createElement("div", null,
                        React.createElement("strong", null, "GitHub \u52A9\u624B"),
                        React.createElement("p", null, "\u8BBE\u5907\u767B\u5F55\u3001\u4ED3\u5E93\u3001Actions\u3001Release \u548C ZIP \u63A8\u9001")),
                    React.createElement(Icon, { name: "chevron" }))));
    }
    function GitHubPage(props) {
        const [auth, setAuth] = useState({});
        const [flow, setFlow] = useState(null);
        const [summary, setSummary] = useState(null);
        const [owner, setOwner] = useState(localStorage.getItem('lukepanel:github-owner') || '');
        const [repo, setRepo] = useState(localStorage.getItem('lukepanel:github-repo') || '');
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const pollRef = useRef(0);
        const zipRef = useRef(null);
        const assetRef = useRef(null);
        const [importPlan, setImportPlan] = useState(null);
        const [importBranch, setImportBranch] = useState('main');
        const [importMessage, setImportMessage] = useState('chore: import files from LukePanel');
        const loadAuth = async () => { const next = asObject(await api('/api/v1/github/auth/status')); setAuth(next); return next; };
        const loadRepo = async () => { if (!owner.trim() || !repo.trim())
            return; setWorking(true); try {
            const next = asObject(await api(`/api/v1/github/summary${query({ owner: owner.trim(), repo: repo.trim() })}`));
            setSummary(next);
            localStorage.setItem('lukepanel:github-owner', owner.trim());
            localStorage.setItem('lukepanel:github-repo', repo.trim());
            setImportBranch(text(next.default_branch, 'main'));
        }
        catch (cause) {
            props.notify('error', '读取仓库失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            await loadAuth();
            if (owner.trim() && repo.trim()) {
                const next = asObject(await api(`/api/v1/github/summary${query({ owner: owner.trim(), repo: repo.trim() })}`));
                setSummary(next);
            }
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, [owner, repo]);
        useEffect(() => { void reload(); return () => window.clearTimeout(pollRef.current); }, []);
        const connectToken = () => props.openModal({ title: '连接 GitHub Token', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const token = String(new FormData(event.currentTarget).get('token') || '').trim(); setWorking(true); try {
                    const next = asObject(await api('/api/v1/github/auth/token', { method: 'POST', body: jsonBody({ token }) }));
                    setAuth(next);
                    props.closeModal();
                    props.notify('success', `已连接 GitHub @${text(next.login)}`);
                }
                catch (cause) {
                    props.notify('error', '连接 GitHub 失败', errorDetail(cause));
                }
                finally {
                    setWorking(false);
                } } },
                React.createElement(Field, { label: "Fine-grained Personal Access Token", hint: "Token \u53EA\u4FDD\u5B58\u5728\u5F53\u524D\u767B\u5F55\u4F1A\u8BDD\u5185\u5B58\uFF0C\u9000\u51FA\u6216\u91CD\u542F\u540E\u5931\u6548" },
                    React.createElement(TextInput, { name: "token", type: "password", required: true, autoFocus: true })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u9A8C\u8BC1\u5E76\u8FDE\u63A5"))) });
        const pollDevice = async (current) => { try {
            const out = asObject(await api('/api/v1/github/auth/device/poll', { method: 'POST', body: jsonBody({ flow_id: current.flow_id }) }));
            if (out.status === 'authorized') {
                setFlow(null);
                await loadAuth();
                props.notify('success', 'GitHub 设备登录完成');
                return;
            }
            if (out.status === 'expired' || out.status === 'denied')
                throw new Error(text(out.message, '设备登录已过期或被拒绝'));
            pollRef.current = window.setTimeout(() => void pollDevice(current), Math.max(2, number(out.retry_after || current.interval, 5)) * 1000);
        }
        catch (cause) {
            setFlow(null);
            props.notify('error', '设备登录失败', errorDetail(cause));
        } };
        const startDevice = async () => { setWorking(true); try {
            const next = asObject(await api('/api/v1/github/auth/device/start', { method: 'POST', body: '{}' }));
            setFlow(next);
            window.open(text(next.verification_uri), '_blank', 'noopener');
            pollRef.current = window.setTimeout(() => void pollDevice(next), Math.max(2, number(next.interval, 5)) * 1000);
        }
        catch (cause) {
            props.notify('error', '无法启动设备登录', errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const disconnect = async () => { if (!await props.confirm('断开 GitHub', '当前会话中的 Token 会立即从内存删除。', '断开', true))
            return; try {
            await api('/api/v1/github/auth/disconnect', { method: 'POST', body: '{}' });
            setAuth({ connected: false });
            setSummary(null);
            props.notify('success', '已断开 GitHub');
        }
        catch (cause) {
            props.notify('error', '断开失败', errorDetail(cause));
        } };
        const repoMutation = async (endpoint, body, success) => { setWorking(true); try {
            const out = asObject(await secureApi(endpoint, { method: 'POST', body: jsonBody({ owner: summary?.owner || owner, repo: summary?.name || repo, ...body }) }));
            props.notify('success', success, out.message || out.output);
            await loadRepo();
            return out;
        }
        catch (cause) {
            props.notify('error', 'GitHub 操作失败', errorDetail(cause));
            throw cause;
        }
        finally {
            setWorking(false);
        } };
        const simpleForm = (title, fields, submit, submitLabel = '确认') => props.openModal({ title, content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); await submit(new FormData(event.currentTarget)); } },
                fields.map((field, index) => React.createElement(Field, { label: field.label, hint: field.hint, key: index }, field.kind === 'textarea' ? React.createElement(TextArea, { name: field.name, rows: field.rows || 5, defaultValue: field.value || '', required: field.required }) : field.kind === 'select' ? React.createElement(SelectInput, { name: field.name, defaultValue: field.value }, field.options.map((option) => React.createElement("option", { key: option }, option))) : React.createElement(TextInput, { name: field.name, defaultValue: field.value || '', required: field.required }))),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", busy: working }, submitLabel))) });
        const openRun = async (run) => { try {
            const jobs = listOf(await api(`/api/v1/github/actions/jobs${query({ owner: summary.owner, repo: summary.name, run_id: run.id })}`), 'jobs');
            props.openModal({ title: `${run.name} · Jobs`, size: 'large', content: jobs.length ? React.createElement("div", { className: "card-list compact-list" }, jobs.map(job => React.createElement("div", { className: "history-row", key: job.id },
                    React.createElement("div", null,
                        React.createElement("strong", null, job.name),
                        React.createElement("small", null,
                            text(job.conclusion || job.status),
                            " \u00B7 ",
                            formatDate(job.started_at))),
                    React.createElement(Button, { onClick: async () => { try {
                            const out = asObject(await api(`/api/v1/github/actions/job-logs${query({ owner: summary.owner, repo: summary.name, job_id: job.id })}`));
                            props.openModal({ title: `${job.name} · 日志`, size: 'large', content: React.createElement("div", { className: "form-stack" },
                                    React.createElement(Terminal, { maxHeight: 650 }, out.logs),
                                    React.createElement(Button, { icon: "copy", onClick: () => copyText(text(out.logs, '')).then(() => props.notify('success', '日志已复制')) }, "\u590D\u5236\u65E5\u5FD7")) });
                        }
                        catch (cause) {
                            props.notify('error', '读取 Job 日志失败', errorDetail(cause));
                        } } }, "\u67E5\u770B\u65E5\u5FD7")))) : React.createElement(EmptyState, { icon: "audit", title: "\u6CA1\u6709\u53EF\u663E\u793A\u7684 Jobs" }) });
        }
        catch (cause) {
            props.notify('error', '读取 Actions 详情失败', errorDetail(cause));
        } };
        const previewImport = async (event) => { const file = event.target.files?.[0]; if (!file || !summary)
            return; setWorking(true); try {
            const form = new FormData();
            form.set('owner', summary.owner);
            form.set('repo', summary.name);
            form.set('branch', importBranch);
            form.set('file', file);
            setImportPlan(await api('/api/v1/github/import/preview', { method: 'POST', body: form }));
            props.notify('success', 'ZIP 差异已生成');
        }
        catch (cause) {
            props.notify('error', 'ZIP 预览失败', errorDetail(cause));
        }
        finally {
            setWorking(false);
            event.target.value = '';
        } };
        const commitImport = async () => { if (!importPlan)
            return; if (!await props.confirm('Commit 并 Push', `新增 ${number(importPlan.added)} · 修改 ${number(importPlan.modified)} · 删除 ${number(importPlan.deleted)}`, '提交推送'))
            return; try {
            const out = asObject(await secureApi('/api/v1/github/import/commit', { method: 'POST', body: jsonBody({ plan_id: importPlan.id, message: importMessage }) }));
            setImportPlan(null);
            props.notify('success', '文件已推送');
            if (out.html_url)
                window.open(out.html_url, '_blank', 'noopener');
            await loadRepo();
        }
        catch (cause) {
            props.notify('error', '推送失败', errorDetail(cause));
        } };
        const openAssets = async () => { if (!summary?.latest_release)
            return; const tag = summary.latest_release.tag_name; try {
            const assets = listOf(await api(`/api/v1/github/release/assets${query({ owner: summary.owner, repo: summary.name, tag })}`), 'assets');
            props.openModal({ title: `Release 附件 · ${tag}`, size: 'large', content: React.createElement("div", { className: "form-stack" },
                    React.createElement("label", { className: "button button-primary file-button" },
                        React.createElement(Icon, { name: "upload", size: 17 }),
                        React.createElement("span", null, "\u4E0A\u4F20\u9644\u4EF6"),
                        React.createElement("input", { ref: assetRef, type: "file", onChange: async (event) => { const file = event.target.files?.[0]; if (!file)
                                return; const form = new FormData(); form.set('owner', summary.owner); form.set('repo', summary.name); form.set('tag', tag); form.set('file', file); try {
                                await secureApi('/api/v1/github/release/assets/upload', { method: 'POST', body: form });
                                props.notify('success', `${file.name} 已上传`);
                                props.closeModal();
                                await openAssets();
                            }
                            catch (cause) {
                                props.notify('error', '附件上传失败', errorDetail(cause));
                            } } })),
                    React.createElement("div", { className: "card-list compact-list" }, assets.map(asset => React.createElement("div", { className: "history-row", key: asset.id },
                        React.createElement("div", null,
                            React.createElement("strong", null, asset.name),
                            React.createElement("small", null,
                                formatBytes(asset.size),
                                " \u00B7 \u4E0B\u8F7D ",
                                number(asset.download_count),
                                " \u6B21 \u00B7 ",
                                formatDate(asset.created_at))),
                        asset.browser_download_url ? React.createElement("a", { className: "button button-default", href: asset.browser_download_url, target: "_blank", rel: "noopener" }, "\u4E0B\u8F7D") : null)))) });
        }
        catch (cause) {
            props.notify('error', '读取 Release 附件失败', errorDetail(cause));
        } };
        const branches = listOf(summary, 'branches').map(item => item.name);
        const runs = listOf(summary, 'workflow_runs');
        const pulls = listOf(summary, 'pull_requests');
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload }),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : React.createElement(React.Fragment, null,
                React.createElement(Card, { className: "github-auth-card" },
                    React.createElement("div", { className: "github-identity" },
                        React.createElement("span", { className: "github-mark" },
                            React.createElement(Icon, { name: "github" })),
                        React.createElement("div", null,
                            React.createElement("h2", null, auth.connected ? `@${text(auth.login)}` : '连接 GitHub'),
                            React.createElement("p", null, auth.connected ? `${text(auth.name || auth.scope)} · Token 仅保存在当前登录会话内存` : '推荐设备代码登录，也可以使用 Fine-grained Token。'))),
                    React.createElement("div", { className: "row-buttons" }, auth.connected ? React.createElement(Button, { tone: "danger", onClick: disconnect }, "\u65AD\u5F00") : React.createElement(React.Fragment, null,
                        React.createElement(Button, { onClick: connectToken }, "Token \u767B\u5F55"),
                        auth.device_login_available !== false ? React.createElement(Button, { tone: "primary", busy: working, onClick: startDevice }, "\u8BBE\u5907\u767B\u5F55") : null))),
                flow ? React.createElement("div", { className: "notice info" },
                    React.createElement(Icon, { name: "info" }),
                    React.createElement("div", null,
                        React.createElement("strong", null,
                            "\u8BBE\u5907\u4EE3\u7801\uFF1A",
                            text(flow.user_code)),
                        React.createElement("span", null, "\u5DF2\u6253\u5F00 GitHub \u9A8C\u8BC1\u9875\uFF0C\u5B8C\u6210\u6388\u6743\u540E\u4F1A\u81EA\u52A8\u66F4\u65B0\u3002")),
                    React.createElement(Button, { icon: "copy", onClick: () => copyText(flow.user_code).then(() => props.notify('success', '设备代码已复制')) }, "\u590D\u5236"),
                    React.createElement(Button, { tone: "danger", onClick: async () => { window.clearTimeout(pollRef.current); try {
                            await api('/api/v1/github/auth/device/cancel', { method: 'POST', body: jsonBody({ flow_id: flow.flow_id }) });
                        }
                        finally {
                            setFlow(null);
                        } } }, "\u53D6\u6D88")) : null,
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u9009\u62E9\u4ED3\u5E93", subtitle: "LukePanel \u4E0D\u9884\u8BBE\u4EFB\u4F55\u4ED3\u5E93" }),
                    React.createElement("form", { className: "repo-picker", onSubmit: (event) => { event.preventDefault(); void loadRepo(); } },
                        React.createElement(Field, { label: "\u6240\u6709\u8005" },
                            React.createElement(TextInput, { value: owner, onChange: (event) => setOwner(event.target.value), required: true })),
                        React.createElement(Field, { label: "\u4ED3\u5E93" },
                            React.createElement(TextInput, { value: repo, onChange: (event) => setRepo(event.target.value), required: true })),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u8BFB\u53D6\u4ED3\u5E93"))),
                summary ? React.createElement(React.Fragment, null,
                    React.createElement("section", { className: "github-summary-grid" },
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: text(summary.full_name), subtitle: text(summary.description, '无仓库说明'), actions: React.createElement(Badge, null, text(summary.visibility)) }),
                            React.createElement("dl", { className: "key-value-list" },
                                React.createElement(KeyValue, { label: "\u9ED8\u8BA4\u5206\u652F", value: text(summary.default_branch) }),
                                React.createElement(KeyValue, { label: "\u6700\u65B0\u63D0\u4EA4", value: React.createElement("code", null, text(summary.main_sha, '').slice(0, 12)) }),
                                React.createElement(KeyValue, { label: "\u5206\u652F", value: branches.length }),
                                React.createElement(KeyValue, { label: "\u6700\u65B0 Tag", value: text(summary.tags?.[0]?.name, '暂无') }),
                                React.createElement(KeyValue, { label: "\u6700\u65B0 Release", value: text(summary.latest_release?.tag_name, '暂无') }))),
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: "\u6700\u8FD1 Actions", subtitle: "\u5931\u8D25\u4EFB\u52A1\u53EF\u76F4\u63A5\u91CD\u8BD5" }),
                            runs.length ? React.createElement("div", { className: "workflow-list" }, runs.map(run => React.createElement("div", { className: "workflow-row", key: run.id },
                                React.createElement("span", { className: `workflow-dot ${run.conclusion === 'success' ? 'ok' : run.status !== 'completed' ? 'running' : 'bad'}` }),
                                React.createElement("div", null,
                                    React.createElement("strong", null, text(run.name)),
                                    React.createElement("small", null,
                                        text(run.head_branch || run.event),
                                        " \u00B7 ",
                                        formatDate(run.created_at))),
                                React.createElement("div", { className: "row-buttons" },
                                    React.createElement(Badge, { tone: run.conclusion === 'success' ? 'success' : run.status !== 'completed' ? 'warning' : 'danger' }, text(run.conclusion || run.status)),
                                    React.createElement(Button, { tone: "ghost", onClick: () => openRun(run) }, "\u8BE6\u60C5"),
                                    ['failure', 'cancelled', 'timed_out'].includes(run.conclusion) ? React.createElement(Button, { onClick: () => repoMutation('/api/v1/github/rerun', { run_id: run.id }, '已请求重试失败任务') }, "\u91CD\u8BD5") : null)))) : React.createElement(EmptyState, { icon: "audit", title: "\u6682\u65E0 Actions \u8BB0\u5F55" }))),
                    React.createElement("section", { className: "github-summary-grid" },
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: "Pull Requests", subtitle: "\u5408\u5E76\u4ECD\u9075\u5B88\u5206\u652F\u4FDD\u62A4\u548C\u68C0\u67E5" }),
                            pulls.length ? React.createElement("div", { className: "workflow-list" }, pulls.map(item => React.createElement("div", { className: "workflow-row", key: item.number },
                                React.createElement("span", { className: `workflow-dot ${item.draft ? 'running' : 'ok'}` }),
                                React.createElement("div", null,
                                    React.createElement("strong", null,
                                        "#",
                                        item.number,
                                        " \u00B7 ",
                                        text(item.title)),
                                    React.createElement("small", null,
                                        text(item.head),
                                        " \u2192 ",
                                        text(item.base),
                                        item.draft ? ' · 草稿' : '')),
                                React.createElement("div", { className: "row-buttons" },
                                    item.html_url ? React.createElement("a", { className: "button button-ghost", href: item.html_url, target: "_blank", rel: "noopener" }, "\u6253\u5F00") : null,
                                    auth.connected && item.state === 'open' && !item.draft ? React.createElement(Button, { tone: "primary", onClick: () => props.openModal({ title: '合并 Pull Request', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const method = String(new FormData(event.currentTarget).get('method') || 'squash'); if (!await props.confirm('确认合并 Pull Request', `#${item.number} · ${text(item.title)}\n合并方式：${method}`, '合并'))
                                                    return; await repoMutation('/api/v1/github/pull/merge', { number: item.number, expected_sha: item.head_sha || '', method }, 'Pull Request 已合并'); props.closeModal(); } },
                                                React.createElement(Field, { label: "\u5408\u5E76\u65B9\u5F0F" },
                                                    React.createElement(SelectInput, { name: "method", defaultValue: "squash" },
                                                        React.createElement("option", { value: "squash" }, "Squash merge\uFF08\u63A8\u8350\uFF09"),
                                                        React.createElement("option", { value: "merge" }, "Merge commit"),
                                                        React.createElement("option", { value: "rebase" }, "Rebase merge"))),
                                                React.createElement("p", { className: "form-help" }, "\u5408\u5E76\u4ECD\u4F1A\u9075\u5B88\u4ED3\u5E93\u7684\u5206\u652F\u4FDD\u62A4\u3001\u68C0\u67E5\u72B6\u6001\u548C\u6700\u65B0 Head SHA\u3002"),
                                                React.createElement("div", { className: "form-actions" },
                                                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                                                    React.createElement(Button, { type: "submit", tone: "primary" }, "\u7EE7\u7EED"))) }) }, "\u5408\u5E76") : null)))) : React.createElement(EmptyState, { icon: "github", title: "\u6682\u65E0\u5F00\u653E\u7684 Pull Request" })),
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: "Release \u9644\u4EF6", subtitle: text(summary.latest_release?.tag_name, '尚未创建 Release') }),
                            summary.latest_release ? React.createElement("div", { className: "setting-card" },
                                React.createElement("p", null,
                                    text(summary.latest_release.name || summary.latest_release.tag_name),
                                    " \u00B7 ",
                                    formatDate(summary.latest_release.published_at)),
                                React.createElement(Button, { tone: "primary", onClick: openAssets }, "\u7BA1\u7406\u9644\u4EF6")) : React.createElement(EmptyState, { icon: "package", title: "\u5C1A\u65E0 Release" }))),
                    React.createElement("div", { className: "settings-grid" },
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: "\u521B\u5EFA\u5206\u652F", subtitle: "\u4ECE\u73B0\u6709\u5206\u652F\u6216 SHA \u521B\u5EFA" }),
                            React.createElement(Button, { tone: "primary", onClick: () => simpleForm('创建分支', [{ label: '新分支名称', name: 'name', required: true }, { label: '来源', name: 'source', kind: 'select', options: branches, value: summary.default_branch }], async (values) => { await repoMutation('/api/v1/github/branch', { name: values.get('name'), source: values.get('source') }, '分支已创建'); props.closeModal(); }) }, "\u521B\u5EFA\u5206\u652F")),
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: "\u521B\u5EFA\u7248\u672C Tag", subtitle: "\u9ED8\u8BA4\u6307\u5411\u9ED8\u8BA4\u5206\u652F\u6700\u65B0\u63D0\u4EA4" }),
                            React.createElement(Button, { tone: "primary", onClick: () => simpleForm('创建 Tag', [{ label: '版本 Tag', name: 'tag', value: VERSION, required: true }], async (values) => { await repoMutation('/api/v1/github/tag', { tag: values.get('tag'), target_sha: summary.main_sha }, `Tag ${values.get('tag')} 已创建`); props.closeModal(); }) }, "\u521B\u5EFA Tag")),
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: "\u521B\u5EFA Pull Request", subtitle: "\u4E0D\u4F1A\u81EA\u52A8\u5408\u5E76" }),
                            React.createElement(Button, { tone: "primary", onClick: () => simpleForm('创建 Pull Request', [{ label: '标题', name: 'title', required: true }, { label: 'Head', name: 'head', kind: 'select', options: branches }, { label: 'Base', name: 'base', kind: 'select', options: branches, value: summary.default_branch }, { label: '说明', name: 'body', kind: 'textarea' }], async (values) => { const out = await repoMutation('/api/v1/github/pull', { title: values.get('title'), body: values.get('body'), head: values.get('head'), base: values.get('base') }, 'Pull Request 已创建'); props.closeModal(); if (out.html_url)
                                    window.open(out.html_url, '_blank', 'noopener'); }) }, "\u521B\u5EFA PR")),
                        React.createElement(Card, null,
                            React.createElement(SectionTitle, { title: "\u521B\u5EFA Release", subtitle: "Tag \u5FC5\u987B\u5DF2\u7ECF\u5B58\u5728" }),
                            React.createElement(Button, { tone: "primary", onClick: () => simpleForm('创建 Release', [{ label: 'Tag', name: 'tag', value: VERSION, required: true }, { label: '标题', name: 'name', value: `LukePanel ${VERSION}`, required: true }, { label: '发布说明', name: 'body', kind: 'textarea' }], async (values) => { const out = await repoMutation('/api/v1/github/release', { tag: values.get('tag'), name: values.get('name'), body: values.get('body'), draft: false, prerelease: false }, 'Release 已创建'); props.closeModal(); if (out.html_url)
                                    window.open(out.html_url, '_blank', 'noopener'); }) }, "\u521B\u5EFA Release"))),
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "ZIP \u5DEE\u5F02\u5BFC\u5165", subtitle: "\u5148\u4E0A\u4F20\u6BD4\u8F83\uFF0C\u518D\u7ECF\u4E8C\u6B21\u9A8C\u8BC1 Commit + Push", actions: React.createElement(Button, { tone: "primary", onClick: () => zipRef.current?.click(), disabled: !auth.connected }, "\u9009\u62E9 ZIP") }),
                        React.createElement("input", { ref: zipRef, className: "visually-hidden", type: "file", accept: ".zip,application/zip", onChange: previewImport }),
                        React.createElement("div", { className: "form-grid" },
                            React.createElement(Field, { label: "\u76EE\u6807\u5206\u652F" },
                                React.createElement(SelectInput, { value: importBranch, onChange: (event) => setImportBranch(event.target.value) }, branches.map(branch => React.createElement("option", { key: branch }, branch)))),
                            React.createElement(Field, { label: "Commit \u4FE1\u606F" },
                                React.createElement(TextInput, { value: importMessage, onChange: (event) => setImportMessage(event.target.value) }))),
                        importPlan ? React.createElement("div", { className: "notice info" },
                            React.createElement(Icon, { name: "check" }),
                            React.createElement("div", null,
                                React.createElement("strong", null, "\u5DEE\u5F02\u5DF2\u751F\u6210"),
                                React.createElement("span", null,
                                    "\u65B0\u589E ",
                                    number(importPlan.added),
                                    " \u00B7 \u4FEE\u6539 ",
                                    number(importPlan.modified),
                                    " \u00B7 \u4E0D\u53D8 ",
                                    number(importPlan.unchanged),
                                    " \u00B7 \u5220\u9664 ",
                                    number(importPlan.deleted))),
                            React.createElement(Button, { tone: "primary", busy: working, onClick: commitImport }, "Commit \u5E76 Push")) : null)) : React.createElement(Card, null,
                    React.createElement(EmptyState, { icon: "github", title: "\u5C1A\u672A\u9009\u62E9\u4ED3\u5E93", description: "\u586B\u5199\u4ED3\u5E93\u6240\u6709\u8005\u548C\u540D\u79F0\u540E\u8BFB\u53D6\uFF1B\u672A\u8FDE\u63A5\u65F6\u4E5F\u53EF\u4EE5\u67E5\u770B\u516C\u5F00\u4ED3\u5E93\u3002" }))));
    }
    function SSHPage(props) {
        const [status, setStatus] = useState({});
        const [users, setUsers] = useState([]);
        const [keys, setKeys] = useState([]);
        const [selectedUser, setSelectedUser] = useState('');
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const enabledValue = (value, fallback = false) => {
            const normalized = String(value ?? '').trim().toLowerCase();
            if (['yes', 'true', 'on', '1', 'enabled'].includes(normalized))
                return true;
            if (['no', 'false', 'off', '0', 'disabled'].includes(normalized))
                return false;
            return fallback;
        };
        const reload = useCallback(async (user = selectedUser) => { setLoading(true); setError(''); try {
            const [statusResult, userResult] = await Promise.all([api('/api/v1/ssh/status'), api('/api/v1/ssh/users')]);
            const nextStatus = asObject(statusResult);
            const userList = listOf(userResult, 'users');
            const nextUser = user || userList[0]?.name || '';
            setStatus(nextStatus);
            setUsers(userList);
            setSelectedUser(nextUser);
            if (nextStatus.available === true && nextUser) {
                setKeys(listOf(await api(`/api/v1/ssh/keys${query({ user: nextUser })}`), 'keys'));
            }
            else {
                setKeys([]);
            }
        }
        catch (cause) {
            setError(errorDetail(cause));
            setKeys([]);
        }
        finally {
            setLoading(false);
        } }, [selectedUser]);
        useEffect(() => { void reload(''); }, []);
        const mutate = async (endpoint, body, success, user = selectedUser) => { setWorking(true); try {
            const out = asObject(await secureApi(endpoint, { method: 'POST', body: jsonBody(body) }));
            props.notify(out.pending_port_confirmation ? 'warning' : 'success', out.message || success);
            await reload(user);
            return out;
        }
        catch (cause) {
            props.notify('error', 'SSH 操作失败', errorDetail(cause));
            throw cause;
        }
        finally {
            setWorking(false);
        } };
        const addKey = () => props.openModal({ title: `添加公钥 · ${selectedUser}`, content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); try {
                    await mutate('/api/v1/ssh/keys/add', { user: selectedUser, key: new FormData(event.currentTarget).get('key') }, 'SSH 公钥已添加');
                    props.closeModal();
                }
                catch { /* reported */ } } },
                React.createElement(Field, { label: "OpenSSH \u516C\u94A5" },
                    React.createElement(TextArea, { name: "key", rows: 6, placeholder: "ssh-ed25519 AAAA...", required: true })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u6DFB\u52A0"))) });
        const generateKey = () => props.openModal({ title: `生成密钥 · ${selectedUser}`, content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); try {
                    const generated = await mutate('/api/v1/ssh/keys/generate', { user: selectedUser, comment: values.get('comment'), passphrase: values.get('passphrase') }, '密钥已生成');
                    props.openModal({ title: '保存私钥', size: 'large', content: React.createElement("div", { className: "form-stack" },
                            React.createElement("div", { className: "notice warning" },
                                React.createElement(Icon, { name: "warning" }),
                                React.createElement("span", null, "\u79C1\u94A5\u53EA\u663E\u793A\u4E00\u6B21\u3002\u8BF7\u7ACB\u5373\u4FDD\u5B58\uFF0C\u5173\u95ED\u540E\u65E0\u6CD5\u518D\u6B21\u67E5\u770B\u3002")),
                            React.createElement(Field, { label: "\u6307\u7EB9" },
                                React.createElement(TextInput, { readOnly: true, value: text(generated.fingerprint) })),
                            React.createElement(Terminal, { maxHeight: 420 }, generated.private_key),
                            React.createElement("div", { className: "form-actions" },
                                React.createElement(Button, { icon: "copy", onClick: () => copyText(text(generated.private_key, '')).then(() => props.notify('success', '私钥已复制')) }, "\u590D\u5236\u79C1\u94A5"),
                                React.createElement(Button, { tone: "primary", icon: "download", onClick: () => { const blob = new Blob([text(generated.private_key, '')], { type: 'application/octet-stream' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = text(generated.filename, 'lukepanel_ed25519'); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } }, "\u4E0B\u8F7D\u79C1\u94A5"),
                                React.createElement(Button, { onClick: props.closeModal }, "\u6211\u5DF2\u4FDD\u5B58"))) });
                }
                catch { /* reported */ } } },
                React.createElement(Field, { label: "\u6CE8\u91CA" },
                    React.createElement(TextInput, { name: "comment", placeholder: `${selectedUser}@lukepanel` })),
                React.createElement(Field, { label: "\u79C1\u94A5\u53E3\u4EE4", hint: "\u5EFA\u8BAE\u8BBE\u7F6E\uFF1B\u7559\u7A7A\u5219\u4E0D\u52A0\u5BC6" },
                    React.createElement(TextInput, { name: "passphrase", type: "password", autoComplete: "new-password" })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u751F\u6210"))) });
        const createUser = () => props.openModal({ title: '创建 Linux 用户', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const name = String(values.get('name') || '').trim(); if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(name)) {
                    props.notify('warning', '用户名只能包含小写字母、数字、下划线和短横线');
                    return;
                } try {
                    await mutate('/api/v1/ssh/users/manage', { action: 'create', name, sudo: values.get('sudo') === 'on' }, 'Linux 用户已创建', name);
                    props.closeModal();
                }
                catch { /* reported */ } } },
                React.createElement(Field, { label: "\u7528\u6237\u540D" },
                    React.createElement(TextInput, { name: "name", autoCapitalize: "none", required: true })),
                React.createElement("label", { className: "check-field" },
                    React.createElement("input", { type: "checkbox", name: "sudo" }),
                    "\u6388\u4E88 sudo \u6743\u9650"),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u521B\u5EFA"))) });
        const saveSettings = async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); await mutate('/api/v1/ssh/settings', { port: number(values.get('port'), 22), permit_root_login: values.get('permit_root_login'), allow_tcp_forwarding: values.get('allow_tcp_forwarding') === 'on', allow_agent_forwarding: values.get('allow_agent_forwarding') === 'on', x11_forwarding: values.get('x11_forwarding') === 'on' }, 'SSH 设置已应用'); };
        const sshAvailable = status.available === true;
        const passwordEnabled = enabledValue(status.password_authentication, false);
        const totalKeys = users.reduce((sum, user) => sum + number(user.key_count), 0);
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: () => reload(), actions: React.createElement(Button, { tone: "primary", icon: "plus", onClick: createUser }, "\u521B\u5EFA\u7528\u6237") }),
            error ? React.createElement(ErrorState, { error: error, retry: () => reload() }) : React.createElement(React.Fragment, null,
                !sshAvailable ? React.createElement("div", { className: "notice danger" },
                    React.createElement(Icon, { name: "warning" }),
                    React.createElement("div", null,
                        React.createElement("strong", null, "OpenSSH Server \u5F53\u524D\u4E0D\u53EF\u7528"),
                        React.createElement("span", null, text(status.error, '无法读取 sshd 有效配置。SSH 设置、密码登录和公钥操作已禁用，避免把未知状态显示成已开启。')))) : null,
                status.pending_new_port ? React.createElement("div", { className: "notice warning" },
                    React.createElement(Icon, { name: "warning" }),
                    React.createElement("div", null,
                        React.createElement("strong", null, "SSH \u65B0\u7AEF\u53E3\u7B49\u5F85\u786E\u8BA4"),
                        React.createElement("span", null,
                            "\u5148\u5728\u53E6\u4E00\u4E2A\u7EC8\u7AEF\u8FDE\u63A5\u7AEF\u53E3 ",
                            text(status.pending_new_port),
                            "\uFF0C\u786E\u8BA4\u6210\u529F\u540E\u518D\u4FDD\u7559\u3002")),
                    React.createElement(Button, { tone: "primary", onClick: () => mutate('/api/v1/ssh/port/confirm', { keep_new: true }, '新端口已确认') }, "\u4FDD\u7559\u65B0\u7AEF\u53E3"),
                    React.createElement(Button, { tone: "danger", onClick: () => mutate('/api/v1/ssh/port/confirm', { keep_new: false }, '已恢复旧端口') }, "\u6062\u590D\u65E7\u7AEF\u53E3")) : null,
                React.createElement("section", { className: "metric-grid small" },
                    React.createElement(Metric, { title: "SSH \u670D\u52A1", value: sshAvailable ? text(status.service, '可用') : '不可用', detail: sshAvailable ? `端口 ${text(status.port, '未知')}` : text(status.error, '未检测到可用 sshd'), icon: "ssh", tone: sshAvailable ? 'normal' : 'danger' }),
                    React.createElement(Metric, { title: "Linux \u7528\u6237", value: String(users.length), detail: "\u53EF\u7BA1\u7406\u8D26\u6237", icon: "user" }),
                    React.createElement(Metric, { title: "\u5DF2\u6388\u6743\u516C\u94A5", value: String(totalKeys), detail: "\u6240\u6709\u7528\u6237\u5408\u8BA1", icon: "key" }),
                    React.createElement(Metric, { title: "\u5BC6\u7801\u767B\u5F55", value: passwordEnabled ? '已开启' : '已关闭', detail: passwordEnabled ? '建议确认密钥后关闭' : '仅密钥登录更安全', icon: "security", tone: passwordEnabled ? 'warning' : 'normal' })),
                React.createElement("div", { className: "settings-grid" },
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "SSH \u5B89\u5168\u8BBE\u7F6E", subtitle: "\u7AEF\u53E3\u4FEE\u6539\u542B\u56DE\u6EDA\u786E\u8BA4\u7A97\u53E3" }),
                        React.createElement("fieldset", { className: "form-fieldset", disabled: !sshAvailable },
                            React.createElement("form", { key: `${status.port}|${status.permit_root_login}|${status.allow_tcp_forwarding}|${status.allow_agent_forwarding}|${status.x11_forwarding}`, className: "form-stack", onSubmit: saveSettings },
                                React.createElement("div", { className: "form-grid" },
                                    React.createElement(Field, { label: "\u76D1\u542C\u7AEF\u53E3" },
                                        React.createElement(TextInput, { name: "port", type: "number", min: "1", max: "65535", defaultValue: number(String(status.port || '22').split(/\s+/)[0], 22) })),
                                    React.createElement(Field, { label: "Root \u767B\u5F55" },
                                        React.createElement(SelectInput, { name: "permit_root_login", defaultValue: text(status.permit_root_login, 'prohibit-password') },
                                            React.createElement("option", { value: "prohibit-password" }, "\u53EA\u5141\u8BB8\u5BC6\u94A5\uFF08\u63A8\u8350\uFF09"),
                                            React.createElement("option", { value: "no" }, "\u5B8C\u5168\u7981\u6B62"),
                                            React.createElement("option", { value: "yes" }, "\u5141\u8BB8"),
                                            React.createElement("option", { value: "forced-commands-only" }, "\u4EC5\u5F3A\u5236\u547D\u4EE4")))),
                                React.createElement("label", { className: "check-field" },
                                    React.createElement("input", { type: "checkbox", name: "allow_tcp_forwarding", defaultChecked: enabledValue(status.allow_tcp_forwarding, false) }),
                                    "\u5141\u8BB8 TCP \u8F6C\u53D1"),
                                React.createElement("label", { className: "check-field" },
                                    React.createElement("input", { type: "checkbox", name: "allow_agent_forwarding", defaultChecked: enabledValue(status.allow_agent_forwarding, false) }),
                                    "\u5141\u8BB8 Agent \u8F6C\u53D1"),
                                React.createElement("label", { className: "check-field" },
                                    React.createElement("input", { type: "checkbox", name: "x11_forwarding", defaultChecked: enabledValue(status.x11_forwarding, false) }),
                                    "\u5141\u8BB8 X11 \u8F6C\u53D1"),
                                React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u5E94\u7528 SSH \u8BBE\u7F6E")))),
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u5BC6\u7801\u767B\u5F55", subtitle: "\u5173\u95ED\u524D\u5FC5\u987B\u5DF2\u6D4B\u8BD5\u516C\u94A5\u767B\u5F55" }),
                        React.createElement("div", { className: `notice ${passwordEnabled ? 'warning' : 'success'}` },
                            React.createElement(Icon, { name: passwordEnabled ? 'warning' : 'check' }),
                            React.createElement("div", null,
                                React.createElement("strong", null, passwordEnabled ? '密码登录当前开启' : '密码登录已关闭'),
                                React.createElement("span", null, passwordEnabled ? '暴露在公网时更容易受到撞库攻击。' : 'Linux 用户必须使用公钥或其他安全方式登录。'))),
                        React.createElement(Button, { tone: passwordEnabled ? 'danger' : 'primary', busy: working, disabled: !sshAvailable, onClick: async () => { const enabled = !passwordEnabled; if (!await props.confirm(enabled ? '恢复密码登录' : '关闭密码登录', enabled ? '恢复后，Linux 账户密码可再次用于远程登录。' : '必须已在另一个终端成功测试公钥登录，避免失联。', enabled ? '恢复' : '确认关闭', !enabled))
                                return; await mutate('/api/v1/ssh/password', { enabled }, enabled ? '密码登录已恢复' : '密码登录已关闭'); } }, passwordEnabled ? '关闭密码登录' : '恢复密码登录'))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u7528\u6237\u4E0E\u516C\u94A5", subtitle: "\u9009\u62E9\u7528\u6237\u540E\u7BA1\u7406 authorized_keys", actions: React.createElement("div", { className: "row-buttons" },
                            React.createElement(SelectInput, { "aria-label": "\u9009\u62E9 SSH \u7528\u6237", value: selectedUser, onChange: (event) => { setSelectedUser(event.target.value); void reload(event.target.value); } }, users.map(user => React.createElement("option", { key: user.name }, user.name))),
                            React.createElement(Button, { tone: "primary", icon: "plus", onClick: addKey, disabled: !selectedUser || !sshAvailable }, "\u6DFB\u52A0\u516C\u94A5"),
                            React.createElement(Button, { icon: "key", onClick: generateKey, disabled: !selectedUser || !sshAvailable }, "\u751F\u6210\u5BC6\u94A5")) }),
                    React.createElement("div", { className: "user-key-layout" },
                        React.createElement("div", { className: "user-list" }, users.map(user => React.createElement("button", { className: selectedUser === user.name ? 'active' : '', key: user.name, onClick: () => { setSelectedUser(user.name); void reload(user.name); } },
                            React.createElement("span", null,
                                React.createElement("strong", null, user.name),
                                React.createElement("small", null,
                                    "UID ",
                                    text(user.uid),
                                    " \u00B7 ",
                                    text(user.home))),
                            React.createElement(Badge, { tone: user.sudo ? 'warning' : 'neutral' }, user.sudo ? 'sudo' : '普通用户')))),
                        React.createElement("div", { className: "key-list" }, keys.length ? keys.map(item => React.createElement("div", { className: "key-row", key: item.id },
                            React.createElement("span", { className: "credential-icon" },
                                React.createElement(Icon, { name: "key" })),
                            React.createElement("div", null,
                                React.createElement("strong", null, text(item.comment, '未命名公钥')),
                                React.createElement("p", { className: "mono" }, text(item.fingerprint)),
                                React.createElement("small", null,
                                    text(item.type),
                                    " \u00B7 ",
                                    text(item.preview))),
                            React.createElement(Button, { tone: "danger", icon: "trash", disabled: !sshAvailable, onClick: async () => { if (await props.confirm('删除 SSH 公钥', '请确认仍有其他可用登录方式，避免失联。', '删除', true))
                                    await mutate('/api/v1/ssh/keys/delete', { user: selectedUser, id: item.id }, '公钥已删除'); } }, "\u5220\u9664"))) : React.createElement(EmptyState, { icon: "key", title: "\u8BE5\u7528\u6237\u6CA1\u6709\u516C\u94A5" })))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "Linux \u7528\u6237\u7BA1\u7406", subtitle: "\u8C28\u614E\u4FEE\u6539 sudo \u6743\u9650\u6216\u5220\u9664\u7528\u6237" }),
                    React.createElement("div", { className: "responsive-table" },
                        React.createElement("div", { className: "table-head" },
                            React.createElement("span", null, "\u7528\u6237"),
                            React.createElement("span", null, "UID/GID"),
                            React.createElement("span", null, "Home / Shell"),
                            React.createElement("span", null, "\u6743\u9650"),
                            React.createElement("span", null, "\u64CD\u4F5C")),
                        users.map(user => React.createElement("div", { className: "table-row", key: user.name },
                            React.createElement("span", { "data-label": "\u7528\u6237" },
                                React.createElement("strong", null, user.name)),
                            React.createElement("span", { "data-label": "UID/GID" },
                                text(user.uid),
                                "/",
                                text(user.gid)),
                            React.createElement("span", { "data-label": "Home / Shell" },
                                React.createElement("small", { className: "mono" },
                                    text(user.home),
                                    React.createElement("br", null),
                                    text(user.shell))),
                            React.createElement("span", { "data-label": "\u6743\u9650" },
                                React.createElement(Badge, { tone: user.sudo ? 'warning' : 'neutral' }, user.sudo ? 'sudo' : '普通')),
                            React.createElement("span", { "data-label": "\u64CD\u4F5C", className: "row-buttons" },
                                React.createElement(Button, { tone: "ghost", onClick: () => mutate('/api/v1/ssh/users/manage', { action: 'sudo', name: user.name, sudo: !user.sudo }, 'sudo 权限已更新') }, user.sudo ? '移除 sudo' : '授予 sudo'),
                                React.createElement(Button, { tone: "danger", onClick: async () => { if (await props.confirm('删除 Linux 用户', `确认删除 ${user.name} 并移除其主目录？`, '删除', true))
                                        await mutate('/api/v1/ssh/users/manage', { action: 'delete', name: user.name, remove_home: true }, '用户已删除', ''); } }, "\u5220\u9664"))))))));
    }
    function AuditPage(props) {
        const [tab, setTab] = useState('audit');
        const [auditEvents, setAuditEvents] = useState([]);
        const [systemLogs, setSystemLogs] = useState('');
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState('');
        const [filters, setFilters] = useState({ q: '', result: '', unit: '', priority: '', lines: 500 });
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            if (tab === 'audit') {
                const out = await api(`/api/v1/audit${query({ q: filters.q, result: filters.result, limit: 500 })}`);
                setAuditEvents(listOf(out, 'events'));
            }
            else {
                const out = asObject(await api(`/api/v1/logs/system${query({ unit: filters.unit, priority: filters.priority, lines: filters.lines })}`));
                setSystemLogs(text(out.logs, ''));
            }
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, [tab, filters.q, filters.result, filters.unit, filters.priority, filters.lines]);
        useEffect(() => { void reload(); }, [reload]);
        useEffect(() => { if (tab !== 'system')
            return; const timer = window.setInterval(() => { if (!document.hidden)
            void reload(); }, 10000); return () => clearInterval(timer); }, [tab, reload]);
        return React.createElement("div", { className: "page-stack" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload, actions: tab === 'system' && systemLogs ? React.createElement(Button, { tone: "ghost", icon: "copy", onClick: () => copyText(systemLogs).then(() => props.notify('success', '日志已复制')) }, "\u590D\u5236") : null }),
            React.createElement("div", { className: "tab-bar" },
                React.createElement("button", { className: tab === 'audit' ? 'active' : '', onClick: () => setTab('audit') }, "\u64CD\u4F5C\u5BA1\u8BA1"),
                React.createElement("button", { className: tab === 'system' ? 'active' : '', onClick: () => setTab('system') }, "\u7CFB\u7EDF\u65E5\u5FD7")),
            tab === 'audit' ? React.createElement(Card, null,
                React.createElement(SectionTitle, { title: "\u64CD\u4F5C\u5BA1\u8BA1", subtitle: "\u8BB0\u5F55\u9762\u677F\u5185\u9AD8\u98CE\u9669\u64CD\u4F5C\u4E0E\u7ED3\u679C" }),
                React.createElement("div", { className: "filter-row" },
                    React.createElement("div", { className: "search-box grow" },
                        React.createElement(Icon, { name: "search", size: 17 }),
                        React.createElement("input", { value: filters.q, onChange: (event) => setFilters(current => ({ ...current, q: event.target.value })), placeholder: "\u7528\u6237\u3001\u8DEF\u5F84\u3001\u52A8\u4F5C\u6216 IP" })),
                    React.createElement(SelectInput, { "aria-label": "\u7B5B\u9009\u5BA1\u8BA1\u7ED3\u679C", value: filters.result, onChange: (event) => setFilters(current => ({ ...current, result: event.target.value })) },
                        React.createElement("option", { value: "" }, "\u5168\u90E8\u7ED3\u679C"),
                        React.createElement("option", { value: "success" }, "\u6210\u529F"),
                        React.createElement("option", { value: "failure" }, "\u5931\u8D25"))),
                error ? React.createElement(ErrorState, { error: error, retry: reload }) : auditEvents.length ? React.createElement("div", { className: "audit-list" }, auditEvents.map((item, index) => React.createElement("article", { className: "audit-row", key: item.id || index },
                    React.createElement("span", { className: `audit-status ${item.result === 'failure' || item.success === false ? 'bad' : 'ok'}` },
                        React.createElement(Icon, { name: item.result === 'failure' || item.success === false ? 'warning' : 'check', size: 16 })),
                    React.createElement("div", null,
                        React.createElement("div", { className: "card-topline" },
                            React.createElement("strong", null, text(item.action || item.event)),
                            React.createElement(Badge, { tone: item.result === 'failure' || item.success === false ? 'danger' : 'success' }, text(item.result, item.success === false ? 'failure' : 'success'))),
                        React.createElement("p", null, text(item.message || item.resource || item.path)),
                        React.createElement("small", null,
                            formatDate(item.time || item.created_at),
                            " \u00B7 ",
                            text(item.username || item.user),
                            " \u00B7 ",
                            text(item.ip || item.client_ip)),
                        item.details ? React.createElement("details", null,
                            React.createElement("summary", null, "\u8BE6\u60C5"),
                            React.createElement(Terminal, null, typeof item.details === 'string' ? item.details : JSON.stringify(item.details, null, 2))) : null)))) : !loading ? React.createElement(EmptyState, { icon: "audit", title: "\u6CA1\u6709\u5339\u914D\u7684\u5BA1\u8BA1\u8BB0\u5F55" }) : React.createElement(LoadingState, null)) : React.createElement(Card, null,
                React.createElement(SectionTitle, { title: "\u7CFB\u7EDF\u65E5\u5FD7", subtitle: "\u5B9A\u671F\u81EA\u52A8\u5237\u65B0\uFF1B\u9875\u9762\u9690\u85CF\u65F6\u6682\u505C" }),
                React.createElement("div", { className: "filter-row" },
                    React.createElement(Field, { label: "systemd \u5355\u5143" },
                        React.createElement(TextInput, { value: filters.unit, onChange: (event) => setFilters(current => ({ ...current, unit: event.target.value })), placeholder: "\u4F8B\u5982 ssh.service" })),
                    React.createElement(Field, { label: "\u4F18\u5148\u7EA7" },
                        React.createElement(SelectInput, { value: filters.priority, onChange: (event) => setFilters(current => ({ ...current, priority: event.target.value })) },
                            React.createElement("option", { value: "" }, "\u5168\u90E8"),
                            React.createElement("option", { value: "err" }, "\u9519\u8BEF\u53CA\u4EE5\u4E0A"),
                            React.createElement("option", { value: "warning" }, "\u8B66\u544A\u53CA\u4EE5\u4E0A"),
                            React.createElement("option", { value: "info" }, "\u4FE1\u606F\u53CA\u4EE5\u4E0A"))),
                    React.createElement(Field, { label: "\u884C\u6570" },
                        React.createElement(TextInput, { type: "number", min: "50", max: "5000", value: filters.lines, onChange: (event) => setFilters(current => ({ ...current, lines: number(event.target.value, 500) })) }))),
                error ? React.createElement(ErrorState, { error: error, retry: reload }) : loading && !systemLogs ? React.createElement(LoadingState, { rows: 7 }) : React.createElement(Terminal, { maxHeight: 720 }, systemLogs)));
    }
    function SecurityPage(props) {
        const [tab, setTab] = useState('overview');
        const [report, setReport] = useState({ checks: [] });
        const [firewall, setFirewall] = useState({ rules: [] });
        const [fail2ban, setFail2ban] = useState({});
        const [allowlist, setAllowlist] = useState({ enabled: false, entries: [] });
        const [notifications, setNotifications] = useState({ enabled: false });
        const [allowlistText, setAllowlistText] = useState('');
        const [notificationForm, setNotificationForm] = useState({ enabled: false, bot_token: '', chat_id: '' });
        const [rule, setRule] = useState({ action: 'allow', direction: 'in', protocol: 'tcp', port: '', source: '', comment: '' });
        const [ignoreEntry, setIgnoreEntry] = useState('');
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const reload = useCallback(async () => {
            setLoading(true);
            setError('');
            try {
                const [a, b, c, d, e] = await Promise.all([
                    api('/api/v1/security/status'),
                    api('/api/v1/security/firewall'),
                    api('/api/v1/security/fail2ban'),
                    api('/api/v1/security/ip-allowlist'),
                    api('/api/v1/security/login-notifications')
                ]);
                const access = asObject(d), notify = asObject(e);
                setReport(asObject(a));
                setFirewall({ ...asObject(b), rules: listOf(b, 'rules') });
                setFail2ban(asObject(c));
                setAllowlist(access);
                setAllowlistText(listOf(access.entries).join('\n'));
                setNotifications(notify);
                setNotificationForm({ enabled: !!notify.enabled, bot_token: '', chat_id: text(notify.chat_id, '') });
            }
            catch (cause) {
                setError(errorDetail(cause));
            }
            finally {
                setLoading(false);
            }
        }, []);
        useEffect(() => { void reload(); }, [reload]);
        const securityAction = async (endpoint, body = {}, success = '操作完成') => {
            setWorking(true);
            try {
                await secureApi(`/api/v1/security/${endpoint}`, { method: 'POST', body: jsonBody(body) });
                await reload();
                props.notify('success', success);
            }
            catch (cause) {
                props.notify('error', '安全操作失败', errorDetail(cause));
            }
            finally {
                setWorking(false);
            }
        };
        const addRule = async (event) => {
            event.preventDefault();
            const port = rule.port.trim();
            if (!port) {
                props.notify('warning', '请输入端口或端口范围');
                return;
            }
            if (rule.action === 'limit' && rule.protocol !== 'tcp') {
                props.notify('warning', 'UFW 限速规则只支持 TCP，请将协议改为 TCP');
                return;
            }
            setWorking(true);
            try {
                await secureApi('/api/v1/security/firewall/rule', { method: 'POST', body: jsonBody({ operation: 'add', rule: { action: rule.action, direction: rule.direction, protocol: rule.protocol, port, source: rule.source.trim(), comment: rule.comment.trim() } }) });
                setRule({ action: 'allow', direction: 'in', protocol: 'tcp', port: '', source: '', comment: '' });
                await reload();
                props.notify('success', '防火墙规则已添加');
            }
            catch (cause) {
                props.notify('error', '添加规则失败', errorDetail(cause));
            }
            finally {
                setWorking(false);
            }
        };
        const deleteRule = async (item) => {
            if (!await props.confirm('删除防火墙规则', `确认删除规则 #${item.number}？`, '删除', true))
                return;
            setWorking(true);
            try {
                await secureApi('/api/v1/security/firewall/rule', { method: 'POST', body: jsonBody({ operation: 'delete', number: Number(item.number) }) });
                await reload();
                props.notify('success', '防火墙规则已删除');
            }
            catch (cause) {
                props.notify('error', '删除规则失败', errorDetail(cause));
            }
            finally {
                setWorking(false);
            }
        };
        const saveAllowlist = async () => {
            setWorking(true);
            try {
                const result = asObject(await secureApi('/api/v1/security/ip-allowlist', { method: 'POST', body: jsonBody({ enabled: !!allowlist.enabled, entries: lines(allowlistText) }) }));
                await reload();
                if (result.recovery_path)
                    props.openModal({ title: '保存恢复地址', content: React.createElement("div", { className: "form-stack" },
                            React.createElement("p", null, "\u8BBF\u95EE\u9650\u5236\u5DF2\u542F\u7528\u3002\u8BF7\u7ACB\u5373\u4FDD\u5B58\u4E0B\u9762\u7684\u4E34\u65F6\u6062\u590D\u5730\u5740\uFF0C\u5931\u8054\u65F6\u53EF\u7528\u5B83\u5173\u95ED\u9650\u5236\u3002"),
                            React.createElement(Terminal, null, `${location.origin}${result.recovery_path}`),
                            React.createElement("div", { className: "form-actions" },
                                React.createElement(Button, { icon: "copy", onClick: () => copyText(`${location.origin}${result.recovery_path}`).then(() => props.notify('success', '恢复地址已复制')) }, "\u590D\u5236"),
                                React.createElement(Button, { tone: "primary", onClick: props.closeModal }, "\u6211\u5DF2\u4FDD\u5B58"))) });
                else
                    props.notify('success', 'IP 允许列表已保存');
            }
            catch (cause) {
                props.notify('error', '访问限制保存失败', errorDetail(cause));
            }
            finally {
                setWorking(false);
            }
        };
        const saveNotifications = async (test = false) => {
            setWorking(true);
            try {
                await secureApi('/api/v1/security/login-notifications', { method: 'POST', body: jsonBody({ enabled: notificationForm.enabled, bot_token: notificationForm.bot_token.trim(), chat_id: notificationForm.chat_id.trim(), test }) });
                setNotificationForm(current => ({ ...current, bot_token: '' }));
                await reload();
                props.notify('success', test ? '测试消息已发送' : '登录通知已保存');
            }
            catch (cause) {
                props.notify('error', '通知配置失败', errorDetail(cause));
            }
            finally {
                setWorking(false);
            }
        };
        const runCheck = async (id) => {
            if (id === 'firewall') {
                setTab('firewall');
                return;
            }
            if (id === 'auto-updates' && await props.confirm('启用自动安全更新', '将安装 unattended-upgrades 并启用每日安全更新，不会自动重启服务器。', '启用'))
                await securityAction('auto-updates/enable', {}, '自动安全更新已启用');
            if (id === 'fail2ban' && await props.confirm('安装并启用 Fail2ban', '将保护 SSH 登录，并自动忽略当前访问 IP 和内网地址。', '安装并启用'))
                await securityAction('fail2ban/install', {}, 'Fail2ban 安装完成');
        };
        const rules = listOf(firewall, 'rules'), checks = listOf(report, 'checks'), banned = listOf(fail2ban, 'banned_ips'), ignored = listOf(fail2ban, 'ignore_ips');
        const checkStatus = (value) => { const status = text(value, 'unknown').toLowerCase(); return { raw: status, css: status === 'advice' ? 'warning' : status, label: status === 'good' ? '良好' : status === 'warning' || status === 'advice' ? '建议' : status === 'danger' || status === 'bad' ? '风险' : '待检查', tone: status === 'good' ? 'success' : status === 'warning' || status === 'advice' ? 'warning' : 'danger' }; };
        return React.createElement("div", { className: "page-stack security-page" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload }),
            React.createElement("div", { className: "tab-bar security-tabs", role: "tablist" }, [['overview', '安全概览'], ['firewall', '防火墙'], ['fail2ban', 'Fail2ban'], ['access', '访问保护']].map(([value, label]) => React.createElement("button", { key: value, className: tab === value ? 'active' : '', onClick: () => setTab(value) }, label))),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : loading && !report.score && tab === 'overview' ? React.createElement(LoadingState, { rows: 6 }) : tab === 'overview' ? React.createElement(React.Fragment, null,
                React.createElement(Card, { className: "security-score" },
                    React.createElement("div", { className: "score-ring" },
                        React.createElement("strong", null, text(report.score, '—')),
                        React.createElement("span", null, "\u5B89\u5168\u8BC4\u5206")),
                    React.createElement("div", null,
                        React.createElement("h2", null, number(report.score) >= 80 ? '整体状态良好' : number(report.score) >= 60 ? '仍有改进空间' : '需要尽快处理'),
                        React.createElement("p", null, "\u8BC4\u5206\u6765\u81EA\u4E3B\u673A\u3001\u9762\u677F\u3001SSH\u3001\u8BA4\u8BC1\u548C\u66F4\u65B0\u7B56\u7565\u68C0\u67E5\u3002"))),
                React.createElement("div", { className: "security-check-grid" }, checks.map(check => { const status = checkStatus(check.status); return React.createElement(Card, { className: "security-check", key: check.id },
                    React.createElement("span", { className: `check-state ${status.css}` }),
                    React.createElement("div", null,
                        React.createElement("div", { className: "card-topline" },
                            React.createElement("strong", null, text(check.title)),
                            React.createElement(Badge, { tone: status.tone }, status.label)),
                        React.createElement("p", null, text(check.detail)),
                        check.recommendation ? React.createElement("small", null,
                            "\u5EFA\u8BAE\uFF1A",
                            check.recommendation) : null,
                        check.status !== 'good' && ['firewall', 'fail2ban', 'auto-updates'].includes(String(check.id)) ? React.createElement(Button, { tone: "ghost", busy: working, onClick: () => runCheck(String(check.id)) }, check.id === 'firewall' ? '前往配置防火墙' : check.id === 'fail2ban' ? '安装并启用' : '启用自动安全更新') : null)); }))) : tab === 'firewall' ? React.createElement(React.Fragment, null,
                React.createElement(Card, { className: "firewall-status-card" },
                    React.createElement("div", null,
                        React.createElement("span", { className: "eyebrow" }, "UFW \u72B6\u6001"),
                        React.createElement("h2", null, !firewall.installed ? '未安装' : firewall.enabled ? '正在保护' : '已安装但未启用'),
                        firewall.installed ? React.createElement("p", null,
                            "\u9ED8\u8BA4\u5165\u7AD9 ",
                            text(firewall.default_incoming),
                            " \u00B7 \u9ED8\u8BA4\u51FA\u7AD9 ",
                            text(firewall.default_outgoing)) : React.createElement("p", null, "\u5B89\u88C5\u540E\u53EF\u7BA1\u7406\u5165\u7AD9\u3001\u51FA\u7AD9\u548C\u7AEF\u53E3\u89C4\u5219\u3002")),
                    React.createElement("div", { className: "row-buttons" }, !firewall.installed ? React.createElement(Button, { tone: "primary", busy: working, onClick: () => securityAction('firewall/install', {}, 'UFW 安装完成') }, "\u5B89\u88C5 UFW") : !firewall.enabled ? React.createElement(Button, { tone: "primary", busy: working, onClick: async () => { if (await props.confirm('安全启用 UFW', '系统会先放行当前访问 IP 和 SSH 端口，并创建 5 分钟自动恢复窗口。启用后请确认新连接正常。', '安全启用'))
                            await securityAction('firewall/enable', {}, 'UFW 已启用，请验证连接后确认'); } }, "\u5B89\u5168\u542F\u7528") : React.createElement(Button, { tone: "danger", busy: working, onClick: async () => { if (await props.confirm('关闭 UFW', '关闭后系统将失去 UFW 入站保护。', '关闭', true))
                            await securityAction('firewall/disable', {}, 'UFW 已关闭'); } }, "\u5173\u95ED UFW"))),
                firewall.recovery_pending ? React.createElement("div", { className: "recovery-banner" },
                    React.createElement("div", null,
                        React.createElement("strong", null, "\u9632\u5931\u8054\u6062\u590D\u7A97\u53E3\u6B63\u5728\u8FD0\u884C"),
                        React.createElement("p", null, "\u786E\u8BA4\u5F53\u524D\u9875\u9762\u548C\u65B0\u7684 SSH \u8FDE\u63A5\u6B63\u5E38\u540E\uFF0C\u7ACB\u5373\u786E\u8BA4\u4FDD\u7559 UFW\u3002")),
                    React.createElement(Button, { tone: "primary", busy: working, onClick: () => securityAction('firewall/confirm', {}, 'UFW 配置已确认') }, "\u8FDE\u63A5\u6B63\u5E38\uFF0C\u786E\u8BA4\u4FDD\u7559")) : null,
                firewall.installed ? React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "\u6DFB\u52A0\u9632\u706B\u5899\u89C4\u5219", subtitle: "\u4F7F\u7528\u6B63\u786E UFW \u8BED\u4E49\uFF1B\u5931\u8D25\u65F6\u663E\u793A\u5B9E\u9645\u547D\u4EE4\u548C\u8F93\u51FA" }),
                    React.createElement("form", { className: "firewall-form-grid firewall-form", onSubmit: addRule },
                        React.createElement(Field, { label: "\u52A8\u4F5C" },
                            React.createElement(SelectInput, { name: "action", value: rule.action, onChange: (event) => setRule(current => ({ ...current, action: event.target.value })) },
                                React.createElement("option", { value: "allow" }, "\u5141\u8BB8"),
                                React.createElement("option", { value: "deny" }, "\u62D2\u7EDD"),
                                React.createElement("option", { value: "reject" }, "\u62D2\u7EDD\u5E76\u56DE\u5E94"),
                                React.createElement("option", { value: "limit" }, "\u8FDE\u63A5\u9650\u901F"))),
                        React.createElement(Field, { label: "\u65B9\u5411" },
                            React.createElement(SelectInput, { name: "direction", value: rule.direction, onChange: (event) => setRule(current => ({ ...current, direction: event.target.value })) },
                                React.createElement("option", { value: "in" }, "\u5165\u7AD9"),
                                React.createElement("option", { value: "out" }, "\u51FA\u7AD9"))),
                        React.createElement(Field, { label: "\u534F\u8BAE" },
                            React.createElement(SelectInput, { name: "protocol", value: rule.protocol, onChange: (event) => setRule(current => ({ ...current, protocol: event.target.value })) },
                                React.createElement("option", { value: "tcp" }, "TCP"),
                                React.createElement("option", { value: "udp" }, "UDP"),
                                React.createElement("option", { value: "any" }, "\u6240\u6709\u534F\u8BAE"))),
                        React.createElement(Field, { label: "\u7AEF\u53E3" },
                            React.createElement(TextInput, { name: "port", value: rule.port, onChange: (event) => setRule(current => ({ ...current, port: event.target.value })), placeholder: "443 \u6216 8000:8100", inputMode: "numeric", required: true })),
                        React.createElement(Field, { label: "\u6765\u6E90\uFF08\u53EF\u9009\uFF09" },
                            React.createElement(TextInput, { name: "source", value: rule.source, onChange: (event) => setRule(current => ({ ...current, source: event.target.value })), placeholder: "IP\u3001CIDR \u6216\u7559\u7A7A" })),
                        React.createElement(Field, { label: "\u5907\u6CE8\uFF08\u53EF\u9009\uFF09" },
                            React.createElement(TextInput, { name: "comment", value: rule.comment, onChange: (event) => setRule(current => ({ ...current, comment: event.target.value })) })),
                        React.createElement(Button, { type: "submit", tone: "primary", busy: working, className: "firewall-submit" }, "\u6DFB\u52A0\u89C4\u5219"))) : null,
                React.createElement("div", { className: "firewall-rule-list" }, rules.length ? rules.map(item => React.createElement(Card, { className: "firewall-rule-card", key: item.number },
                    React.createElement("span", { className: "rule-number" },
                        "#",
                        item.number),
                    React.createElement("div", { className: "rule-main" },
                        React.createElement("div", { className: "rule-title" },
                            React.createElement(Badge, { tone: String(item.action).toLowerCase().includes('allow') ? 'success' : String(item.action).toLowerCase().includes('deny') || String(item.action).toLowerCase().includes('reject') ? 'danger' : 'warning' }, text(item.action)),
                            React.createElement("strong", null, text(item.to || item.destination, 'Anywhere'))),
                        React.createElement("p", null,
                            "\u6765\u6E90\uFF1A",
                            text(item.from || item.source, 'Anywhere'),
                            item.version ? ` · ${item.version}` : '')),
                    React.createElement(Button, { tone: "danger", icon: "trash", busy: working, onClick: () => deleteRule(item) }, "\u5220\u9664"))) : React.createElement(Card, null,
                    React.createElement(EmptyState, { icon: "security", title: "\u6682\u65E0\u81EA\u5B9A\u4E49\u89C4\u5219" })))) : tab === 'fail2ban' ? !fail2ban.installed ? React.createElement(Card, null,
                React.createElement(EmptyState, { icon: "security", title: "Fail2ban \u672A\u5B89\u88C5", description: "\u5B89\u88C5\u540E\u5C06\u81EA\u52A8\u4FDD\u62A4 SSH\uFF0C\u5E76\u628A\u5F53\u524D\u8BBF\u95EE IP \u52A0\u5165\u5FFD\u7565\u5217\u8868\u3002", action: React.createElement(Button, { tone: "primary", busy: working, onClick: () => securityAction('fail2ban/install', {}, 'Fail2ban 安装完成') }, "\u5B89\u88C5\u5E76\u542F\u7528") })) : React.createElement(React.Fragment, null,
                React.createElement("div", { className: "metric-grid compact-metrics" },
                    React.createElement(Metric, { title: "\u5F53\u524D\u5931\u8D25", value: text(fail2ban.currently_failed, '0'), detail: "\u5F53\u524D jail", icon: "warning" }),
                    React.createElement(Metric, { title: "\u7D2F\u8BA1\u5931\u8D25", value: text(fail2ban.total_failed, '0'), detail: "\u5386\u53F2\u7D2F\u8BA1", icon: "audit" }),
                    React.createElement(Metric, { title: "\u5F53\u524D\u5C01\u7981", value: text(fail2ban.currently_banned, '0'), detail: "\u6B63\u5728\u963B\u6B62", icon: "security" }),
                    React.createElement(Metric, { title: "\u7D2F\u8BA1\u5C01\u7981", value: text(fail2ban.total_banned, '0'), detail: "\u5386\u53F2\u7D2F\u8BA1", icon: "backup" })),
                React.createElement("div", { className: "security-split" },
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u5DF2\u5C01\u7981 IP", subtitle: "sshd jail \u5F53\u524D\u8BB0\u5F55" }),
                        banned.length ? React.createElement("div", { className: "compact-list" }, banned.map(ip => React.createElement("div", { className: "compact-row", key: ip },
                            React.createElement("code", null, ip),
                            React.createElement(Button, { tone: "ghost", onClick: () => securityAction('fail2ban/unban', { ip }, `${ip} 已解封`) }, "\u89E3\u5C01")))) : React.createElement(EmptyState, { icon: "check", title: "\u5F53\u524D\u6CA1\u6709\u5C01\u7981\u5730\u5740" })),
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u5FFD\u7565\u5217\u8868", subtitle: "\u4E0D\u4F1A\u88AB Fail2ban \u5C01\u7981\u7684\u5730\u5740" }),
                        React.createElement("form", { className: "inline-form", onSubmit: async (event) => { event.preventDefault(); if (!ignoreEntry.trim())
                                return; await securityAction('fail2ban/ignore', { entry: ignoreEntry.trim(), action: 'add' }, 'Fail2ban 白名单已更新'); setIgnoreEntry(''); } },
                            React.createElement(TextInput, { value: ignoreEntry, onChange: (event) => setIgnoreEntry(event.target.value), placeholder: "IP \u6216 CIDR" }),
                            React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u6DFB\u52A0")),
                        React.createElement("div", { className: "compact-list" }, ignored.map(entry => React.createElement("div", { className: "compact-row", key: entry },
                            React.createElement("code", null, entry),
                            React.createElement(Button, { tone: "danger", icon: "trash", title: `从白名单移除 ${entry}`, onClick: () => securityAction('fail2ban/ignore', { entry, action: 'remove' }, '白名单条目已移除') })))))))
                : React.createElement("div", { className: "settings-grid" },
                    React.createElement(Card, { className: "setting-card" },
                        React.createElement(SectionTitle, { title: "\u9762\u677F IP \u5141\u8BB8\u5217\u8868", subtitle: "\u5F00\u542F\u540E\u53EA\u6709\u6307\u5B9A IP \u6216\u7F51\u6BB5\u80FD\u8BBF\u95EE\u9762\u677F", actions: React.createElement(Toggle, { checked: !!allowlist.enabled, onChange: enabled => setAllowlist((current) => ({ ...current, enabled })), label: allowlist.enabled ? '已开启' : '未开启' }) }),
                        React.createElement(Field, { label: "\u5141\u8BB8\u5730\u5740", hint: "\u6BCF\u884C\u4E00\u4E2A IP \u6216 CIDR\uFF1B\u5F00\u542F\u65F6\u81EA\u52A8\u5305\u542B\u5F53\u524D IP" },
                            React.createElement(TextArea, { rows: "7", value: allowlistText, onChange: (event) => setAllowlistText(event.target.value) })),
                        React.createElement("p", { className: "field-hint" },
                            "\u5F53\u524D\u8BBF\u95EE IP\uFF1A",
                            text(allowlist.current_ip, '无法识别')),
                        React.createElement(Button, { tone: "primary", busy: working, onClick: saveAllowlist }, "\u4FDD\u5B58\u8BBF\u95EE\u9650\u5236")),
                    React.createElement(Card, { className: "setting-card" },
                        React.createElement(SectionTitle, { title: "Telegram \u767B\u5F55\u901A\u77E5", subtitle: "\u767B\u5F55\u6210\u529F\u540E\u53D1\u9001\u8BBE\u5907\u3001IP \u548C\u767B\u5F55\u65B9\u5F0F", actions: React.createElement(Toggle, { checked: notificationForm.enabled, onChange: enabled => setNotificationForm(current => ({ ...current, enabled })), label: notificationForm.enabled ? '已开启' : '未开启' }) }),
                        React.createElement(Field, { label: "Bot Token", hint: notifications.configured ? '已保存 Token，留空保持不变' : '首次启用时必填' },
                            React.createElement(TextInput, { type: "password", value: notificationForm.bot_token, onChange: (event) => setNotificationForm(current => ({ ...current, bot_token: event.target.value })), autoComplete: "off" })),
                        React.createElement(Field, { label: "Chat ID" },
                            React.createElement(TextInput, { value: notificationForm.chat_id, onChange: (event) => setNotificationForm(current => ({ ...current, chat_id: event.target.value })) })),
                        React.createElement("div", { className: "form-actions" },
                            React.createElement(Button, { tone: "primary", busy: working, onClick: () => saveNotifications(false) }, "\u4FDD\u5B58"),
                            React.createElement(Button, { busy: working, onClick: () => saveNotifications(true) }, "\u4FDD\u5B58\u5E76\u6D4B\u8BD5")))));
    }
    function SettingsPage(props) {
        const [settings, setSettings] = useState({});
        const [sessions, setSessions] = useState([]);
        const [currentSession, setCurrentSession] = useState('');
        const [passkeys, setPasskeys] = useState([]);
        const [devices, setDevices] = useState([]);
        const [totp, setTotp] = useState({});
        const [account, setAccount] = useState({ username: props.username, current_password: '' });
        const [password, setPassword] = useState({ current_password: '', new_password: '', confirm: '' });
        const [refreshSeconds, setRefreshSeconds] = useState(10);
        const [passkeyName, setPasskeyName] = useState('');
        const [loading, setLoading] = useState(true);
        const [working, setWorking] = useState(false);
        const [error, setError] = useState('');
        const reload = useCallback(async () => { setLoading(true); setError(''); try {
            const [a, b, c, d, e] = await Promise.all([api('/api/v1/settings'), api('/api/v1/auth/sessions'), api('/api/v1/auth/passkeys'), api('/api/v1/auth/trusted-devices'), api('/api/v1/auth/totp/status')]);
            const config = asObject(a), sessionData = asObject(b);
            setSettings(config);
            setSessions(listOf(sessionData, 'sessions'));
            setCurrentSession(text(sessionData.current, ''));
            setPasskeys(listOf(c, 'passkeys'));
            setDevices(listOf(d, 'devices'));
            setTotp(asObject(e));
            setAccount(current => ({ ...current, username: text(config.admin_user, props.username) }));
            setRefreshSeconds(number(config.auto_refresh_seconds, 10));
        }
        catch (cause) {
            setError(errorDetail(cause));
        }
        finally {
            setLoading(false);
        } }, [props.username]);
        useEffect(() => { void reload(); }, [reload]);
        const run = async (title, task) => { setWorking(true); try {
            await task();
        }
        catch (cause) {
            props.notify('error', title, errorDetail(cause));
        }
        finally {
            setWorking(false);
        } };
        const recoveryModal = (codes) => props.openModal({ title: '保存恢复码', content: React.createElement("div", { className: "form-stack" },
                React.createElement("p", null, "\u6BCF\u4E2A\u6062\u590D\u7801\u53EA\u80FD\u4F7F\u7528\u4E00\u6B21\uFF0C\u5173\u95ED\u540E\u4E0D\u4F1A\u518D\u6B21\u663E\u793A\u3002"),
                React.createElement(Terminal, null, codes.join('\n')),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { icon: "copy", onClick: () => copyText(codes.join('\n')).then(() => props.notify('success', '恢复码已复制')) }, "\u590D\u5236\u5168\u90E8"),
                    React.createElement(Button, { tone: "primary", onClick: props.closeModal }, "\u6211\u5DF2\u4FDD\u5B58"))) });
        const beginTotp = () => run('无法开始两步验证设置', async () => { const setup = asObject(await secureApi('/api/v1/auth/totp/setup', { method: 'POST', body: '{}' })); props.openModal({ title: '设置两步验证', content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const code = String(new FormData(event.currentTarget).get('code') || '').trim(); await run('验证码确认失败', async () => { await secureApi('/api/v1/auth/totp/confirm', { method: 'POST', body: jsonBody({ code }) }); props.closeModal(); recoveryModal(listOf(setup.recovery_codes)); await reload(); props.notify('success', '两步验证已开启'); }); } },
                React.createElement("p", null, "\u5728\u8EAB\u4EFD\u9A8C\u8BC1\u5668\u4E2D\u624B\u52A8\u6DFB\u52A0\u5BC6\u94A5\uFF0C\u6216\u4F7F\u7528\u4E0B\u65B9 OTPAuth URI\u3002"),
                React.createElement(Field, { label: "\u5BC6\u94A5" },
                    React.createElement("div", { className: "input-copy" },
                        React.createElement(TextInput, { readOnly: true, value: text(setup.secret, '') }),
                        React.createElement(Button, { icon: "copy", title: "\u590D\u5236\u5BC6\u94A5", onClick: () => copyText(text(setup.secret, '')).then(() => props.notify('success', '密钥已复制')) }))),
                React.createElement(Field, { label: "OTPAuth URI" },
                    React.createElement(TextArea, { readOnly: true, rows: "3", value: text(setup.otpauth_uri, '') })),
                React.createElement(Field, { label: "6 \u4F4D\u9A8C\u8BC1\u7801" },
                    React.createElement(TextInput, { name: "code", inputMode: "numeric", autoComplete: "one-time-code", pattern: "[0-9]{6}", required: true, autoFocus: true })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: "primary" }, "\u9A8C\u8BC1\u5E76\u5F00\u542F"))) }); });
        const codeAction = (title, description, endpoint, success, destructive = false) => props.openModal({ title, content: React.createElement("form", { className: "form-stack", onSubmit: async (event) => { event.preventDefault(); const code = String(new FormData(event.currentTarget).get('code') || '').trim(); await run(`${title}失败`, async () => { const out = asObject(await secureApi(endpoint, { method: 'POST', body: jsonBody({ code }) })); props.closeModal(); if (out.recovery_codes)
                    recoveryModal(listOf(out.recovery_codes)); await reload(); props.notify('success', success); }); } },
                React.createElement("p", null, description),
                React.createElement(Field, { label: "\u9A8C\u8BC1\u7801\u6216\u6062\u590D\u7801" },
                    React.createElement(TextInput, { name: "code", required: true, autoFocus: true, autoComplete: "one-time-code" })),
                React.createElement("div", { className: "form-actions" },
                    React.createElement(Button, { onClick: props.closeModal }, "\u53D6\u6D88"),
                    React.createElement(Button, { type: "submit", tone: destructive ? 'danger' : 'primary' }, destructive ? '确认关闭' : '确认'))) });
        const registerPasskey = () => run('Passkey 注册失败', async () => { if (!window.PublicKeyCredential || !navigator.credentials)
            throw new Error('当前浏览器不支持 Passkey'); const name = passkeyName.trim() || navigator.platform || '当前设备'; const begin = asObject(await secureApi('/api/v1/auth/passkey/register/begin', { method: 'POST', body: jsonBody({ name }) })); const credential = await navigator.credentials.create({ publicKey: normalizeCreationOptions(begin.public_key || begin.options || begin) }); if (!credential)
            throw new Error('未完成 Passkey 创建'); await secureApi('/api/v1/auth/passkey/register/finish', { method: 'POST', body: jsonBody({ flow_id: begin.flow_id, name, credential: serializeCredential(credential) }) }); setPasskeyName(''); await reload(); props.notify('success', 'Passkey 已添加'); });
        return React.createElement("div", { className: "page-stack settings-page" },
            React.createElement(PageHeader, { ...props, busy: loading, onRefresh: reload, actions: React.createElement(Button, { tone: "danger", onClick: props.onLogout }, "\u9000\u51FA\u767B\u5F55") }),
            error ? React.createElement(ErrorState, { error: error, retry: reload }) : loading && !settings.version ? React.createElement(LoadingState, { rows: 6 }) : React.createElement(React.Fragment, null,
                React.createElement("div", { className: "settings-grid" },
                    React.createElement(Card, { className: "setting-card" },
                        React.createElement(SectionTitle, { title: "\u7BA1\u7406\u5458\u8D26\u6237", subtitle: "\u4FEE\u6539\u7528\u6237\u540D\u540E\u4F1A\u64A4\u9500\u5176\u4ED6\u767B\u5F55\u4F1A\u8BDD" }),
                        React.createElement("form", { className: "form-stack", onSubmit: (event) => { event.preventDefault(); void run('用户名修改失败', async () => { await api('/api/v1/auth/account', { method: 'PATCH', body: jsonBody({ username: account.username.trim(), current_password: account.current_password }) }); setAccount(current => ({ ...current, current_password: '' })); await reload(); props.notify('success', '管理员用户名已更新'); }); } },
                            React.createElement(Field, { label: "\u7BA1\u7406\u5458\u7528\u6237\u540D" },
                                React.createElement(TextInput, { value: account.username, onChange: (event) => setAccount(current => ({ ...current, username: event.target.value })), autoCapitalize: "none", required: true })),
                            React.createElement(Field, { label: "\u5F53\u524D\u5BC6\u7801" },
                                React.createElement(TextInput, { type: "password", value: account.current_password, onChange: (event) => setAccount(current => ({ ...current, current_password: event.target.value })), autoComplete: "current-password", required: true })),
                            React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u4FDD\u5B58\u7528\u6237\u540D"))),
                    React.createElement(Card, { className: "setting-card" },
                        React.createElement(SectionTitle, { title: "\u4FEE\u6539\u5BC6\u7801", subtitle: "\u65B0\u5BC6\u7801\u5FC5\u987B\u6EE1\u8DB3\u540E\u7AEF\u5B89\u5168\u5F3A\u5EA6\u8981\u6C42" }),
                        React.createElement("form", { className: "form-stack", onSubmit: (event) => { event.preventDefault(); if (password.new_password !== password.confirm) {
                                props.notify('warning', '两次输入的新密码不一致');
                                return;
                            } void run('密码修改失败', async () => { await api('/api/v1/auth/password', { method: 'POST', body: jsonBody({ current_password: password.current_password, new_password: password.new_password }) }); setPassword({ current_password: '', new_password: '', confirm: '' }); await reload(); props.notify('success', '密码已修改，其他会话已撤销'); }); } },
                            React.createElement(Field, { label: "\u5F53\u524D\u5BC6\u7801" },
                                React.createElement(TextInput, { type: "password", value: password.current_password, onChange: (event) => setPassword(current => ({ ...current, current_password: event.target.value })), autoComplete: "current-password", required: true })),
                            React.createElement(Field, { label: "\u65B0\u5BC6\u7801" },
                                React.createElement(TextInput, { type: "password", value: password.new_password, onChange: (event) => setPassword(current => ({ ...current, new_password: event.target.value })), autoComplete: "new-password", required: true })),
                            React.createElement(Field, { label: "\u786E\u8BA4\u65B0\u5BC6\u7801" },
                                React.createElement(TextInput, { type: "password", value: password.confirm, onChange: (event) => setPassword(current => ({ ...current, confirm: event.target.value })), autoComplete: "new-password", required: true })),
                            React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u4FEE\u6539\u5BC6\u7801"))),
                    React.createElement(Card, { className: "setting-card" },
                        React.createElement(SectionTitle, { title: "\u4E24\u6B65\u9A8C\u8BC1", subtitle: "\u8EAB\u4EFD\u9A8C\u8BC1\u5668\u548C\u4E00\u6B21\u6027\u6062\u590D\u7801", actions: React.createElement(Badge, { tone: totp.enabled ? 'success' : 'neutral' }, totp.enabled ? '已开启' : '未开启') }),
                        totp.enabled ? React.createElement("p", { className: "setting-note" },
                            "\u5269\u4F59\u6062\u590D\u7801\uFF1A",
                            number(totp.recovery_codes_remaining),
                            " \u4E2A") : React.createElement("p", { className: "setting-note" }, "\u5F3A\u70C8\u5EFA\u8BAE\u7BA1\u7406\u5458\u8D26\u6237\u5F00\u542F\u4E24\u6B65\u9A8C\u8BC1\u3002"),
                        React.createElement("div", { className: "form-actions" }, !totp.enabled ? React.createElement(Button, { tone: "primary", busy: working, onClick: beginTotp }, "\u5F00\u59CB\u8BBE\u7F6E") : React.createElement(React.Fragment, null,
                            React.createElement(Button, { busy: working, onClick: () => codeAction('重新生成恢复码', '旧恢复码将立即失效。', '/api/v1/auth/totp/recovery', '恢复码已重新生成') }, "\u91CD\u65B0\u751F\u6210\u6062\u590D\u7801"),
                            React.createElement(Button, { tone: "danger", busy: working, onClick: () => codeAction('关闭两步验证', '关闭后账户安全性会降低。', '/api/v1/auth/totp/disable', '两步验证已关闭', true) }, "\u5173\u95ED")))),
                    React.createElement(Card, { className: "setting-card" },
                        React.createElement(SectionTitle, { title: "\u9762\u677F\u504F\u597D", subtitle: "\u7EDF\u4E00\u63A7\u5236\u9875\u9762\u81EA\u52A8\u5237\u65B0\u9891\u7387" }),
                        React.createElement("form", { className: "form-stack", onSubmit: (event) => { event.preventDefault(); void run('保存失败', async () => { await api('/api/v1/settings', { method: 'PATCH', body: jsonBody({ auto_refresh_seconds: refreshSeconds }) }); await reload(); props.notify('success', '刷新频率已保存'); }); } },
                            React.createElement(Field, { label: "\u81EA\u52A8\u5237\u65B0\u95F4\u9694\uFF08\u79D2\uFF09" },
                                React.createElement(TextInput, { type: "number", min: "2", max: "300", value: refreshSeconds, onChange: (event) => setRefreshSeconds(number(event.target.value, 10)) })),
                            React.createElement(Button, { type: "submit", tone: "primary", busy: working }, "\u4FDD\u5B58\u504F\u597D")),
                        React.createElement("dl", { className: "key-value-list" },
                            React.createElement(KeyValue, { label: "\u7248\u672C", value: text(settings.version, VERSION) }),
                            React.createElement(KeyValue, { label: "\u76D1\u542C", value: text(settings.listen), mono: true }),
                            React.createElement(KeyValue, { label: "HTTPS Cookie", value: boolText(settings.secure_cookie) })))),
                React.createElement(Card, null,
                    React.createElement(SectionTitle, { title: "Passkey", subtitle: "\u4F7F\u7528 Face ID\u3001Touch ID \u6216\u5B89\u5168\u5BC6\u94A5\u767B\u5F55" }),
                    React.createElement("div", { className: "inline-form" },
                        React.createElement(TextInput, { value: passkeyName, onChange: (event) => setPasskeyName(event.target.value), placeholder: "\u8BBE\u5907\u540D\u79F0\uFF0C\u4F8B\u5982 iPhone" }),
                        React.createElement(Button, { tone: "primary", busy: working, onClick: registerPasskey }, "\u6DFB\u52A0 Passkey")),
                    passkeys.length ? React.createElement("div", { className: "credential-list" }, passkeys.map(item => React.createElement("div", { className: "credential-row", key: item.id },
                        React.createElement("span", { className: "credential-icon" },
                            React.createElement(Icon, { name: "key" })),
                        React.createElement("div", null,
                            React.createElement("strong", null, text(item.name, '未命名 Passkey')),
                            React.createElement("p", null,
                                "\u521B\u5EFA\uFF1A",
                                formatDate(item.created_at),
                                item.last_used ? ` · 最近使用：${formatDate(item.last_used)}` : '')),
                        React.createElement(Button, { tone: "danger", onClick: async () => { if (await props.confirm('删除 Passkey', `确认删除“${text(item.name, '未命名 Passkey')}”？`, '删除', true))
                                await run('删除失败', async () => { await secureApi('/api/v1/auth/passkeys', { method: 'DELETE', body: jsonBody({ id: item.id }) }); await reload(); props.notify('success', 'Passkey 已删除'); }); } }, "\u5220\u9664")))) : React.createElement(EmptyState, { icon: "key", title: "\u5C1A\u672A\u6DFB\u52A0 Passkey" })),
                React.createElement("div", { className: "settings-two-column" },
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u767B\u5F55\u4F1A\u8BDD", subtitle: "\u5F53\u524D\u4F1A\u8BDD\u4E0D\u4F1A\u88AB\u6279\u91CF\u64A4\u9500", actions: React.createElement(Button, { tone: "danger", disabled: sessions.length <= 1, onClick: () => run('撤销失败', async () => { const out = asObject(await api('/api/v1/auth/sessions', { method: 'DELETE', body: '{}' })); await reload(); props.notify('success', `已撤销 ${number(out.revoked)} 个其他会话`); }) }, "\u64A4\u9500\u5176\u4ED6\u4F1A\u8BDD") }),
                        React.createElement("div", { className: "compact-list" }, sessions.map(session => React.createElement("div", { className: "compact-row", key: session.id },
                            React.createElement("div", null,
                                React.createElement("strong", null,
                                    session.id,
                                    session.id === currentSession ? React.createElement(Badge, { tone: "success" }, "\u5F53\u524D") : null),
                                React.createElement("small", null,
                                    formatDate(session.created_at),
                                    " \u2192 ",
                                    formatDate(session.expires_at))))))),
                    React.createElement(Card, null,
                        React.createElement(SectionTitle, { title: "\u53EF\u4FE1\u8BBE\u5907", subtitle: "\u8DF3\u8FC7\u4E24\u6B65\u9A8C\u8BC1\u7684\u8BBE\u5907 Cookie", actions: React.createElement(Button, { tone: "danger", disabled: !devices.length, onClick: () => run('撤销失败', async () => { await secureApi('/api/v1/auth/trusted-devices', { method: 'DELETE', body: jsonBody({ all: true }) }); await reload(); props.notify('success', '全部可信设备已撤销'); }) }, "\u5168\u90E8\u64A4\u9500") }),
                        React.createElement("div", { className: "compact-list" }, devices.length ? devices.map(device => React.createElement("div", { className: "compact-row", key: device.id },
                            React.createElement("div", null,
                                React.createElement("strong", null, text(device.name, '未命名设备')),
                                React.createElement("small", null,
                                    text(device.last_ip),
                                    " \u00B7 ",
                                    formatDate(device.last_used))),
                            React.createElement(Button, { tone: "danger", icon: "trash", title: `撤销可信设备 ${text(device.name, '未命名设备')}`, onClick: () => run('撤销失败', async () => { await secureApi('/api/v1/auth/trusted-devices', { method: 'DELETE', body: jsonBody({ id: device.id }) }); await reload(); props.notify('success', '可信设备已撤销'); }) }))) : React.createElement(EmptyState, { icon: "user", title: "\u6CA1\u6709\u53EF\u4FE1\u8BBE\u5907" }))))));
    }
    class AppErrorBoundary extends React.Component {
        constructor(props) { super(props); this.state = { error: null }; }
        static getDerivedStateFromError(error) { return { error }; }
        componentDidCatch(error, info) { console.error('LukePanel UI error', error, info); }
        render() { if (!this.state.error)
            return this.props.children; return React.createElement("main", { className: "fatal-layout" },
            React.createElement("div", { className: "fatal-card" },
                React.createElement("span", { className: "empty-icon" },
                    React.createElement(Icon, { name: "warning", size: 32 })),
                React.createElement("h1", null, "\u9875\u9762\u53D1\u751F\u9519\u8BEF"),
                React.createElement("p", null, "\u4E3A\u907F\u514D\u9519\u8BEF\u72B6\u6001\u7EE7\u7EED\u5F71\u54CD\u64CD\u4F5C\uFF0C\u754C\u9762\u5DF2\u505C\u6B62\u6E32\u67D3\u3002"),
                React.createElement(Terminal, null,
                    this.state.error.message,
                    "\\n",
                    this.state.error.stack),
                React.createElement(Button, { tone: "primary", onClick: () => location.reload() }, "\u91CD\u65B0\u52A0\u8F7D"))); }
    }
    function App() {
        const routeState = useRoute();
        const route = ROUTE_MAP.get(routeState.path) || ROUTE_MAP.get('/');
        const [ready, setReady] = useState(false);
        const [identity, setIdentity] = useState(null);
        const [modal, setModal] = useState(null);
        const [drawer, setDrawer] = useState(false);
        const [compactLayout, setCompactLayout] = useState(() => window.matchMedia('(max-width: 900px)').matches);
        const [toasts, setToasts] = useState([]);
        const sidebarRef = useRef(null);
        const confirmResolve = useRef(null);
        const elevationResolve = useRef(null);
        const elevationReject = useRef(null);
        const modalReturnFocus = useRef(null);
        const toastId = useRef(0);
        const notify = useCallback((kind, title, detail) => { const id = ++toastId.current; setToasts(items => [...items.slice(-3), { id, kind, title, detail }]); window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), kind === 'error' ? 10000 : 5000); }, []);
        const presentModal = useCallback((state) => {
            if (!document.querySelector('.modal'))
                modalReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setModal(state);
        }, []);
        const closeModal = useCallback(() => { if (confirmResolve.current) {
            confirmResolve.current(false);
            confirmResolve.current = null;
        } setModal(null); }, []);
        const openModal = presentModal;
        const confirmAction = useCallback((title, message, actionLabel = '确认', destructive = false) => new Promise(resolve => {
            if (confirmResolve.current)
                confirmResolve.current(false);
            confirmResolve.current = resolve;
            presentModal({ title, destructive, content: React.createElement("div", { className: "confirm-dialog" },
                    React.createElement("p", null, message),
                    React.createElement("div", { className: "form-actions" },
                        React.createElement(Button, { onClick: () => { confirmResolve.current?.(false); confirmResolve.current = null; setModal(null); } }, "\u53D6\u6D88"),
                        React.createElement(Button, { tone: destructive ? 'danger' : 'primary', onClick: () => { confirmResolve.current?.(true); confirmResolve.current = null; setModal(null); } }, actionLabel))) });
        }), [presentModal]);
        const resetAuth = useCallback(() => { csrfToken = ''; setIdentity(null); setModal(null); }, []);
        const applyIdentity = useCallback((next) => { csrfToken = text(next.csrf_token, ''); setIdentity(next); setReady(true); localStorage.setItem('lukepanel:last-user', text(next.username, '')); }, []);
        useEffect(() => { unauthorizedHandler = resetAuth; return () => { unauthorizedHandler = null; }; }, [resetAuth]);
        useEffect(() => {
            let active = true;
            void api('/api/v1/auth/me').then(next => { if (active)
                applyIdentity(next); }).catch(() => { if (active) {
                resetAuth();
                setReady(true);
            } });
            return () => { active = false; };
        }, [applyIdentity, resetAuth]);
        useEffect(() => {
            elevationHandler = () => new Promise((resolve, reject) => {
                elevationResolve.current = resolve;
                elevationReject.current = reject;
                presentModal({ title: '需要二次验证', content: React.createElement("form", { className: "form-stack elevation-form", onSubmit: async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const submit = event.currentTarget.querySelector('button[type="submit"]'); if (submit)
                            submit.disabled = true; try {
                            await api('/api/v1/auth/elevate', { method: 'POST', body: jsonBody({ password: values.get('password'), otp: values.get('otp') }) });
                            setModal(null);
                            elevationResolve.current?.();
                            elevationResolve.current = null;
                            elevationReject.current = null;
                        }
                        catch (cause) {
                            notify('error', '二次验证失败', errorDetail(cause));
                            if (submit)
                                submit.disabled = false;
                        } } },
                        React.createElement("p", null, "\u6B64\u64CD\u4F5C\u4F1A\u4FEE\u6539\u7CFB\u7EDF\u914D\u7F6E\uFF0C\u8BF7\u518D\u6B21\u9A8C\u8BC1\u7BA1\u7406\u5458\u8EAB\u4EFD\u3002"),
                        React.createElement(Field, { label: "\u5F53\u524D\u5BC6\u7801" },
                            React.createElement(TextInput, { name: "password", type: "password", autoComplete: "current-password", required: true, autoFocus: true })),
                        React.createElement(Field, { label: "\u4E24\u6B65\u9A8C\u8BC1\u7801\uFF08\u5DF2\u5F00\u542F\u65F6\uFF09" },
                            React.createElement(TextInput, { name: "otp", inputMode: "numeric", autoComplete: "one-time-code" })),
                        React.createElement("div", { className: "form-actions" },
                            React.createElement(Button, { onClick: () => { setModal(null); elevationReject.current?.(new Error('已取消二次验证')); elevationResolve.current = null; elevationReject.current = null; } }, "\u53D6\u6D88"),
                            React.createElement(Button, { type: "submit", tone: "primary" }, "\u9A8C\u8BC1\u5E76\u7EE7\u7EED"))) });
            });
            return () => { elevationHandler = null; };
        }, [notify, presentModal]);
        useEffect(() => {
            const query = window.matchMedia('(max-width: 900px)');
            const update = () => setCompactLayout(query.matches);
            update();
            query.addEventListener('change', update);
            return () => query.removeEventListener('change', update);
        }, []);
        useEffect(() => { if (sidebarRef.current)
            sidebarRef.current.inert = compactLayout && !drawer; }, [compactLayout, drawer]);
        useEffect(() => { document.title = `${route.title} · LukePanel`; setDrawer(false); }, [route.path]);
        const logout = useCallback(async () => { try {
            await api('/api/v1/auth/logout', { method: 'POST', body: '{}' });
        }
        catch { /* Session may already be invalid. */ }
        finally {
            resetAuth();
            routeState.navigate('/', true);
        } }, [resetAuth, routeState.navigate]);
        if (!ready)
            return React.createElement("main", { className: "boot-screen" },
                React.createElement("img", { src: "/assets/favicon-64.png", alt: "" }),
                React.createElement("span", { className: "spinner" }),
                React.createElement("p", null, "\u6B63\u5728\u8FDE\u63A5 LukePanel\u2026"));
        if (!identity)
            return React.createElement(LoginPage, { onAuthenticated: applyIdentity, notify: notify });
        const pageProps = { route, navigate: routeState.navigate, notify, openModal, closeModal, confirm: confirmAction };
        const renderPage = () => {
            switch (route.path) {
                case '/': return React.createElement(DashboardPage, { ...pageProps });
                case '/system': return React.createElement(SystemPage, { ...pageProps });
                case '/system/services': return React.createElement(ServicesPage, { ...pageProps });
                case '/system/processes': return React.createElement(ProcessesPage, { ...pageProps });
                case '/system/network': return React.createElement(NetworkPage, { ...pageProps });
                case '/system/storage': return React.createElement(StoragePage, { ...pageProps });
                case '/system/tasks': return React.createElement(TasksPage, { ...pageProps });
                case '/system/updates': return React.createElement(UpdatesPage, { ...pageProps });
                case '/system/host': return React.createElement(HostPage, { ...pageProps });
                case '/system/snapshots': return React.createElement(SnapshotsPage, { ...pageProps });
                case '/docker': return React.createElement(DockerPage, { ...pageProps });
                case '/files': return React.createElement(FilesPage, { ...pageProps });
                case '/tools': return React.createElement(ToolsPage, { ...pageProps });
                case '/tools/github': return React.createElement(GitHubPage, { ...pageProps });
                case '/ssh': return React.createElement(SSHPage, { ...pageProps });
                case '/audit': return React.createElement(AuditPage, { ...pageProps });
                case '/security': return React.createElement(SecurityPage, { ...pageProps });
                case '/settings': return React.createElement(SettingsPage, { ...pageProps, username: text(identity.username, ''), onLogout: logout });
                default: return React.createElement(DashboardPage, { ...pageProps });
            }
        };
        const active = (item) => route.path === item.path || (item.path !== '/' && route.path.startsWith(`${item.path}/`));
        return React.createElement("div", { className: "app-shell" },
            React.createElement("aside", { ref: sidebarRef, className: `sidebar ${drawer ? 'is-open' : ''}`, "aria-hidden": compactLayout && !drawer ? true : undefined },
                React.createElement("div", { className: "sidebar-brand" },
                    React.createElement("img", { src: "/assets/favicon-64.png", alt: "LukePanel" }),
                    React.createElement("div", null,
                        React.createElement("strong", null, "LukePanel"),
                        React.createElement("span", null, VERSION)),
                    React.createElement("button", { className: "icon-button sidebar-close", onClick: () => setDrawer(false), "aria-label": "\u5173\u95ED\u83DC\u5355" },
                        React.createElement(Icon, { name: "close" }))),
                React.createElement("nav", { className: "sidebar-nav", "aria-label": "\u4E3B\u5BFC\u822A" }, PRIMARY_ROUTES.map(item => React.createElement("button", { key: item.path, className: active(item) ? 'active' : '', onClick: () => routeState.navigate(item.path) },
                    React.createElement(Icon, { name: item.icon }),
                    React.createElement("span", null, item.title)))),
                React.createElement("div", { className: "sidebar-account" },
                    React.createElement("span", { className: "avatar" }, text(identity.username, 'L').slice(0, 1).toUpperCase()),
                    React.createElement("div", null,
                        React.createElement("strong", null, text(identity.username, '管理员')),
                        React.createElement("small", null, "\u672C\u673A\u7BA1\u7406\u5458")),
                    React.createElement("button", { className: "icon-button", onClick: logout, "aria-label": "\u9000\u51FA\u767B\u5F55" },
                        React.createElement(Icon, { name: "back" })))),
            drawer ? React.createElement("button", { className: "drawer-scrim", "aria-label": "\u5173\u95ED\u83DC\u5355", onClick: () => setDrawer(false) }) : null,
            React.createElement("section", { className: "workspace" },
                React.createElement("header", { className: "mobile-topbar" },
                    React.createElement("button", { className: "icon-button", onClick: () => setDrawer(true), "aria-label": "\u6253\u5F00\u83DC\u5355" },
                        React.createElement(Icon, { name: "menu" })),
                    React.createElement("div", { className: "mobile-brand" },
                        React.createElement("img", { src: "/assets/favicon-64.png", alt: "" }),
                        React.createElement("strong", null, "LukePanel")),
                    React.createElement("span", { className: "mobile-user" }, text(identity.username, '管理员'))),
                React.createElement("main", { className: "content" },
                    React.createElement(AppErrorBoundary, { key: route.path }, renderPage()))),
            React.createElement("nav", { className: "mobile-bottom-nav", "aria-label": "\u79FB\u52A8\u7AEF\u4E3B\u5BFC\u822A" },
                MOBILE_ROUTES.map(path => { const item = ROUTE_MAP.get(path); return React.createElement("button", { key: path, className: active(item) ? 'active' : '', onClick: () => routeState.navigate(path) },
                    React.createElement(Icon, { name: item.icon, size: 20 }),
                    React.createElement("span", null, item.title)); }),
                React.createElement("button", { onClick: () => setDrawer(true) },
                    React.createElement(Icon, { name: "more", size: 20 }),
                    React.createElement("span", null, "\u66F4\u591A"))),
            React.createElement(Modal, { state: modal, returnFocus: modalReturnFocus.current, onClose: () => { if (elevationReject.current) {
                    elevationReject.current(new Error('已取消二次验证'));
                    elevationResolve.current = null;
                    elevationReject.current = null;
                } closeModal(); } }),
            React.createElement(Toasts, { items: toasts, dismiss: id => setToasts(items => items.filter(item => item.id !== id)) }));
    }
    const rootNode = document.getElementById('app');
    if (!rootNode)
        throw new Error('缺少 #app 根节点');
    ReactDOM.createRoot(rootNode).render(React.createElement(AppErrorBoundary, null,
        React.createElement(App, null)));
})();
