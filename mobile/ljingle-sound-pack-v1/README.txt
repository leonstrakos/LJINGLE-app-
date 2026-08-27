LJingle Sound Pack V1

Mapping from your uploaded ZIP:
1 = app opening
2 = delete
3 = jingle
4 = create

Install:
1. Extract this folder into:
   C:\Users\Korisnik\Desktop\TRACKING APP\mobile
2. From mobile run:
   node .\ljingle-sound-pack-v1\install-ljingle-sounds-v1.cjs

The installer:
- copies the 4 MP3s into src/assets/ui-sounds/
- upgrades src/audio/uiFeedback.ts
- wires sound 1 to App opening
- keeps create/delete/jingle as explicit reusable cues
- runs tsc --noEmit
- restores touched TS files if typecheck fails
