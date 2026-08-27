param(
  [string]$RepoRoot = "C:\Users\Korisnik\Desktop\TRACKING APP"
)

$ErrorActionPreference = "Stop"

$mobile = Join-Path $RepoRoot "mobile"
$rescuePath = Join-Path $mobile "src\storage\profileWatchlistRescue.ts"
$dbPath = Join-Path $mobile "src\storage\database.ts"

if (-not (Test-Path $dbPath)) {
  throw "SAFE STOP - database.ts not found"
}

$module = @'
import type { SQLiteDatabase } from 'expo-sqlite';

// profileWatchlistRescueV1
// Recovered from the "Watchlist - movies" section of watzch.txt.
// Idempotent: existing matching movies are moved to WATCHLIST only when
// they are not already COMPLETED/WATCHING/DROPPED.

type Seed = {
  key: string;
  title: string;
  aliases: string[];
  releaseYear: number | null;
};

const seeds: Seed[] = [
  {
    key: 'dark-side-of-the-moon',
    title: 'Dark Side of the Moon',
    aliases: ['dasrk side of the moon', 'dark side of the moon'],
    releaseYear: null,
  },
  {
    key: 'indecent-proposal',
    title: 'Indecent Proposal',
    aliases: ['incidicent proposal', 'indecent proposal'],
    releaseYear: 1993,
  },
  {
    key: 'robin-hood-men-in-tights',
    title: 'Robin Hood: Men in Tights',
    aliases: ['robin hood man in tights', 'robin hood men in tights'],
    releaseYear: 1993,
  },
  {
    key: '12-monkeys',
    title: '12 Monkeys',
    aliases: ['12 monkeys'],
    releaseYear: 1995,
  },
  {
    key: 'gattaca',
    title: 'Gattaca',
    aliases: ['gattaca'],
    releaseYear: 1997,
  },
  {
    key: 'prince-of-egypt',
    title: 'The Prince of Egypt',
    aliases: ['the prince of ehypt', 'the prince of egypt'],
    releaseYear: 1998,
  },
  {
    key: 'magnolia',
    title: 'Magnolia',
    aliases: ['magnolia'],
    releaseYear: 1999,
  },
  {
    key: 'the-mexican',
    title: 'The Mexican',
    aliases: ['the mexican'],
    releaseYear: 2001,
  },
  {
    key: 'returner',
    title: 'Returner',
    aliases: ['retruner', 'returner'],
    releaseYear: 2002,
  },
  {
    key: 'avengers-doomsday',
    title: 'Avengers: Doomsday',
    aliases: ['avengers doomsday', 'avengers: doomsday'],
    releaseYear: 2026,
  },
  {
    key: 'sheep-detectives',
    title: 'The Sheep Detectives',
    aliases: ['the sheep detecticves', 'the sheep detectives'],
    releaseYear: 2026,
  },
  {
    key: 'lee-cronin-the-mummy',
    title: 'The Mummy',
    aliases: ['le croning the mummy', 'lee cronin the mummy', 'the mummy'],
    releaseYear: 2026,
  },
  {
    key: 'the-drama',
    title: 'The Drama',
    aliases: ['the drama'],
    releaseYear: 2026,
  },
  {
    key: 'rental-family',
    title: 'Rental Family',
    aliases: ['rental family'],
    releaseYear: 2025,
  },
  {
    key: 'no-other-choice',
    title: 'No Other Choice',
    aliases: ['no other choice'],
    releaseYear: 2025,
  },
  {
    key: 'poor-things',
    title: 'Poor Things',
    aliases: ['poor things'],
    releaseYear: 2023,
  },
  {
    key: 'nope',
    title: 'Nope',
    aliases: ['nope'],
    releaseYear: 2022,
  },
  {
    key: 'allied',
    title: 'Allied',
    aliases: ['allied'],
    releaseYear: 2016,
  },
  {
    key: 'vicky-cristina-barcelona',
    title: 'Vicky Cristina Barcelona',
    aliases: ['vicky cristina barcelona'],
    releaseYear: 2008,
  },
  {
    key: 'assassination-jesse-james',
    title: 'The Assassination of Jesse James by the Coward Robert Ford',
    aliases: [
      'the assasination of jesse james by cowerd robert',
      'the assassination of jesse james by the coward robert ford',
    ],
    releaseYear: 2007,
  },
];

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type MediaRow = {
  media_id: string;
  media_type: string;
  title: string;
  original_title: string | null;
  release_year: number | null;
  watch_status: string;
};

function findExisting(seed: Seed, rows: MediaRow[]) {
  const accepted = new Set(
    [seed.title, ...seed.aliases].map(normalize).filter(Boolean),
  );

  const matches = rows.filter(
    (row) =>
      row.media_type === 'MOVIE' &&
      (
        accepted.has(normalize(row.title)) ||
        accepted.has(normalize(row.original_title))
      ),
  );

  if (matches.length <= 1) return matches[0] ?? null;

  if (seed.releaseYear !== null) {
    return (
      matches.find((row) => Number(row.release_year) === seed.releaseYear) ??
      matches[0] ??
      null
    );
  }

  return matches[0] ?? null;
}

export async function restoreProfileWatchlistOnce(
  database: SQLiteDatabase,
) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY NOT NULL,
      setting_value TEXT NOT NULL
    );
  `);

  const marker = await database.getFirstAsync<{ setting_value: string }>(
    `SELECT setting_value
       FROM app_settings
      WHERE setting_key='profile_watchlist_rescue_v1_done'
      LIMIT 1`,
  );

  if (marker?.setting_value === 'done') {
    return { alreadyDone: true, total: seeds.length, inserted: 0, matched: 0 };
  }

  const rows = await database.getAllAsync<MediaRow>(
    `SELECT media_id, media_type, title, original_title, release_year, watch_status
       FROM media_items`,
  );

  let inserted = 0;
  let matched = 0;

  await database.execAsync('BEGIN IMMEDIATE;');

  try {
    for (const seed of seeds) {
      const existing = findExisting(seed, rows);
      const now = new Date().toISOString();

      if (existing) {
        matched += 1;

        // Never destroy real watch history.
        if (existing.watch_status === 'WATCHLIST') {
          await database.runAsync(
            `UPDATE media_items
                SET release_year=COALESCE(release_year, ?),
                    modified_at=?
              WHERE media_id=?`,
            seed.releaseYear,
            now,
            existing.media_id,
          );
        }

        continue;
      }

      const id = `profile-watchlist-${seed.key}`;

      await database.runAsync(
        `INSERT INTO media_items (
           media_id, media_type, tmdb_id,
           title, original_title, overview,
           poster_path, backdrop_path, release_year,
           watch_status, progress, enjoyment,
           favourite, started_on, completed_on,
           created_at, modified_at
         )
         VALUES (?, 'MOVIE', NULL, ?, ?, NULL, NULL, NULL, ?,
                 'WATCHLIST', 0, NULL, 0, NULL, NULL, ?, ?)`,
        id,
        seed.title,
        seed.title,
        seed.releaseYear,
        now,
        now,
      );

      rows.push({
        media_id: id,
        media_type: 'MOVIE',
        title: seed.title,
        original_title: seed.title,
        release_year: seed.releaseYear,
        watch_status: 'WATCHLIST',
      });

      inserted += 1;
    }

    await database.runAsync(
      `INSERT INTO app_settings(setting_key, setting_value)
       VALUES ('profile_watchlist_rescue_v1_done', 'done')
       ON CONFLICT(setting_key)
       DO UPDATE SET setting_value='done'`,
    );

    await database.execAsync('COMMIT;');
  } catch (error) {
    try {
      await database.execAsync('ROLLBACK;');
    } catch {
      // Preserve original error.
    }
    throw error;
  }

  const result = {
    alreadyDone: false,
    total: seeds.length,
    inserted,
    matched,
  };

  console.log('[profileWatchlistRescueV1]', result);
  return result;
}
'@

$originalDb = Get-Content $dbPath -Raw
$patchedDb = $originalDb

$importLine = "import { restoreProfileWatchlistOnce } from './profileWatchlistRescue';"
if (-not $patchedDb.Contains($importLine)) {
  $imports = [regex]::Matches(
    $patchedDb,
    "(?m)^import[^\r\n]+from\s+['""][^'""]+['""];\s*$"
  )
  if ($imports.Count -eq 0) {
    throw "SAFE STOP - no import anchor in database.ts"
  }
  $last = $imports[$imports.Count - 1]
  $at = $last.Index + $last.Length
  $patchedDb = $patchedDb.Substring(0, $at) + "`r`n$importLine" + $patchedDb.Substring($at)
}

$marker = "// profileWatchlistRescueV1"
if (-not $patchedDb.Contains($marker)) {
  $anchors = @(
    "await restoreProfileWatchHistoryOnce(database);",
    "await importGamesNotesOnce(database);",
    "await repairTvTimeOnce(database);",
    "await importTvTimeOnce(database);",
    "await migrate(database);"
  )

  $anchor = $null
  foreach ($candidate in $anchors) {
    if ($patchedDb.Contains($candidate)) {
      $anchor = $candidate
      break
    }
  }

  if (-not $anchor) {
    throw "SAFE STOP - no safe DB init anchor found"
  }

  $patchedDb = $patchedDb.Replace(
    $anchor,
    "$anchor`r`n      $marker`r`n      await restoreProfileWatchlistOnce(database);"
  )
}

Set-Content $rescuePath $module -Encoding UTF8
Set-Content $dbPath $patchedDb -Encoding UTF8

Push-Location $mobile
try {
  & npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) {
    throw "TypeScript check failed"
  }
}
catch {
  Set-Content $dbPath $originalDb -Encoding UTF8
  Remove-Item $rescuePath -ErrorAction SilentlyContinue
  throw
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "WATCHLIST RESCUE INSTALLED"
Write-Host "20 recovered Plan to Watch movies"
Write-Host "Restart the app once."
