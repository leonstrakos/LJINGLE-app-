package hr.leon.library.service;

import hr.leon.library.dto.BookRequest;
import hr.leon.library.dto.BookResponse;
import hr.leon.library.dto.PagedResponse;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.exception.BookNotFoundException;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.mapper.BookMapper;
import hr.leon.library.repository.BookRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class BookService {

    private final BookRepository bookRepository;
    private final BookMapper bookMapper;

    public BookService(BookRepository bookRepository, BookMapper bookMapper) {
        this.bookRepository = bookRepository;
        this.bookMapper = bookMapper;
    }

    public BookResponse getByBookId(String bookId) {
        return bookMapper.toResponse(findEntity(bookId));
    }

    public List<BookResponse> getAll() {
        return bookRepository.findAll(Sort.by(Sort.Direction.ASC, "title"))
                .stream()
                .map(bookMapper::toResponse)
                .toList();
    }

    public PagedResponse<BookResponse> getPage(int page, int size) {
        Page<BookResponse> result = bookRepository
                .findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "title")))
                .map(bookMapper::toResponse);
        return PagedResponse.from(result);
    }

    @Transactional
    public BookResponse create(BookRequest request) {
        validateTracking(request);
        BookEntity saved = bookRepository.save(bookMapper.toEntity(request));
        return bookMapper.toResponse(saved);
    }

    @Transactional
    public BookResponse update(String bookId, BookRequest request) {
        validateTracking(request);
        BookEntity entity = findEntity(bookId);
        bookMapper.updateEntity(entity, request);
        return bookMapper.toResponse(bookRepository.save(entity));
    }

    @Transactional
    public void delete(String bookId) {
        BookEntity entity = findEntity(bookId);
        bookRepository.delete(entity);
    }

    private BookEntity findEntity(String bookId) {
        return bookRepository.findByBookId(bookId)
                .orElseThrow(() -> new BookNotFoundException(bookId));
    }

    private void validateTracking(BookRequest request) {
        if (request.progress() < 0 || request.progress() > 100) {
            throw new InvalidRequestException("Napredak mora biti između 0 i 100.");
        }
        if (request.startedOn() != null
                && request.finishedOn() != null
                && request.finishedOn().isBefore(request.startedOn())) {
            throw new InvalidRequestException("Datum završetka ne može biti prije datuma početka.");
        }
    }
}
