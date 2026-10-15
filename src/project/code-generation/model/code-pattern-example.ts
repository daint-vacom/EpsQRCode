const CODE_DATE_FORMATS = {
  YYYY: ['year'],
  MM: ['month'],
  DD: ['day'],
  YYYYMM: ['year', 'month'],
  YYYYMMDD: ['year', 'month', 'day'],
} as const;

const CODE_PATTERN_EXAMPLE_CONFIG = {
  sequence: {
    tokenPattern: /\{SEQ:(\d{1,2})\}/g,
    render: (width: string) => '0'.repeat(Number(width)),
  },
  date: {
    tokenPattern: /\{DATE:(YYYYMMDD|YYYYMM|YYYY|MM|DD)\}/g,
    render: (format: keyof typeof CODE_DATE_FORMATS) => {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value]),
      );
      return CODE_DATE_FORMATS[format].map((part) => values[part]).join('');
    },
  },
} as const;

export const DEFAULT_CODE_GENERATION_PATTERNS = {
  material_group: 'NVT-{SEQ:5}',
  material_model: 'MVT-{SEQ:5}',
  material_specification: 'TS-{SEQ:5}',
} as const;

export function getCodePatternExample(pattern: string): string {
  return pattern
    .replace(
      CODE_PATTERN_EXAMPLE_CONFIG.sequence.tokenPattern,
      (_token, width: string) =>
        CODE_PATTERN_EXAMPLE_CONFIG.sequence.render(width),
    )
    .replace(
      CODE_PATTERN_EXAMPLE_CONFIG.date.tokenPattern,
      (_token, format: keyof typeof CODE_DATE_FORMATS) =>
        CODE_PATTERN_EXAMPLE_CONFIG.date.render(format),
    );
}
