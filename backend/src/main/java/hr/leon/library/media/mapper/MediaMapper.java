package hr.leon.library.media.mapper;

import hr.leon.library.media.dto.MediaRequest;
import hr.leon.library.media.dto.MediaResponse;
import hr.leon.library.media.entity.MediaEntity;
import org.springframework.stereotype.Component;

@Component
public class MediaMapper {

    public MediaEntity toEntity(MediaRequest request) {
        MediaEntity entity = new MediaEntity();
        updateEntity(entity, request);
        return entity;
    }

    public void updateEntity(MediaEntity entity, MediaRequest request) {
        entity.setMediaType(request.mediaType());
        entity.setTmdbId(request.tmdbId());
        entity.setTitle(request.title().trim());
        entity.setOriginalTitle(trimToNull(request.originalTitle()));
        entity.setOverview(trimToNull(request.overview()));
        entity.setPosterPath(trimToNull(request.posterPath()));
        entity.setBackdropPath(trimToNull(request.backdropPath()));
        entity.setReleaseYear(request.releaseYear());
        entity.setWatchStatus(request.watchStatus());
        entity.setProgress(request.progress());
        entity.setEnjoyment(request.enjoyment());
        entity.setFavourite(request.favourite());
        entity.setStartedOn(request.startedOn());
        entity.setCompletedOn(request.completedOn());
    }

    public MediaResponse toResponse(MediaEntity entity) {
        return new MediaResponse(
                entity.getMediaId(),
                entity.getMediaType(),
                entity.getTmdbId(),
                entity.getTitle(),
                entity.getOriginalTitle(),
                entity.getOverview(),
                entity.getPosterPath(),
                entity.getBackdropPath(),
                entity.getReleaseYear(),
                entity.getWatchStatus(),
                entity.getProgress(),
                entity.getEnjoyment(),
                entity.isFavourite(),
                entity.getStartedOn(),
                entity.getCompletedOn()
        );
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
