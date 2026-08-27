import { bookApi } from '../../../services/bookApi';
import { mediaApi } from '../../../services/mediaApi';
import { seriesApi } from '../../../services/seriesApi';
import type { CaptureOperation } from './types';

function midnightIso(date: string): string {
  return new Date(date + 'T12:00:00').toISOString();
}

export async function executeCaptureOperation(operation: CaptureOperation): Promise<void> {
  if(operation.kind==='UPDATE_BOOK'){
    const current=await bookApi.getById(operation.entity.entityId);
    await bookApi.update(operation.entity.entityId,{
      ...current,
      ...operation.patch,
      progress: operation.patch.progress ?? current.progress,
      readingStatus: operation.patch.readingStatus ?? current.readingStatus,
      startedOn: operation.patch.startedOn !== undefined ? operation.patch.startedOn : current.startedOn,
      finishedOn: operation.patch.finishedOn !== undefined ? operation.patch.finishedOn : current.finishedOn,
    });
    return;
  }

  if(operation.kind==='UPDATE_MEDIA'){
    const current=await mediaApi.getById(operation.entity.entityId);
    await mediaApi.update(operation.entity.entityId,{
      ...current,
      ...operation.patch,
      progress: operation.patch.progress ?? current.progress,
      watchStatus: operation.patch.watchStatus ?? current.watchStatus,
      startedOn: operation.patch.startedOn !== undefined ? operation.patch.startedOn : current.startedOn,
      completedOn: operation.patch.completedOn !== undefined ? operation.patch.completedOn : current.completedOn,
    });
    return;
  }

  if(operation.kind==='MARK_NEXT_SERIES_EPISODES'){
    let progress=await seriesApi.getProgress(operation.entity.entityId);
    const candidates=progress.episodes
      .filter(ep=>ep.seasonNumber>0&&!ep.watched)
      .slice(0,operation.count);

    if(candidates.length!==operation.count){
      throw new Error(
        `Cannot safely mark ${operation.count} episodes: only ${candidates.length} unwatched regular episodes are available.`
      );
    }

    const watchedAt=operation.occurredOn ? midnightIso(operation.occurredOn) : undefined;
    for(const episode of candidates){
      progress=await seriesApi.setWatchedAt(
        operation.entity.entityId,
        episode.episodeId,
        true,
        watchedAt,
      );
    }
    return;
  }

  const never: never = operation;
  throw new Error('Unsupported capture operation: '+JSON.stringify(never));
}
