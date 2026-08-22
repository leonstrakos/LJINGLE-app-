package hr.leon.library.entity;

import hr.leon.library.media.entity.MediaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.util.UUID;

@Entity
@Table(
        name = "activities",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_activities_book_type",
                        columnNames = {"book_id", "activity_type"}
                ),
                @UniqueConstraint(
                        name = "uq_activities_media_type",
                        columnNames = {"media_id", "activity_type"}
                )
        }
)
public class ActivityEntity extends BaseEntity {

    @Column(name = "activity_id", nullable = false, unique = true, updatable = false, length = 36)
    private String activityId;

    @Column(nullable = false, length = 255)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", nullable = false, length = 32)
    private ActivityType activityType;

    @ManyToOne
    @JoinColumn(name = "book_id", referencedColumnName = "book_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private BookEntity book;

    @ManyToOne
    @JoinColumn(name = "topic_id", referencedColumnName = "topic_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private TopicEntity topic;

    @ManyToOne
    @JoinColumn(name = "media_id", referencedColumnName = "media_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private MediaEntity media;

    @PrePersist
    void initializeActivityId() {
        if (activityId == null) {
            activityId = UUID.randomUUID().toString();
        }
    }

    public String getActivityId() {
        return activityId;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public ActivityType getActivityType() {
        return activityType;
    }

    public void setActivityType(ActivityType activityType) {
        this.activityType = activityType;
    }

    public BookEntity getBook() {
        return book;
    }

    public void setBook(BookEntity book) {
        this.book = book;
    }

    public TopicEntity getTopic() {
        return topic;
    }

    public void setTopic(TopicEntity topic) {
        this.topic = topic;
    }

    public MediaEntity getMedia() {
        return media;
    }

    public void setMedia(MediaEntity media) {
        this.media = media;
    }
}
