package hr.leon.library.exception;

public class BookNotFoundException extends RuntimeException {
    public BookNotFoundException(String bookId) {
        super("Knjiga s identifikatorom " + bookId + " nije pronađena.");
    }
}
