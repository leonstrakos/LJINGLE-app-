# LJingle native PDF selection repair

The original installer expected the pre-immersive `beginNote` implementation
and stopped when it encountered the newer reader revision. Run the repair
installer from the LJingle app root. It supports both reader revisions,
combines immersive and selection highlights, creates a recovery backup, and
rolls back the repair if a later step fails.

```powershell
node repair-reader-native-selection-v2-r2.cjs
```

Then install dependencies and build a new Android development/preview build.
The native bridge is not available in Expo Go.
