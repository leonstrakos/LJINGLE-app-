# Integrated v2 module release

This build merges four isolated forks into the last complete v2 baseline.

| Module | Database | Backend | Mobile |
|---|---|---|---|
| Entries | existing V7 | existing entries API | list, filters, create, edit, delete, links |
| Games | V8 | CRUD, timers, IGDB proxy | nested Games navigator and screens |
| Movies/TV | V9 | CRUD, watch timers, TMDB proxy | nested Media navigator and screens |
| Book Metadata | no migration | search, reconciliation, preview, confirmed import | search/import screen |

## Integration-owned changes

- root navigation and Today entry points for every module;
- Book Metadata entry point from the book catalogue;
- `WATCHING` added to shared activity types and history labels;
- V9 updates the existing activity-type constraint before watch activities are stored;
- runtime database default changed to `life_catalogue_v2`;
- backend-only configuration for Google Books, IGDB and TMDB;
- consolidated README, API contracts and Postman collection;
- immutable Flyway policy and frozen V1–V7 checksums.

## Database continuity

The working local database is `life_catalogue_v2`. When this build starts against the
existing V7 schema, Flyway must apply V8 and V9 only. V1–V7 are unchanged. The next
schema migration must be V10 or later; no released migration number may be reused.

## Verification commands

```powershell
cd backend
mvn clean test
mvn spring-boot:run

cd ..\mobile
npm ci
npm run typecheck
npx expo start --web --clear
```

Expected backend startup evidence:

```text
Database: jdbc:postgresql://localhost:5432/life_catalogue_v2
Current version of schema "public": 9
Tomcat started on port 8080
```
