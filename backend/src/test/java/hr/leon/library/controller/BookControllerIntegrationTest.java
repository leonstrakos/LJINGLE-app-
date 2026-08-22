package hr.leon.library.controller;

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
class BookControllerIntegrationTest {

    private static final String VALID_REQUEST = """
            {
              "title": "Dina",
              "author": "Frank Herbert",
              "isbn": "978-0441172719",
              "publishedYear": 1965,
              "readingStatus": "IN_PROGRESS",
              "progress": 42,
              "enjoyment": "ENJOYED",
              "favourite": true,
              "startedOn": "2026-08-01",
              "finishedOn": null
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private TimeSessionRepository timeSessionRepository;

    @BeforeEach
    void cleanDatabase() {
        timeSessionRepository.deleteAll();
        activityRepository.deleteAll();
        bookRepository.deleteAll();
    }

    @Test
    void createsAndReturnsDtoWithoutBaseFields() throws Exception {
        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.bookId").isNotEmpty())
                .andExpect(jsonPath("$.title").value("Dina"))
                .andExpect(jsonPath("$.readingStatus").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.progress").value(42))
                .andExpect(jsonPath("$.enjoyment").value("ENJOYED"))
                .andExpect(jsonPath("$.favourite").value(true))
                .andExpect(jsonPath("$.startedOn").value("2026-08-01"))
                .andExpect(jsonPath("$").value(not(hasKey("available"))))
                .andExpect(jsonPath("$").value(not(hasKey("id"))))
                .andExpect(jsonPath("$").value(not(hasKey("createdAt"))))
                .andExpect(jsonPath("$").value(not(hasKey("modifiedAt"))));
    }

    @Test
    void supportsPagination() throws Exception {
        createBook();

        mockMvc.perform(get("/api/books").param("page", "0").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void updatesAndDeletesBook() throws Exception {
        String location = createBook();
        String bookId = location.substring(location.lastIndexOf('/') + 1);

        String updated = VALID_REQUEST
                .replace("Dina", "Dina Mesija")
                .replace("IN_PROGRESS", "COMPLETED")
                .replace("42", "100")
                .replace("\"finishedOn\": null", "\"finishedOn\": \"2026-08-18\"");
        mockMvc.perform(put("/api/books/{bookId}", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updated))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Dina Mesija"))
                .andExpect(jsonPath("$.readingStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.progress").value(100))
                .andExpect(jsonPath("$.finishedOn").value("2026-08-18"));

        mockMvc.perform(delete("/api/books/{bookId}", bookId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/books/{bookId}", bookId))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsBlankTitle() throws Exception {
        String invalid = VALID_REQUEST.replace("Dina", " ");

        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.title").exists());
    }

    @Test
    void defaultsPersonalTrackingFieldsForLegacyCreateRequests() throws Exception {
        String legacyRequest = """
                {
                  "title": "Proces",
                  "author": "Franz Kafka",
                  "isbn": "978-953-313-212-6",
                  "publishedYear": 1925,
                  "available": false
                }
                """;

        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(legacyRequest))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.readingStatus").value("LATER"))
                .andExpect(jsonPath("$.progress").value(0))
                .andExpect(jsonPath("$.favourite").value(false))
                .andExpect(jsonPath("$").value(not(hasKey("available"))));
    }

    @Test
    void rejectsProgressOutsidePercentageRange() throws Exception {
        String invalid = VALID_REQUEST.replace("\"progress\": 42", "\"progress\": 101");

        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.progress").exists());
    }

    @Test
    void rejectsFinishedDateBeforeStartedDate() throws Exception {
        String invalid = VALID_REQUEST.replace(
                "\"finishedOn\": null",
                "\"finishedOn\": \"2026-07-31\""
        );

        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.dateRangeValid").exists());
    }

    @Test
    void rejectsUnknownTrackingStatus() throws Exception {
        String invalid = VALID_REQUEST.replace("IN_PROGRESS", "READING_SOMEDAY");

        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest());
    }

    private String createBook() throws Exception {
        return mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getHeader("Location");
    }
}
