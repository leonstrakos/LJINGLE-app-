package hr.leon.library.controller;

import com.jayway.jsonpath.JsonPath;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.BookRepository;
import hr.leon.library.repository.EntryRepository;
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
class EntryControllerIntegrationTest {

    private static final String BOOK_REQUEST = """
            {
              "title": "Dina",
              "author": "Frank Herbert",
              "isbn": "978-0441172719",
              "publishedYear": 1965
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EntryRepository entryRepository;

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
        entryRepository.deleteAll();
        timeSessionRepository.deleteAll();
        activityRepository.deleteAll();
        topicRepository.deleteAll();
        bookRepository.deleteAll();
    }

    @Test
    void supportsCrudAndCombinedFiltersWithOptionalAttachments() throws Exception {
        String bookId = createBook();
        String topicId = createTopic("Filozofija");
        String activityId = createActivity(topicId, "Čitanje izvora");

        MvcResult created = mockMvc.perform(post("/api/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(entryRequest(
                                "  Ključni citat  ",
                                "  Strah ubija um.  ",
                                "QUOTE",
                                bookId,
                                topicId,
                                activityId
                        )))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/entries/")))
                .andExpect(jsonPath("$.title").value("Ključni citat"))
                .andExpect(jsonPath("$.content").value("Strah ubija um."))
                .andExpect(jsonPath("$.type").value("QUOTE"))
                .andExpect(jsonPath("$.bookId").value(bookId))
                .andExpect(jsonPath("$.topicId").value(topicId))
                .andExpect(jsonPath("$.activityId").value(activityId))
                .andReturn();
        String entryId = JsonPath.read(
                created.getResponse().getContentAsString(),
                "$.entryId"
        );

        createIndependentEntry("Bilješka", "NOTE");

        mockMvc.perform(get("/api/entries"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        mockMvc.perform(get("/api/entries/{entryId}", entryId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entryId").value(entryId));

        mockMvc.perform(get("/api/entries")
                        .param("bookId", bookId)
                        .param("topicId", topicId)
                        .param("activityId", activityId)
                        .param("type", "quote"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].entryId").value(entryId));

        mockMvc.perform(put("/api/entries/{entryId}", entryId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(entryRequest(
                                "",
                                "Napredak do polovice knjige.",
                                "PROGRESS_UPDATE",
                                null,
                                null,
                                activityId
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.type").value("PROGRESS_UPDATE"))
                .andExpect(jsonPath("$.bookId").doesNotExist())
                .andExpect(jsonPath("$.topicId").doesNotExist())
                .andExpect(jsonPath("$.activityId").value(activityId));

        mockMvc.perform(delete("/api/entries/{entryId}", entryId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/entries/{entryId}", entryId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("Zapis")));
    }

    @Test
    void validatesContentTypeAndReferencedTargetsWithFriendlyErrors() throws Exception {
        mockMvc.perform(post("/api/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "   ",
                                  "type": "NOTE"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.content")
                        .value("Sadržaj zapisa je obavezan."));

        mockMvc.perform(post("/api/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Zapis",
                                  "type": "MEMO"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Dopuštene vrijednosti")))
                .andExpect(jsonPath("$.fieldErrors.type").exists());

        mockMvc.perform(post("/api/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Zapis",
                                  "type": "NOTE",
                                  "bookId": "missing-book"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("Knjiga")));

        mockMvc.perform(get("/api/entries")
                        .param("topicId", "missing-topic"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("Tema")));

        mockMvc.perform(get("/api/entries")
                        .param("type", "memo"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Dopuštene vrijednosti")));
    }

    @Test
    void deletingTargetsPreservesEntryAndNullsItsAttachments() throws Exception {
        String bookId = createBook();
        String topicId = createTopic("Istraživanje");
        String activityId = createActivity(topicId, "Analizirati izvor");
        String entryId = createAttachedEntry(bookId, topicId, activityId);

        mockMvc.perform(delete("/api/books/{bookId}", bookId))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/topics/{topicId}", topicId))
                .andExpect(status().isNoContent());

        ActivityEntity activity = activityRepository.findByActivityId(activityId).orElseThrow();
        activityRepository.delete(activity);
        activityRepository.flush();

        mockMvc.perform(get("/api/entries/{entryId}", entryId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Povezani zapis"))
                .andExpect(jsonPath("$.bookId").doesNotExist())
                .andExpect(jsonPath("$.topicId").doesNotExist())
                .andExpect(jsonPath("$.activityId").doesNotExist());
    }

    private String createBook() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BOOK_REQUEST))
                .andExpect(status().isCreated())
                .andReturn();
        String location = result.getResponse().getHeader("Location");
        return location.substring(location.lastIndexOf('/') + 1);
    }

    private String createTopic(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"%s\"}".formatted(name)))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.topicId");
    }

    private String createActivity(String topicId, String label) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/topics/{topicId}/activities", topicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "label": "%s",
                                  "activityType": "RESEARCH"
                                }
                                """.formatted(label)))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.activityId");
    }

    private void createIndependentEntry(String content, String type) throws Exception {
        mockMvc.perform(post("/api/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(entryRequest(null, content, type, null, null, null)))
                .andExpect(status().isCreated());
    }

    private String createAttachedEntry(String bookId, String topicId, String activityId)
            throws Exception {
        MvcResult result = mockMvc.perform(post("/api/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(entryRequest(
                                null,
                                "Povezani zapis",
                                "OBSERVATION",
                                bookId,
                                topicId,
                                activityId
                        )))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.entryId");
    }

    private String entryRequest(
            String title,
            String content,
            String type,
            String bookId,
            String topicId,
            String activityId
    ) {
        return """
                {
                  "title": %s,
                  "content": "%s",
                  "type": "%s",
                  "bookId": %s,
                  "topicId": %s,
                  "activityId": %s
                }
                """.formatted(
                jsonString(title),
                content,
                type,
                jsonString(bookId),
                jsonString(topicId),
                jsonString(activityId)
        );
    }

    private String jsonString(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }
}
