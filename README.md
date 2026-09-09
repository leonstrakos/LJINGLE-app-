# LJINGLE

> **A personal catalogue, activity tracker, and memory system built around one idea:**
>
> **Keep track of what you spend your time on — and preserve the history around it.**

LJINGLE brings books, films, television, games, notes, activities, timers, statistics, collections, topics, and personal memories into one private, local-first archive.

It is **not** a social network or productivity scoreboard.

It is a record of **what I watched, read, played, worked on, thought about, returned to, and spent time with**.

---

## Contents

- [Overview](#overview)
- [Core Areas](#core-areas)
  - [Today](#today)
  - [Catalogue](#catalogue)
  - [Collections](#collections)
  - [Entries & Topics](#entries--topics)
  - [History](#history)
  - [Memory Radio](#memory-radio)
  - [Statistics](#statistics)
  - [Karta / Constellation](#karta--constellation)
- [Catalogue Search](#catalogue-search)
- [Random Picker](#random-picker)
- [Jingle](#jingle-)
- [Catalogue Snapshots](#catalogue-snapshots)
- [Command Palette](#command-palette)
- [Themes & Visual System](#themes--visual-system)
- [Imports](#imports)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Running the App](#running-the-app)
- [Type Checking](#type-checking)
- [Development Philosophy](#development-philosophy)
- [Status](#status)
- [License](#license)

---

# Overview

Most tracking apps isolate different parts of life:

| Tool type | Usually tracks |
|---|---|
| Film apps | Films |
| Book apps | Books |
| Game trackers | Games |
| Time trackers | Activities |
| Note apps | Thoughts |
| Journals | Memories |

LJINGLE combines those ideas into one connected personal system.

**The Catalogue provides the objects.**  
**Timers and History record interaction with them.**  
**Entries and Topics provide context.**  
**Collections organize them.**  
**Statistics reveal patterns over time.**  
**Memory Radio resurfaces the archive.**  
**Karta / Constellation visualizes relationships.**

The long-term goal is simple:

> **The app should become more useful simply because it has existed for longer.**

---

# Core Areas

## Today

The main dashboard provides quick access to what is happening now.

It can surface:

- active timers
- recently paused activity
- current reading / watching / playing
- recent catalogue items
- entries
- topics
- history
- statistics
- Memory Radio
- contextual session notes
- quick continuation actions

The goal is to make the app useful without turning the home screen into a traditional productivity dashboard.

---

## Catalogue

The Catalogue is the top-level library and discovery layer.

### Books

Track books, reading state, metadata, and personal history.

Books can connect to:

- reading progress
- quotes
- notes
- highlights
- session history
- entries
- topics
- collections

### Films & Series

Track:

- watchlist
- currently watching
- completed titles
- dropped titles
- series progress
- episode history
- personal notes
- catalogue history

### Games

Track games using states such as:

- backlog
- playing
- installed
- completed
- played before
- dropped
- quit

Games can preserve progress and session history independently from status.

### Collections

Collections organize catalogue items into deeper custom structures.

### Super Boxes

Super Boxes appear directly in the Catalogue as high-level destinations while their creation and editing remain part of the Collections system.

---

## Collections

LJINGLE currently uses a three-level collection hierarchy:

```text
Memory Box
    ↓
Big Box
    ↓
Super Box
```

### Memory Box

A **Memory Box** is the base custom collection.

Examples:

```text
Rainy Night
Arthurian
Winter
IIT
Favorite Horror
Research Notes
```

A Memory Box can belong to multiple Big Boxes.

### Big Box

A **Big Box** groups multiple Memory Boxes.

Example:

```text
Research
├── 📦 IIT
├── 📦 Consciousness
└── 📦 Information Theory
```

A Memory Box may appear in more than one Big Box.

Big Boxes use `📦` as their default visual identity.

### Super Box

A **Super Box** is the highest organizational layer.

It groups Big Boxes rather than individual Memory Boxes.

Example:

```text
Research
├── 📦 IIT
├── 📦 UFO
└── 📦 Gnosticism
```

A Big Box may belong to multiple Super Boxes.

Super Boxes can:

- be empty
- contain any number of Big Boxes
- reorder their Big Boxes
- create new Memory Boxes inside child Big Boxes
- use custom glyphs
- default to `◇`
- appear directly in the Catalogue
- be hidden without being deleted
- be reordered in Catalogue composition
- toggle their Catalogue glyph independently

Super Boxes are intentionally **not shown as another root card layer inside Collections**.

Collections owns their hierarchy and editing logic.  
The Catalogue is their primary visual entry point.

---

## Entries & Topics

LJINGLE includes a lightweight writing and knowledge layer.

### Entries

Entries can be used for:

- notes
- observations
- quotes
- logs
- longer text
- research fragments
- session notes

### Topics

Topics provide recurring conceptual anchors.

They allow catalogue activity and personal writing to coexist inside the same system instead of living in separate apps.

---

## History

Completed activity is treated as history rather than disposable timer data.

History can preserve:

- activity sessions
- catalogue interactions
- timestamps
- session notes
- contextual information
- reading / watching / playing activity

The archive is intended to accumulate rather than reset.

---

## Memory Radio

Memory Radio resurfaces material from the personal archive.

Rather than always presenting information chronologically, it provides another way to revisit:

- old notes
- memories
- saved material
- previously recorded context

It includes its own player and audio-related interface.

---

## Statistics

Statistics are generated from local history and catalogue data.

Current and planned statistics include:

- catalogue totals
- watch / read / play activity
- time spent
- recent interests
- historical snapshots
- changing catalogue composition
- longer-term eras and patterns

### What am I into lately?

Recent activity can also be analyzed over shorter periods to surface what has dominated attention lately instead of only showing lifetime totals.

---

## Karta / Constellation

Karta is the graph and spatial relationship layer.

It is designed for connecting items when folders and hierarchy are not enough.

Its visual language is intentionally sparse:

- deep navy space
- stars
- thin relationship lines
- restrained labels
- constellation-like structures

The long-term direction is a global constellation where catalogue objects, topics, entries, and other entities can coexist spatially.

---

# Catalogue Search

The Catalogue home screen includes a global search across saved:

- books
- films
- series
- games

Structured queries are supported.

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

# Random Picker

**Odaberi mi nešto** is deliberately not a random-item button.

It answers a more useful question:

> **What should I continue right now?**

The picker selects only from active items:

- books currently being read
- series or films currently being watched
- games currently being played
- installed games

Completed, dropped, backlog, and planned items are excluded.

Repeated rolls avoid previously selected items until the active pool has been exhausted.

---

# Jingle 🔔

`Jingle` is the app's lightweight favourite / meaningful-item marker.

It is independent from catalogue status.

A book can be completed and still be a Jingle.  
A game can be currently played and be a Jingle.  
A film can be years old and remain a Jingle.

Internally this behaves like a favourite flag while the interface uses the bell metaphor.

**Status and meaning are intentionally separate concepts.**

---

# Catalogue Snapshots

The app can preserve snapshots of the catalogue over time.

This makes it possible to eventually answer questions such as:

- What was I watching during a certain period?
- What games dominated a particular year?
- What was I reading during a specific season?
- When did my interests shift?
- How different is my library now compared with an earlier snapshot?

The Catalogue therefore functions as both a collection and a historical record.

---

# Command Palette

On desktop/web:

```text
Ctrl + K
```

or:

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

Keyboard navigation:

```text
↑ ↓
Enter
Esc
```

---

# Themes & Visual System

The visual layer is intentionally independent from the data model.

LJINGLE supports independent:

- accent color
- background color
- visual skins
- module-level skin overrides
- atmosphere density

## Catalogue Composition

Built-in Catalogue sections can be:

- shown or hidden
- reordered
- displayed with or without glyphs

Current built-in sections include:

- Books
- Films & Series
- Games
- Collections

Super Boxes join the same composition system and can also be:

- reordered
- hidden
- shown again
- rendered with or without their glyph

## Module Skins

Individual modules can borrow another visual skin independently.

Current choices:

```text
AUTO
CLASSIC
CELESTIAL
AERO
```

Module targets include:

```text
Catalogue
Collections
Books
Films & Series
Games
Radio
Timer
```

Example:

```text
Catalogue → Celestial
Collections → Classic
Timer → Aero
Games → Auto
```

## Atmosphere Density

Celestial presentation has an independent atmosphere setting:

```text
QUIET
NORMAL
MYTHIC
```

`NORMAL` preserves the standard balance.  
`QUIET` reduces visual noise.  
`MYTHIC` increases ambient density slightly.

The same token can later drive:

- mist
- glow
- constellation lines
- sparse ornament
- celestial motion

## Visual Directions

### Classic

A cleaner, more conventional interface language.

### Celestial

A dark navy / gold system inspired by:

- celestial navigation
- star charts
- brass instruments
- night skies
- deep ocean blues
- ivory typography
- restrained gold geometry

The rule is:

> **Influence, not cosplay.**

Games remain Games.  
Books remain Books.  
Search remains Search.

### Aero

A Frutiger-Aero-inspired direction using:

- glass
- sky
- water
- grass
- tactile controls
- soft chrome
- environmental backgrounds

without changing the underlying information architecture.

---

# Imports

The repository includes tooling used to migrate historical catalogue data from external services.

Existing migration and repair work includes:

- TV Time history
- series metadata
- episode history
- movie runtimes
- game catalogue information
- game notes

These are migration tools rather than runtime dependencies of the application.

---

# Architecture

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

# Tech Stack

## Mobile

The client is built with:

- React Native
- Expo
- TypeScript
- React Navigation
- SQLite

Local SQLite is the primary storage layer for the mobile application.

The app is designed so that personal tracking remains usable locally rather than requiring a permanent network connection.

## Backend

The repository also contains a Java backend built with:

- Java
- Spring Boot
- Maven
- Flyway
- relational database persistence

The backend is being developed alongside the local-first mobile architecture and is not required for every mobile feature.

---

# Running the App

## Mobile

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

## Backend

From the repository root:

```powershell
.\start-backend.ps1
```

The backend can also be run directly from its project directory using Maven.

---

# Type Checking

Before committing mobile changes:

```bash
cd mobile
npx tsc --noEmit
```

A clean run should produce no new TypeScript errors.

---

# Development Philosophy

### Local first

The personal archive should remain useful without depending on an external service.

### History should accumulate

Completed activity should not disappear.

The value of the system should increase as its history grows.

### Catalogue objects are context

A film, book, game, topic, collection, or activity is not just an item in a database.

It can connect to:

- time
- notes
- memories
- collections
- topics
- periods of life
- relationships to other objects

### Status and meaning are different

Whether something is currently being watched or has been completed is separate from whether it matters personally.

This is why features such as **Jingle** exist independently from status.

### Discovery belongs above management

Individual Books, Media, Games, and Collections screens remain focused on managing their own content.

Cross-catalogue discovery, search, continuation, and random selection belong at the Catalogue level.

### Depth is better than clutter

The archive is expected to become large.

Instead of keeping every object visible at the root, hierarchy is used where it helps:

```text
Memory Box → Big Box → Super Box
```

Graph relationships are used where hierarchy is not appropriate.

### Visual style should not own the data model

Themes, module skins, atmosphere, and layout should remain interchangeable without changing the archive itself.

### No social layer required

There are no follower counts, public feeds, or engagement mechanics at the center of the design.

> **The user is the audience.**

---

# Status

> **Active development**

The current repository includes:

- catalogue tracking
- local history
- timers
- entries
- topics
- statistics
- Memory Radio
- Collections hierarchy
- Super Boxes
- Karta / Constellation
- modular visual skins
- catalogue composition
- local-first storage
- migration tooling

The architecture and interface are still evolving.

---

# License

Personal project.

No license has currently been granted for redistribution or reuse.
