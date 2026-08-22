package hr.leon.library.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.GameRepository;
import hr.leon.library.repository.TimeSessionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GameControllerIntegrationTest {

    private static final String VALID_REQUEST = """
            {
              "title": "Disco Elysium",
              "developer": "ZA/UM",
              "platform": "PC",
              "releaseYear": 2019,
              "gameStatus": "PLAYING",
              "progress": 38,
              "enjoyment": "ENJOYED",
              "favourite": true,
              "startedOn": "2026-08-01",
              "finishedOn": null,
              "igdbId": 26192,
              "coverUrl": "https://images.example/disco.jpg"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private GameRepository gameRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private TimeSessionRepository timeSessionRepository;

    @BeforeEach
    void cleanBefore() {
        cleanDatabase();
    }

    @AfterEach
    void cleanAfter() {
        cleanDatabase();
    }

    @Test
    void createsGameAndItsPlayingActivity() throws Exception {
        mockMvc.perform(post("/api/games")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.gameId").isNotEmpty())
                .andExpect(jsonPath("$.title").value("Disco Elysium"))
                .andExpect(jsonPath("$.gameStatus").value("PLAYING"))
                .andExpect(jsonPath("$.platform").value("PC"))
                .andExpect(jsonPath("$.progress").value(38))
                .andExpect(jsonPath("$.enjoyment").value("ENJOYED"))
                .andExpect(jsonPath("$.favourite").value(true))
                .andExpect(jsonPath("$.playingActivityId").isNotEmpty())
                .andExpect(jsonPath("$").value(not(hasKey("id"))))
                .andExpect(jsonPath("$").value(not(hasKey("createdAt"))));

        assertThat(activityRepository.count()).isEqualTo(1);
        ActivityEntity activity = activityRepository.findAll().get(0);
        assertThat(activity.getActivityType().name()).isEqualTo("PLAYING");
        assertThat(activity.getLabel()).isEqualTo("Igranje — Disco Elysium");
    }

    @Test
    void listsGamesAndFiltersByStatus() throws Exception {
        createGame();
        String completed = VALID_REQUEST
                .replace("Disco Elysium", "Journey")
                .replace("\"gameStatus\": \"PLAYING\"", "\"gameStatus\": \"COMPLETED\"")
                .replace("\"progress\": 38", "\"progress\": 100")
                .replace("26192", "1970");
        mockMvc.perform(post("/api/games")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(completed))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/games"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(get("/api/games").param("status", "completed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Journey"));

        mockMvc.perform(get("/api/games").param("status", "SOMEDAY"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatesGameAndKeepsPlayingActivityIdentity() throws Exception {
        JsonNode created = createGame();
        String gameId = created.get("gameId").asText();
        String activityId = created.get("playingActivityId").asText();
        String updated = VALID_REQUEST
                .replace("Disco Elysium", "Disco Elysium: The Final Cut")
                .replace("\"progress\": 38", "\"progress\": 72");

        mockMvc.perform(put("/api/games/{gameId}", gameId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updated))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Disco Elysium: The Final Cut"))
                .andExpect(jsonPath("$.progress").value(72))
                .andExpect(jsonPath("$.playingActivityId").value(activityId));

        ActivityEntity activity = activityRepository.findByActivityId(activityId).orElseThrow();
        assertThat(activity.getLabel()).isEqualTo("Igranje — Disco Elysium: The Final Cut");
    }

    @Test
    void startsIdempotentlyAndStopsPlayingTimer() throws Exception {
        JsonNode created = createGame();
        String gameId = created.get("gameId").asText();

        mockMvc.perform(get("/api/games/{gameId}/timer", gameId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityType").value("PLAYING"))
                .andExpect(jsonPath("$.running").value(false));

        mockMvc.perform(post("/api/games/{gameId}/timer/start", gameId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true))
                .andExpect(jsonPath("$.activeSessionId").isNotEmpty());

        mockMvc.perform(post("/api/games/{gameId}/timer/start", gameId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true));

        assertThat(timeSessionRepository.count()).isEqualTo(1);

        mockMvc.perform(post("/api/games/{gameId}/timer/stop", gameId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(false))
                .andExpect(jsonPath("$.activeSessionId").doesNotExist());
    }

    @Test
    void deletingGameStopsTimerAndPreservesActivityHistory() throws Exception {
        JsonNode created = createGame();
        String gameId = created.get("gameId").asText();
        String activityId = created.get("playingActivityId").asText();

        mockMvc.perform(post("/api/games/{gameId}/timer/start", gameId))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/games/{gameId}", gameId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/games/{gameId}", gameId))
                .andExpect(status().isNotFound());

        ActivityEntity activity = activityRepository.findByActivityId(activityId).orElseThrow();
        assertThat(timeSessionRepository.findAllByActivityOrderByStartedAtDesc(activity))
                .singleElement()
                .satisfies(session -> assertThat(session.getEndedAt()).isNotNull());
    }

    @Test
    void validatesProgressPlatformAndDates() throws Exception {
        mockMvc.perform(post("/api/games")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST.replace("\"progress\": 38", "\"progress\": 101")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.progress").exists());

        mockMvc.perform(post("/api/games")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST.replace("\"platform\": \"PC\"", "\"platform\": \" \"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.platform").exists());

        String invalidDates = VALID_REQUEST.replace(
                "\"finishedOn\": null",
                "\"finishedOn\": \"2026-07-31\""
        );
        mockMvc.perform(post("/api/games")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidDates))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.dateRangeValid").exists());
    }

    private JsonNode createGame() throws Exception {
        String body = mockMvc.perform(post("/api/games")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body);
    }

    private void cleanDatabase() {
        timeSessionRepository.deleteAll();
        gameRepository.deleteAll();
        activityRepository.deleteAll();
    }
}
