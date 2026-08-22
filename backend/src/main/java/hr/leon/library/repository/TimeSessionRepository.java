package hr.leon.library.repository;

import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.TimeSessionEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TimeSessionRepository extends JpaRepository<TimeSessionEntity, Long> {
    Optional<TimeSessionEntity> findFirstByActivityAndEndedAtIsNullOrderByStartedAtDesc(
            ActivityEntity activity
    );

    List<TimeSessionEntity> findAllByActivityOrderByStartedAtDesc(ActivityEntity activity);

    List<TimeSessionEntity> findAllByEndedAtIsNullOrderByStartedAtDesc();

    @Query("""
            SELECT session.activity
            FROM TimeSessionEntity session
            WHERE session.endedAt IS NOT NULL
              AND NOT EXISTS (
                    SELECT activeSession.id
                    FROM TimeSessionEntity activeSession
                    WHERE activeSession.activity = session.activity
                      AND activeSession.endedAt IS NULL
              )
            GROUP BY session.activity
            ORDER BY MAX(session.endedAt) DESC
            """)
    List<ActivityEntity> findRecentInactiveActivities(Pageable pageable);
}
