declare namespace React {
  type ReactNode = any;
  type SetStateAction<S> = S | ((previous: S) => S);
  type Dispatch<A> = (value: A) => void;
  interface RefObject<T> { current: T; }
  function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  function useRef<T>(initial: T): RefObject<T>;
  function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void;
  function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
  function useCallback<T extends (...args: any[]) => any>(callback: T, dependencies: readonly unknown[]): T;
  class Component<P = {}, S = {}> {
    constructor(props: P);
    readonly props: Readonly<P>;
    state: Readonly<S>;
    setState(state: Partial<S> | ((previous: Readonly<S>, props: Readonly<P>) => Partial<S> | null)): void;
    render(): any;
  }
}
declare const React: {
  useState: typeof React.useState;
  useRef: typeof React.useRef;
  useEffect: typeof React.useEffect;
  useMemo: typeof React.useMemo;
  useCallback: typeof React.useCallback;
  Component: typeof React.Component;
};
declare const ReactDOM: { createRoot(node: Element | DocumentFragment): { render(children: any): void; unmount(): void } };
declare namespace JSX {
  interface IntrinsicAttributes { key?: string | number }
  interface IntrinsicElements { [element: string]: any }
  interface ElementChildrenAttribute { children: {} }
}
interface Window {
  __LUKEPANEL_VERSION__: string;
  __LUKEPANEL_TEST__?: boolean;
  __LUKEPANEL_TEST_PATH__?: string;
}
