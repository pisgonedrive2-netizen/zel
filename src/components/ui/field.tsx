"use client";

import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { numberInputDisplay, parseNumberInput, parseOptionalNumberInput } from "@/lib/number-input";

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

/**
 * Form alanı sarmalayıcısı. İlk geçerli React elementi (input/select/textarea)
 * için otomatik bir `id` üretip `<label htmlFor>` bağlantısı kurar ve `aria-*`
 * niteliklerini doldurur (a11y).
 */
export function Field({ label, required, children, hint }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  let injected = false;

  const enhanced = Children.map(children, (child) => {
    if (!injected && isValidElement(child)) {
      injected = true;
      type WithProps = {
        id?: string;
        "aria-required"?: boolean;
        "aria-describedby"?: string;
      };
      const existing = (child.props ?? {}) as WithProps;
      return cloneElement(child as React.ReactElement<WithProps>, {
        id: existing.id ?? id,
        "aria-required": required || existing["aria-required"],
        "aria-describedby": hint
          ? [existing["aria-describedby"], hintId].filter(Boolean).join(" ")
          : existing["aria-describedby"],
      });
    }
    return child;
  });

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {enhanced}
      {hint && (
        <p id={hintId} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-background border border-input text-foreground rounded-lg px-3 py-1.5 text-[13px] outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export function Input({ className = "", ...props }: InputProps) {
  return <input {...props} className={`${inputCls} ${className}`} />;
}

/** Tutar alanları — boşken `0` göstermez, yazarken rahat silinir. */
export function NumberInput({
  value,
  onChange,
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(() => numberInputDisplay(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(numberInputDisplay(value));
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onChange(parseNumberInput(raw, 0));
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(numberInputDisplay(value));
        props.onBlur?.(e);
      }}
      className={`${inputCls} ${className}`}
    />
  );
}

/** Opsiyonel tutar — boş bırakılabilir. */
export function OptionalNumberInput({
  value,
  onChange,
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
}) {
  const [text, setText] = useState(() => numberInputDisplay(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(numberInputDisplay(value));
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onChange(parseOptionalNumberInput(raw));
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(numberInputDisplay(value));
        props.onBlur?.(e);
      }}
      className={`${inputCls} ${className}`}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}
export function Select({ options, className = "", ...props }: SelectProps) {
  return (
    <select {...props} className={`${inputCls} cursor-pointer ${className}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export function Textarea({ className = "", ...props }: TextareaProps) {
  return <textarea rows={3} {...props} className={`${inputCls} resize-none ${className}`} />;
}

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

export function FormActions({
  onCancel,
  submitLabel = "Kaydet",
  onDelete,
  deleteLabel = "Sil",
  hideSubmit = false,
  submitDisabled = false,
}: {
  onCancel: () => void;
  submitLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  hideSubmit?: boolean;
  submitDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-4 mt-5 border-t border-border">
      <div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-[13px] px-3 py-1.5 rounded-lg text-red-600 hover:bg-destructive/10 dark:text-red-400 transition-colors"
          >
            {deleteLabel}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {hideSubmit ? "Kapat" : "İptal"}
        </button>
        {!hideSubmit && (
          <button
            type="submit"
            disabled={submitDisabled}
            className="text-[13px] font-medium px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
