import type { TmdbMediaResponse } from './media';

export type MediaStackParamList = {
  MediaList: { focusMediaId?: string; collectionId?: string } | undefined;
  MediaDetails: { mediaId: string };
  MediaSearch: undefined;
  MediaForm: { mediaId?: string; draft?: TmdbMediaResponse } | undefined;
};
