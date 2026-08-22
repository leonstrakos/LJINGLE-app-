package hr.leon.library.media.exception;

public class MediaAlreadyExistsException extends RuntimeException {
    public MediaAlreadyExistsException() {
        super("Taj TMDB naslov već postoji u katalogu.");
    }
}
