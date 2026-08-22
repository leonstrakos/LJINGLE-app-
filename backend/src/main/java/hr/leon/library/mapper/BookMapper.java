package hr.leon.library.mapper;

import hr.leon.library.dto.BookRequest;
import hr.leon.library.dto.BookResponse;
import hr.leon.library.entity.BookEntity;
import org.springframework.stereotype.Component;

@Component
public class BookMapper {

    public BookEntity toEntity(BookRequest request) {
        BookEntity entity = new BookEntity();
        updateEntity(entity, request);
        return entity;
    }

    public void updateEntity(BookEntity entity, BookRequest request) {
        entity.setTitle(request.title().trim());
        entity.setAuthor(request.author().trim());
        entity.setIsbn(request.isbn().trim());
        entity.setPublishedYear(request.publishedYear());
        entity.setReadingStatus(request.readingStatus());
        entity.setProgress(request.progress());
        entity.setEnjoyment(request.enjoyment());
        entity.setFavourite(request.favourite());
        entity.setStartedOn(request.startedOn());
        entity.setFinishedOn(request.finishedOn());
    }

    public BookResponse toResponse(BookEntity entity) {
        return new BookResponse(
                entity.getBookId(),
                entity.getTitle(),
                entity.getAuthor(),
                entity.getIsbn(),
                entity.getPublishedYear(),
                entity.getReadingStatus(),
                entity.getProgress(),
                entity.getEnjoyment(),
                entity.isFavourite(),
                entity.getStartedOn(),
                entity.getFinishedOn()
        );
    }
}
