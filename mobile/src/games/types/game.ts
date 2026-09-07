// gamesNotesImportV1
export type GameStatus =
  | 'BACKLOG'
  | 'PLAYING'
  | 'INSTALLED'
  | 'COMPLETED'
  | 'PLAYED_BEFORE'
  | 'DROPPED'
  | 'QUIT'
  | 'UNSORTED';

export type Enjoyment = 'ENJOYED' | 'OKAY' | 'REGRET';

export type GameResponse = {
  gameId: string;
  title: string;
  developer: string | null;
  platform: string;
  releaseYear: number | null;
  gameStatus: GameStatus;
  progress: number;
  enjoyment: Enjoyment | null;
  favourite: boolean;
  /** Imported Notes DNF: treated as completed, displayed with an asterisk. */
  dnf: boolean;
  startedOn: string | null;
  finishedOn: string | null;
  igdbId: number | null;
  coverUrl: string | null;
  playingActivityId: string | null;
};

export type GameRequest = Omit<GameResponse, 'gameId' | 'playingActivityId' | 'dnf'>;

export type GameMetadataResult = {
  igdbId: number;
  title: string;
  developer: string | null;
  releaseYear: number | null;
  coverUrl: string | null;
  platforms: string[];
};

export type GameStackParamList = {
  GameList: { focusGameId?: string; collectionId?: string } | undefined;
  GameDetails: { gameId: string };
  GameForm: { gameId?: string; prefill?: GameMetadataResult } | undefined;
  GameMetadataSearch: undefined;
};

export const gameStatusLabels: Record<GameStatus, string> = {
  BACKLOG: 'Za poslije',
  PLAYING: 'Igram',
  INSTALLED: 'Instalirano',
  COMPLETED: 'Završeno',
  PLAYED_BEFORE: 'Igrano prije',
  DROPPED: 'Odustao/la',
  QUIT: 'Quit',
  UNSORTED: 'Nesvrstano',
};

export const enjoymentLabels: Record<Enjoyment, string> = {
  ENJOYED: 'Svidjelo mi se',
  OKAY: 'Bilo je u redu',
  REGRET: 'Žalim utrošeno vrijeme',
};

export const gameStatuses = Object.keys(gameStatusLabels) as GameStatus[];
export const enjoymentOptions = Object.keys(enjoymentLabels) as Enjoyment[];
