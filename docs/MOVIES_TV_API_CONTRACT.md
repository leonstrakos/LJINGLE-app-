# Movies / TV module — API contract

Base path: `/api`

## Domain values

- `mediaType`: `MOVIE` or `SERIES`
- `watchStatus`: `WATCHLIST`, `WATCHING`, `COMPLETED`, or `DROPPED`
- `enjoyment`: `ENJOYED`, `OKAY`, `REGRET`, or `null`
- `progress`: integer from `0` to `100`; `COMPLETED` requires `100`
- Dates use `YYYY-MM-DD`. `completedOn` cannot precede `startedOn`.

TMDB supplies metadata only. Personal status, progress, enjoyment, favourite,
dates, watch activities, and time sessions live exclusively in PostgreSQL.

## Local catalogue

### List

`GET /api/media`

Optional filters:

- `mediaType=MOVIE|SERIES`
- `status=WATCHLIST|WATCHING|COMPLETED|DROPPED`

Returns `MediaResponse[]`, sorted by title.

### Get one

`GET /api/media/{mediaId}`

### Create

`POST /api/media`

```json
{
  "mediaType": "MOVIE",
  "tmdbId": 550,
  "title": "Fight Club",
  "originalTitle": "Fight Club",
  "overview": "Metadata description",
  "posterPath": "/poster.jpg",
  "backdropPath": "/backdrop.jpg",
  "releaseYear": 1999,
  "watchStatus": "WATCHLIST",
  "progress": 0,
  "enjoyment": null,
  "favourite": false,
  "startedOn": null,
  "completedOn": null
}
```

Returns `201 Created`, a `Location: /api/media/{mediaId}` header, and:

```json
{
  "mediaId": "uuid",
  "mediaType": "MOVIE",
  "tmdbId": 550,
  "title": "Fight Club",
  "originalTitle": "Fight Club",
  "overview": "Metadata description",
  "posterPath": "/poster.jpg",
  "backdropPath": "/backdrop.jpg",
  "releaseYear": 1999,
  "watchStatus": "WATCHLIST",
  "progress": 0,
  "enjoyment": null,
  "favourite": false,
  "startedOn": null,
  "completedOn": null
}
```

A non-null `(mediaType, tmdbId)` pair is unique. A duplicate returns `409`.
Manual items may use `tmdbId: null`.

### Update

`PUT /api/media/{mediaId}`

Uses the complete create payload and returns `MediaResponse`.

### Delete

`DELETE /api/media/{mediaId}`

Returns `204 No Content`. An active watch session is stopped first. The media
row is removed, while its activity and time-session history remain preserved.

## Watch-time activity

- `GET /api/media/{mediaId}/watching`
- `POST /api/media/{mediaId}/watching/start`
- `POST /api/media/{mediaId}/watching/stop`

Start and stop are idempotent. Each media item owns at most one `WATCHING`
activity and at most one currently running session.

```json
{
  "activityId": "uuid-or-null",
  "label": "Film — Fight Club",
  "activityType": "WATCHING",
  "mediaId": "uuid",
  "running": true,
  "activeSessionId": "uuid-or-null",
  "activeStartedAt": "2026-08-18T18:00:00Z",
  "completedSeconds": 7200,
  "totalSeconds": 7312
}
```

The activity also appears in `GET /api/activities/active`. Session history is
available from the existing `GET /api/activities/{activityId}/sessions` route.

## Online metadata proxy

The backend can optionally read a TMDB API Read Access Token from:

```text
TMDB_API_TOKEN
```

The token is never accepted from or returned to the mobile client. When it is absent,
the endpoint automatically uses Apple's public Search API for movies and TVmaze for
series, both without a key.

### Search

`GET /api/media/tmdb/search?query=Dune&mediaType=MOVIE&page=1`

```json
{
  "page": 1,
  "totalPages": 1,
  "totalResults": 1,
  "results": [
    {
      "tmdbId": 438631,
      "mediaType": "MOVIE",
      "title": "Dune",
      "originalTitle": "Dune",
      "overview": "...",
      "posterPath": "/path.jpg",
      "posterUrl": "https://image.tmdb.org/t/p/w500/path.jpg",
      "backdropPath": "/backdrop.jpg",
      "backdropUrl": "https://image.tmdb.org/t/p/w500/backdrop.jpg",
      "releaseYear": 2021
    }
  ]
}
```

### Details

`GET /api/media/tmdb/{mediaType}/{tmdbId}`

Returns one online media result in the same shape as a search result.

If TMDB is configured but cannot be reached, Apple Search or TVmaze is used as the
appropriate fallback. A `503 Service Unavailable` response is returned only when the
public fallback is also unavailable.

## Mobile integration note

The mobile module is self-contained under `MediaNavigator`. The integration
branch only needs to:

1. Add `Media: undefined` to `RootStackParamList`.
2. Import `MediaNavigator` into `App.tsx`.
3. Add a root screen:

```tsx
<Stack.Screen
  name="Media"
  component={MediaNavigator}
  options={{ headerShown: false }}
/>
```

4. Add the desired Today/catalogue entry point with
   `navigation.navigate('Media')`.

No mobile or backend API key is required. A TMDB token can still be set as an optional
primary source in the backend terminal:

```powershell
$env:TMDB_API_TOKEN = "your-api-read-access-token"
mvn spring-boot:run
```
