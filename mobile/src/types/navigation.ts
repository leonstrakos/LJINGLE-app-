export type RootStackParamList = {
  Today: undefined;
  // jinglePortalNetworkV1
  JingleNetwork: undefined;
  JingleProfile: { username: string };
  ThemePicker: undefined;
  Catalogue: undefined;
  Collections: undefined;
  CollectionDetails: { collectionId: string };
  // memoryCapsuleBoxedV1
  MemoryCapsule: { capsuleId: string };
  Topics: undefined;
  TopicDetails: { topicId: string };
  History: undefined;
  Stats: undefined;
  Reconstruction: { year?: number } | undefined;
  // ljingleReaderEntriesHighlightRadioR1: focused entry deep-link from Reader
  Entries: { focusEntryId?: string; collectionId?: string } | undefined;
  EntryForm: { entryId?: string } | undefined;
  MemoryRadio: { trackId?: string } | undefined;
  Games: {
    screen?: 'GameList';
    params?: { focusGameId?: string; collectionId?: string };
  } | undefined;
  Media: {
    screen?: 'MediaList';
    params?: { focusMediaId?: string; collectionId?: string };
  } | undefined;
  BookList: { focusBookId?: string; collectionId?: string } | undefined;
  BookSearch: undefined;
  BookMetadataImport: undefined;
  BookDetails: {
    bookId: string;
    openReader?: boolean;
    readerPage?: number | null;
    readerLocator?: string | null;
    readerSelectionRects?: Array<{ page: number; rect: string }> | null;
  };
  BookForm: { bookId?: string } | undefined;
};
