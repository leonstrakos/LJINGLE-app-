package hr.leon.library.media.dto;

import hr.leon.library.entity.Enjoyment;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.entity.WatchStatus;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record MediaRequest(
        @NotNull(message = "Vrsta sadržaja je obvezna.")
        MediaType mediaType,

        @Positive(message = "TMDB identifikator mora biti pozitivan broj.")
        Long tmdbId,

        @NotBlank(message = "Naslov je obvezan.")
        @Size(max = 255, message = "Naslov smije imati najviše 255 znakova.")
        String title,

        @Size(max = 255, message = "Izvorni naslov smije imati najviše 255 znakova.")
        String originalTitle,

        @Size(max = 10000, message = "Opis smije imati najviše 10000 znakova.")
        String overview,

        @Size(max = 500, message = "Putanja postera je predugačka.")
        String posterPath,

        @Size(max = 500, message = "Putanja pozadinske slike je predugačka.")
        String backdropPath,

        @Min(value = 1800, message = "Godina izdanja nije valjana.")
        @Max(value = 3000, message = "Godina izdanja nije valjana.")
        Integer releaseYear,

        @NotNull(message = "Status gledanja je obvezan.")
        WatchStatus watchStatus,

        @NotNull(message = "Napredak je obvezan.")
        @Min(value = 0, message = "Napredak ne može biti manji od 0.")
        @Max(value = 100, message = "Napredak ne može biti veći od 100.")
        Integer progress,

        Enjoyment enjoyment,

        @NotNull(message = "Oznaka favorita je obvezna.")
        Boolean favourite,

        LocalDate startedOn,

        LocalDate completedOn
) {
    public MediaRequest {
        if (watchStatus == null) {
            watchStatus = WatchStatus.WATCHLIST;
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
        return startedOn == null || completedOn == null || !completedOn.isBefore(startedOn);
    }

    @AssertTrue(message = "Dovršeni film ili serija moraju imati 100% napretka.")
    public boolean isCompletedProgressValid() {
        return watchStatus != WatchStatus.COMPLETED || progress == 100;
    }
}
