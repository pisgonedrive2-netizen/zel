import { Fragment, jsx as jsxOrig, jsxs as jsxsOrig } from "react/jsx-runtime";
import type { JSX as ReactJSX } from "react";
import { translateJsxProps } from "./jsx-translate";

export namespace JSX {
  export type Element = ReactJSX.Element;
  export type ElementType = ReactJSX.ElementType;
  export type ElementClass = ReactJSX.ElementClass;
  export interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
  export interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
  export type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
  export interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
  export interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
  export interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
}

export const jsx: typeof jsxOrig = ((type, props, key) =>
  jsxOrig(type, translateJsxProps(type, props) as typeof props, key)
) as typeof jsxOrig;

export const jsxs: typeof jsxsOrig = ((type, props, key) =>
  jsxsOrig(type, translateJsxProps(type, props) as typeof props, key)
) as typeof jsxsOrig;

export { Fragment };
