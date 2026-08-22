package hr.leon.library.controller;

import com.jayway.jsonpath.JsonPath;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.BookRepository;
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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActivityControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TimeSessionRepository timeSessionRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private BookRepository bookRepository;

    @BeforeEach
    void cleanDatabase() {
        timeSessionRepository.deleteAll();
        activityRepository.deleteAll();
        bookRepository.deleteAll();
    }

    @Test
    void persistsReadingAcrossIdempotentStartAndStopCalls() throws Exception {
        String bookId = createBook("Dina", "978-0441172719");

        mockMvc.perform(get("/api/activities/books/{bookId}/reading", bookId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").doesNotExist())
                .andExpect(jsonPath("$.bookId").value(bookId))
                .andExpect(jsonPath("$.running").value(false))
                .andExpect(jsonPath("$.totalSeconds").value(0));

        MvcResult started = mockMvc.perform(
                        post("/api/activities/books/{bookId}/reading/start", bookId)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").isNotEmpty())
                .andExpect(jsonPath("$.activeSessionId").isNotEmpty())
                .andExpect(jsonPath("$.activeStartedAt").isNotEmpty())
                .andExpect(jsonPath("$.running").value(true))
                .andReturn();

        String response = started.getResponse().getContentAsString();
        String activityId = JsonPath.read(response, "$.activityId");
        String sessionId = JsonPath.read(response, "$.activeSessionId");

        mockMvc.perform(post("/api/activities/books/{bookId}/reading/start", bookId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeSessionId").value(sessionId))
                .andExpect(jsonPath("$.running").value(true));

        mockMvc.perform(get("/api/activities/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].bookId").value(bookId));

        mockMvc.perform(post("/api/activities/{activityId}/stop", activityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").value(activityId))
                .andExpect(jsonPath("$.activeSessionId").doesNotExist())
                .andExpect(jsonPath("$.running").value(false));

        mockMvc.perform(get("/api/activities/recent").param("limit", "6"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].activityId").value(activityId))
                .andExpect(jsonPath("$[0].running").value(false));

        mockMvc.perform(get("/api/activities/{activityId}/sessions", activityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].sessionId").value(sessionId))
                .andExpect(jsonPath("$[0].startedAt").isNotEmpty())
                .andExpect(jsonPath("$[0].endedAt").isNotEmpty())
                .andExpect(jsonPath("$[0].running").value(false));

        mockMvc.perform(post("/api/activities/{activityId}/start", activityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true));

        mockMvc.perform(get("/api/activities/recent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void permitsDifferentBookTimersToRunAtTheSameTime() throws Exception {
        String firstBookId = createBook("Dina", "978-0441172719");
        String secondBookId = createBook("Solaris", "978-0571314635");

        mockMvc.perform(post("/api/activities/books/{bookId}/reading/start", firstBookId))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/activities/books/{bookId}/reading/start", secondBookId))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/activities/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void rejectsInvalidRecentActivityLimit() throws Exception {
        mockMvc.perform(get("/api/activities/recent").param("limit", "0"))
                .andExpect(status().isBadRequest());
    }

    private String createBook(String title, String isbn) throws Exception {
        String request = """
                {
                  "title": "%s",
                  "author": "Testni autor",
                  "isbn": "%s",
                  "publishedYear": 1965,
                  "available": true
                }
                """.formatted(title, isbn);

        String location = mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getHeader("Location");
        return location.substring(location.lastIndexOf('/') + 1);
    }
}
