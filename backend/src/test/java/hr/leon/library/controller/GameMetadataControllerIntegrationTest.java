package hr.leon.library.controller;

import hr.leon.library.dto.GameMetadataResponse;
import hr.leon.library.exception.IgdbUnavailableException;
import hr.leon.library.provider.igdb.IgdbGameProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GameMetadataControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IgdbGameProvider igdbGameProvider;

    @Test
    void returnsNormalizedIgdbResults() throws Exception {
        when(igdbGameProvider.search("Outer Wilds")).thenReturn(List.of(
                new GameMetadataResponse(
                        11800,
                        "Outer Wilds",
                        "Mobius Digital",
                        2019,
                        "https://images.igdb.com/igdb/image/upload/t_cover_big/example.jpg",
                        List.of("PC", "PlayStation 5")
                )
        ));

        mockMvc.perform(get("/api/games/metadata/search").param("query", "Outer Wilds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].igdbId").value(11800))
                .andExpect(jsonPath("$[0].title").value("Outer Wilds"))
                .andExpect(jsonPath("$[0].developer").value("Mobius Digital"))
                .andExpect(jsonPath("$[0].platforms[1]").value("PlayStation 5"));
    }

    @Test
    void rejectsBlankSearchQuery() throws Exception {
        mockMvc.perform(get("/api/games/metadata/search").param("query", " "))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reportsUnavailableOnlineProviderWithoutLeakingDetails() throws Exception {
        when(igdbGameProvider.search("Halo"))
                .thenThrow(new IgdbUnavailableException("Online pretraga igara nije dostupna."));

        mockMvc.perform(get("/api/games/metadata/search").param("query", "Halo"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Online pretraga igara nije dostupna."));
    }
}
