package hr.leon.library.media.service;

import hr.leon.library.entity.ActivityType;
import hr.leon.library.media.dto.MediaRequest;
import hr.leon.library.media.dto.MediaResponse;
import hr.leon.library.media.entity.MediaEntity;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.entity.WatchStatus;
import hr.leon.library.media.exception.MediaAlreadyExistsException;
import hr.leon.library.media.exception.MediaNotFoundException;
import hr.leon.library.media.mapper.MediaMapper;
import hr.leon.library.media.repository.MediaRepository;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.TimeSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class MediaService {

    private final MediaRepository mediaRepository;
    private final MediaMapper mediaMapper;
    private final ActivityRepository activityRepository;
    private final TimeSessionRepository timeSessionRepository;

    public MediaService(
            MediaRepository mediaRepository,
            MediaMapper mediaMapper,
            ActivityRepository activityRepository,
            TimeSessionRepository timeSessionRepository
    ) {
        this.mediaRepository = mediaRepository;
        this.mediaMapper = mediaMapper;
        this.activityRepository = activityRepository;
        this.timeSessionRepository = timeSessionRepository;
    }

    public MediaResponse getByMediaId(String mediaId) {
        return mediaMapper.toResponse(findEntity(mediaId));
    }

    public List<MediaResponse> getAll(MediaType mediaType, WatchStatus watchStatus) {
        return mediaRepository.findAll().stream()
                .filter(media -> mediaType == null || media.getMediaType() == mediaType)
                .filter(media -> watchStatus == null || media.getWatchStatus() == watchStatus)
                .sorted(Comparator.comparing(MediaEntity::getTitle, String.CASE_INSENSITIVE_ORDER))
                .map(mediaMapper::toResponse)
                .toList();
    }

    @Transactional
    public MediaResponse create(MediaRequest request) {
        rejectDuplicateTmdbItem(request, null);
        return mediaMapper.toResponse(mediaRepository.save(mediaMapper.toEntity(request)));
    }

    @Transactional
    public MediaResponse update(String mediaId, MediaRequest request) {
        MediaEntity entity = findEntity(mediaId);
        rejectDuplicateTmdbItem(request, mediaId);
        mediaMapper.updateEntity(entity, request);
        MediaEntity saved = mediaRepository.save(entity);
        activityRepository
                .findByMediaMediaIdAndActivityType(mediaId, ActivityType.WATCHING)
                .ifPresent(activity -> {
                    String noun = saved.getMediaType() == MediaType.MOVIE ? "Film" : "Serija";
                    activity.setLabel(noun + " — " + saved.getTitle());
                    activityRepository.save(activity);
                });
        return mediaMapper.toResponse(saved);
    }

    @Transactional
    public void delete(String mediaId) {
        MediaEntity entity = findEntity(mediaId);
        activityRepository
                .findByMediaMediaIdAndActivityType(mediaId, ActivityType.WATCHING)
                .flatMap(activity -> timeSessionRepository
                        .findFirstByActivityAndEndedAtIsNullOrderByStartedAtDesc(activity))
                .ifPresent(session -> {
                    session.setEndedAt(Instant.now());
                    timeSessionRepository.save(session);
                });
        mediaRepository.delete(entity);
    }

    private MediaEntity findEntity(String mediaId) {
        return mediaRepository.findByMediaId(mediaId)
                .orElseThrow(() -> new MediaNotFoundException(mediaId));
    }

    private void rejectDuplicateTmdbItem(MediaRequest request, String currentMediaId) {
        if (request.tmdbId() == null) {
            return;
        }
        mediaRepository.findByMediaTypeAndTmdbId(request.mediaType(), request.tmdbId())
                .filter(existing -> !existing.getMediaId().equals(currentMediaId))
                .ifPresent(existing -> {
                    throw new MediaAlreadyExistsException();
                });
    }
}
