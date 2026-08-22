package hr.leon.library.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "topics")
public class TopicEntity extends BaseEntity {

    @Column(name = "topic_id", nullable = false, unique = true, updatable = false, length = 36)
    private String topicId;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    @Column(length = 1000)
    private String description;

    @PrePersist
    void initializeTopicId() {
        if (topicId == null) {
            topicId = UUID.randomUUID().toString();
        }
    }

    public String getTopicId() {
        return topicId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
