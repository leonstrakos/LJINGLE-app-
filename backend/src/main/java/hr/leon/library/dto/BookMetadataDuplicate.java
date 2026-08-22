package hr.leon.library.dto;

public record BookMetadataDuplicate(
        String bookId,
        String title,
        String author,
        String isbn,
        DuplicateReason reason
) {
    public enum DuplicateReason {
        ISBN,
        TITLE_AUTHOR
    }
}
