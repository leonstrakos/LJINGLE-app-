package hr.leon.library.service;

import hr.leon.library.dto.ActivityRequest;
import hr.leon.library.dto.ActivityResponse;
import hr.leon.library.dto.ActivityTimerResponse;
import hr.leon.library.dto.TimeSessionResponse;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.ActivityType;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.entity.TimeSessionEntity;
import hr.leon.library.entity.TopicEntity;
import hr.leon.library.exception.ActivityNotFoundException;
import hr.leon.library.exception.BookNotFoundException;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.exception.TopicNotFoundException;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.BookRepository;
import hr.leon.library.repository.TimeSessionRepository;
import hr.leon.library.repository.TopicRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class ActivityService {

    private final ActivityRepository activityRepository;
    private final TimeSessionRepository timeSessionRepository;
    private final BookRepository bookRepository;
    private final TopicRepository topicRepository;

    public ActivityService(
            ActivityRepository activityRepository,
            TimeSessionRepository timeSessionRepository,
            BookRepository bookRepository,
            TopicRepository topicRepository
    ) {
        this.activityRepository = activityRepository;
        this.timeSessionRepository = timeSessionRepository;
        this.bookRepository = bookRepository;
        this.topicRepository = topicRepository;
    }

    public List<ActivityResponse> getActivitiesForTopic(String topicId) {
        findTopic(topicId);
        return activityRepository.findAllByTopicTopicIdOrderByLabelAsc(topicId)
                .stream()
                .map(this::toActivityResponse)
                .toList();
    }

    @Transactional
    public ActivityResponse createActivity(String topicId, ActivityRequest request) {
        TopicEntity topic = findTopic(topicId);
        ActivityEntity activity = new ActivityEntity();
        activity.setLabel(request.label().trim());
        activity.setActivityType(request.activityType());
        activity.setTopic(topic);
        return toActivityResponse(activityRepository.save(activity));
    }

    public ActivityTimerResponse getReadingTimer(String bookId) {
        BookEntity book = findBook(bookId);
        return activityRepository
                .findByBookBookIdAndActivityType(bookId, ActivityType.READING)
                .map(activity -> toTimerResponse(activity, Instant.now()))
                .orElseGet(() -> emptyReadingTimer(book));
    }

    @Transactional
    public ActivityTimerResponse startReading(String bookId) {
        BookEntity book = findBook(bookId);
        ActivityEntity activity = activityRepository
                .findByBookBookIdAndActivityType(bookId, ActivityType.READING)
                .orElseGet(() -> createReadingActivity(book));

        if (timeSessionRepository
                .findFirstByActivityAndEndedAtIsNullOrderByStartedAtDesc(activity)
                .isEmpty()) {
            TimeSessionEntity session = new TimeSessionEntity();
            session.setActivity(activity);
            session.setStartedAt(Instant.now());
            timeSessionRepository.save(session);
        }

        return toTimerResponse(activity, Instant.now());
    }

    @Transactional
    public ActivityTimerResponse stopReading(String bookId) {
        BookEntity book = findBook(bookId);
        ActivityEntity activity = activityRepository
                .findByBookBookIdAndActivityType(bookId, ActivityType.READING)
                .orElse(null);

        if (activity == null) {
            return emptyReadingTimer(book);
        }

        stopActiveSession(activity);
        return toTimerResponse(activity, Instant.now());
    }

    @Transactional
    public ActivityTimerResponse stopActivity(String activityId) {
        ActivityEntity activity = activityRepository.findByActivityId(activityId)
                .orElseThrow(() -> new ActivityNotFoundException(activityId));
        stopActiveSession(activity);
        return toTimerResponse(activity, Instant.now());
    }

    @Transactional
    public ActivityTimerResponse startActivity(String activityId) {
        ActivityEntity activity = activityRepository.findByActivityIdForUpdate(activityId)
                .orElseThrow(() -> new ActivityNotFoundException(activityId));
        if (timeSessionRepository
                .findFirstByActivityAndEndedAtIsNullOrderByStartedAtDesc(activity)
                .isEmpty()) {
            TimeSessionEntity session = new TimeSessionEntity();
            session.setActivity(activity);
            session.setStartedAt(Instant.now());
            timeSessionRepository.save(session);
        }
        return toTimerResponse(activity, Instant.now());
    }

    public List<ActivityTimerResponse> getActiveTimers() {
        Map<String, ActivityEntity> uniqueActivities = new LinkedHashMap<>();
        timeSessionRepository.findAllByEndedAtIsNullOrderByStartedAtDesc()
                .forEach(session -> uniqueActivities.putIfAbsent(
                        session.getActivity().getActivityId(),
                        session.getActivity()
                ));

        Instant now = Instant.now();
        return uniqueActivities.values().stream()
                .map(activity -> toTimerResponse(activity, now))
                .toList();
    }

    public List<ActivityTimerResponse> getRecentActivities(int limit) {
        if (limit < 1 || limit > 20) {
            throw new InvalidRequestException("Limit nedavnih aktivnosti mora biti između 1 i 20.");
        }

        Instant now = Instant.now();
        return timeSessionRepository
                .findRecentInactiveActivities(PageRequest.of(0, limit))
                .stream()
                .map(activity -> toTimerResponse(activity, now))
                .toList();
    }

    public List<TimeSessionResponse> getSessions(String activityId) {
        ActivityEntity activity = activityRepository.findByActivityId(activityId)
                .orElseThrow(() -> new ActivityNotFoundException(activityId));
        Instant now = Instant.now();
        return timeSessionRepository.findAllByActivityOrderByStartedAtDesc(activity)
                .stream()
                .map(session -> toSessionResponse(session, now))
                .toList();
    }

    private ActivityEntity createReadingActivity(BookEntity book) {
        ActivityEntity activity = new ActivityEntity();
        activity.setActivityType(ActivityType.READING);
        activity.setLabel("Čitanje — " + book.getTitle());
        activity.setBook(book);
        return activityRepository.save(activity);
    }

    private ActivityTimerResponse emptyReadingTimer(BookEntity book) {
        return new ActivityTimerResponse(
                null,
                "Čitanje — " + book.getTitle(),
                ActivityType.READING.name(),
                book.getBookId(),
                null,
                false,
                null,
                null,
                0,
                0
        );
    }

    private ActivityTimerResponse toTimerResponse(ActivityEntity activity, Instant now) {
        List<TimeSessionEntity> sessions =
                timeSessionRepository.findAllByActivityOrderByStartedAtDesc(activity);
        TimeSessionEntity activeSession = sessions.stream()
                .filter(session -> session.getEndedAt() == null)
                .findFirst()
                .orElse(null);

        long completedSeconds = sessions.stream()
                .filter(session -> session.getEndedAt() != null)
                .mapToLong(session -> durationSeconds(
                        session.getStartedAt(),
                        session.getEndedAt()
                ))
                .sum();
        long activeSeconds = activeSession == null
                ? 0
                : durationSeconds(activeSession.getStartedAt(), now);
        BookEntity book = activity.getBook();
        TopicEntity topic = activity.getTopic();

        return new ActivityTimerResponse(
                activity.getActivityId(),
                activity.getLabel(),
                activity.getActivityType().name(),
                book == null ? null : book.getBookId(),
                topic == null ? null : topic.getTopicId(),
                activeSession != null,
                activeSession == null ? null : activeSession.getSessionId(),
                activeSession == null ? null : activeSession.getStartedAt(),
                completedSeconds,
                completedSeconds + activeSeconds
        );
    }

    private TimeSessionResponse toSessionResponse(TimeSessionEntity session, Instant now) {
        Instant effectiveEnd = session.getEndedAt() == null ? now : session.getEndedAt();
        return new TimeSessionResponse(
                session.getSessionId(),
                session.getStartedAt(),
                session.getEndedAt(),
                durationSeconds(session.getStartedAt(), effectiveEnd),
                session.getEndedAt() == null
        );
    }

    private ActivityResponse toActivityResponse(ActivityEntity activity) {
        BookEntity book = activity.getBook();
        TopicEntity topic = activity.getTopic();
        return new ActivityResponse(
                activity.getActivityId(),
                activity.getLabel(),
                activity.getActivityType().name(),
                book == null ? null : book.getBookId(),
                topic == null ? null : topic.getTopicId(),
                activity.getCreatedAt(),
                activity.getModifiedAt()
        );
    }

    private long durationSeconds(Instant start, Instant end) {
        return Math.max(0, Duration.between(start, end).getSeconds());
    }

    private void stopActiveSession(ActivityEntity activity) {
        timeSessionRepository
                .findFirstByActivityAndEndedAtIsNullOrderByStartedAtDesc(activity)
                .ifPresent(session -> {
                    session.setEndedAt(Instant.now());
                    timeSessionRepository.save(session);
                });
    }

    private BookEntity findBook(String bookId) {
        return bookRepository.findByBookId(bookId)
                .orElseThrow(() -> new BookNotFoundException(bookId));
    }

    private TopicEntity findTopic(String topicId) {
        return topicRepository.findByTopicId(topicId)
                .orElseThrow(() -> new TopicNotFoundException(topicId));
    }
}
