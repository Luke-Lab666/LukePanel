import { useCallback, useEffect, useState } from 'react';

export const routes = new Set([
  '/', '/system', '/services', '/processes', '/network', '/storage', '/timers', '/tasks', '/updates', '/host', '/snapshots',
  '/files', '/docker', '/tools', '/github', '/ssh', '/audit', '/security',
]);

export const routeParents: Record<string, string> = {
  '/services': '/system',
  '/processes': '/system',
  '/network': '/system',
  '/storage': '/system',
  '/timers': '/system',
  '/tasks': '/system',
  '/updates': '/system',
  '/host': '/system',
  '/snapshots': '/system',
  '/ssh': '/system',
  '/github': '/tools',
};

const STORAGE_KEY = 'lukepanel:last-route';

function valid(path: string) {
  return routes.has(path) ? path : '/';
}

export function useRouter() {
  const [path, setPath] = useState(() => valid(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPath(valid(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, path);
  }, [path]);

  const navigate = useCallback((next: string, replace = false) => {
    const target = valid(next);
    if (target !== window.location.pathname) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', target);
    }
    setPath(target);
  }, []);

  const restore = useCallback(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) ?? '/';
    const target = valid(window.location.pathname === '/' ? saved : window.location.pathname);
    navigate(target, true);
  }, [navigate]);

  return { path, navigate, restore, parent: routeParents[path] };
}
