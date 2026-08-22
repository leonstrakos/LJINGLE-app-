package hr.leon.library.media.exception;

public class MediaNotFoundException extends RuntimeException {
    public MediaNotFoundException(String mediaId) {
        super("Film ili serija nije pronađena: " + mediaId);
    }
}
