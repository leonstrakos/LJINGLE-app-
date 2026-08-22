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

import java.time.LocalDate;
import java.time.ZoneId;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HistoryControllerIntegrationTest {

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
    void returnsPaginatedGlobalHistoryWithActivityContext() throws Exception {
        String topicId = createTopic("Francuski");
        String activityId = createActivity(topicId, "Učiti francuski", "STUDYING");

        MvcResult started = mockMvc.perform(
                        post("/api/activities/{activityId}/start", activityId)
                )
                .andExpect(status().isOk())
                .andReturn();
        String sessionId = JsonPath.read(
                started.getResponse().getContentAsString(),
                "$.activeSessionId"
        );

        mockMvc.perform(get("/api/history/sessions")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].sessionId").value(sessionId))
                .andExpect(jsonPath("$.content[0].activityId").value(activityId))
                .andExpect(jsonPath("$.content[0].activityLabel").value("Učiti francuski"))
                .andExpect(jsonPath("$.content[0].activityType").value("STUDYING"))
                .andExpect(jsonPath("$.content[0].topicId").value(topicId))
                .andExpect(jsonPath("$.content[0].bookId").doesNotExist())
                .andExpect(jsonPath("$.content[0].startedAt").isNotEmpty())
                .andExpect(jsonPath("$.content[0].endedAt").doesNotExist())
                .andExpect(jsonPath("$.content[0].durationSeconds").isNumber())
                .andExpect(jsonPath("$.content[0].running").value(true))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    void filtersByLocalDayAndRejectsInvalidPaging() throws Exception {
        String topicId = createTopic("Istraživanje");
        String activityId = createActivity(topicId, "Pregled izvora", "RESEARCH");
        mockMvc.perform(post("/api/activities/{activityId}/start", activityId))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/activities/{activityId}/stop", activityId))
                .andExpect(status().isOk());

        String today = LocalDate.now(ZoneId.of("Europe/Zagreb")).toString();
        mockMvc.perform(get("/api/history/sessions")
                        .param("date", today)
                        .param("zone", "Europe/Zagreb"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].running").value(false));

        mockMvc.perform(get("/api/history/sessions").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Veličina stranice mora biti između 1 i 100."
                ));

        mockMvc.perform(get("/api/history/sessions")
                        .param("date", "18/08/2026")
                        .param("zone", "Europe/Zagreb"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Datum mora biti u obliku GGGG-MM-DD."
                ));
    }

    private String createTopic(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"%s\"}".formatted(name)))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.topicId");
    }

    private String createActivity(String topicId, String label, String type) throws Exception {
        String request = """
                {
                  "label": "%s",
                  "activityType": "%s"
                }
                """.formatted(label, type);
        MvcResult result = mockMvc.perform(post("/api/topics/{topicId}/activities", topicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.activityId");
    }
}
