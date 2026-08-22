package hr.leon.library.dto;

import hr.leon.library.entity.Enjoyment;
import hr.leon.library.entity.ReadingStatus;

import java.time.LocalDate;

public record BookResponse(
        String bookId,
        String title,
        String author,
        String isbn,
        Integer publishedYear,
        ReadingStatus readingStatus,
        int progress,
        Enjoyment enjoyment,
        boolean favourite,
        LocalDate startedOn,
        LocalDate finishedOn
) {
}
