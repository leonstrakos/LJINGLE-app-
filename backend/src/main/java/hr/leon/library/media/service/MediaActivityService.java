package hr.leon.library.media.service;

import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.ActivityType;
import hr.leon.library.entity.TimeSessionEntity;
import hr.leon.library.media.dto.MediaTimerResponse;
import hr.leon.library.media.entity.MediaEntity;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.exception.MediaNotFoundException;
import hr.leon.library.media.repository.MediaRepository;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.TimeSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class MediaActivityService {

    private final MediaRepository mediaRepository;
    private final ActivityRepository activityRepository;
    private final TimeSessionRepository timeSessionRepository;

    public MediaActivityService(
            MediaRepository mediaRepository,
            ActivityRepository activityRepository,
            TimeSessionRepository timeSessionRepository
    ) {
        this.mediaRepository = mediaRepository;
        this.activityRepository = activityRepository;
        this.timeSessionRepository = timeSessionRepository;
    }

    public MediaTimerResponse getWatchingTimer(String mediaId) {
        MediaEntity media = findMedia(mediaId);
        return activityRepository
                .findByMediaMediaIdAndActivityType(mediaId, ActivityType.WATCHING)
                .map(activity -> toTimerResponse(activity, media, Instant.now()))
                .orElseGet(() -> emptyTimer(media));
    }

    @Transactional
    public MediaTimerResponse startWatching(String mediaId) {
        MediaEntity media = mediaRepository.findByMediaIdForUpdate(mediaId)
                .orElseThrow(() -> new MediaNotFoundException(mediaId));
        ActivityEntity activity = activityRepository
                .findByMediaMediaIdAndActivityType(mediaId, ActivityType.WATCHING)
                .orElseGet(() -> createWatchingActivity(media));

        if (timeSessionRepository
                .findFirstByActivityAndEndedAtIsNullOrderByStartedAtDesc(activity)
                .isEmpty()) {
            TimeSessionEntity session = new TimeSessionEntity();
            session.setActivity(activity);
            session.setStartedAt(Instant.now());
            timeSessionRepository.save(session);
        }
        return toTimerResponse(activity, media, Instant.now());
    }

    @Transactional
    public MediaTimerResponse stopWatching(String mediaId) {
        MediaEntity media = findMedia(mediaId);
        ActivityEntity activity = activityRepository
                .findByMediaMediaIdAndActivityType(mediaId, ActivityType.WATCHING)
                .orElse(null);
        if (activity == null) {
            return emptyTimer(media);
        }

        timeSessionRepository
                .findFirstByActivityAndEndedAtIsNullOrderByStartedAtDesc(activity)
                .ifPresent(session -> {
                    session.setEndedAt(Instant.now());
                    timeSessionRepository.save(session);
                });
        return toTimerResponse(activity, media, Instant.now());
    }

    private ActivityEntity createWatchingActivity(MediaEntity media) {
        ActivityEntity activity = new ActivityEntity();
        activity.setActivityType(ActivityType.WATCHING);
        activity.setLabel(watchingLabel(media));
        activity.setMedia(media);
        return activityRepository.save(activity);
    }

    private MediaTimerResponse emptyTimer(MediaEntity media) {
        return new MediaTimerResponse(
                null,
                watchingLabel(media),
                ActivityType.WATCHING.name(),
                media.getMediaId(),
                false,
                null,
                null,
                0,
                0
        );
    }

    private MediaTimerResponse toTimerResponse(
            ActivityEntity activity,
            MediaEntity media,
            Instant now
    ) {
        List<TimeSessionEntity> sessions =
                timeSessionRepository.findAllByActivityOrderByStartedAtDesc(activity);
        TimeSessionEntity active = sessions.stream()
                .filter(session -> session.getEndedAt() == null)
                .findFirst()
                .orElse(null);
        long completedSeconds = sessions.stream()
                .filter(session -> session.getEndedAt() != null)
                .mapToLong(session -> durationSeconds(session.getStartedAt(), session.getEndedAt()))
                .sum();
        long activeSeconds = active == null
                ? 0
                : durationSeconds(active.getStartedAt(), now);

        return new MediaTimerResponse(
                activity.getActivityId(),
                activity.getLabel(),
                activity.getActivityType().name(),
                media.getMediaId(),
                active != null,
                active == null ? null : active.getSessionId(),
                active == null ? null : active.getStartedAt(),
                completedSeconds,
                completedSeconds + activeSeconds
        );
    }

    private String watchingLabel(MediaEntity media) {
        String noun = media.getMediaType() == MediaType.MOVIE ? "Film" : "Serija";
        return noun + " — " + media.getTitle();
    }

    private long durationSeconds(Instant start, Instant end) {
        return Math.max(0, Duration.between(start, end).getSeconds());
    }

    private MediaEntity findMedia(String mediaId) {
        return mediaRepository.findByMediaId(mediaId)
                .orElseThrow(() -> new MediaNotFoundException(mediaId));
    }
}
