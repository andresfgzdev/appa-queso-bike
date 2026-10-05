/// <reference types="vite/client" />

// Fallback ambient module declarations when node_modules is not yet installed
declare module "react" {
  export = React;
  export as namespace React;
  namespace React {
    interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {}
    type JSXElementConstructor<P> = ((props: P) => ReactElement<any, any> | null) | (new (props: P) => Component<any, any>);
    interface Component<P = {}, S = {}> {}
    const StrictMode: any;
    function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
    function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
    function useRef<T>(initialValue: T): { current: T };
    function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
    function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  }
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "react/jsx-dev-runtime" {
  export const jsxDEV: any;
  export const Fragment: any;
}

declare module "react-dom/client" {
  export interface Root {
    render(children: any): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
