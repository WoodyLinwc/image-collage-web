const PATHS: Record<string, string[]> = {
  plus: ['M12 5v14', 'M5 12h14'],
  download: ['M12 4v11', 'M8 11l4 4 4-4', 'M5 19h14'],
  share: ['M12 15V4', 'M8 8l4-4 4 4', 'M6 12v7h12v-7'],
  swap: ['M7 8h11', 'M15 5l3 3-3 3', 'M17 16H6', 'M9 13l-3 3 3 3'],
  image: ['M4 6h16v12H4z', 'M4 15l4-4 4 4 3-3 5 5', 'M15.5 9.5h.01'],
  reset: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 5v4h4'],
  trash: ['M5 7h14', 'M10 11v6', 'M14 11v6', 'M6.5 7l1 12h9l1-12', 'M9.5 7V4.5h5V7'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  layers: ['M4 4h7v16H4z', 'M13 4h7v7h-7z', 'M13 13h7v7h-7z'],
  fit: ['M3.5 4.5h17v15h-17z', 'M9 7.5h6v9H9z'],
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
