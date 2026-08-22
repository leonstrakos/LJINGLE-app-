package hr.leon.library.dto;

import hr.leon.library.entity.Enjoyment;
import hr.leon.library.entity.GameStatus;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record GameRequest(
        @NotBlank(message = "Naslov je obvezan.")
        @Size(max = 255, message = "Naslov smije imati najviše 255 znakova.")
        String title,

        @Size(max = 255, message = "Naziv razvojnog studija smije imati najviše 255 znakova.")
        String developer,

        @NotBlank(message = "Platforma je obvezna.")
        @Size(max = 120, message = "Platforma smije imati najviše 120 znakova.")
        String platform,

        @Min(value = 0, message = "Godina izlaska ne može biti negativna.")
        @Max(value = 3000, message = "Godina izlaska nije valjana.")
        Integer releaseYear,

        @NotNull(message = "Status igre je obvezan.")
        GameStatus gameStatus,

        @NotNull(message = "Napredak je obvezan.")
        @Min(value = 0, message = "Napredak ne može biti manji od 0.")
        @Max(value = 100, message = "Napredak ne može biti veći od 100.")
        Integer progress,

        Enjoyment enjoyment,

        @NotNull(message = "Oznaka favorita je obvezna.")
        Boolean favourite,

        LocalDate startedOn,

        LocalDate finishedOn,

        @Positive(message = "IGDB identifikator mora biti pozitivan.")
        Long igdbId,

        @Size(max = 1000, message = "Adresa naslovnice smije imati najviše 1000 znakova.")
        String coverUrl
) {
    public GameRequest {
        if (gameStatus == null) {
            gameStatus = GameStatus.BACKLOG;
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
