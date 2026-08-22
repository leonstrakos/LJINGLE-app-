# Book metadata/import API contract

Base path: `/api/book-metadata`

Providers: `OPEN_LIBRARY`, `GOOGLE_BOOKS`.

Google Books credentials remain on the backend. Configure `GOOGLE_BOOKS_API_KEY`; the mobile client never receives or sends it.

## Search

`GET /api/book-metadata/search?q=Dune&provider=GOOGLE_BOOKS&limit=20`

- `q`: required, 2–200 characters.
- `provider`: optional. Omit it to search and reconcile both providers.
- `limit`: optional, 1–40, default 20.

Response:

```json
{
  "query": "Dune",
  "results": [
    {
      "title": "Dune",
      "authors": ["Frank Herbert"],
      "isbn10": "0441172717",
      "isbn13": "9780441172719",
      "publishedYear": 1965,
      "publisher": "Ace",
      "pageCount": 412,
      "description": "...",
      "coverUrl": "https://...",
      "sources": [
        {"provider": "OPEN_LIBRARY", "externalId": "OL893415W"},
        {"provider": "GOOGLE_BOOKS", "externalId": "volume-id"}
      ]
    }
  ],
  "warnings": []
}
```

Results with a shared normalized ISBN are reconciled into one candidate. Title+author reconciliation is used only when at least one result has no ISBN, so different editions with different ISBNs remain distinct.

## ISBN lookup and catalogue deduplication

`GET /api/book-metadata/isbn/9780441172719`

Hyphens and spaces are ignored. The response contains the reconciled external candidate and any existing catalogue duplicates found by normalized ISBN or normalized title+author.

```json
{
  "isbn": "9780441172719",
  "candidate": {},
  "duplicates": [
    {
      "bookId": "...",
      "title": "Dina",
      "author": "Frank Herbert",
      "isbn": "978-0-441-17271-9",
      "reason": "ISBN"
    }
  ],
  "warnings": []
}
```

## Explicit source reconciliation

`POST /api/book-metadata/reconcile`

```json
{
  "sources": [
    {"provider": "OPEN_LIBRARY", "externalId": "OL893415W"},
    {"provider": "GOOGLE_BOOKS", "externalId": "volume-id"}
  ]
}
```

Accepts one to five sources. Returns one canonical candidate or `400` if the sources do not describe the same book.

## Import preview (no write)

`POST /api/book-metadata/imports/preview`

```json
{
  "source": {"provider": "GOOGLE_BOOKS", "externalId": "volume-id"},
  "targetBookId": null
}
```

`targetBookId` is optional. Use it only when the user explicitly selected an existing catalogue record.

The response action is one of:

- `CREATE`: no duplicate exists; confirmation creates a new `LATER` book.
- `UPDATE_EXISTING`: bibliographic fields differ; explicit confirmation is required.
- `ALREADY_IMPORTED`: the existing bibliographic fields already match.
- `BLOCKED`: required metadata is missing or the duplicate is ambiguous.

The preview includes `changedBibliographicFields`, `protectedPersonalFields`, duplicates, warnings, and `confirmationRequired`.

## Confirm import (write)

`POST /api/book-metadata/imports/confirm`

```json
{
  "source": {"provider": "GOOGLE_BOOKS", "externalId": "volume-id"},
  "targetBookId": "existing-book-id",
  "confirmMetadataUpdate": true
}
```

- Returns `201` for `CREATE` and `200` for an existing record.
- `confirmMetadataUpdate: true` is mandatory for `UPDATE_EXISTING`.
- The server resolves the provider item and reruns deduplication at confirmation time; it does not trust preview metadata sent back by the client.
- The request cannot contain personal fields.

Only `title`, `author`, `isbn`, and `publishedYear` can be written by this module. It never changes `readingStatus`, `progress`, `enjoyment`, `favourite`, `startedOn`, `finishedOn`, activities, or time-session history.

## Mobile integration

The isolated entry screen is `mobile/src/screens/BookMetadataImportScreen.tsx`. Add it to the app navigator in the integration branch and optionally pass `onImported` to refresh the existing book list. This fork intentionally does not edit `App.tsx` or navigation types.

## Migration decision

No V10 migration is included. Existing book columns are sufficient, and provider IDs are kept as external request references rather than persisted catalogue identity.
