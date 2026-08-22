# Life Catalogue — modular development map

The application is built as a set of connected modules rather than one large media
tracker. Each module owns a distinct part of the personal record while sharing the
same catalogue, topic and time-session foundations.

## Product model

| Object | Responsibility |
|---|---|
| Catalogue item | Something that belongs to the user's world: a book, game, film, series or later a custom object |
| Activity | A reusable action that can be resumed, such as reading a book, studying French or playing chess |
| Time session | One actual interval with a start and optional end time |
| Topic | A subject that connects activities, catalogue items, notes and statistics |
| Entry | A note, quote, observation, review or progress update |
| External source | Metadata provider or import format; never the authority for personal history |

## Module sequence

### M1 — Persistent time core

Status: implemented.

- reusable activities and permanent time sessions;
- reading timer on a book detail;
- active timer recovery after reload or app closure;
- several different activities may run simultaneously;
- session history and active-timer endpoints.

### M2 — Personal catalogue state

Status: implemented.

- Later, In progress, Completed, Paused and Dropped;
- progress percentage and start/finish dates;
- Enjoyed, Okay and Regret instead of numerical scores;
- favourites;
- removal of library-loan language from the personal interface.

### M3 — Today

Status: implemented.

- active timers;
- Continue with cards;
- direct entry into the catalogue;
- daily total and per-activity breakdown.

### M4 — Topics and custom activities

Status: implemented.

- topics such as Chess, French, IIT or Heralds of the Lion;
- several action categories under one topic, for example Playing chess and Studying chess;
- custom activities that use the same session engine as reading;
- topic deletion does not erase time history.

### M5 — History and statistics

Status: first slice implemented.

- chronological, paginated session history with optional local-day filtering;
- daily totals and per-activity summaries;
- later: calendar plus weekly, monthly and all-time summaries;
- time by medium, topic and activity category;
- manual session correction with an audit trail;
- overlaps remain visible because simultaneous timers are supported.

### M6 — Notes, quotes and observations

Status: first full mobile/backend slice implemented.

- entries attached to books, topics and activities;
- entry types: note, quote, observation, review and progress update;
- mobile list, type filtering, create/edit/delete and optional catalogue links;
- later: rich-text editor, pinning, dashboard widgets and full-text search.

### M7 — Games

Status: first full mobile/backend slice implemented.

- IGDB-backed metadata search through the backend;
- Backlog, Playing, Completed and Dropped states;
- platform, progress, enjoyment, favourites and playtime;
- playing sessions connected to the same topic/time system.

### M8 — Movies and television

Status: first film/series slice implemented.

- TMDB-backed film and series metadata through the backend;
- Watchlist, Watching, Completed and Dropped states;
- progress, enjoyment, favourites and persisted watch-time activities;
- later: seasons, episodes, rewatches and episode-level history;
- TV Time backup importer with preview, deduplication and error report.

### M9 — Books metadata and imports

Status: first full mobile/backend slice implemented.

- Open Library and Google Books search;
- ISBN lookup and metadata reconciliation;
- preview, duplicate detection and explicit confirmation;
- imports never overwrite personal status, progress, enjoyment, favourites or time.

### M10 — Reliability and ownership

- export of the complete personal record;
- database backup and restore;
- authentication and per-user ownership when the single-user prototype becomes multi-user;
- privacy settings and optional local-only attachments.

## Architectural decisions

1. PostgreSQL is authoritative for personal status, progress, notes and time.
2. External APIs provide metadata only.
3. An activity describes what can be continued; a session records what actually happened.
4. Running timers store a start timestamp. The server is not updated every second.
5. Topics connect domains without flattening different actions into one number.
6. Completed sessions survive deletion or detachment of their original catalogue/topic object.
7. Imports must be previewable, repeatable and deduplicated before committing changes.
8. Applied Flyway migrations are immutable; schema changes always receive a new version.
9. Tracking App uses `life_catalogue_v2` and must never connect to the Bell database.
