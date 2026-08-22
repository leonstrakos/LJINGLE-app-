package hr.leon.library.repository;

import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.ActivityType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends JpaRepository<ActivityEntity, Long> {
    Optional<ActivityEntity> findByActivityId(String activityId);

    Optional<ActivityEntity> findByBookBookIdAndActivityType(String bookId, ActivityType activityType);

    Optional<ActivityEntity> findByMediaMediaIdAndActivityType(
            String mediaId,
            ActivityType activityType
    );

    List<ActivityEntity> findAllByTopicTopicIdOrderByLabelAsc(String topicId);

    long countByTopicTopicId(String topicId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select activity from ActivityEntity activity where activity.activityId = :activityId")
    Optional<ActivityEntity> findByActivityIdForUpdate(@Param("activityId") String activityId);
}
