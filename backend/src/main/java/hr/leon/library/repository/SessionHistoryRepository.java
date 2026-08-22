package hr.leon.library.repository;

import hr.leon.library.entity.TimeSessionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface SessionHistoryRepository extends JpaRepository<TimeSessionEntity, Long> {

    @Override
    @EntityGraph(attributePaths = {"activity", "activity.book", "activity.topic"})
    Page<TimeSessionEntity> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"activity", "activity.book", "activity.topic"})
    @Query("""
            SELECT session
            FROM TimeSessionEntity session
            WHERE session.startedAt < :rangeEnd
              AND (session.endedAt IS NULL OR session.endedAt > :rangeStart)
            """)
    Page<TimeSessionEntity> findSessionsOverlapping(
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd,
            Pageable pageable
    );
}
