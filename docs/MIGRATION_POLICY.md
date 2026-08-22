# Flyway migration policy

The Tracking App schema belongs only to PostgreSQL database `life_catalogue_v2`.
It must never point to the Bell project's database.

1. Once a migration is applied or distributed, its filename and contents are immutable.
2. Every schema change receives the next unused version number.
3. Never resolve a checksum mismatch by editing an old migration or running
   `flyway repair` without first proving the database history is incorrect.
4. Before packaging, compare V1–V7 with the frozen checksum manifest below.
5. API credentials are backend environment variables and never belong in migrations,
   mobile source, `.env` files included in ZIPs, or seed data.

## Frozen baseline checksums

```text
ae4be5a52f4b9c162176268f67d90060c9b2da3775991818bb90617c0b1d9c49  V1__create_books_table.sql
92ef9ce9eb64bda885f786cebd0fee281f64485a34c52b566037383eb420ac14  V2__seed_books.sql
49f8084959b7e7c997d7316051c09a1b2dddb3a632ca8e19203ab722c4414db2  V3__seed_catalog.sql
6e4ade21be3262de8a14d289c936b551e65b688e8bc8672d6662af1a13818  V4__create_activities_and_time_sessions.sql
b66060ff72e70c0d658900c5beacda96a47d04de963955473eebf441fa8de624  V5__add_personal_book_tracking.sql
2f0445405222a1af2de8a14d289c936b551e65b688e8bc8672d6662af1a13818  V6__create_topics_and_link_activities.sql
e79e01606f72eab1da7528dbff365043029a17a8d0fb286d6a9ec3e32f6e793b  V7__create_entries.sql
```

V8 introduces Games. V9 introduces Movies/TV and expands the activity-type constraint
with `WATCHING`. Book Metadata needs no schema migration.
