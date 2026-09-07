// ljinglePdfSelectionR6
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { entryApi } from '../services/entryApi';
import {
  getReaderBookmarks,
  getReaderNotes,
  toggleReaderBookmark,
  saveBookDocumentTheme,
  saveEpubPosition,
  savePdfPosition,
  saveReaderEntryAnchor,
} from '../services/bookReaderRepository';
import { colors } from '../theme/colors';
import { setPaletteInteractionLock } from '../utils/paletteInteractionLock';
// ljingleMorningFixesV1:reader
import type { ActivityTimerResponse } from '../types/activity';
import type {
  BookDocument,
  BookReaderTheme,
  ReaderSelectionRect,
  ReaderEntryAnchor,
  ReaderBookmark,
} from '../types/reader';
import { ReaderBookmarkGlyph } from './ReaderBookmarkGlyph';
import { semanticFeedback } from '../utils/semanticFeedback';
import { ReactiveAmbientField } from './ReactiveAmbientField';
import { AnimatedPressable } from './AnimatedPressable';

declare const require: (name: string) => any;

const PdfModule = require('react-native-pdf-jsi');
const Pdf = PdfModule.default as any;
const searchTextDirect = PdfModule.searchTextDirect as
  | ((pdfId: string, query: string, startPage: number, endPage: number) => Promise<unknown>)
  | undefined;
const EpubReader = require('@epubjs-react-native/core').Reader as any;
const EpubReaderProvider = require('@epubjs-react-native/core').ReaderProvider as any;
const useEpubFileSystem = require(
  '@epubjs-react-native/expo-file-system',
).useFileSystem as any;

type Props = {
  bookId: string;
  bookTitle: string;
  document: BookDocument | null;
  readingTimer: ActivityTimerResponse | null;
  timerLoading: boolean;
  visible: boolean;
  initialPage?: number | null;
  initialLocator?: string | null;
  initialSelectionRects?: ReaderSelectionRect[] | null;
  onClose: () => void;
  onOpenEntry: (entryId: string) => void;
  onToggleTimer: () => void;
  onProgressSaved: () => void;
};

type EpubPosition = {
  locator: string;
  progress: number;
};

type PdfHighlight = {
  page: number;
  rect: string;
};

type PdfSelection = {
  page: number;
  text: string;
  rects: ReaderSelectionRect[];
};

function anchorLabel(anchor: ReaderEntryAnchor) {
  if (anchor.format === 'PDF' && anchor.page) return `Stranica ${anchor.page}`;
  return 'Mjesto u EPUB-u';
}

function safeEpubPosition(args: unknown[]): EpubPosition | null {
  const values = args.filter(Boolean) as any[];
  const location = values.find(
    (value) =>
      typeof value === 'object' &&
      (value?.start?.cfi || value?.end?.cfi || value?.cfi),
  );
  const locator =
    location?.start?.cfi ||
    location?.cfi ||
    location?.end?.cfi ||
    values.find((value) => typeof value === 'string' && value.includes('epubcfi'));

  const numeric = values
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .map(Number);
  const progress =
    numeric.find((value) => value >= 0 && value <= 1) ??
    numeric.find((value) => value >= 0 && value <= 100) ??
    0;

  return locator ? { locator: String(locator), progress } : null;
}

function ReaderButton({
  active = false,
  disabled = false,
  label,
  onPress,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      cue="tap"
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarButton,
        active && styles.toolbarButtonActive,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.toolbarButtonText, active && styles.toolbarButtonTextActive]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function BookReaderModal({
  bookId,
  bookTitle,
  document,
  readingTimer,
  timerLoading,
  visible,
  initialPage,
  initialLocator,
  initialSelectionRects,
  onClose,
  onOpenEntry,
  onToggleTimer,
  onProgressSaved,
}: Props) {
  const [readerTheme, setReaderTheme] = useState<BookReaderTheme>(
    document?.readerTheme ?? 'DAY',
  );
  const [page, setPage] = useState(
    Math.max(1, initialPage ?? document?.currentPage ?? 1),
  );
  const [totalPages, setTotalPages] = useState(document?.totalPages ?? 0);
  const [epubLocator, setEpubLocator] = useState(
    initialLocator ?? document?.epubLocator ?? '',
  );
  const [epubProgress, setEpubProgress] = useState(document?.progress ?? 0);
  const [notes, setNotes] = useState<ReaderEntryAnchor[]>([]);
  // ljingleCompletionSealReaderBookmarksR1:Modal
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [panel, setPanel] = useState<'NOTE' | 'NOTES' | null>(null);
  const [noteType, setNoteType] = useState<'NOTE' | 'QUOTE'>('NOTE');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [pdfSelectionRects, setPdfSelectionRects] = useState<ReaderSelectionRect[]>([]);
  // codexNativePdfSelectionBridgeAppV2
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [readerError, setReaderError] = useState<string | null>(null);
  // codexPdfReaderImmersiveV1
  const [immersive, setImmersive] = useState(false);
  const [immersiveHint, setImmersiveHint] = useState(false);
  const [pdfHighlights, setPdfHighlights] = useState<PdfHighlight[]>([]);
  // ljingleReaderEntriesHighlightRadioR1: durable rectangles reconstructed from saved ReaderEntryAnchors
  const [savedPdfHighlights, setSavedPdfHighlights] = useState<PdfHighlight[]>([]);
  const [pdfSelection, setPdfSelection] = useState<PdfSelection | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [selectionBridge, setSelectionBridge] = useState('');
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  // ljingleNativePdfSelectionBridgeV1
  const [quoteSearchBusy, setQuoteSearchBusy] = useState(false);
  const saveVersion = useRef(0);
  const immersiveHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pdfId = document ? 'book-reader-' + document.documentId : 'book-reader-empty';

  useEffect(() => { setSelectionBridge(''); }, [document?.documentId, visible]);

  const night = readerTheme === 'NIGHT';
  const displayedProgress = document?.format === 'PDF'
    ? totalPages > 0
      ? Math.round((page / totalPages) * 100)
      : document?.progress ?? 0
    : Math.round(epubProgress <= 1 ? epubProgress * 100 : epubProgress);

  const currentBookmark = useMemo(() => {
    if (!document) return null;
    if (document.format === 'PDF') {
      return bookmarks.find((bookmark) => bookmark.page === page) ?? null;
    }
    const locator = String(epubLocator || document.epubLocator || '').trim();
    if (!locator) return null;
    return bookmarks.find((bookmark) => bookmark.epubLocator === locator) ?? null;
  }, [bookmarks, document, epubLocator, page]);

  const canBookmarkCurrentLocation = Boolean(
    document &&
      (document.format === 'PDF' || String(epubLocator || document.epubLocator || '').trim()),
  );

  const epubTheme = useMemo(
    () => ({
      body: {
        background: night ? '#111318' : colors.background,
        color: night ? '#E8E2D5' : colors.text,
        'font-family': 'Georgia, serif',
        'line-height': '1.62',
        padding: '0 4%',
      },
      p: {
        color: night ? '#E8E2D5' : colors.text,
      },
      a: {
        color: night ? colors.gold : colors.navy,
      },
    }),
    [night],
  );

  const refreshNotes = async () => {
    if (!document) return;
    const nextNotes = await getReaderNotes(document.documentId);
    setNotes(nextNotes);

    if (document.format !== 'PDF') {
      setSavedPdfHighlights([]);
      return;
    }

    // ljingleReaderEntriesHighlightRadioR1: every saved quote/note that has PDF geometry remains highlighted
    // after closing and reopening the book. Deduplicate exact rectangles because an
    // entry can be revisited through more than one UI path.
    const seen = new Set<string>();
    const savedHighlights: PdfHighlight[] = [];
    for (const note of nextNotes) {
      for (const rect of Array.isArray(note.selectionRects) ? note.selectionRects : []) {
        const page = Number(rect?.page);
        const value = typeof rect?.rect === 'string' ? rect.rect.trim() : '';
        if (!Number.isFinite(page) || page < 1 || value.split(',').length !== 4) continue;
        const key = page + ':' + value;
        if (seen.has(key)) continue;
        seen.add(key);
        savedHighlights.push({ page, rect: value });
        if (savedHighlights.length >= 4096) break;
      }
      if (savedHighlights.length >= 4096) break;
    }
    setSavedPdfHighlights(savedHighlights);
  };

  const refreshBookmarks = async () => {
    if (!document) {
      setBookmarks([]);
      return;
    }
    setBookmarks(await getReaderBookmarks(bookId));
  };

  const showImmersiveHint = () => {
    if (immersiveHintTimer.current) clearTimeout(immersiveHintTimer.current);
    immersiveHintTimer.current = setTimeout(() => {
      setImmersiveHint(false);
      immersiveHintTimer.current = null;
    }, 1400);
  };

  const toggleImmersive = () => {
    const next = !immersive;
    setImmersive(next);
    if (next) {
      setImmersiveHint(true);
      showImmersiveHint();
    } else {
      setImmersiveHint(false);
    }
  };

  const searchPdfQuote = async (value: string) => {
    const query = value.trim();
    if (!query || document?.format !== 'PDF' || !searchTextDirect) {
      setPdfHighlights([]);
      return;
    }
    setQuoteSearchBusy(true);
    try {
      const raw = await searchTextDirect(pdfId, query, 1, totalPages || 9999);
      const rows = Array.isArray(raw) ? raw : [];
      const highlights = rows
        .map((row: any) => ({ page: Number(row?.page), rect: String(row?.rect ?? '') }))
        .filter((row) => Number.isFinite(row.page) && row.page > 0 && row.rect)
        .slice(0, 32);
      setPdfHighlights(highlights);
    } catch {
      // Image-only PDFs have no text layer; the quote can still be saved manually.
      setPdfHighlights([]);
    } finally {
      setQuoteSearchBusy(false);
    }
  };

  useEffect(() => () => {
    if (immersiveHintTimer.current) clearTimeout(immersiveHintTimer.current);
  }, []);

  useEffect(() => {
    setPaletteInteractionLock('book-reader', visible);
    return () => setPaletteInteractionLock('book-reader', false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !document) return;
    setReaderTheme(document.readerTheme);
    setPage(Math.max(1, initialPage ?? document.currentPage ?? 1));
    setTotalPages(document.totalPages ?? 0);
    setEpubLocator(initialLocator ?? document.epubLocator ?? '');
    setEpubProgress(document.progress);
    setSelectedText('');
    const initialRects = Array.isArray(initialSelectionRects)
      ? initialSelectionRects
          .filter((rect) => rect && Number.isFinite(Number(rect.page)) && typeof rect.rect === 'string' && rect.rect.split(',').length === 4)
          .slice(0, 128)
      : [];
    setPdfSelectionRects(initialRects);
    setPdfSelection(null);
    setSelectionNotice(null);
    setReaderError(null);
    setImmersive(false);
    setImmersiveHint(false);
    // ljingleReaderEntriesHighlightRadioR1: clear old document highlight memory, then refreshNotes restores this book's rectangles
    setSavedPdfHighlights([]);
    setPdfHighlights([]);
    setQuoteSearchBusy(false);
    setBookmarks([]);
    void refreshNotes().catch(() => setNotes([]));
    void refreshBookmarks().catch(() => setBookmarks([]));
  }, [document?.documentId, visible, initialPage, initialLocator, initialSelectionRects]);

  useEffect(() => {
    if (!visible || !document || document.format !== 'PDF' || totalPages <= 0) {
      return;
    }
    const version = ++saveVersion.current;
    const timeout = setTimeout(() => {
      void savePdfPosition(document.documentId, bookId, page, totalPages)
        .then(() => {
          if (version === saveVersion.current) onProgressSaved();
        })
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(timeout);
  }, [bookId, document?.documentId, document?.format, page, totalPages, visible]);

  useEffect(() => {
    if (!visible || !document || document.format !== 'EPUB' || !epubLocator) return;
    const version = ++saveVersion.current;
    const timeout = setTimeout(() => {
      void saveEpubPosition(
        document.documentId,
        bookId,
        epubLocator,
        epubProgress,
      )
        .then(() => {
          if (version === saveVersion.current) onProgressSaved();
        })
        .catch(() => undefined);
    }, 700);
    return () => clearTimeout(timeout);
  }, [bookId, document?.documentId, document?.format, epubLocator, epubProgress, visible]);

  const toggleTheme = async () => {
    if (!document) return;
    const next: BookReaderTheme = readerTheme === 'DAY' ? 'NIGHT' : 'DAY';
    setReaderTheme(next);
    await saveBookDocumentTheme(document.documentId, next).catch(() => undefined);
  };

  const toggleCurrentBookmark = async () => {
    if (!document || bookmarkBusy || !canBookmarkCurrentLocation) return;
    setBookmarkBusy(true);
    try {
      await toggleReaderBookmark({
        documentId: document.documentId,
        bookId,
        format: document.format,
        page: document.format === 'PDF' ? page : null,
        epubLocator:
          document.format === 'EPUB'
            ? String(epubLocator || document.epubLocator || '').trim()
            : null,
      });
      await refreshBookmarks();
      void semanticFeedback.selection();
    } catch (caught) {
      setReaderError(
        caught instanceof Error
          ? caught.message
          : 'Bookmark se nije mogao spremiti.',
      );
    } finally {
      setBookmarkBusy(false);
    }
  };

  const beginNote = (quote = '', asQuote = false) => {
    setImmersive(false);
    setNoteError(null);
    setSelectedText(quote.trim());
    if (!quote.trim()) setPdfSelectionRects([]);
    setNoteType(quote.trim() || asQuote ? 'QUOTE' : 'NOTE');
    setNoteTitle('');
    setNoteContent(quote.trim());
    setPanel('NOTE');
  };

  const createNote = async () => {
    if (!document || savingNote || !noteContent.trim()) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const entry = await entryApi.create({
        title: noteTitle.trim() || null,
        content: noteContent.trim(),
        type: noteType,
        bookId,
        activityId: readingTimer?.activityId ?? null,
        topicId: null,
      });

      await saveReaderEntryAnchor({
        entryId: entry.entryId,
        documentId: document.documentId,
        bookId,
        format: document.format,
        page: document.format === 'PDF' ? page : null,
        epubLocator: document.format === 'EPUB' ? epubLocator : null,
        selectedText: (noteType === 'QUOTE' ? noteContent.trim() : selectedText.trim()) || null,
        selectionRects: document.format === 'PDF' ? pdfSelectionRects : null,
      });

      await refreshNotes();
      // ljingleReaderEntriesHighlightRadioR1: current selection is now represented by saved memory
      setPdfSelectionRects([]);
      setPanel('NOTES');
      setNoteTitle('');
      setNoteContent('');
      setSelectedText('');
    } catch (caught) {
      setNoteError(
        caught instanceof Error ? caught.message : 'Zapis nije spremljen.',
      );
    } finally {
      setSavingNote(false);
    }
  };

  const copyPdfSelection = async () => {
    if (!pdfSelection) return;
    // ljingleReaderCopyGuardR2
    try {
      await Clipboard.setStringAsync(pdfSelection.text);
      setSelectionNotice('Citat je kopiran.');
    } catch {
      setSelectionNotice('Kopiranje nije uspjelo. Pokušaj ponovno.');
    }
  };

  const createPdfQuote = async () => {
    if (!document || !pdfSelection || selectionBusy) return;
    setSelectionBusy(true);
    try {
      const entry = await entryApi.create({
        title: null,
        content: pdfSelection.text,
        type: 'QUOTE',
        bookId,
        activityId: readingTimer?.activityId ?? null,
        topicId: null,
      });
      await saveReaderEntryAnchor({
        entryId: entry.entryId,
        documentId: document.documentId,
        bookId,
        format: 'PDF',
        page: pdfSelection.page,
        selectedText: pdfSelection.text,
        selectionRects: pdfSelection.rects,
      });
      await refreshNotes();
      setSelectionNotice('Citat je spremljen u Zapise.');
      // ljingleReaderEntriesHighlightRadioR1: promote the live selection to saved highlight memory
      setPdfSelection(null);
      setPdfSelectionRects([]);
      setSelectedText('');
    } catch (caught) {
      setSelectionNotice(caught instanceof Error ? caught.message : 'Citat nije spremljen.');
    } finally {
      setSelectionBusy(false);
    }
  };

  if (!document) return null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}
    >
      <StatusBar hidden={visible || immersive} />
      {/* ljingleSemanticAliveR21Exact:reader-dust */}
      <ReactiveAmbientField
        mode="reading"
        active={visible}
      />
      <SafeAreaView style={[styles.safeArea, night && styles.safeAreaNight]}>
        {!immersive ? (
          <View style={[styles.header, night && styles.headerNight]}>
            <Pressable
              accessibilityLabel="Zatvori čitač"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={[styles.closeText, night && styles.nightText]}>×</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={[styles.headerTitle, night && styles.nightText]}>
                {bookTitle}
              </Text>
              <Text style={[styles.headerMeta, night && styles.nightMuted]}>
                {document.format} · {Math.max(0, Math.min(100, displayedProgress))}%
                {document.format === 'PDF' ? (selectionBridge === 'R6' ? ' · Odabir R6' : ' · Odabir nije potvrđen') : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                currentBookmark
                  ? 'Ukloni bookmark s trenutnog mjesta'
                  : 'Bookmarkaj trenutno mjesto'
              }
              disabled={bookmarkBusy || !canBookmarkCurrentLocation}
              hitSlop={8}
              onPress={() => void toggleCurrentBookmark()}
              style={({ pressed }) => [
                styles.bookmarkButton,
                currentBookmark && styles.bookmarkButtonActive,
                (bookmarkBusy || !canBookmarkCurrentLocation) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <ReaderBookmarkGlyph active={Boolean(currentBookmark)} size={21} />
            </Pressable>
            <ReaderButton
              active={night}
              label={night ? 'Noć' : 'Dan'}
              onPress={() => void toggleTheme()}
            />
            <ReaderButton
              disabled={document.format !== 'PDF'}
              label="⛶"
              onPress={toggleImmersive}
            />
          </View>
        ) : null}

        <View style={[styles.readerStage, night && styles.readerStageNight]}>
          {document.format === 'PDF' ? (
            <View
              style={[
                styles.readerFill,
                night &&
                  Platform.OS === 'android' &&
                  ({ filter: [{ invert: 1 }, { hueRotate: '180deg' }] } as any),
              ]}
            >
              <Pdf
                enablePaging={false}
                horizontal={false}
                enableTextSelection={true}
                onTextSelectionReady={(version: string) => setSelectionBridge(version)}
                pdfId={pdfId}
                highlightRects={[
                  ...savedPdfHighlights.map((item) => ({ ...item, color: colors.gold })),
                  ...pdfHighlights.map((item) => ({ ...item, color: colors.gold })),
                  ...pdfSelectionRects.map((item) => ({ ...item, color: colors.gold })),
                ]}
                onTextSelectionError={(message: string) => {
                  setSelectionNotice(message || 'Označavanje nije uspjelo.');
                }}
                onTextSelectionUnavailable={(unavailablePage: number) => {
                  setPdfSelection(null);
                  setPdfSelectionRects([]);
                  setSelectionNotice(`Stranica ${Math.max(1, Number(unavailablePage) || page)} nema označivi tekst. Ako je sken, trebat će OCR.`);
                }}
                onTextSelectionFailure={(failure: { code?: string; page?: number }) => {
                  const code = String(failure?.code ?? 'UNKNOWN');
                  const failedPage = Math.max(1, Number(failure?.page) || page);
                  const message =
                    code === 'NO_PAGE_TARGET'
                      ? 'Long press je prepoznat, ali dodir nije mapiran na PDF stranicu.'
                      : code === 'SOURCE_UNREADABLE'
                        ? 'PDF je otvoren, ali selection bridge ne može ponovno otvoriti izvor dokumenta.'
                        : code === 'NO_CHARACTER_AT_TOUCH'
                          ? `Stranica ${failedPage} ima tekst, ali ispod dodira nije pronađen znak. Probaj držati točno na riječi.`
                          : code === 'PAGE_UNAVAILABLE'
                            ? `Stranica ${failedPage} nije dostupna selection bridgeu.`
                            : code === 'NATIVE_ERROR'
                              ? 'Native PDF selection je naišao na grešku.'
                              : `PDF selection nije uspio (${code}).`;
                  setPdfSelection(null);
                  setPdfSelectionRects([]);
                  setSelectionNotice(message);
                }}
                onPageSingleTap={toggleImmersive}
                onError={(value: unknown) =>
                  setReaderError(
                    value instanceof Error ? value.message : 'PDF se nije mogao otvoriti.',
                  )
                }
                onLoadComplete={(pages: number) => {
                  setTotalPages(Math.max(1, Number(pages) || 1));
                  setReaderError(null);
                }}
                onPageChanged={(nextPage: number, pages: number) => {
                  setPage(Math.max(1, Number(nextPage) || 1));
                  setTotalPages(Math.max(1, Number(pages) || 1));
                }}
                onTextSelected={(selection: { text?: string; page?: number; rects?: ReaderSelectionRect[] }) => {
                  const quote = String(selection?.text ?? '').trim();
                  if (!quote) return;
                  const nextPage = Math.max(1, Number(selection?.page) || page);
                  const rects = Array.isArray(selection?.rects)
                    ? selection.rects
                        .filter((rect) => rect && typeof rect.rect === 'string' && rect.rect.split(',').length === 4)
                        .map((rect) => ({ page: Math.max(1, Number(rect.page) || nextPage), rect: rect.rect }))
                    : [];
                  // Keep the viewport fixed while selecting and dragging.
                  setPage(nextPage);
                  setSelectedText(quote);
                  setPdfSelectionRects(rects);
                  setPdfSelection({ page: nextPage, text: quote, rects });
                  // PDF selection returned text without drawable highlight rects
                  setSelectionNotice(rects.length ? null : 'Tekst je odabran, ali nedostaju koordinate za highlight.');
                  setNoteType('QUOTE');
                  setNoteContent(quote);
                  setPanel(null);
                }}
                page={Math.max(1, initialPage ?? document.currentPage ?? 1)}
                source={{ uri: document.uri, cache: false }}
                style={styles.readerFill}
                trustAllCerts={false}
              />
            </View>
          ) : (
            <EpubReaderProvider>
              <EpubReader
                allowPopups={false}
                allowScriptedContent={false}
                defaultTheme={epubTheme}
                enableSelection
                fileSystem={useEpubFileSystem}
                initialLocation={
                  epubLocator || initialLocator || document.epubLocator || undefined
                }
                key={`${document.documentId}-${readerTheme}`}
                onLocationChange={(...args: unknown[]) => {
                  const next = safeEpubPosition(args);
                  if (!next) return;
                  setEpubLocator(next.locator);
                  setEpubProgress(next.progress);
                }}
                onSelected={(text: string, cfiRange: string) => {
                  if (cfiRange) setEpubLocator(String(cfiRange));
                  const quote = String(text ?? '').trim();
                  setSelectedText(quote);
                  setNoteType(quote ? 'QUOTE' : 'NOTE');
                  setNoteContent(quote);
                  setPanel(null);
                }}
                src={document.uri}
              />
            </EpubReaderProvider>
          )}

          {readerError ? (
            <View style={styles.readerError}>
              <Text style={styles.readerErrorTitle}>Dokument se nije otvorio</Text>
              <Text style={styles.readerErrorText}>{readerError}</Text>
            </View>
          ) : null}
          {pdfSelection ? (
            <View style={[styles.selectionCard, night && styles.selectionCardNight]}>
              <Text style={[styles.selectionEyebrow, night && styles.nightMuted]}>
                PDF CITAT · STRANICA {pdfSelection.page}
              </Text>
              <Text numberOfLines={5} style={[styles.selectionText, night && styles.nightText]}>
                “{pdfSelection.text}”
              </Text>
              <View style={styles.selectionActions}>
                <Pressable onPress={() => void copyPdfSelection()} style={styles.selectionSecondary}>
                  <Text style={styles.selectionSecondaryText}>Kopiraj</Text>
                </Pressable>
                <Pressable
                  disabled={selectionBusy}
                  onPress={() => void createPdfQuote()}
                  style={[styles.selectionPrimary, selectionBusy && styles.disabled]}
                >
                  <Text style={styles.selectionPrimaryText}>
                    {selectionBusy ? 'Spremam…' : 'Citat'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => { setPdfSelection(null); setPdfSelectionRects([]); setSelectedText(''); setSelectionNotice(null); }} style={styles.selectionSecondary}>
                  <Text style={styles.selectionSecondaryText}>Zatvori</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {selectionNotice ? (
            <Pressable onPress={() => setSelectionNotice(null)} style={styles.selectionNotice}>
              <Text style={styles.selectionNoticeText}>{selectionNotice}</Text>
            </Pressable>
          ) : null}
          {immersive && immersiveHint ? (
            <View pointerEvents="none" style={styles.immersiveHint}>
              <Text style={styles.immersiveHintText}>Dodirni stranicu za kontrole</Text>
            </View>
          ) : null}
        </View>

        {!immersive ? (
          <View style={[styles.footer, night && styles.headerNight]}>
            <ReaderButton
              active={Boolean(readingTimer?.running)}
              disabled={timerLoading || !readingTimer}
              label={readingTimer?.running ? '■ Timer' : '▶ Timer'}
              onPress={onToggleTimer}
            />
            <ReaderButton
              active={Boolean(selectedText)}
              label={selectedText || document.format === 'PDF' ? '＋ Citat' : '＋ Zapis'}
              onPress={() => beginNote(selectedText, document.format === 'PDF')}
            />
            <ReaderButton
              active={panel === 'NOTES'}
              label={'Zapisi ' + notes.length}
              onPress={() => {
                setImmersive(false);
                setPanel(panel === 'NOTES' ? null : 'NOTES');
              }}
            />
            <Text style={[styles.positionText, night && styles.nightMuted]}>
              {document.format === 'PDF'
                ? page + (totalPages ? ' / ' + totalPages : '')
                : Math.max(0, Math.min(100, displayedProgress)) + '%'}
            </Text>
          </View>
        ) : null}

        {panel ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.panelOverlay}
          >
            <Pressable onPress={() => setPanel(null)} style={styles.panelBackdrop} />
            <View style={[styles.panel, night && styles.panelNight]}>
              <View style={styles.panelHandle} />
              {panel === 'NOTE' ? (
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={[styles.panelTitle, night && styles.nightText]}>
                        Zapis uz čitanje
                      </Text>
                      <Text style={[styles.panelSubtitle, night && styles.nightMuted]}>
                        {document.format === 'PDF' ? `Stranica ${page}` : 'Trenutno mjesto u EPUB-u'}
                      </Text>
                    </View>
                    <Pressable onPress={() => setPanel(null)}>
                      <Text style={[styles.panelClose, night && styles.nightText]}>×</Text>
                    </Pressable>
                  </View>

                  <View style={styles.noteTypeRow}>
                    {(['NOTE', 'QUOTE'] as const).map((type) => (
                      <Pressable
                        key={type}
                        onPress={() => setNoteType(type)}
                        style={[
                          styles.noteTypeChip,
                          noteType === type && styles.noteTypeChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.noteTypeText,
                            noteType === type && styles.noteTypeTextActive,
                          ]}
                        >
                          {type === 'NOTE' ? 'Bilješka' : 'Citat'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    onChangeText={setNoteTitle}
                    placeholder="Naslov (nije obavezan)"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.noteTitleInput, night && styles.inputNight]}
                    value={noteTitle}
                  />
                  <TextInput
                    multiline
                    onChangeText={setNoteContent}
                    placeholder={document.format === 'PDF' ? 'Zalijepi ili upiši citat iz PDF-a…' : 'Zapiši misao…  [[Naziv zapisa]] i dalje radi.'}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.noteInput, night && styles.inputNight]}
                    textAlignVertical="top"
                    value={noteContent}
                  />
                  {document.format === 'PDF' && noteType === 'QUOTE' && searchTextDirect ? (
                    <Pressable
                      disabled={quoteSearchBusy || !noteContent.trim()}
                      onPress={() => void searchPdfQuote(noteContent)}
                      style={({ pressed }) => [styles.quoteSearchButton, pressed && styles.pressed]}
                    >
                      <Text style={[styles.quoteSearchText, night && styles.nightText]}>
                        {quoteSearchBusy ? 'Tražim tekst u PDF-u…' : 'Pronađi citat u PDF-u'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {noteError ? <Text style={styles.noteError}>{noteError}</Text> : null}
                  <Pressable
                    disabled={savingNote || !noteContent.trim()}
                    onPress={() => void createNote()}
                    style={({ pressed }) => [
                      styles.saveButton,
                      (savingNote || !noteContent.trim()) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    {savingNote ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.saveButtonText}>Spremi kao LJingle zapis</Text>
                    )}
                  </Pressable>
                </ScrollView>
              ) : (
                <>
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={[styles.panelTitle, night && styles.nightText]}>
                        Zapisi iz knjige
                      </Text>
                      <Text style={[styles.panelSubtitle, night && styles.nightMuted]}>
                        Isti zapisi kao u glavnom dijelu aplikacije
                      </Text>
                    </View>
                    <Pressable onPress={() => setPanel(null)}>
                      <Text style={[styles.panelClose, night && styles.nightText]}>×</Text>
                    </Pressable>
                  </View>
                  <ScrollView contentContainerStyle={styles.notesList}>
                    {notes.length === 0 ? (
                      <Text style={[styles.emptyNotes, night && styles.nightMuted]}>
                        Još nema zapisa vezanih uz ovaj dokument.
                      </Text>
                    ) : (
                      notes.map((note) => (
                        <Pressable
                          key={note.anchorId}
                          onPress={() => onOpenEntry(note.entryId)}
                          style={({ pressed }) => [
                            styles.noteCard,
                            night && styles.noteCardNight,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.noteAnchor}>{anchorLabel(note)}</Text>
                          <Text numberOfLines={1} style={[styles.noteCardTitle, night && styles.nightText]}>
                            {note.entryTitle || 'Zapis bez naslova'}
                          </Text>
                          <Text numberOfLines={3} style={[styles.noteCardContent, night && styles.nightMuted]}>
                            {note.entryContent}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  safeAreaNight: { backgroundColor: '#0B0D12' },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerNight: { backgroundColor: '#111318', borderBottomColor: '#2C2F36' },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(127,127,127,0.10)',
  },
  closeText: { color: colors.text, fontSize: 31, lineHeight: 34, fontWeight: '300' },
  headerCopy: { flex: 1, minWidth: 0, marginHorizontal: 11 },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  headerMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  toolbarButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.24)',
    borderRadius: 999,
    backgroundColor: 'rgba(127,127,127,0.08)',
    paddingHorizontal: 12,
  },
  toolbarButtonActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  toolbarButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  toolbarButtonTextActive: { color: colors.text },
  readerStage: { flex: 1, backgroundColor: colors.fill },
  readerStageNight: { backgroundColor: '#050608' },
  readerFill: { flex: 1, width: '100%', height: '100%' },
  readerError: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '35%',
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 20,
  },
  readerErrorTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  readerErrorText: { marginTop: 7, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  footer: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  positionText: { marginLeft: 'auto', color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  nightText: { color: '#F3EEDF' },
  nightMuted: { color: '#A7A39A' },
  panelOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  panelBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.40)' },
  panel: {
    maxHeight: '74%',
    minHeight: 320,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  panelNight: { backgroundColor: '#17191F' },
  panelHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    marginTop: 9,
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(127,127,127,0.34)',
  },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  panelTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  panelSubtitle: { marginTop: 3, color: colors.textMuted, fontSize: 12 },
  panelClose: { color: colors.text, fontSize: 30, lineHeight: 32 },
  noteTypeRow: { flexDirection: 'row', marginTop: 18, gap: 8 },
  noteTypeChip: {
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.25)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noteTypeChipActive: { borderColor: colors.black, backgroundColor: colors.black },
  noteTypeText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  noteTypeTextActive: { color: colors.onAccent },
  noteTitleInput: {
    minHeight: 48,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.25)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 138,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.25)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.65)',
    padding: 13,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  inputNight: { borderColor: '#343741', backgroundColor: '#0F1116', color: '#F3EEDF' },
  quoteSearchButton: {
    alignSelf: 'flex-start',
    marginTop: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fillStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quoteSearchText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  selectionCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  selectionCardNight: { backgroundColor: '#17191F', borderColor: '#343741' },
  selectionEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  selectionText: { marginTop: 7, color: colors.text, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  selectionActions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  selectionPrimary: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.black },
  selectionPrimaryText: { color: colors.onAccent, fontSize: 12, fontWeight: '900' },
  selectionSecondary: { minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.fillStrong, paddingHorizontal: 12 },
  selectionSecondaryText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  selectionNotice: { position: 'absolute', left: 18, right: 18, top: 18, borderRadius: 13, backgroundColor: 'rgba(20,20,24,0.86)', paddingHorizontal: 13, paddingVertical: 10 },
  selectionNoticeText: { color: colors.white, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  immersiveHint: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  immersiveHintText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  noteError: { marginTop: 8, color: colors.danger, fontSize: 12 },
  saveButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 15,
    backgroundColor: colors.black,
    paddingHorizontal: 16,
  },
  saveButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  notesList: { paddingTop: 14, paddingBottom: 20 },
  emptyNotes: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', padding: 28 },
  // ljingleReaderEntriesHighlightRadioR1: theme-safe reader note cards
  noteCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: colors.separator,
    borderLeftColor: colors.gold,
    borderRadius: 16,
    backgroundColor: colors.fill,
    padding: 15,
  },
  noteCardNight: { borderColor: '#343741', borderLeftColor: colors.gold, backgroundColor: '#101218' },
  noteAnchor: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  noteCardTitle: { marginTop: 5, color: colors.text, fontSize: 15, fontWeight: '800' },
  noteCardContent: { marginTop: 5, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
  // ljingleCompletionSealReaderBookmarksR1:ModalStyles
  bookmarkButton: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  bookmarkButtonActive: {
    borderColor: colors.navy,
    backgroundColor: colors.fillStrong,
  },

});
