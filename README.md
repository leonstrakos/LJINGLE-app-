# Tracking App

A personal catalogue, activity tracker and memory system built around one idea:

> **Keep track of what you spend your time on and preserve the history around it.**

Tracking App combines books, films, television, games, notes, activities, timers, statistics and personal memories into one private library.

It is not designed as a social network or productivity scoreboard.  
It is a personal archive of **what I watched, read, played, worked on, thought about and spent time with**.

---

## Overview

Most tracking apps isolate different parts of life:

- Letterboxd tracks films
- Goodreads tracks books
- Backloggd tracks games
- time trackers record activities
- note apps store thoughts
- journals preserve memories

Tracking App brings those ideas together into one interconnected system.

The catalogue provides the objects.  
Timers and history record interaction with them.  
Entries and topics provide context.  
Statistics reveal patterns over time.

---

## Features

### Today

The main dashboard provides quick access to the things currently happening.

- active timers
- recent activity
- catalogue
- entries
- topics
- history
- statistics
- Memory Radio
- contextual session notes

The goal is to make the app useful without turning the home screen into a traditional productivity dashboard.

---

## Catalogue

One library for several kinds of media:

### Books

Track books and their reading state, metadata and personal history.

### Films & Series

Track:

- watchlist
- currently watching
- completed titles
- dropped titles
- series progress
- episode history

### Games

Track games using states such as:

- backlog
- playing
- installed
- completed
- played before
- dropped
- quit

### Collections

Books, media and games can also be grouped into custom collections.

---

## Catalogue Search

The catalogue home screen includes a global search across saved:

- books
- films
- series
- games

It also supports structured queries.

Examples:

```text
type:movie
type:series
type:book
type:game

status:watching
status:reading
status:playing
status:installed

year:2024
jingle
```

Queries can be combined:

```text
type:movie year:2024
type:game status:installed
jingle type:movie
type:book status:reading
```

Normal text can be mixed with filters:

```text
type:movie now
jingle alien
```

---

## Random Picker

**Odaberi mi nešto** is deliberately not a random-item button.

It answers a more useful question:

> **What should I continue right now?**

The picker selects only from active items:

- books currently being read
- series or films currently being watched
- games currently being played
- installed games

Completed, dropped, backlog and planned items are excluded.

Repeated rolls avoid previously selected items until the active pool has been exhausted.

---

## Jingle 🔔

`Jingle` is the app's lightweight favourite / meaningful-item marker.

It is independent from catalogue status.

A book can be completed and still be a Jingle.  
A game can be currently played and be a Jingle.  
A film can be years old and remain a Jingle.

Internally this is stored as a favourite flag, while the interface uses the bell metaphor.

---

## History

Tracking App keeps activity as history rather than treating completed timers as disposable data.

History can preserve:

- activity sessions
- catalogue interactions
- timestamps
- session notes
- contextual information

The long-term goal is for the app to become increasingly useful simply because it has existed for longer.

---

## Entries & Topics

The app also includes a lightweight writing system.

### Entries

Entries can be used for notes, observations, logs and longer pieces of text.

### Topics

Topics provide a way to connect and organize entries around recurring subjects.

This allows catalogue activity and personal writing to coexist inside the same system instead of living in separate apps.

---

## Memory Radio

Memory Radio resurfaces material from the personal archive.

Rather than always presenting information chronologically, it provides another way to revisit previously recorded material and memories.

The feature includes its own player and audio-related interface.

---

## Statistics

Statistics are generated from the local history and catalogue.

Current and planned statistics include:

- catalogue totals
- watch / read / play activity
- time spent
- recent interests
- historical snapshots
- changing catalogue composition
- longer-term eras and patterns

### What am I into lately?

Recent activity can also be analyzed over shorter periods to surface what has dominated attention lately rather than only showing lifetime totals.

---

## Catalogue Snapshots

The app can preserve snapshots of the catalogue over time.

This makes it possible to eventually answer questions such as:

- What was I watching during a certain period?
- What games dominated a particular year?
- When did my interests shift?
- How different is my library now compared with an earlier snapshot?

The catalogue therefore functions as both a collection and a historical record.

---

## Command Palette

On desktop/web:

```text
Ctrl + K
```

or

```text
Cmd + K
```

opens the global command palette.

It can be used to:

- search catalogue items
- open books
- open films and series
- open games
- navigate to major screens
- access Jingle items
- reopen recent catalogue items
- reuse recent searches

Keyboard navigation is supported with:

```text
↑ ↓
Enter
Esc
```

---

## Themes

The app includes a customizable visual system with independent:

- accent color
- background color
- visual skins

One of the current visual directions is inspired by **Frutiger Aero** — glass, grass, bubbles, sky and tactile interface elements — while keeping the actual information architecture clean and usable.

The visual layer is intentionally independent from the data model.

---

## Imports

The project includes tooling used to migrate historical catalogue data from external services.

Existing development work includes migration and repair pipelines for:

- TV Time history
- series metadata
- episode history
- movie runtimes
- game catalogue information
- game notes

These imports are migration tools rather than runtime dependencies of the application.

---

## Architecture

The repository contains the mobile application and backend in a single repository.

```text
TRACKING APP/
│
├── mobile/
│   ├── assets/
│   ├── src/
│   │   ├── audio/
│   │   ├── components/
│   │   ├── games/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── storage/
│   │   ├── theme/
│   │   └── types/
│   │
│   ├── App.tsx
│   └── package.json
│
├── backend/
│   └── Spring Boot backend
│
├── docs/
├── docker-compose.yml
├── start-backend.ps1
├── start-mobile.ps1
└── README.md
```

---

## Mobile Stack

The client is built with:

- React Native
- Expo
- TypeScript
- React Navigation
- SQLite

Local SQLite is the primary storage layer for the mobile application.

The app is designed so that personal tracking remains usable locally rather than requiring a permanent network connection.

---

## Backend

The repository also contains a Java backend built with:

- Java
- Spring Boot
- Maven
- Flyway
- relational database persistence

The backend is being developed alongside the local-first mobile architecture and is not required for every mobile feature.

---

## Running the App

### Mobile

From the repository root:

```powershell
.\start-mobile.ps1
```

Or manually:

```bash
cd mobile
npm install
npx expo start
```

### Backend

From the repository root:

```powershell
.\start-backend.ps1
```

The backend can also be run directly from its project directory using Maven.

---

## Type Checking

Before committing mobile changes:

```bash
cd mobile
npx tsc --noEmit
```

A clean run should produce no TypeScript errors.

---

## Development Philosophy

A few principles guide the project.

### Local first

The personal archive should remain useful without depending on an external service.

### History should accumulate

Completed activity should not disappear.  
The value of the system should increase as its history grows.

### Catalogue objects are context

A film, book or game is not just an item in a database. It can connect to time, notes, memories, collections and periods of life.

### Status and meaning are different

Whether something is currently being watched or has been completed is separate from whether it matters personally.

This is why features such as **Jingle** exist independently from status.

### Discovery belongs above management

Individual Books, Media and Games screens remain focused on managing their own collections.

Cross-catalogue discovery, global search and random selection live at the catalogue level instead of cluttering every list.

### No social layer required

There are no follower counts, feeds or engagement mechanics at the center of the design.

The user is the audience.

---

## Status

**Active development.**

The current repository represents the first consolidated baseline of the application, including the catalogue, tracking, history, statistics, themes, Memory Radio and discovery systems.

The architecture and interface are still evolving.

---

## License

Personal project.

No license has currently been granted for redistribution or reuse.
