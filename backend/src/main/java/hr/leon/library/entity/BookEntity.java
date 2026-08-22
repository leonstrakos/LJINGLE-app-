package hr.leon.library.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "books")
public class BookEntity extends BaseEntity {

    @Column(name = "book_id", nullable = false, unique = true, updatable = false, length = 36)
    private String bookId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 255)
    private String author;

    @Column(nullable = false, length = 32)
    private String isbn;

    @Column(name = "published_year", nullable = false)
    private Integer publishedYear;

    // Legacy storage column retained so existing installations and seed migrations remain valid.
    @Column(nullable = false)
    private boolean available = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "reading_status", nullable = false, length = 32)
    private ReadingStatus readingStatus = ReadingStatus.LATER;

    @Column(nullable = false)
    private int progress;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private Enjoyment enjoyment;

    @Column(nullable = false)
    private boolean favourite;

    @Column(name = "started_on")
    private LocalDate startedOn;

    @Column(name = "finished_on")
    private LocalDate finishedOn;

    @PrePersist
    void initializeBookId() {
        if (bookId == null) {
            bookId = UUID.randomUUID().toString();
        }
    }

    public String getBookId() {
        return bookId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getIsbn() {
        return isbn;
    }

    public void setIsbn(String isbn) {
        this.isbn = isbn;
    }

    public Integer getPublishedYear() {
        return publishedYear;
    }

    public void setPublishedYear(Integer publishedYear) {
        this.publishedYear = publishedYear;
    }

    public ReadingStatus getReadingStatus() {
        return readingStatus;
    }

    public void setReadingStatus(ReadingStatus readingStatus) {
        this.readingStatus = readingStatus;
    }

    public int getProgress() {
        return progress;
    }

    public void setProgress(int progress) {
        this.progress = progress;
    }

    public Enjoyment getEnjoyment() {
        return enjoyment;
    }

    public void setEnjoyment(Enjoyment enjoyment) {
        this.enjoyment = enjoyment;
    }

    public boolean isFavourite() {
        return favourite;
    }

    public void setFavourite(boolean favourite) {
        this.favourite = favourite;
    }

    public LocalDate getStartedOn() {
        return startedOn;
    }

    public void setStartedOn(LocalDate startedOn) {
        this.startedOn = startedOn;
    }

    public LocalDate getFinishedOn() {
        return finishedOn;
    }

    public void setFinishedOn(LocalDate finishedOn) {
        this.finishedOn = finishedOn;
    }
}
