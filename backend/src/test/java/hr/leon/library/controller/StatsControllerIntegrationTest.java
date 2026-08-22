package hr.leon.library.controller;

import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.ActivityType;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.entity.TimeSessionEntity;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.BookRepository;
import hr.leon.library.repository.TimeSessionRepository;
import hr.leon.library.repository.TopicRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StatsControllerIntegrationTest {

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
    void calculatesOnlyThePartOfASessionInsideTheRequestedLocalDay() throws Exception {
        ZoneId zone = ZoneId.of("Europe/Zagreb");
        LocalDate date = LocalDate.of(2026, 8, 18);

        BookEntity book = new BookEntity();
        book.setTitle("Dina");
        book.setAuthor("Frank Herbert");
        book.setIsbn("978-0441172719");
        book.setPublishedYear(1965);
        book = bookRepository.saveAndFlush(book);

        ActivityEntity activity = new ActivityEntity();
        activity.setLabel("Čitanje — Dina");
        activity.setActivityType(ActivityType.READING);
        activity.setBook(book);
        activity = activityRepository.saveAndFlush(activity);

        TimeSessionEntity session = new TimeSessionEntity();
        session.setActivity(activity);
        session.setStartedAt(date.atTime(LocalTime.of(23, 30)).atZone(zone).toInstant());
        session.setEndedAt(date.plusDays(1).atTime(LocalTime.of(1, 0)).atZone(zone).toInstant());
        timeSessionRepository.saveAndFlush(session);

        mockMvc.perform(get("/api/stats/daily")
                        .param("date", "2026-08-18")
                        .param("zone", "Europe/Zagreb"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value("2026-08-18"))
                .andExpect(jsonPath("$.zone").value("Europe/Zagreb"))
                .andExpect(jsonPath("$.totalSeconds").value(1800))
                .andExpect(jsonPath("$.activities.length()").value(1))
                .andExpect(jsonPath("$.activities[0].label").value("Čitanje — Dina"))
                .andExpect(jsonPath("$.activities[0].seconds").value(1800))
                .andExpect(jsonPath("$.activities[0].running").value(false));
    }

    @Test
    void rejectsInvalidDatesAndTimeZones() throws Exception {
        mockMvc.perform(get("/api/stats/daily").param("date", "18-08-2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Datum mora biti u obliku GGGG-MM-DD."));

        mockMvc.perform(get("/api/stats/daily").param("zone", "Not/AZone"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Vremenska zona nije valjana: Not/AZone"));
    }
}
