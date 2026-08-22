package hr.leon.library.controller;

import hr.leon.library.dto.BookRequest;
import hr.leon.library.dto.BookResponse;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.service.BookService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@Validated
@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @GetMapping("/{bookId}")
    public BookResponse getBook(@PathVariable String bookId) {
        return bookService.getByBookId(bookId);
    }

    @GetMapping
    public ResponseEntity<?> getBooks(
            @RequestParam(required = false) @Min(0) Integer page,
            @RequestParam(required = false) @Min(1) @Max(100) Integer size
    ) {
        if ((page == null) != (size == null)) {
            throw new InvalidRequestException("Parametri page i size moraju biti poslani zajedno.");
        }

        if (page == null) {
            return ResponseEntity.ok(bookService.getAll());
        }
        return ResponseEntity.ok(bookService.getPage(page, size));
    }

    @PostMapping
    public ResponseEntity<BookResponse> createBook(@Valid @RequestBody BookRequest request) {
        BookResponse created = bookService.create(request);
        return ResponseEntity
                .created(URI.create("/api/books/" + created.bookId()))
                .body(created);
    }

    @PutMapping("/{bookId}")
    public BookResponse updateBook(
            @PathVariable String bookId,
            @Valid @RequestBody BookRequest request
    ) {
        return bookService.update(bookId, request);
    }

    @DeleteMapping("/{bookId}")
    public ResponseEntity<Void> deleteBook(@PathVariable String bookId) {
        bookService.delete(bookId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
