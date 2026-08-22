package hr.leon.library.collection.service;

import hr.leon.library.collection.dto.EntityReferenceResponse;
import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.entity.EntryEntity;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.media.repository.MediaRepository;
import hr.leon.library.repository.BookRepository;
import hr.leon.library.repository.EntryRepository;
import hr.leon.library.repository.GameRepository;
import hr.leon.library.repository.TopicRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class EntityReferenceService {

    private final BookRepository bookRepository;
    private final MediaRepository mediaRepository;
    private final GameRepository gameRepository;
    private final TopicRepository topicRepository;
    private final EntryRepository entryRepository;

    public EntityReferenceService(
            BookRepository bookRepository,
            MediaRepository mediaRepository,
            GameRepository gameRepository,
            TopicRepository topicRepository,
            EntryRepository entryRepository
    ) {
        this.bookRepository = bookRepository;
        this.mediaRepository = mediaRepository;
        this.gameRepository = gameRepository;
        this.topicRepository = topicRepository;
        this.entryRepository = entryRepository;
    }

    public EntityReferenceResponse resolve(EntityReferenceType type, String id) {
        return switch (type) {
            case BOOK -> bookRepository.findByBookId(id)
                    .map(book -> new EntityReferenceResponse(type, id, book.getTitle(), book.getAuthor()))
                    .orElseThrow(() -> missing(type, id));
            case MEDIA -> mediaRepository.findByMediaId(id)
                    .map(media -> new EntityReferenceResponse(
                            type,
                            id,
                            media.getTitle(),
                            media.getMediaType().name()
                    ))
                    .orElseThrow(() -> missing(type, id));
            case GAME -> gameRepository.findByGameId(id)
                    .map(game -> new EntityReferenceResponse(type, id, game.getTitle(), game.getPlatform()))
                    .orElseThrow(() -> missing(type, id));
            case TOPIC -> topicRepository.findByTopicId(id)
                    .map(topic -> new EntityReferenceResponse(type, id, topic.getName(), topic.getDescription()))
                    .orElseThrow(() -> missing(type, id));
            case ENTRY -> entryRepository.findByEntryId(id)
                    .map(entry -> new EntityReferenceResponse(
                            type,
                            id,
                            entryTitle(entry),
                            entry.getEntryType().name()
                    ))
                    .orElseThrow(() -> missing(type, id));
        };
    }

    public List<EntityReferenceResponse> search(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<EntityReferenceResponse> all = new ArrayList<>();

        bookRepository.findAll().forEach(book -> all.add(new EntityReferenceResponse(
                EntityReferenceType.BOOK,
                book.getBookId(),
                book.getTitle(),
                book.getAuthor()
        )));
        mediaRepository.findAll().forEach(media -> all.add(new EntityReferenceResponse(
                EntityReferenceType.MEDIA,
                media.getMediaId(),
                media.getTitle(),
                media.getMediaType().name()
        )));
        gameRepository.findAll().forEach(game -> all.add(new EntityReferenceResponse(
                EntityReferenceType.GAME,
                game.getGameId(),
                game.getTitle(),
                game.getPlatform()
        )));
        topicRepository.findAll().forEach(topic -> all.add(new EntityReferenceResponse(
                EntityReferenceType.TOPIC,
                topic.getTopicId(),
                topic.getName(),
                topic.getDescription()
        )));
        entryRepository.findAll().forEach(entry -> all.add(new EntityReferenceResponse(
                EntityReferenceType.ENTRY,
                entry.getEntryId(),
                entryTitle(entry),
                entry.getEntryType().name()
        )));

        return all.stream()
                .filter(item -> normalized.isBlank() || haystack(item).contains(normalized))
                .sorted(Comparator.comparing(EntityReferenceResponse::title, String.CASE_INSENSITIVE_ORDER))
                .limit(120)
                .toList();
    }

    private String haystack(EntityReferenceResponse item) {
        return (item.title() + " " + (item.subtitle() == null ? "" : item.subtitle()) + " " + item.entityType())
                .toLowerCase(Locale.ROOT);
    }

    private String entryTitle(EntryEntity entry) {
        if (entry.getTitle() != null && !entry.getTitle().isBlank()) {
            return entry.getTitle().trim();
        }
        String content = entry.getContent().replaceAll("\\s+", " ").trim();
        if (content.length() <= 60) return content;
        return content.substring(0, 57) + "…";
    }

    private InvalidRequestException missing(EntityReferenceType type, String id) {
        return new InvalidRequestException("Stavka " + type + " s identifikatorom " + id + " ne postoji.");
    }
}
