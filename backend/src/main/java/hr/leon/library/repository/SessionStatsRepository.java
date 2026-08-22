package hr.leon.library.repository;

import hr.leon.library.entity.TimeSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface SessionStatsRepository extends JpaRepository<TimeSessionEntity, Long> {

    @Query("""
            SELECT session
            FROM TimeSessionEntity session
            WHERE session.startedAt < :dayEnd
              AND (session.endedAt IS NULL OR session.endedAt > :dayStart)
            ORDER BY session.startedAt ASC
            """)
    List<TimeSessionEntity> findSessionsOverlapping(
            @Param("dayStart") Instant dayStart,
            @Param("dayEnd") Instant dayEnd
    );
}
