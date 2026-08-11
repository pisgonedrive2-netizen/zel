import { Fragment, jsxDEV as jsxDEVOrig } from "react/jsx-dev-runtime";
import type { JSX as ReactJSX } from "react";
import { jsx, jsxs } from "./jsx-runtime";
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

export const jsxDEV: typeof jsxDEVOrig = ((type, props, key, isStatic, source, self) =>
  jsxDEVOrig(type, translateJsxProps(type, props) as typeof props, key, isStatic, source, self)
) as typeof jsxDEVOrig;

export { Fragment, jsx, jsxs };
