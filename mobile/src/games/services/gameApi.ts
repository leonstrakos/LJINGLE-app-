import { apiRequest } from '../../services/apiClient';
import type { ActivityTimerResponse } from '../../types/activity';
import type {
  GameMetadataResult,
  GameRequest,
  GameResponse,
  GameStatus,
} from '../types/game';

// lazyGameCoversV1
export type GameMetadataPatch = {
  developer?: string | null;
  releaseYear?: number | null;
  igdbId?: number | null;
  coverUrl?: string | null;
};

export const gameApi = {
  getAll: (status?: GameStatus) =>
    apiRequest<GameResponse[]>(`/games${status ? `?status=${status}` : ''}`),

  getById: (gameId: string) => apiRequest<GameResponse>(`/games/${gameId}`),

  create: (payload: GameRequest) =>
    apiRequest<GameResponse>('/games', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (gameId: string, payload: GameRequest) =>
    apiRequest<GameResponse>(`/games/${gameId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // // catalogueJingleProgressSemanticsV1:GameJingle
  setFavourite: (
    gameId: string,
    favourite: boolean,
  ) =>
    apiRequest<GameResponse>(
      `/games/${encodeURIComponent(gameId)}/favourite`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          favourite,
        }),
      },
    ),

  remove: (gameId: string) =>
    apiRequest<void>(`/games/${gameId}`, {
      method: 'DELETE',
    }),

  // lazyGameCoversV1 — fills only missing online metadata.
  patchMetadata: (gameId: string, payload: GameMetadataPatch) =>
    apiRequest<GameResponse>(`/games/${encodeURIComponent(gameId)}/metadata`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getTimer: (gameId: string) =>
    apiRequest<ActivityTimerResponse>(`/games/${gameId}/timer`),

  startTimer: (gameId: string) =>
    apiRequest<ActivityTimerResponse>(`/games/${gameId}/timer/start`, {
      method: 'POST',
    }),

  stopTimer: (gameId: string) =>
    apiRequest<ActivityTimerResponse>(`/games/${gameId}/timer/stop`, {
      method: 'POST',
    }),

  searchMetadata: (query: string) =>
    apiRequest<GameMetadataResult[]>(
      `/games/metadata/search?query=${encodeURIComponent(query.trim())}`,
    ),
};

// catalogueJingleProgressSemanticsV1
