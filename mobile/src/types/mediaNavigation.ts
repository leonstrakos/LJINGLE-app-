import type { TmdbMediaResponse } from './media';

export type MediaStackParamList = {
  MediaList: undefined;
  MediaDetails: { mediaId: string };
  MediaSearch: undefined;
  MediaForm: { mediaId?: string; draft?: TmdbMediaResponse } | undefined;
};
