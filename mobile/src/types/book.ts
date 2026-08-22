export type ReadingStatus = 'LATER' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'DROPPED';

export type Enjoyment = 'ENJOYED' | 'OKAY' | 'REGRET';

export type BookResponse = {
  bookId: string;
  title: string;
  author: string;
  isbn: string;
  publishedYear: number;
  readingStatus: ReadingStatus;
  progress: number;
  enjoyment: Enjoyment | null;
  favourite: boolean;
  startedOn: string | null;
  finishedOn: string | null;
};

export type BookRequest = Omit<BookResponse, 'bookId'>;

export type PagedBooks = {
  content: BookResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;  
};

export const readingStatusLabels: Record<ReadingStatus, string> = {
  LATER: 'Za poslije',
  IN_PROGRESS: 'Čitam',
  COMPLETED: 'Pročitano',
  PAUSED: 'Pauzirano',
  DROPPED: 'Odustao/la',
};

export const enjoymentLabels: Record<Enjoyment, string> = {
  ENJOYED: 'Svidjelo mi se',
  OKAY: 'Bilo je u redu',
  REGRET: 'Žalim utrošeno vrijeme',
};

export const readingStatuses = Object.keys(readingStatusLabels) as ReadingStatus[];
export const enjoymentOptions = Object.keys(enjoymentLabels) as Enjoyment[];
