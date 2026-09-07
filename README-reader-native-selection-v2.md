# LJingle reader native PDF selection bridge

Run `node apply-reader-native-selection-v2.cjs` from the LJingle app root (or set
`LJINGLE_ROOT`). Keep the sibling `react-native-pdf-jsi-native-selection.patch`
next to the installer.

The installer is guarded and additive:

- patches `react-native-pdf-jsi` 4.4.2 through `patch-package` for Android;
- keeps the existing Pdfium renderer, paging, and inverted/night reader mode;
- long-presses a text PDF natively, selects the tapped word, and returns text,
  page, and Pdfium rectangles to JS;
- saves the quote as the existing LJingle entry plus a page/rectangle anchor;
- leaves scanned/image-only PDFs unchanged (no fake text is generated).

After applying it, install dependencies and create a new Android development or
preview build. Expo Go cannot load this native change.
