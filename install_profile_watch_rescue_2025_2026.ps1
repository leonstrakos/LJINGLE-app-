param(
  [string]$RepoRoot = "C:\Users\Korisnik\Desktop\TRACKING APP"
)

$ErrorActionPreference = "Stop"

$mobile = Join-Path $RepoRoot "mobile"
$dbPath = Join-Path $mobile "src\storage\database.ts"
$rescuePath = Join-Path $mobile "src\storage\profileWatchRescue.ts"

if (-not (Test-Path $dbPath)) {
  throw "SAFE STOP - database.ts not found: $dbPath"
}

$originalDb = Get-Content $dbPath -Raw
$patchedDb = $originalDb

$importLine = "import { restoreProfileWatchHistoryOnce } from './profileWatchRescue';"

if (-not $patchedDb.Contains($importLine)) {
  $imports = [regex]::Matches(
    $patchedDb,
    "(?m)^import[^\r\n]+from\s+['""][^'""]+['""];\s*$"
  )

  if ($imports.Count -eq 0) {
    throw "SAFE STOP - no import anchor found in database.ts"
  }

  $lastImport = $imports[$imports.Count - 1]
  $insertAt = $lastImport.Index + $lastImport.Length
  $patchedDb =
    $patchedDb.Substring(0, $insertAt) +
    "`r`n$importLine" +
    $patchedDb.Substring($insertAt)
}

$callMarker = "// profileWatchRescueV1"
$callBlock = "$callMarker`r`n      await restoreProfileWatchHistoryOnce(database);"

if (-not $patchedDb.Contains($callMarker)) {
  $anchors = @(
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
    throw "SAFE STOP - no safe database initialization anchor found"
  }

  $patchedDb = $patchedDb.Replace(
    $anchor,
    "$anchor`r`n      $callBlock"
  )
}

# Keep all writes until validation has passed.
$rescueText = @'
import type { SQLiteDatabase } from 'expo-sqlite';

// profileWatchRescueV1
//
// Source: recovered TV Time/profile screenshots after the 2025-12-17 backup cutoff.
// Exact completed_on is written only for titles known to have been watched on the
// Croatian theatrical release day. Everything else keeps year/order precision only.

type RescuePrecision = 'DAY' | 'YEAR';
type RescueMediaType = 'MOVIE' | 'SERIES';

type RescueSeed = {
  key: string;
  mediaType: RescueMediaType;
  title: string;
  aliases: string[];
  releaseYear: number | null;
  watchedYear: number;
  watchedDate: string | null;
  precision: RescuePrecision;
  sourceOrder: number;
  sourceSection: string;
};

type MediaRow = {
  media_id: string;
  media_type: string;
  title: string;
  original_title: string | null;
  release_year: number | null;
  watch_status: string;
  progress: number;
  completed_on: string | null;
};

const MARKER_KEY = 'profile_watch_rescue_v1_done';

const seeds: RescueSeed[] = [
  {
    key: "late2025-bedtime-stories",
    mediaType: 'MOVIE',
    title: "Bedtime Stories",
    aliases: ["bedtime stories"],
    releaseYear: 2008,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-walk-of-shame",
    mediaType: 'MOVIE',
    title: "Walk of Shame",
    aliases: ["walk of shame"],
    releaseYear: 2014,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-frankenstein-del-toro",
    mediaType: 'MOVIE',
    title: "Frankenstein",
    aliases: ["frankenstein (guillermo del toro)", "frankenstein (guillern odel toro)"],
    releaseYear: 2025,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 3,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-my-best-friend-is-a-vampire",
    mediaType: 'MOVIE',
    title: "My Best Friend Is a Vampire",
    aliases: ["my best friend is a vampire"],
    releaseYear: 1987,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 4,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-fantastic-four-first-steps",
    mediaType: 'MOVIE',
    title: "The Fantastic Four: First Steps",
    aliases: ["fantastic 4", "fantastic four", "the fantastic four first steps"],
    releaseYear: 2025,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 5,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-the-surfer",
    mediaType: 'MOVIE',
    title: "The Surfer",
    aliases: ["the surfer"],
    releaseYear: 2025,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 6,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-roofman",
    mediaType: 'MOVIE',
    title: "Roofman",
    aliases: ["roofman"],
    releaseYear: 2025,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 7,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-good-fortune",
    mediaType: 'MOVIE',
    title: "Good Fortune",
    aliases: ["good fortune"],
    releaseYear: 2025,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 8,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-great-expectations",
    mediaType: 'MOVIE',
    title: "Great Expectations",
    aliases: ["great expectations"],
    releaseYear: null,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 9,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-womb",
    mediaType: 'MOVIE',
    title: "Womb",
    aliases: ["womb"],
    releaseYear: 2010,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 10,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-wake-up-dead-man",
    mediaType: 'MOVIE',
    title: "Wake Up Dead Man: A Knives Out Mystery",
    aliases: ["wake up dead man knives out", "wake up dead man"],
    releaseYear: 2025,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 11,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "late2025-bugonia",
    mediaType: 'MOVIE',
    title: "Bugonia",
    aliases: ["bugonia"],
    releaseYear: 2025,
    watchedYear: 2025,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 12,
    sourceSection: 'PROFILE_AFTER_BACKUP_2025',
  },
  {
    key: "movie2026-the-majestic",
    mediaType: 'MOVIE',
    title: "The Majestic",
    aliases: ["the majestic"],
    releaseYear: 2001,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1001,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-lassie",
    mediaType: 'MOVIE',
    title: "Lassie",
    aliases: ["lassie"],
    releaseYear: null,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1002,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-eternity",
    mediaType: 'MOVIE',
    title: "Eternity",
    aliases: ["eternity"],
    releaseYear: 2025,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1003,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-uptown-girls",
    mediaType: 'MOVIE',
    title: "Uptown Girls",
    aliases: ["uptown girls"],
    releaseYear: 2003,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1004,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-zootopia",
    mediaType: 'MOVIE',
    title: "Zootopia",
    aliases: ["zootopia"],
    releaseYear: 2016,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1005,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-scent-of-a-woman",
    mediaType: 'MOVIE',
    title: "Scent of a Woman",
    aliases: ["scent of a woman"],
    releaseYear: 1992,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1006,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-agent-cody-banks",
    mediaType: 'MOVIE',
    title: "Agent Cody Banks",
    aliases: ["agent cody banks"],
    releaseYear: 2003,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1007,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-class",
    mediaType: 'MOVIE',
    title: "Class",
    aliases: ["class"],
    releaseYear: null,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1008,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-marty-supreme",
    mediaType: 'MOVIE',
    title: "Marty Supreme",
    aliases: ["marty supreme", "marty veličanstveni", "marty velicanstveni"],
    releaseYear: 2025,
    watchedYear: 2026,
    watchedDate: "2026-01-01",
    precision: 'DAY',
    sourceOrder: 1009,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-zootopia-2",
    mediaType: 'MOVIE',
    title: "Zootopia 2",
    aliases: ["zootopia 2"],
    releaseYear: 2025,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1010,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-the-princess-bride",
    mediaType: 'MOVIE',
    title: "The Princess Bride",
    aliases: ["the princess bride"],
    releaseYear: 1987,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1011,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-jerry-maguire",
    mediaType: 'MOVIE',
    title: "Jerry Maguire",
    aliases: ["jerry maguire"],
    releaseYear: 1996,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1012,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-henry-sugar",
    mediaType: 'MOVIE',
    title: "The Wonderful Story of Henry Sugar",
    aliases: ["the wonderful story of henry sugar"],
    releaseYear: 2023,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1013,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-swing-kids",
    mediaType: 'MOVIE',
    title: "Swing Kids",
    aliases: ["swing kids"],
    releaseYear: 1993,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1014,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-man-on-the-moon",
    mediaType: 'MOVIE',
    title: "Man on the Moon",
    aliases: ["man on the moon"],
    releaseYear: 1999,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1015,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-armageddon",
    mediaType: 'MOVIE',
    title: "Armageddon",
    aliases: ["armageddon"],
    releaseYear: 1998,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1016,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-shes-out-of-my-league",
    mediaType: 'MOVIE',
    title: "She's Out of My League",
    aliases: ["she's out of my league", "shes out of my league"],
    releaseYear: 2010,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1017,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-heartbreakers",
    mediaType: 'MOVIE',
    title: "Heartbreakers",
    aliases: ["heart breakers", "hert breakers", "heartbreakers"],
    releaseYear: 2001,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1018,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-boogie-nights",
    mediaType: 'MOVIE',
    title: "Boogie Nights",
    aliases: ["boogie nights"],
    releaseYear: 1997,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1019,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-dazed-and-confused",
    mediaType: 'MOVIE',
    title: "Dazed and Confused",
    aliases: ["dazed and confuzed", "dazed and confused"],
    releaseYear: 1993,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1020,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-devil-wears-prada",
    mediaType: 'MOVIE',
    title: "The Devil Wears Prada",
    aliases: ["the devil wears prada"],
    releaseYear: 2006,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1021,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-crocodile-dundee",
    mediaType: 'MOVIE',
    title: "Crocodile Dundee",
    aliases: ["crocodile dundee"],
    releaseYear: 1986,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1022,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-the-housemaid",
    mediaType: 'MOVIE',
    title: "The Housemaid",
    aliases: ["the housemaid", "kućna pomoćnica", "kucna pomocnica"],
    releaseYear: 2025,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1023,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-shaun-of-the-dead",
    mediaType: 'MOVIE',
    title: "Shaun of the Dead",
    aliases: ["shawn of the dead", "shaun of the dead"],
    releaseYear: 2004,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1024,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-wuthering-heights-2026",
    mediaType: 'MOVIE',
    title: "Wuthering Heights",
    aliases: ["wuthering heights", "wuthering heights (2026)", "orkanski visovi"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-02-12",
    precision: 'DAY',
    sourceOrder: 1025,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-knight-and-day",
    mediaType: 'MOVIE',
    title: "Knight and Day",
    aliases: ["knight and day"],
    releaseYear: 2010,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1026,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-tag",
    mediaType: 'MOVIE',
    title: "Tag",
    aliases: ["tag"],
    releaseYear: 2018,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1027,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-rango",
    mediaType: 'MOVIE',
    title: "Rango",
    aliases: ["rango"],
    releaseYear: 2011,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1028,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-the-life-of-chuck",
    mediaType: 'MOVIE',
    title: "The Life of Chuck",
    aliases: ["the life of chuck"],
    releaseYear: 2025,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1029,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-queen-of-chess",
    mediaType: 'MOVIE',
    title: "Queen of Chess",
    aliases: ["queen of chess"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1030,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-central-intelligence",
    mediaType: 'MOVIE',
    title: "Central Intelligence",
    aliases: ["central intelligence"],
    releaseYear: 2016,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1031,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-sisterhood-traveling-pants",
    mediaType: 'MOVIE',
    title: "The Sisterhood of the Traveling Pants",
    aliases: ["the sisterhood of travelling pants", "the sisterhood of the traveling pants"],
    releaseYear: 2005,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1032,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-crocodile-dundee-ii",
    mediaType: 'MOVIE',
    title: "Crocodile Dundee II",
    aliases: ["crocodile dundee ii", "crocodile dundee 2"],
    releaseYear: 1988,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1033,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-hoppers",
    mediaType: 'MOVIE',
    title: "Hoppers",
    aliases: ["hoopers", "hoppers", "skakutavci"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-03-05",
    precision: 'DAY',
    sourceOrder: 1034,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-project-hail-mary",
    mediaType: 'MOVIE',
    title: "Project Hail Mary",
    aliases: ["hail mary", "project hail mary", "projekt spasitelj"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-03-19",
    precision: 'DAY',
    sourceOrder: 1035,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-lotr-fellowship",
    mediaType: 'MOVIE',
    title: "The Lord of the Rings: The Fellowship of the Ring",
    aliases: ["the lord of the rings the fellowship of the ring"],
    releaseYear: 2001,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1036,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-lotr-two-towers",
    mediaType: 'MOVIE',
    title: "The Lord of the Rings: The Two Towers",
    aliases: ["the lord of the rings the two towers"],
    releaseYear: 2002,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1037,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-lotr-return-king",
    mediaType: 'MOVIE',
    title: "The Lord of the Rings: The Return of the King",
    aliases: ["the lord of the rings the return of the king"],
    releaseYear: 2003,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1038,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-dark-shadows",
    mediaType: 'MOVIE',
    title: "Dark Shadows",
    aliases: ["dark shadows"],
    releaseYear: 2012,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1039,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-pizza-movie",
    mediaType: 'MOVIE',
    title: "Pizza Movie",
    aliases: ["pizza movie"],
    releaseYear: null,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1040,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-good-luck-have-fun-dont-die",
    mediaType: 'MOVIE',
    title: "Good Luck, Have Fun, Don't Die",
    aliases: ["good luck have fun don't die", "good luck, have fun, don't die", "sretno zabavi se nemoj umrijeti"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1041,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-ready-or-not-2",
    mediaType: 'MOVIE',
    title: "Ready or Not 2: Here I Come",
    aliases: ["ready or not 2 here i come", "ready or not 2: here i come", "igra skrivača 2 duplo ili ništa", "igra skrivaca 2 duplo ili nista"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-03-26",
    precision: 'DAY',
    sourceOrder: 1042,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-super-mario-galaxy",
    mediaType: 'MOVIE',
    title: "The Super Mario Galaxy Movie",
    aliases: ["super mario galaxy", "the super mario galaxy movie"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-04-02",
    precision: 'DAY',
    sourceOrder: 1043,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-whiplash",
    mediaType: 'MOVIE',
    title: "Whiplash",
    aliases: ["whiplash"],
    releaseYear: 2014,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1044,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-george-of-the-jungle",
    mediaType: 'MOVIE',
    title: "George of the Jungle",
    aliases: ["george of the jungle"],
    releaseYear: 1997,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 1045,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-devil-wears-prada-2",
    mediaType: 'MOVIE',
    title: "The Devil Wears Prada 2",
    aliases: ["devil wears prada 2", "the devil wears prada 2", "vrag nosi pradu 2"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-04-30",
    precision: 'DAY',
    sourceOrder: 1046,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-toy-story-5",
    mediaType: 'MOVIE',
    title: "Toy Story 5",
    aliases: ["toy story 5", "priča o igračkama 5", "prica o igrackama 5"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-06-18",
    precision: 'DAY',
    sourceOrder: 1047,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "movie2026-disclosure-day",
    mediaType: 'MOVIE',
    title: "Disclosure Day",
    aliases: ["disclosure day", "dan razotkrivanja"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: "2026-06-11",
    precision: 'DAY',
    sourceOrder: 1048,
    sourceSection: 'PROFILE_2026_MOVIES',
  },
  {
    key: "show2026-call-of-the-night",
    mediaType: 'SERIES',
    title: "Call of the Night",
    aliases: ["call of the night"],
    releaseYear: 2022,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2001,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-dating-naked-uk",
    mediaType: 'SERIES',
    title: "Dating Naked UK",
    aliases: ["dating naked uk"],
    releaseYear: 2024,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2002,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-love-death-robots",
    mediaType: 'SERIES',
    title: "Love, Death & Robots",
    aliases: ["love death robots", "love, death & robots"],
    releaseYear: 2019,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2003,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-squid-game",
    mediaType: 'SERIES',
    title: "Squid Game",
    aliases: ["squid game"],
    releaseYear: 2021,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2004,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-rick-and-morty",
    mediaType: 'SERIES',
    title: "Rick and Morty",
    aliases: ["rick and morty"],
    releaseYear: 2013,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2005,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-lois-and-clark",
    mediaType: 'SERIES',
    title: "Lois & Clark: The New Adventures of Superman",
    aliases: ["lois & clark: the new adventures of superman", "lois and clark the new adventures of superman"],
    releaseYear: 1993,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2006,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-alien-earth",
    mediaType: 'SERIES',
    title: "Alien: Earth",
    aliases: ["alien earth", "alien: earth"],
    releaseYear: 2025,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2007,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-upload",
    mediaType: 'SERIES',
    title: "Upload",
    aliases: ["upload"],
    releaseYear: 2020,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2008,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-doctor-who",
    mediaType: 'SERIES',
    title: "Doctor Who",
    aliases: ["doctor who"],
    releaseYear: null,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2009,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-dexter",
    mediaType: 'SERIES',
    title: "Dexter",
    aliases: ["dexter"],
    releaseYear: 2006,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2010,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-dr-stone",
    mediaType: 'SERIES',
    title: "Dr. Stone",
    aliases: ["dr. stone", "dr stone"],
    releaseYear: 2019,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2011,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-alice-in-borderland",
    mediaType: 'SERIES',
    title: "Alice in Borderland",
    aliases: ["alice in the borderland", "alice in borderland"],
    releaseYear: 2020,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2012,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-green-eggs-and-ham",
    mediaType: 'SERIES',
    title: "Green Eggs and Ham",
    aliases: ["gren eggs and ham", "green eggs and ham"],
    releaseYear: 2019,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2013,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-stranger-things",
    mediaType: 'SERIES',
    title: "Stranger Things",
    aliases: ["stranger things"],
    releaseYear: 2016,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2014,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-one-punch-man",
    mediaType: 'SERIES',
    title: "One Punch Man",
    aliases: ["one punch man"],
    releaseYear: 2015,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2015,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-malcolm-in-the-middle",
    mediaType: 'SERIES',
    title: "Malcolm in the Middle",
    aliases: ["malcolm in the middle"],
    releaseYear: 2000,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2016,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-ted",
    mediaType: 'SERIES',
    title: "Ted",
    aliases: ["ted"],
    releaseYear: 2024,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2017,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-malcolm-lifes-still-unfair",
    mediaType: 'SERIES',
    title: "Malcolm in the Middle: Life's Still Unfair",
    aliases: ["malcolm in the middle life's still unfair", "malcolm in the middle: life's still unfair"],
    releaseYear: 2026,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2018,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-invincible",
    mediaType: 'SERIES',
    title: "Invincible",
    aliases: ["invincible"],
    releaseYear: 2021,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2019,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
  {
    key: "show2026-the-boys",
    mediaType: 'SERIES',
    title: "The Boys",
    aliases: ["the boys"],
    releaseYear: 2019,
    watchedYear: 2026,
    watchedDate: null,
    precision: 'YEAR',
    sourceOrder: 2020,
    sourceSection: 'PROFILE_2026_SHOWS',
  },
];

function normalizeTitle(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidateFor(seed: RescueSeed, rows: MediaRow[]) {
  const accepted = new Set(
    [seed.title, ...seed.aliases].map(normalizeTitle).filter(Boolean),
  );

  const matches = rows.filter((row) => {
    if (row.media_type !== seed.mediaType) return false;
    return (
      accepted.has(normalizeTitle(row.title)) ||
      accepted.has(normalizeTitle(row.original_title))
    );
  });

  if (matches.length <= 1) return matches[0] ?? null;

  if (seed.releaseYear !== null) {
    const exactYear = matches.find(
      (row) => Number(row.release_year) === seed.releaseYear,
    );
    if (exactYear) return exactYear;
  }

  return matches[0] ?? null;
}

async function tableExists(database: SQLiteDatabase, name: string) {
  const row = await database.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
    name,
  );
  return Boolean(row?.name);
}

function syntheticMediaId(seed: RescueSeed) {
  return `profile-rescue-${seed.key}`;
}

export type ProfileWatchRescueResult = {
  alreadyDone: boolean;
  total: number;
  inserted: number;
  updated: number;
  exactDates: number;
  movies: number;
  series: number;
};

export async function restoreProfileWatchHistoryOnce(
  database: SQLiteDatabase,
): Promise<ProfileWatchRescueResult> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY NOT NULL,
      setting_value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_watch_recovery (
      source_key TEXT PRIMARY KEY NOT NULL,
      media_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      source_section TEXT NOT NULL,
      source_order INTEGER NOT NULL,
      watched_year INTEGER NOT NULL,
      watched_date TEXT,
      date_precision TEXT NOT NULL,
      source_note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_profile_watch_recovery_order
      ON profile_watch_recovery(watched_year, source_order);
  `);

  const marker = await database.getFirstAsync<{ setting_value: string }>(
    `SELECT setting_value FROM app_settings WHERE setting_key=? LIMIT 1`,
    MARKER_KEY,
  );

  if (marker?.setting_value === 'done') {
    return {
      alreadyDone: true,
      total: seeds.length,
      inserted: 0,
      updated: 0,
      exactDates: seeds.filter((seed) => seed.precision === 'DAY').length,
      movies: seeds.filter((seed) => seed.mediaType === 'MOVIE').length,
      series: seeds.filter((seed) => seed.mediaType === 'SERIES').length,
    };
  }

  const hasExternalFlags = await tableExists(database, 'external_media_flags');

  const rows = await database.getAllAsync<MediaRow>(
    `SELECT
       media_id, media_type, title, original_title, release_year,
       watch_status, progress, completed_on
     FROM media_items`,
  );

  let inserted = 0;
  let updated = 0;

  await database.execAsync('BEGIN IMMEDIATE;');

  try {
    for (const seed of seeds) {
      const existing = candidateFor(seed, rows);
      const now = new Date().toISOString();
      let mediaId: string;

      if (existing) {
        mediaId = existing.media_id;

        if (seed.mediaType === 'MOVIE') {
          await database.runAsync(
            `UPDATE media_items
                SET watch_status='COMPLETED',
                    progress=100,
                    completed_on=CASE
                      WHEN completed_on IS NOT NULL THEN completed_on
                      WHEN ? IS NOT NULL THEN ?
                      ELSE NULL
                    END,
                    release_year=COALESCE(release_year, ?),
                    modified_at=?
              WHERE media_id=?`,
            seed.watchedDate,
            seed.watchedDate,
            seed.releaseYear,
            now,
            mediaId,
          );
        } else {
          await database.runAsync(
            `UPDATE media_items
                SET watch_status=CASE
                      WHEN watch_status='WATCHLIST' THEN 'WATCHING'
                      ELSE watch_status
                    END,
                    release_year=COALESCE(release_year, ?),
                    modified_at=?
              WHERE media_id=?`,
            seed.releaseYear,
            now,
            mediaId,
          );
        }

        updated += 1;
      } else {
        mediaId = syntheticMediaId(seed);
        const movie = seed.mediaType === 'MOVIE';

        await database.runAsync(
          `INSERT INTO media_items (
             media_id, media_type, tmdb_id,
             title, original_title, overview,
             poster_path, backdrop_path, release_year,
             watch_status, progress, enjoyment,
             favourite, started_on, completed_on,
             created_at, modified_at
           )
           VALUES (?, ?, NULL, ?, ?, NULL, NULL, NULL, ?,
                   ?, ?, NULL, 0, NULL, ?, ?, ?)`,
          mediaId,
          seed.mediaType,
          seed.title,
          seed.title,
          seed.releaseYear,
          movie ? 'COMPLETED' : 'WATCHING',
          movie ? 100 : 0,
          movie ? seed.watchedDate : null,
          now,
          now,
        );

        rows.push({
          media_id: mediaId,
          media_type: seed.mediaType,
          title: seed.title,
          original_title: seed.title,
          release_year: seed.releaseYear,
          watch_status: movie ? 'COMPLETED' : 'WATCHING',
          progress: movie ? 100 : 0,
          completed_on: movie ? seed.watchedDate : null,
        });

        inserted += 1;
      }

      if (hasExternalFlags) {
        await database.runAsync(
          `DELETE FROM external_media_flags
            WHERE media_id=?
              AND source='TV_TIME'
              AND flag='NEBITNO'`,
          mediaId,
        );
      }

      await database.runAsync(
        `INSERT INTO profile_watch_recovery (
           source_key, media_id, media_type, source_section, source_order,
           watched_year, watched_date, date_precision, source_note, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_key) DO UPDATE SET
           media_id=excluded.media_id,
           media_type=excluded.media_type,
           source_section=excluded.source_section,
           source_order=excluded.source_order,
           watched_year=excluded.watched_year,
           watched_date=excluded.watched_date,
           date_precision=excluded.date_precision,
           source_note=excluded.source_note`,
        seed.key,
        mediaId,
        seed.mediaType,
        seed.sourceSection,
        seed.sourceOrder,
        seed.watchedYear,
        seed.watchedDate,
        seed.precision,
        seed.precision === 'DAY'
          ? 'Exact day recovered from Croatian release-day rule.'
          : 'Year/order recovered from profile screenshot; exact day intentionally unknown.',
        now,
      );
    }

    await database.runAsync(
      `INSERT INTO app_settings(setting_key, setting_value)
       VALUES (?, 'done')
       ON CONFLICT(setting_key)
       DO UPDATE SET setting_value='done'`,
      MARKER_KEY,
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
    updated,
    exactDates: seeds.filter((seed) => seed.precision === 'DAY').length,
    movies: seeds.filter((seed) => seed.mediaType === 'MOVIE').length,
    series: seeds.filter((seed) => seed.mediaType === 'SERIES').length,
  };

  console.log('[profileWatchRescueV1]', result);
  return result;
}

'@

Set-Content $rescuePath $rescueText -Encoding UTF8
Set-Content $dbPath $patchedDb -Encoding UTF8

Push-Location $mobile
try {
  Write-Host "Checking TypeScript..."
  & npx tsc --noEmit

  if ($LASTEXITCODE -ne 0) {
    throw "TypeScript check failed"
  }
}
catch {
  Write-Host "ROLLBACK - restoring database.ts and removing rescue module."
  Set-Content $dbPath $originalDb -Encoding UTF8
  Remove-Item $rescuePath -ErrorAction SilentlyContinue
  throw
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "PROFILE WATCH RESCUE INSTALLED"
Write-Host "60 movies + 20 series"
Write-Host "9 exact Croatian release-day movie dates"
Write-Host "All other dates preserve YEAR/ORDER only"
Write-Host ""
Write-Host "Now fully restart the app once."
Write-Host "The database import is idempotent and runs once on database initialization."
