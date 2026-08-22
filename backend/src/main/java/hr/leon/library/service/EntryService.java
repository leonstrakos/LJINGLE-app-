package hr.leon.library.service;

import hr.leon.library.dto.EntryRequest;
import hr.leon.library.dto.EntryResponse;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.entity.EntryEntity;
import hr.leon.library.entity.EntryType;
import hr.leon.library.entity.TopicEntity;
import hr.leon.library.exception.ActivityNotFoundException;
import hr.leon.library.exception.BookNotFoundException;
import hr.leon.library.exception.EntryNotFoundException;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.exception.TopicNotFoundException;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.BookRepository;
import hr.leon.library.repository.EntryRepository;
import hr.leon.library.repository.TopicRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class EntryService {

    private final EntryRepository entryRepository;
    private final BookRepository bookRepository;
    private final TopicRepository topicRepository;
    private final ActivityRepository activityRepository;

    public EntryService(
            EntryRepository entryRepository,
            BookRepository bookRepository,
            TopicRepository topicRepository,
            ActivityRepository activityRepository
    ) {
        this.entryRepository = entryRepository;
        this.bookRepository = bookRepository;
        this.topicRepository = topicRepository;
        this.activityRepository = activityRepository;
    }

    public List<EntryResponse> getAll(
            String bookId,
            String topicId,
            String activityId,
            String type
    ) {
        String normalizedBookId = normalizeOptional(bookId);
        String normalizedTopicId = normalizeOptional(topicId);
        String normalizedActivityId = normalizeOptional(activityId);
        EntryType normalizedType = parseType(type);

        validateBook(normalizedBookId);
        validateTopic(normalizedTopicId);
        validateActivity(normalizedActivityId);

        return entryRepository.findAllFiltered(
                        normalizedBookId,
                        normalizedTopicId,
                        normalizedActivityId,
                        normalizedType
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public EntryResponse getByEntryId(String entryId) {
        return toResponse(findEntry(entryId));
    }

    @Transactional
    public EntryResponse create(EntryRequest request) {
        EntryEntity entry = new EntryEntity();
        applyRequest(entry, request);
        return toResponse(entryRepository.save(entry));
    }

    @Transactional
    public EntryResponse update(String entryId, EntryRequest request) {
        EntryEntity entry = findEntry(entryId);
        applyRequest(entry, request);
        return toResponse(entryRepository.saveAndFlush(entry));
    }

    @Transactional
    public void delete(String entryId) {
        entryRepository.delete(findEntry(entryId));
    }

    private void applyRequest(EntryEntity entry, EntryRequest request) {
        String bookId = normalizeOptional(request.bookId());
        String topicId = normalizeOptional(request.topicId());
        String activityId = normalizeOptional(request.activityId());

        entry.setTitle(normalizeOptional(request.title()));
        entry.setContent(request.content().trim());
        entry.setEntryType(request.type());
        entry.setBook(findBook(bookId));
        entry.setTopic(findTopic(topicId));
        entry.setActivity(findActivity(activityId));
    }

    private EntryEntity findEntry(String entryId) {
        return entryRepository.findByEntryId(entryId)
                .orElseThrow(() -> new EntryNotFoundException(entryId));
    }

    private BookEntity findBook(String bookId) {
        if (bookId == null) {
            return null;
        }
        return bookRepository.findByBookId(bookId)
                .orElseThrow(() -> new BookNotFoundException(bookId));
    }

    private TopicEntity findTopic(String topicId) {
        if (topicId == null) {
            return null;
        }
        return topicRepository.findByTopicId(topicId)
                .orElseThrow(() -> new TopicNotFoundException(topicId));
    }

    private ActivityEntity findActivity(String activityId) {
        if (activityId == null) {
            return null;
        }
        return activityRepository.findByActivityId(activityId)
                .orElseThrow(() -> new ActivityNotFoundException(activityId));
    }

    private void validateBook(String bookId) {
        if (bookId != null && !bookRepository.existsByBookId(bookId)) {
            throw new BookNotFoundException(bookId);
        }
    }

    private void validateTopic(String topicId) {
        if (topicId != null && topicRepository.findByTopicId(topicId).isEmpty()) {
            throw new TopicNotFoundException(topicId);
        }
    }

    private void validateActivity(String activityId) {
        if (activityId != null && activityRepository.findByActivityId(activityId).isEmpty()) {
            throw new ActivityNotFoundException(activityId);
        }
    }

    private EntryType parseType(String type) {
        String normalized = normalizeOptional(type);
        if (normalized == null) {
            return null;
        }
        try {
            return EntryType.valueOf(normalized.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            String allowed = Arrays.stream(EntryType.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            throw new InvalidRequestException(
                    "Nepoznata vrsta zapisa. Dopuštene vrijednosti su: " + allowed + "."
            );
        }
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private EntryResponse toResponse(EntryEntity entry) {
        BookEntity book = entry.getBook();
        TopicEntity topic = entry.getTopic();
        ActivityEntity activity = entry.getActivity();
        return new EntryResponse(
                entry.getEntryId(),
                entry.getTitle(),
                entry.getContent(),
                entry.getEntryType().name(),
                book == null ? null : book.getBookId(),
                topic == null ? null : topic.getTopicId(),
                activity == null ? null : activity.getActivityId(),
                entry.getCreatedAt(),
                entry.getModifiedAt()
        );
    }
}
