package hr.leon.library.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "games")
public class GameEntity extends BaseEntity {

    @Column(name = "game_id", nullable = false, unique = true, updatable = false, length = 36)
    private String gameId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 255)
    private String developer;

    @Column(nullable = false, length = 120)
    private String platform;

    @Column(name = "release_year")
    private Integer releaseYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "game_status", nullable = false, length = 32)
    private GameStatus gameStatus = GameStatus.BACKLOG;

    @Column(nullable = false)
    private int progress;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private Enjoyment enjoyment;

    @Column(nullable = false)
    private boolean favourite;

    @Column(name = "started_on")
    private LocalDate startedOn;

    @Column(name = "finished_on")
    private LocalDate finishedOn;

    @Column(name = "igdb_id")
    private Long igdbId;

    @Column(name = "cover_url", length = 1000)
    private String coverUrl;

    @OneToOne
    @JoinColumn(
            name = "playing_activity_id",
            referencedColumnName = "activity_id",
            unique = true
    )
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private ActivityEntity playingActivity;

    @PrePersist
    void initializeGameId() {
        if (gameId == null) {
            gameId = UUID.randomUUID().toString();
        }
    }

    public String getGameId() {
        return gameId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDeveloper() {
        return developer;
    }

    public void setDeveloper(String developer) {
        this.developer = developer;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public Integer getReleaseYear() {
        return releaseYear;
    }

    public void setReleaseYear(Integer releaseYear) {
        this.releaseYear = releaseYear;
    }

    public GameStatus getGameStatus() {
        return gameStatus;
    }

    public void setGameStatus(GameStatus gameStatus) {
        this.gameStatus = gameStatus;
    }

    public int getProgress() {
        return progress;
    }

    public void setProgress(int progress) {
        this.progress = progress;
    }

    public Enjoyment getEnjoyment() {
        return enjoyment;
    }

    public void setEnjoyment(Enjoyment enjoyment) {
        this.enjoyment = enjoyment;
    }

    public boolean isFavourite() {
        return favourite;
    }

    public void setFavourite(boolean favourite) {
        this.favourite = favourite;
    }

    public LocalDate getStartedOn() {
        return startedOn;
    }

    public void setStartedOn(LocalDate startedOn) {
        this.startedOn = startedOn;
    }

    public LocalDate getFinishedOn() {
        return finishedOn;
    }

    public void setFinishedOn(LocalDate finishedOn) {
        this.finishedOn = finishedOn;
    }

    public Long getIgdbId() {
        return igdbId;
    }

    public void setIgdbId(Long igdbId) {
        this.igdbId = igdbId;
    }

    public String getCoverUrl() {
        return coverUrl;
    }

    public void setCoverUrl(String coverUrl) {
        this.coverUrl = coverUrl;
    }

    public ActivityEntity getPlayingActivity() {
        return playingActivity;
    }

    public void setPlayingActivity(ActivityEntity playingActivity) {
        this.playingActivity = playingActivity;
    }
}
