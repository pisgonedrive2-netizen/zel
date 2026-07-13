import type { SVGProps } from "react";

type IconProps = {
  size?: number;
  className?: string;
} & SVGProps<SVGSVGElement>;

function baseProps({ size = 22, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className,
    "aria-hidden": true as const,
    ...rest,
  };
}

/** Starter — yükselen kıvılcım / ignition */
export function IconStarter(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path
        d="M12 3.2c.4 2.8-.2 4.6-1.6 6.4-.9 1.1-1.3 2.1-1.1 3.4.2 1.4 1.2 2.5 2.7 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 3.2c-.4 2.8.2 4.6 1.6 6.4.9 1.1 1.3 2.1 1.1 3.4-.2 1.4-1.2 2.5-2.7 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="12" cy="17.2" r="1.35" fill="currentColor" />
      <path
        d="M8.2 20.2h7.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

/** Standard — çift halkalı yıldız / signal */
export function IconStandard(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.35" opacity="0.35" />
      <circle cx="12" cy="12" r="5.1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7.4l1.05 2.55 2.75.2-2.15 1.8.7 2.65L12 13.5l-2.35 1.1.7-2.65-2.15-1.8 2.75-.2L12 7.4z"
        fill="currentColor"
        opacity="0.92"
      />
    </svg>
  );
}

/** Premium — geometrik taç */
export function IconPremium(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path
        d="M5.2 16.8h13.6l-1.1-8.2-3.5 3.4L12 6.4 9.8 12l-3.5-3.4L5.2 16.8z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M5.5 18.6h13"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <circle cx="5.5" cy="8.4" r="1.15" fill="currentColor" />
      <circle cx="12" cy="5.6" r="1.15" fill="currentColor" />
      <circle cx="18.5" cy="8.4" r="1.15" fill="currentColor" />
    </svg>
  );
}

/** Elite — kupa + ışın */
export function IconElite(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path
        d="M8.2 5.4h7.6v5.2c0 2.2-1.7 4-3.8 4h0c-2.1 0-3.8-1.8-3.8-4V5.4z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M8.2 6.6H6.4A2.2 2.2 0 0 0 4.2 8.8c0 1.7 1.2 3.1 2.8 3.4"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M15.8 6.6h1.8A2.2 2.2 0 0 1 19.8 8.8c0 1.7-1.2 3.1-2.8 3.4"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M12 14.6v2.2M9.4 19.4h5.2M10.2 16.8h3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 3.2v1.4M15.2 4.1l-.9 1.1M8.8 4.1l.9 1.1"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** Multi-marka — örtüşen marka panelleri */
export function IconMulti(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect
        x="3.8"
        y="5.2"
        width="10.2"
        height="10.2"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <rect
        x="10"
        y="8.6"
        width="10.2"
        height="10.2"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path
        d="M7.2 10.4h3.2M7.2 12.8h2.2M13.6 13.8h3.4M13.6 16.2h2.4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export type PackageIcon = typeof IconStarter;
