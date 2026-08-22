package hr.leon.library.repository;

import hr.leon.library.entity.TopicEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TopicRepository extends JpaRepository<TopicEntity, Long> {
    Optional<TopicEntity> findByTopicId(String topicId);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndTopicIdNot(String name, String topicId);
}
