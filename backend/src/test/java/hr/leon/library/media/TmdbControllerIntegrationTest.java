package hr.leon.library.media;

import hr.leon.library.media.dto.TmdbMediaResponse;
import hr.leon.library.media.dto.TmdbSearchResponse;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.tmdb.TmdbProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TmdbControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TmdbProvider tmdbProvider;

    @Test
    void proxiesTypedMovieSearchWithoutExposingCredentials() throws Exception {
        TmdbMediaResponse result = new TmdbMediaResponse(
                550,
                MediaType.MOVIE,
                "Fight Club",
                "Fight Club",
                "Overview",
                "/poster.jpg",
                "https://image.tmdb.org/t/p/w500/poster.jpg",
                "/backdrop.jpg",
                "https://image.tmdb.org/t/p/w500/backdrop.jpg",
                1999
        );
        given(tmdbProvider.search("Fight Club", MediaType.MOVIE, 1))
                .willReturn(new TmdbSearchResponse(1, 1, 1, List.of(result)));

        mockMvc.perform(get("/api/media/tmdb/search")
                        .param("query", "Fight Club")
                        .param("mediaType", "MOVIE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].tmdbId").value(550))
                .andExpect(jsonPath("$.results[0].mediaType").value("MOVIE"))
                .andExpect(jsonPath("$.results[0].posterUrl").isNotEmpty())
                .andExpect(jsonPath("$.apiToken").doesNotExist());
    }

    @Test
    void rejectsUnknownMediaTypeBeforeCallingProvider() throws Exception {
        mockMvc.perform(get("/api/media/tmdb/search")
                        .param("query", "Dune")
                        .param("mediaType", "GAME"))
                .andExpect(status().isBadRequest());
    }
}
