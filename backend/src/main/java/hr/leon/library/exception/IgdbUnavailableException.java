package hr.leon.library.exception;

public class IgdbUnavailableException extends RuntimeException {

    public IgdbUnavailableException(String message) {
        super(message);
    }

    public IgdbUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
