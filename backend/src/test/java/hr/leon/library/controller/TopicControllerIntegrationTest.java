package hr.leon.library.controller;

import com.jayway.jsonpath.JsonPath;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.BookRepository;
import hr.leon.library.repository.TimeSessionRepository;
import hr.leon.library.repository.TopicRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
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
class TopicControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TimeSessionRepository timeSessionRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private TopicRepository topicRepository;

    @Autowired
    private BookRepository bookRepository;

    @BeforeEach
    void cleanDatabase() {
        timeSessionRepository.deleteAll();
        activityRepository.deleteAll();
        topicRepository.deleteAll();
        bookRepository.deleteAll();
    }

    @Test
    void createsListsUpdatesAndDeletesTopics() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "  Filozofija  ",
                                  "description": "Bilješke i čitanje"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/topics/")))
                .andExpect(jsonPath("$.name").value("Filozofija"))
                .andExpect(jsonPath("$.description").value("Bilješke i čitanje"))
                .andExpect(jsonPath("$.activityCount").value(0))
                .andReturn();

        String topicId = JsonPath.read(
                created.getResponse().getContentAsString(),
                "$.topicId"
        );

        mockMvc.perform(get("/api/topics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].topicId").value(topicId));

        mockMvc.perform(put("/api/topics/{topicId}", topicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Filozofija uma",
                                  "description": ""
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Filozofija uma"))
                .andExpect(jsonPath("$.description").doesNotExist());

        mockMvc.perform(delete("/api/topics/{topicId}", topicId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/topics/{topicId}", topicId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("ne postoji")));
    }

    @Test
    void validatesTopicAndActivityInputWithFriendlyErrors() throws Exception {
        mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.name").value("Naziv teme je obavezan."));

        String topicId = createTopic("Istraživanje", null);

        mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"istraživanje\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("već postoji")));

        mockMvc.perform(post("/api/topics/{topicId}/activities", topicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "label": "Čitanje izvora",
                                  "activityType": "UNKNOWN"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Dopuštene vrijednosti")))
                .andExpect(jsonPath("$.fieldErrors.activityType").exists());
    }

    @Test
    void createsReusableActivitiesAndStartsEachTimerIndependently() throws Exception {
        String topicId = createTopic("Šah", "Igranje i učenje");
        String studyingId = createActivity(topicId, "Učiti šah", "STUDYING");
        String playingId = createActivity(topicId, "Igrati šah", "PLAYING");

        mockMvc.perform(get("/api/topics/{topicId}/activities", topicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].topicId").value(topicId))
                .andExpect(jsonPath("$[1].topicId").value(topicId));

        MvcResult firstStart = mockMvc.perform(
                        post("/api/activities/{activityId}/start", studyingId)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true))
                .andReturn();
        String firstSessionId = JsonPath.read(
                firstStart.getResponse().getContentAsString(),
                "$.activeSessionId"
        );

        mockMvc.perform(post("/api/activities/{activityId}/start", studyingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeSessionId").value(firstSessionId));

        mockMvc.perform(post("/api/activities/{activityId}/start", playingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true));

        mockMvc.perform(get("/api/activities/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void deletingTopicDetachesActivitiesButPreservesTimersAndHistory() throws Exception {
        String topicId = createTopic("French", null);
        String activityId = createActivity(topicId, "Study French", "STUDYING");

        mockMvc.perform(post("/api/activities/{activityId}/start", activityId))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/activities/{activityId}/stop", activityId))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/topics/{topicId}", topicId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/activities/{activityId}/sessions", activityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].endedAt").isNotEmpty());

        mockMvc.perform(post("/api/activities/{activityId}/start", activityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").value(activityId))
                .andExpect(jsonPath("$.running").value(true));
    }

    @Test
    void returnsNotFoundForUnknownTopicAndActivity() throws Exception {
        mockMvc.perform(get("/api/topics/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("Tema")));

        mockMvc.perform(post("/api/activities/missing/start"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("Aktivnost")));
    }

    private String createTopic(String name, String description) throws Exception {
        String request = description == null
                ? "{\"name\":\"%s\"}".formatted(name)
                : "{\"name\":\"%s\",\"description\":\"%s\"}"
                        .formatted(name, description);
        MvcResult result = mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.topicId");
    }

    private String createActivity(String topicId, String label, String activityType)
            throws Exception {
        String request = """
                {
                  "label": "%s",
                  "activityType": "%s"
                }
                """.formatted(label, activityType);
        MvcResult result = mockMvc.perform(post("/api/topics/{topicId}/activities", topicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.activityId");
    }
}
