type Props = {
  size?: number;
  className?: string;
};

export function ChatLogo({ size = 32, className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M16 3.5c2.18 0 4.31.65 6.13 1.87l2.9 1.93c1.78 1.19 2.84 3.16 2.84 5.3v4.2c0 2.14-1.06 4.11-2.84 5.3l-2.9 1.93A11.55 11.55 0 0 1 16 28.5a11.55 11.55 0 0 1-6.13-1.87l-2.9-1.93A6.29 6.29 0 0 1 4.13 20.8V16.6c0-2.14 1.06-4.11 2.84-5.3l2.9-1.93A11.55 11.55 0 0 1 16 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 6.25c1.82-1.75 4.75-1.7 6.44.11 1.69 1.81 1.69 4.66 0 6.47L16 18.73"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 6.25c-1.82-1.75-4.75-1.7-6.44.11-1.69 1.81-1.69 4.66 0 6.47L16 18.73"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 13.05c1.82 1.75 1.82 4.58 0 6.33-1.82 1.75-4.75 1.7-6.44-.11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 13.05c-1.82 1.75-1.82 4.58 0 6.33 1.82 1.75 4.75 1.7 6.44-.11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
