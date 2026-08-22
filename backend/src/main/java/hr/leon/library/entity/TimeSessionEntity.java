package hr.leon.library.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "time_sessions")
public class TimeSessionEntity extends BaseEntity {

    @Column(name = "session_id", nullable = false, unique = true, updatable = false, length = 36)
    private String sessionId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "activity_id", referencedColumnName = "activity_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ActivityEntity activity;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @PrePersist
    void initializeSessionId() {
        if (sessionId == null) {
            sessionId = UUID.randomUUID().toString();
        }
    }

    public String getSessionId() {
        return sessionId;
    }

    public ActivityEntity getActivity() {
        return activity;
    }

    public void setActivity(ActivityEntity activity) {
        this.activity = activity;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }
}
