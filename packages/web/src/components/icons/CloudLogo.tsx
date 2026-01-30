interface CloudLogoProps {
  size?: number;
  className?: string;
}

export function CloudLogo({ size = 24, className }: CloudLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M6.5 18.5C3.46 18.5 1 16.04 1 13c0-2.5 1.67-4.6 3.95-5.27C5.83 4.84 8.64 2.5 12 2.5c4.14 0 7.5 3.36 7.5 7.5 0 .34-.02.67-.07 1H19.5c1.93 0 3.5 1.57 3.5 3.5S21.43 18 19.5 18H6.5v.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
