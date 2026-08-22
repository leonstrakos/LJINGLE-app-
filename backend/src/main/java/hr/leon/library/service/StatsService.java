package hr.leon.library.service;

import hr.leon.library.dto.DailyActivityTimeResponse;
import hr.leon.library.dto.DailyTimeResponse;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.entity.TimeSessionEntity;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.repository.SessionStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class StatsService {

    private static final String DEFAULT_ZONE = "Europe/Zagreb";

    private final SessionStatsRepository sessionStatsRepository;

    public StatsService(SessionStatsRepository sessionStatsRepository) {
        this.sessionStatsRepository = sessionStatsRepository;
    }

    public DailyTimeResponse getDaily(String requestedDate, String requestedZone) {
        ZoneId zone = parseZone(requestedZone);
        LocalDate date = parseDate(requestedDate, zone);
        Instant dayStart = date.atStartOfDay(zone).toInstant();
        Instant dayEnd = date.plusDays(1).atStartOfDay(zone).toInstant();
        Instant now = Instant.now();

        Map<String, MutableActivityTime> grouped = new LinkedHashMap<>();
        sessionStatsRepository.findSessionsOverlapping(dayStart, dayEnd)
                .forEach(session -> addSession(grouped, session, dayStart, dayEnd, now));

        List<DailyActivityTimeResponse> activities = grouped.values().stream()
                .map(MutableActivityTime::toResponse)
                .toList();
        long totalSeconds = activities.stream()
                .mapToLong(DailyActivityTimeResponse::seconds)
                .sum();

        return new DailyTimeResponse(date, zone.getId(), totalSeconds, activities);
    }

    private void addSession(
            Map<String, MutableActivityTime> grouped,
            TimeSessionEntity session,
            Instant dayStart,
            Instant dayEnd,
            Instant now
    ) {
        Instant effectiveEnd = session.getEndedAt() == null ? now : session.getEndedAt();
        Instant overlapStart = later(session.getStartedAt(), dayStart);
        Instant overlapEnd = earlier(effectiveEnd, dayEnd);
        long seconds = Math.max(0, Duration.between(overlapStart, overlapEnd).getSeconds());
        if (seconds == 0) {
            return;
        }

        ActivityEntity activity = session.getActivity();
        MutableActivityTime summary = grouped.computeIfAbsent(
                activity.getActivityId(),
                ignored -> new MutableActivityTime(activity)
        );
        summary.seconds += seconds;
        summary.running = summary.running || session.getEndedAt() == null;
    }

    private ZoneId parseZone(String requestedZone) {
        String value = requestedZone == null || requestedZone.isBlank()
                ? DEFAULT_ZONE
                : requestedZone.trim();
        try {
            return ZoneId.of(value);
        } catch (DateTimeException exception) {
            throw new InvalidRequestException("Vremenska zona nije valjana: " + value);
        }
    }

    private LocalDate parseDate(String requestedDate, ZoneId zone) {
        if (requestedDate == null || requestedDate.isBlank()) {
            return LocalDate.now(zone);
        }
        try {
            return LocalDate.parse(requestedDate.trim());
        } catch (DateTimeParseException exception) {
            throw new InvalidRequestException("Datum mora biti u obliku GGGG-MM-DD.");
        }
    }

    private Instant later(Instant first, Instant second) {
        return first.isAfter(second) ? first : second;
    }

    private Instant earlier(Instant first, Instant second) {
        return first.isBefore(second) ? first : second;
    }

    private static final class MutableActivityTime {
        private final String activityId;
        private final String label;
        private final String activityType;
        private final String bookId;
        private long seconds;
        private boolean running;

        private MutableActivityTime(ActivityEntity activity) {
            BookEntity book = activity.getBook();
            this.activityId = activity.getActivityId();
            this.label = activity.getLabel();
            this.activityType = activity.getActivityType().name();
            this.bookId = book == null ? null : book.getBookId();
        }

        private DailyActivityTimeResponse toResponse() {
            return new DailyActivityTimeResponse(
                    activityId,
                    label,
                    activityType,
                    bookId,
                    seconds,
                    running
            );
        }
    }
}
