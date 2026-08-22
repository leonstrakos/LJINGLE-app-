package hr.leon.library.dto;

import hr.leon.library.entity.Enjoyment;
import hr.leon.library.entity.ReadingStatus;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record BookRequest(
        @NotBlank(message = "Naslov je obvezan.")
        @Size(max = 255, message = "Naslov smije imati najviše 255 znakova.")
        String title,

        @NotBlank(message = "Autor je obvezan.")
        @Size(max = 255, message = "Autor smije imati najviše 255 znakova.")
        String author,

        @NotBlank(message = "ISBN je obvezan.")
        @Size(max = 32, message = "ISBN smije imati najviše 32 znaka.")
        String isbn,

        @NotNull(message = "Godina izdanja je obvezna.")
        @Min(value = 0, message = "Godina izdanja ne može biti negativna.")
        @Max(value = 3000, message = "Godina izdanja nije valjana.")
        Integer publishedYear,

        @NotNull(message = "Status čitanja je obvezan.")
        ReadingStatus readingStatus,

        @NotNull(message = "Napredak je obvezan.")
        @Min(value = 0, message = "Napredak ne može biti manji od 0.")
        @Max(value = 100, message = "Napredak ne može biti veći od 100.")
        Integer progress,

        Enjoyment enjoyment,

        @NotNull(message = "Oznaka favorita je obvezna.")
        Boolean favourite,

        LocalDate startedOn,

        LocalDate finishedOn
) {
    public BookRequest {
        if (readingStatus == null) {
            readingStatus = ReadingStatus.LATER;
        }
        if (progress == null) {
            progress = 0;
        }
        if (favourite == null) {
            favourite = false;
        }
    }

    @AssertTrue(message = "Datum završetka ne može biti prije datuma početka.")
    public boolean isDateRangeValid() {
        return startedOn == null || finishedOn == null || !finishedOn.isBefore(startedOn);
    }
}
