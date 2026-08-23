import { getDatabase } from './database';

// uncertaintyDatesV1
//
// Approximate chronology is NOT an exact date.
//
// "Summer 2021" must remain an interval,
// not silently become 2021-07-01.
//
// Canonical getDatabase only.

export type ApproximateDateEntityType =
  | 'BOOK'
  | 'MEDIA'
  | 'GAME';

export type ApproximateDatePrecision =
  | 'YEAR'
  | 'MONTH'
  | 'SEASON';

export type ApproximateSeason =
  | 'SPRING'
  | 'SUMMER'
  | 'AUTUMN'
  | 'WINTER';

export type ApproximateDateRecord = {
  entityType:
    ApproximateDateEntityType;

  entityId: string;

  precision:
    ApproximateDatePrecision;

  year: number;

  month: number | null;

  season:
    ApproximateSeason | null;

  note: string | null;

  createdAt: string;

  modifiedAt: string;
};

export type ApproximateDateBounds = {
  start: string;
  end: string;
  representative: string;
};

type Row =
  Record<
    string,
    string | number | null
  >;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  const database =
    await getDatabase();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS approximate_dates (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,

      precision TEXT NOT NULL,

      year INTEGER NOT NULL,

      month INTEGER,
      season TEXT,

      note TEXT,

      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,

      PRIMARY KEY (
        entity_type,
        entity_id
      )
    );

    CREATE INDEX IF NOT EXISTS idx_approximate_dates_year
      ON approximate_dates(
        year,
        entity_type
      );
  `);

  schemaReady = true;
}

function asText(
  value: unknown,
) {
  return typeof value === 'string' &&
    value.trim()
    ? value.trim()
    : null;
}

function asNumber(
  value: unknown,
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function mapRow(
  row: Row,
): ApproximateDateRecord {
  return {
    entityType:
      String(
        row.entity_type,
      ) as ApproximateDateEntityType,

    entityId:
      String(
        row.entity_id,
      ),

    precision:
      String(
        row.precision,
      ) as ApproximateDatePrecision,

    year:
      Number(
        row.year,
      ),

    month:
      row.month === null
        ? null
        : Number(
            row.month,
          ),

    season:
      row.season
        ? String(
            row.season,
          ) as ApproximateSeason
        : null,

    note:
      asText(
        row.note,
      ),

    createdAt:
      String(
        row.created_at,
      ),

    modifiedAt:
      String(
        row.modified_at,
      ),
  };
}

function validateYear(
  year: number,
) {
  if (
    !Number.isInteger(year) ||
    year < 1000 ||
    year > 3000
  ) {
    throw new Error(
      'Godina nije valjana.'
    );
  }
}

function validateInput(
  precision:
    ApproximateDatePrecision,
  year: number,
  month: number | null,
  season:
    ApproximateSeason | null,
) {
  validateYear(year);

  if (
    precision === 'MONTH'
  ) {
    if (
      month === null ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new Error(
        'Odaberi mjesec.'
      );
    }
  }

  if (
    precision === 'SEASON' &&
    !season
  ) {
    throw new Error(
      'Odaberi godišnje doba.'
    );
  }
}

function isoDate(
  year: number,
  month: number,
  day: number,
) {
  return (
    String(year)
      .padStart(4, '0') +
    '-' +
    String(month)
      .padStart(2, '0') +
    '-' +
    String(day)
      .padStart(2, '0') +
    'T12:00:00.000Z'
  );
}

function lastDayOfMonth(
  year: number,
  month: number,
) {
  return new Date(
    Date.UTC(
      year,
      month,
      0,
    ),
  ).getUTCDate();
}

export function getApproximateDateBounds(
  value:
    Pick<
      ApproximateDateRecord,
      | 'precision'
      | 'year'
      | 'month'
      | 'season'
    >,
): ApproximateDateBounds {
  const {
    precision,
    year,
    month,
    season,
  } = value;

  if (
    precision === 'MONTH' &&
    month
  ) {
    const last =
      lastDayOfMonth(
        year,
        month,
      );

    const middle =
      Math.max(
        1,
        Math.round(
          last / 2,
        ),
      );

    return {
      start:
        isoDate(
          year,
          month,
          1,
        ),

      end:
        isoDate(
          year,
          month,
          last,
        ),

      representative:
        isoDate(
          year,
          month,
          middle,
        ),
    };
  }

  if (
    precision === 'SEASON'
  ) {
    if (
      season === 'SPRING'
    ) {
      return {
        start:
          isoDate(
            year,
            3,
            1,
          ),

        end:
          isoDate(
            year,
            5,
            31,
          ),

        representative:
          isoDate(
            year,
            4,
            15,
          ),
      };
    }

    if (
      season === 'SUMMER'
    ) {
      return {
        start:
          isoDate(
            year,
            6,
            1,
          ),

        end:
          isoDate(
            year,
            8,
            31,
          ),

        representative:
          isoDate(
            year,
            7,
            16,
          ),
      };
    }

    if (
      season === 'AUTUMN'
    ) {
      return {
        start:
          isoDate(
            year,
            9,
            1,
          ),

        end:
          isoDate(
            year,
            11,
            30,
          ),

        representative:
          isoDate(
            year,
            10,
            16,
          ),
      };
    }

    // WINTER:
    // "Winter 2021" means
    // Dec 2021 -> Feb 2022.
    return {
      start:
        isoDate(
          year,
          12,
          1,
        ),

      end:
        isoDate(
          year + 1,
          2,
          lastDayOfMonth(
            year + 1,
            2,
          ),
        ),

      representative:
        isoDate(
          year + 1,
          1,
          15,
        ),
    };
  }

  return {
    start:
      isoDate(
        year,
        1,
        1,
      ),

    end:
      isoDate(
        year,
        12,
        31,
      ),

    representative:
      isoDate(
        year,
        7,
        2,
      ),
  };
}

const monthLabels = [
  '',
  'Siječanj',
  'Veljača',
  'Ožujak',
  'Travanj',
  'Svibanj',
  'Lipanj',
  'Srpanj',
  'Kolovoz',
  'Rujan',
  'Listopad',
  'Studeni',
  'Prosinac',
];

const seasonLabels:
  Record<
    ApproximateSeason,
    string
  > = {
    SPRING: 'Proljeće',
    SUMMER: 'Ljeto',
    AUTUMN: 'Jesen',
    WINTER: 'Zima',
  };

export function formatApproximateDate(
  value: Pick<
    ApproximateDateRecord,
    | 'precision'
    | 'year'
    | 'month'
    | 'season'
  >,
) {
  if (
    value.precision ===
      'MONTH' &&
    value.month
  ) {
    return (
      monthLabels[
        value.month
      ] +
      ' ' +
      value.year +
      '.'
    );
  }

  if (
    value.precision ===
      'SEASON' &&
    value.season
  ) {
    if (
      value.season ===
      'WINTER'
    ) {
      return (
        seasonLabels[
          value.season
        ] +
        ' ' +
        value.year +
        '/' +
        String(
          value.year + 1,
        ).slice(-2) +
        '.'
      );
    }

    return (
      seasonLabels[
        value.season
      ] +
      ' ' +
      value.year +
      '.'
    );
  }

  return (
    'Negdje ' +
    value.year +
    '.'
  );
}

export async function getApproximateDate(
  entityType:
    ApproximateDateEntityType,
  entityId: string,
): Promise<
  ApproximateDateRecord | null
> {
  await ensureSchema();

  const database =
    await getDatabase();

  const row =
    await database.getFirstAsync<Row>(
      `
        SELECT *
        FROM approximate_dates
        WHERE
          entity_type = ?
          AND entity_id = ?
        LIMIT 1
      `,
      entityType,
      entityId,
    );

  return row
    ? mapRow(row)
    : null;
}

export async function setApproximateDate(
  input: {
    entityType:
      ApproximateDateEntityType;

    entityId: string;

    precision:
      ApproximateDatePrecision;

    year: number;

    month?: number | null;

    season?:
      ApproximateSeason | null;

    note?: string | null;
  },
): Promise<ApproximateDateRecord> {
  await ensureSchema();

  const database =
    await getDatabase();

  const month =
    input.precision ===
      'MONTH'
      ? input.month ?? null
      : null;

  const season =
    input.precision ===
      'SEASON'
      ? input.season ?? null
      : null;

  validateInput(
    input.precision,
    input.year,
    month,
    season,
  );

  const now =
    new Date()
      .toISOString();

  const note =
    input.note?.trim() ||
    null;

  await database.runAsync(
    `
      INSERT INTO approximate_dates (
        entity_type,
        entity_id,
        precision,
        year,
        month,
        season,
        note,
        created_at,
        modified_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )

      ON CONFLICT(
        entity_type,
        entity_id
      )

      DO UPDATE SET
        precision =
          excluded.precision,

        year =
          excluded.year,

        month =
          excluded.month,

        season =
          excluded.season,

        note =
          excluded.note,

        modified_at =
          excluded.modified_at
    `,
    input.entityType,
    input.entityId,
    input.precision,
    input.year,
    month,
    season,
    note,
    now,
    now,
  );

  const saved =
    await getApproximateDate(
      input.entityType,
      input.entityId,
    );

  if (!saved) {
    throw new Error(
      'Approximate date nije spremljen.'
    );
  }

  return saved;
}

export async function deleteApproximateDate(
  entityType:
    ApproximateDateEntityType,
  entityId: string,
) {
  await ensureSchema();

  const database =
    await getDatabase();

  await database.runAsync(
    `
      DELETE FROM approximate_dates
      WHERE
        entity_type = ?
        AND entity_id = ?
    `,
    entityType,
    entityId,
  );
}
