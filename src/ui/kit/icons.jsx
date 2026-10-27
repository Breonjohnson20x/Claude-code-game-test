// Small engraved line icons (24×24, currentColor). Decorative unless given a `label`.

const PATHS = {
  treasury: 'M12 3c4.4 0 8 1.6 8 3.5S16.4 10 12 10 4 8.4 4 6.5 7.6 3 12 3Zm-8 3.5v4C4 12.4 7.6 14 12 14s8-1.6 8-3.5v-4M4 10.5v4C4 16.4 7.6 18 12 18s8-1.6 8-3.5v-4M4 14.5v3C4 19.4 7.6 21 12 21s8-1.6 8-3.5v-3',
  manpower: 'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5M3 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M14.5 14.2c2.9.3 5 2.9 5 5.8',
  readiness: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Zm-3.5 9 2.5 2.5 4.5-5',
  stability: 'M12 3v18M5 21h14M5 7h14M7 7l-3 7h6L7 7Zm10 0-3 7h6l-3-7Z',
  unrest: 'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.4-2.4-5.6-3.9-8.1-.3 1.8-1.2 3-2.3 3.6.2-3-1.4-5.6-3.8-7.3.4 3.3-3 5.7-3 10.8C5.5 18.4 8.1 21 12 21Z',
  intel: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  chronicle: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5m0-15v15m0 0A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6M9 10.5h6',
  council: 'M12 3 3 7.5h18L12 3ZM5 7.5V18m4.7-10.5V18m4.6-10.5V18M19 7.5V18M3 21h18M3.5 18h17',
  saves: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5 1.4 2.9 3.1.4-2.3 2.2.6 3.1L12 14.6l-2.8 1.5.6-3.1-2.3-2.2 3.1-.4L12 7.5Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-1.6 1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.1 1.2l-.3 2H10l-.3-2a7 7 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L3.7 9.6l2-3.4 1.9.7A7 7 0 0 1 9.7 5.7L10 3.6h4l.3 2.1a7 7 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4Z',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  sword: 'M14.5 4H20v5.5L9.5 20 4 14.5 14.5 4ZM7 17l-3 3M10.5 13.5l-3-3',
  crown: 'M3.5 8 7 12l5-6.5L17 12l3.5-4-1.5 10h-14L3.5 8ZM5 21h14',
  fire: 'M12 21c3.6 0 6-2.4 6-5.7 0-3.2-2.2-5.1-3.6-7.4-.3 1.6-1.1 2.8-2.1 3.3.2-2.8-1.3-5.2-3.5-6.7.4 3-2.8 5.3-2.8 10.1C6 18.6 8.4 21 12 21Zm0 0c-1.7 0-2.8-1.1-2.8-2.6 0-1.8 1.6-2.6 2.8-4.2 1.2 1.6 2.8 2.4 2.8 4.2 0 1.5-1.1 2.6-2.8 2.6Z',
  map: 'M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4.5m0 2.5v.5',
  quill: 'M20 4c-6 0-11 4-13 10l-2 6 6-2c6-2 10-7 10-13l-1-1ZM7 17l5-5',
  scroll: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7m0-16a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2Zm0 16a2 2 0 0 1-2-2v-1h4v1a2 2 0 0 1-2 2Zm4-12h4m-4 4h4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5ZM16 9.5l5 5m0-5-5 5',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 19h14',
  upload: 'M12 20V9m0 0-4 4m4-4 4 4M5 5h14',
  trash: 'M5 7h14M9.5 7V5h5v2m-7 0 1 13h7l1-13',
};

export function Icon({ name, size = 22, label, className = '', strokeWidth = 1.6 }) {
  const d = PATHS[name] ?? PATHS.alert;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS);
