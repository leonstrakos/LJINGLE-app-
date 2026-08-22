package hr.leon.library.media;

import com.jayway.jsonpath.JsonPath;
import hr.leon.library.media.repository.MediaRepository;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.TimeSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
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
class MediaControllerIntegrationTest {

    private static final String MOVIE_REQUEST = """
            {
              "mediaType": "MOVIE",
              "tmdbId": 550,
              "title": "Fight Club",
              "originalTitle": "Fight Club",
              "overview": "An insomniac meets a soap maker.",
              "posterPath": "/poster.jpg",
              "backdropPath": "/backdrop.jpg",
              "releaseYear": 1999,
              "watchStatus": "WATCHING",
              "progress": 45,
              "enjoyment": "ENJOYED",
              "favourite": true,
              "startedOn": "2026-08-17",
              "completedOn": null
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MediaRepository mediaRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private TimeSessionRepository timeSessionRepository;

    @BeforeEach
    void cleanDatabase() {
        timeSessionRepository.deleteAll();
        activityRepository.deleteAll();
        mediaRepository.deleteAll();
    }

    @Test
    void createsFiltersUpdatesAndDeletesMedia() throws Exception {
        String mediaId = createMedia(MOVIE_REQUEST);

        mockMvc.perform(get("/api/media")
                        .param("mediaType", "MOVIE")
                        .param("status", "WATCHING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].mediaId").value(mediaId))
                .andExpect(jsonPath("$[0].mediaType").value("MOVIE"))
                .andExpect(jsonPath("$[0].watchStatus").value("WATCHING"))
                .andExpect(jsonPath("$[0].progress").value(45))
                .andExpect(jsonPath("$[0].favourite").value(true))
                .andExpect(jsonPath("$[0]").value(not(hasKey("id"))))
                .andExpect(jsonPath("$[0]").value(not(hasKey("createdAt"))));

        String completed = MOVIE_REQUEST
                .replace("WATCHING", "COMPLETED")
                .replace("\"progress\": 45", "\"progress\": 100")
                .replace("\"completedOn\": null", "\"completedOn\": \"2026-08-18\"");
        mockMvc.perform(put("/api/media/{mediaId}", mediaId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(completed))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.progress").value(100))
                .andExpect(jsonPath("$.completedOn").value("2026-08-18"));

        mockMvc.perform(delete("/api/media/{mediaId}", mediaId))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/media/{mediaId}", mediaId))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsDuplicateTmdbItemAndInvalidCompletedProgress() throws Exception {
        createMedia(MOVIE_REQUEST);

        mockMvc.perform(post("/api/media")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(MOVIE_REQUEST))
                .andExpect(status().isConflict());

        String invalidCompleted = MOVIE_REQUEST.replace("WATCHING", "COMPLETED");
        mockMvc.perform(post("/api/media")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidCompleted.replace("550", "551")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.completedProgressValid").exists());
    }

    @Test
    void persistsIdempotentWatchTimerAndExposesItAsActiveActivity() throws Exception {
        String mediaId = createMedia(MOVIE_REQUEST);

        mockMvc.perform(get("/api/media/{mediaId}/watching", mediaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").doesNotExist())
                .andExpect(jsonPath("$.activityType").value("WATCHING"))
                .andExpect(jsonPath("$.mediaId").value(mediaId))
                .andExpect(jsonPath("$.running").value(false));

        MvcResult started = mockMvc.perform(
                        post("/api/media/{mediaId}/watching/start", mediaId)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").isNotEmpty())
                .andExpect(jsonPath("$.activeSessionId").isNotEmpty())
                .andExpect(jsonPath("$.running").value(true))
                .andReturn();
        String body = started.getResponse().getContentAsString();
        String activityId = JsonPath.read(body, "$.activityId");
        String sessionId = JsonPath.read(body, "$.activeSessionId");

        mockMvc.perform(post("/api/media/{mediaId}/watching/start", mediaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeSessionId").value(sessionId));

        mockMvc.perform(get("/api/activities/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].activityId").value(activityId))
                .andExpect(jsonPath("$[0].activityType").value("WATCHING"));

        mockMvc.perform(post("/api/media/{mediaId}/watching/stop", mediaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(false))
                .andExpect(jsonPath("$.activeSessionId").doesNotExist());

        mockMvc.perform(get("/api/activities/{activityId}/sessions", activityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].sessionId").value(sessionId))
                .andExpect(jsonPath("$[0].endedAt").isNotEmpty());
    }

    @Test
    void deletingMediaStopsTimerButPreservesActivityHistory() throws Exception {
        String mediaId = createMedia(MOVIE_REQUEST);
        String body = mockMvc.perform(post("/api/media/{mediaId}/watching/start", mediaId))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String activityId = JsonPath.read(body, "$.activityId");

        mockMvc.perform(delete("/api/media/{mediaId}", mediaId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/activities/{activityId}/sessions", activityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].running").value(false));
    }

    private String createMedia(String request) throws Exception {
        String location = mockMvc.perform(post("/api/media")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andReturn()
                .getResponse()
                .getHeader("Location");
        return location.substring(location.lastIndexOf('/') + 1);
    }
}
