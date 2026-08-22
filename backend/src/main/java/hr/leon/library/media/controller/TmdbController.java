package hr.leon.library.media.controller;

import hr.leon.library.media.dto.TmdbMediaResponse;
import hr.leon.library.media.dto.TmdbSearchResponse;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.tmdb.TmdbProvider;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/media/tmdb")
public class TmdbController {

    private final TmdbProvider tmdbProvider;

    public TmdbController(TmdbProvider tmdbProvider) {
        this.tmdbProvider = tmdbProvider;
    }

    @GetMapping("/search")
    public TmdbSearchResponse search(
            @RequestParam
            @NotBlank
            @Size(max = 200)
            String query,

            @RequestParam
            @NotNull
            MediaType mediaType,

            @RequestParam(defaultValue = "1")
            @Min(1)
            @Max(500)
            int page
    ) {
        return tmdbProvider.search(query.trim(), mediaType, page);
    }

    @GetMapping("/{mediaType}/{tmdbId}")
    public TmdbMediaResponse getDetails(
            @PathVariable MediaType mediaType,
            @PathVariable @Min(1) long tmdbId
    ) {
        return tmdbProvider.getDetails(mediaType, tmdbId);
    }
}
