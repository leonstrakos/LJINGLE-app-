// forkK15BrainlessContextualLanguageV1

# K15 — Brainless Contextual Language

## Runtime architecture

typed text / Whisper transcript
→ deterministic fuzzy language parser
→ K10 / K12 / Context Spine
→ candidate or confirmation row
→ existing safe executor
→ SQLite

No local LLM is invoked.

## Context

Omitted subjects such as:

- "stavi u Winter"
- "dodaj u Winter"
- "linkaj s Jung"
- "otvori zadnje gledano"

produce contextual referent phrases and are resolved through the existing
K10 + Context Spine candidate system.

Mutations remain user-confirmed.

## Fuzzy language

The parser tolerates:
- common command typos/transpositions
- Croatian / English mixtures
- speech repetition such as "duneee"
- natural create phrases such as "napravi knjigu dune"

## Natural create

- book/topic → local confirmation command
- movie/series/game → online metadata search first, then user chooses result

## Legacy Brain

The Qwen GGUF is deleted from the phone on first Palette status read.
There is no llama.rn import in the JS inference path after K15.

The already-installed native dev APK still physically contains its compiled
llama.rn library until a future EAS rebuild. K15 does not require that rebuild.

The Brain glyph remains as the icon for LJingle Intelligence and is pink/lime.

No DB/backend/schema/native changes.
