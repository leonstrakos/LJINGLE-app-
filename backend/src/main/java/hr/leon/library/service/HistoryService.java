package hr.leon.library.service;

import hr.leon.library.dto.HistorySessionResponse;
import hr.leon.library.dto.PagedResponse;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.entity.TimeSessionEntity;
import hr.leon.library.entity.TopicEntity;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.repository.SessionHistoryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;

@Service
@Transactional(readOnly = true)
public class HistoryService {

    private static final String DEFAULT_ZONE = "Europe/Zagreb";
    private static final int MAX_PAGE_SIZE = 100;

    private final SessionHistoryRepository sessionHistoryRepository;

    public HistoryService(SessionHistoryRepository sessionHistoryRepository) {
        this.sessionHistoryRepository = sessionHistoryRepository;
    }

    public PagedResponse<HistorySessionResponse> getSessions(
            int page,
            int size,
            String requestedDate,
            String requestedZone
    ) {
        Pageable pageable = createPageable(page, size);
        Instant now = Instant.now();
        Page<TimeSessionEntity> sessions;

        if (requestedDate == null || requestedDate.isBlank()) {
            sessions = sessionHistoryRepository.findAll(pageable);
        } else {
            ZoneId zone = parseZone(requestedZone);
            LocalDate date = parseDate(requestedDate);
            Instant dayStart = date.atStartOfDay(zone).toInstant();
            Instant dayEnd = date.plusDays(1).atStartOfDay(zone).toInstant();
            Instant effectiveEnd = dayEnd.isBefore(now) ? dayEnd : now;

            sessions = !effectiveEnd.isAfter(dayStart)
                    ? Page.empty(pageable)
                    : sessionHistoryRepository.findSessionsOverlapping(
                            dayStart,
                            effectiveEnd,
                            pageable
                    );
        }

        return PagedResponse.from(sessions.map(session -> toResponse(session, now)));
    }

    private Pageable createPageable(int page, int size) {
        if (page < 0) {
            throw new InvalidRequestException("Broj stranice ne može biti negativan.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("Veličina stranice mora biti između 1 i 100.");
        }

        Sort sort = Sort.by(
                Sort.Order.desc("startedAt"),
                Sort.Order.desc("id")
        );
        return PageRequest.of(page, size, sort);
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

    private LocalDate parseDate(String requestedDate) {
        try {
            return LocalDate.parse(requestedDate.trim());
        } catch (DateTimeParseException exception) {
            throw new InvalidRequestException("Datum mora biti u obliku GGGG-MM-DD.");
        }
    }

    private HistorySessionResponse toResponse(TimeSessionEntity session, Instant now) {
        ActivityEntity activity = session.getActivity();
        BookEntity book = activity.getBook();
        TopicEntity topic = activity.getTopic();
        Instant effectiveEnd = session.getEndedAt() == null ? now : session.getEndedAt();

        return new HistorySessionResponse(
                session.getSessionId(),
                activity.getActivityId(),
                activity.getLabel(),
                activity.getActivityType().name(),
                book == null ? null : book.getBookId(),
                topic == null ? null : topic.getTopicId(),
                session.getStartedAt(),
                session.getEndedAt(),
                Math.max(0, Duration.between(session.getStartedAt(), effectiveEnd).getSeconds()),
                session.getEndedAt() == null
        );
    }
}
