package hr.leon.library.exception;

public class EntryNotFoundException extends RuntimeException {
    public EntryNotFoundException(String entryId) {
        super("Zapis s identifikatorom " + entryId + " nije pronađen.");
    }
}
