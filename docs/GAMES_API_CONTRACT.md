# Games API contract

Base path: `/api/games`.

## Domain values

- `gameStatus`: `BACKLOG`, `PLAYING`, `COMPLETED`, `DROPPED`
- `enjoyment`: `ENJOYED`, `OKAY`, `REGRET`, or `null`
- `progress`: integer from `0` to `100`
- dates use `YYYY-MM-DD`; `finishedOn` cannot precede `startedOn`

IGDB or the public Steam Store fallback supplies metadata only. Personal state and time
history remain in the local catalogue.

## Local catalogue

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/games` | List games ordered by title |
| `GET` | `/api/games?status=PLAYING` | Filter by personal status |
| `GET` | `/api/games/{gameId}` | Get one game |
| `POST` | `/api/games` | Create a game and reusable playing activity |
| `PUT` | `/api/games/{gameId}` | Update editable fields and activity label |
| `DELETE` | `/api/games/{gameId}` | Stop its timer and remove the catalogue row |

```json
{
  "title": "Disco Elysium",
  "developer": "ZA/UM",
  "platform": "PC",
  "releaseYear": 2019,
  "gameStatus": "PLAYING",
  "progress": 38,
  "enjoyment": "ENJOYED",
  "favourite": true,
  "startedOn": "2026-08-01",
  "finishedOn": null,
  "igdbId": 26192,
  "coverUrl": "https://images.igdb.com/igdb/image/upload/t_cover_big/example.jpg"
}
```

`title` and `platform` are required. Deleting a game preserves its activity and completed
time-session history.

## Playing timer

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/games/{gameId}/timer` | Get persisted timer state and total playtime |
| `POST` | `/api/games/{gameId}/timer/start` | Start idempotently |
| `POST` | `/api/games/{gameId}/timer/stop` | Stop and persist the current session |

The activity also appears in `GET /api/activities/active`; its sessions remain available
from `GET /api/activities/{activityId}/sessions`.

## Online metadata proxy

`GET /api/games/metadata/search?query=Outer%20Wilds`

`IGDB_CLIENT_ID` and `IGDB_ACCESS_TOKEN` are optional backend settings. Without them,
the same endpoint automatically searches the public Steam Store API without a key.
If IGDB is configured but temporarily unavailable, Steam is used as a fallback.
