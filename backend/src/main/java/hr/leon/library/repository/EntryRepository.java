package hr.leon.library.repository;

import hr.leon.library.entity.EntryEntity;
import hr.leon.library.entity.EntryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EntryRepository extends JpaRepository<EntryEntity, Long> {
    Optional<EntryEntity> findByEntryId(String entryId);

    @Query("""
            select entry from EntryEntity entry
            left join entry.book book
            left join entry.topic topic
            left join entry.activity activity
            where (:bookId is null or book.bookId = :bookId)
              and (:topicId is null or topic.topicId = :topicId)
              and (:activityId is null or activity.activityId = :activityId)
              and (:type is null or entry.entryType = :type)
            order by entry.modifiedAt desc, entry.createdAt desc
            """)
    List<EntryEntity> findAllFiltered(
            @Param("bookId") String bookId,
            @Param("topicId") String topicId,
            @Param("activityId") String activityId,
            @Param("type") EntryType type
    );
}
