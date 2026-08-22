// historicalDateFoundationV1
//
// Supports historical dates without inventing false precision.
//
// Examples:
// exact       2026-08-22
// month       2026-08
// year        2026
// approximate ~2026-08
//
// No SQLite/storage dependency.

export type HistoricalDatePrecision =
  | 'DAY'
  | 'MONTH'
  | 'YEAR';

export type HistoricalDate = {
  value: string;
  precision: HistoricalDatePrecision;
  approximate: boolean;
};

const CROATIAN_MONTHS = [
  'siječanj',
  'veljača',
  'ožujak',
  'travanj',
  'svibanj',
  'lipanj',
  'srpanj',
  'kolovoz',
  'rujan',
  'listopad',
  'studeni',
  'prosinac',
] as const;

const CROATIAN_MONTHS_GENITIVE = [
  'siječnja',
  'veljače',
  'ožujka',
  'travnja',
  'svibnja',
  'lipnja',
  'srpnja',
  'kolovoza',
  'rujna',
  'listopada',
  'studenoga',
  'prosinca',
] as const;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function validYear(year: number) {
  return Number.isInteger(year) &&
    year >= 1 &&
    year <= 9999;
}

function validMonth(month: number) {
  return Number.isInteger(month) &&
    month >= 1 &&
    month <= 12;
}

function validDay(
  year: number,
  month: number,
  day: number,
) {
  if (
    !validYear(year) ||
    !validMonth(month) ||
    !Number.isInteger(day) ||
    day < 1
  ) {
    return false;
  }

  const maxDay = new Date(
    year,
    month,
    0,
  ).getDate();

  return day <= maxDay;
}

export function parseHistoricalDate(
  input: string,
): HistoricalDate | null {
  const raw = input.trim();

  if (!raw) {
    return null;
  }

  const approximate = raw.startsWith('~');

  const clean = approximate
    ? raw.slice(1).trim()
    : raw;

  const dayMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);

  if (dayMatch) {
    const year = Number(dayMatch[1]);
    const month = Number(dayMatch[2]);
    const day = Number(dayMatch[3]);

    if (!validDay(year, month, day)) {
      return null;
    }

    return {
      value:
        `${year}-${pad2(month)}-${pad2(day)}`,
      precision: 'DAY',
      approximate,
    };
  }

  const monthMatch =
    /^(\d{4})-(\d{2})$/.exec(clean);

  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);

    if (
      !validYear(year) ||
      !validMonth(month)
    ) {
      return null;
    }

    return {
      value:
        `${year}-${pad2(month)}`,
      precision: 'MONTH',
      approximate,
    };
  }

  const yearMatch =
    /^(\d{4})$/.exec(clean);

  if (yearMatch) {
    const year = Number(yearMatch[1]);

    if (!validYear(year)) {
      return null;
    }

    return {
      value: String(year),
      precision: 'YEAR',
      approximate,
    };
  }

  return null;
}

export function serializeHistoricalDate(
  date: HistoricalDate,
) {
  return date.approximate
    ? `~${date.value}`
    : date.value;
}

export function formatHistoricalDate(
  date: HistoricalDate,
) {
  const prefix = date.approximate
    ? 'oko '
    : '';

  if (date.precision === 'YEAR') {
    return `${prefix}${date.value}.`;
  }

  const parts = date.value
    .split('-')
    .map(Number);

  const year = parts[0];
  const month = parts[1];

  if (
    !year ||
    !month ||
    !validMonth(month)
  ) {
    return serializeHistoricalDate(date);
  }

  if (date.precision === 'MONTH') {
    return (
      prefix +
      CROATIAN_MONTHS[month - 1] +
      ' ' +
      year +
      '.'
    );
  }

  const day = parts[2];

  if (
    !day ||
    !validDay(year, month, day)
  ) {
    return serializeHistoricalDate(date);
  }

  return (
    prefix +
    day +
    '. ' +
    CROATIAN_MONTHS_GENITIVE[month - 1] +
    ' ' +
    year +
    '.'
  );
}


// ----------------------------------------------------------
// Sorting
//
// Missing precision sorts at the beginning of its known
// interval instead of fabricating a visible date.
//
// 2024       -> 2024-01-01 internally for sorting only
// 2024-06    -> 2024-06-01 internally for sorting only
//
// The fabricated portion is NEVER shown to the user.
// ----------------------------------------------------------

export function historicalDateSortValue(
  date: HistoricalDate,
) {
  const parts = date.value
    .split('-')
    .map(Number);

  const year = parts[0] ?? 1;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  return (
    year * 10000 +
    month * 100 +
    day
  );
}

export function compareHistoricalDates(
  a: HistoricalDate,
  b: HistoricalDate,
) {
  return (
    historicalDateSortValue(a) -
    historicalDateSortValue(b)
  );
}


// ----------------------------------------------------------
// Constructors
// ----------------------------------------------------------

export function historicalDay(
  year: number,
  month: number,
  day: number,
  approximate = false,
): HistoricalDate {
  if (!validDay(year, month, day)) {
    throw new Error(
      'Invalid historical day'
    );
  }

  return {
    value:
      `${year}-${pad2(month)}-${pad2(day)}`,
    precision: 'DAY',
    approximate,
  };
}

export function historicalMonth(
  year: number,
  month: number,
  approximate = false,
): HistoricalDate {
  if (
    !validYear(year) ||
    !validMonth(month)
  ) {
    throw new Error(
      'Invalid historical month'
    );
  }

  return {
    value:
      `${year}-${pad2(month)}`,
    precision: 'MONTH',
    approximate,
  };
}

export function historicalYear(
  year: number,
  approximate = false,
): HistoricalDate {
  if (!validYear(year)) {
    throw new Error(
      'Invalid historical year'
    );
  }

  return {
    value: String(year),
    precision: 'YEAR',
    approximate,
  };
}


// ----------------------------------------------------------
// Human labels for future forms
// ----------------------------------------------------------

export const historicalPrecisionLabels:
  Record<
    HistoricalDatePrecision,
    string
  > = {
    DAY: 'Točan datum',
    MONTH: 'Mjesec',
    YEAR: 'Godina',
  };
