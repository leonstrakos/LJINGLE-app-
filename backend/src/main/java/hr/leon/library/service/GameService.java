package hr.leon.library.service;

import hr.leon.library.dto.ActivityTimerResponse;
import hr.leon.library.dto.GameRequest;
import hr.leon.library.dto.GameResponse;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.ActivityType;
import hr.leon.library.entity.GameEntity;
import hr.leon.library.entity.GameStatus;
import hr.leon.library.entity.TimeSessionEntity;
import hr.leon.library.exception.GameNotFoundException;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.mapper.GameMapper;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.GameRepository;
import hr.leon.library.repository.TimeSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class GameService {

    private final GameRepository gameRepository;
    private final ActivityRepository activityRepository;
    private final TimeSessionRepository timeSessionRepository;
    private final ActivityService activityService;
    private final GameMapper gameMapper;

    public GameService(
            GameRepository gameRepository,
            ActivityRepository activityRepository,
            TimeSessionRepository timeSessionRepository,
            ActivityService activityService,
            GameMapper gameMapper
    ) {
        this.gameRepository = gameRepository;
        this.activityRepository = activityRepository;
        this.timeSessionRepository = timeSessionRepository;
        this.activityService = activityService;
        this.gameMapper = gameMapper;
    }

    public GameResponse getByGameId(String gameId) {
        return gameMapper.toResponse(findEntity(gameId));
    }

    public List<GameResponse> getAll(String rawStatus) {
        List<GameEntity> games = rawStatus == null
                ? gameRepository.findAllByOrderByTitleAsc()
                : gameRepository.findAllByGameStatusOrderByTitleAsc(parseStatus(rawStatus));
        return games.stream().map(gameMapper::toResponse).toList();
    }

    @Transactional
    public GameResponse create(GameRequest request) {
        GameEntity game = gameMapper.toEntity(request);
        game.setPlayingActivity(createPlayingActivity(game.getTitle()));
        return gameMapper.toResponse(gameRepository.save(game));
    }

    @Transactional
    public GameResponse update(String gameId, GameRequest request) {
        GameEntity game = findEntity(gameId);
        gameMapper.updateEntity(game, request);

        ActivityEntity activity = game.getPlayingActivity();
        if (activity == null) {
            game.setPlayingActivity(createPlayingActivity(game.getTitle()));
        } else {
            activity.setLabel(playingLabel(game.getTitle()));
            activityRepository.save(activity);
        }

        return gameMapper.toResponse(gameRepository.save(game));
    }

    @Transactional
    public void delete(String gameId) {
        GameEntity game = findEntity(gameId);
        ActivityEntity activity = game.getPlayingActivity();
        if (activity != null) {
            activityService.stopActivity(activity.getActivityId());
        }
        gameRepository.delete(game);
    }

    public ActivityTimerResponse getTimer(String gameId) {
        GameEntity game = findEntity(gameId);
        ActivityEntity activity = game.getPlayingActivity();
        return activity == null
                ? emptyTimer(game)
                : toTimerResponse(activity, Instant.now());
    }

    @Transactional
    public ActivityTimerResponse startPlaying(String gameId) {
        GameEntity game = findEntity(gameId);
        ActivityEntity activity = game.getPlayingActivity();
        if (activity == null) {
            activity = createPlayingActivity(game.getTitle());
            game.setPlayingActivity(activity);
            gameRepository.save(game);
        }
        return activityService.startActivity(activity.getActivityId());
    }

    @Transactional
    public ActivityTimerResponse stopPlaying(String gameId) {
        GameEntity game = findEntity(gameId);
        ActivityEntity activity = game.getPlayingActivity();
        return activity == null
                ? emptyTimer(game)
                : activityService.stopActivity(activity.getActivityId());
    }

    private ActivityEntity createPlayingActivity(String gameTitle) {
        ActivityEntity activity = new ActivityEntity();
        activity.setActivityType(ActivityType.PLAYING);
        activity.setLabel(playingLabel(gameTitle));
        return activityRepository.save(activity);
    }

    private ActivityTimerResponse emptyTimer(GameEntity game) {
        return new ActivityTimerResponse(
                null,
                playingLabel(game.getTitle()),
                ActivityType.PLAYING.name(),
                null,
                null,
                false,
                null,
                null,
                0,
                0
        );
    }

    private ActivityTimerResponse toTimerResponse(ActivityEntity activity, Instant now) {
        List<TimeSessionEntity> sessions =
                timeSessionRepository.findAllByActivityOrderByStartedAtDesc(activity);
        TimeSessionEntity activeSession = sessions.stream()
                .filter(session -> session.getEndedAt() == null)
                .findFirst()
                .orElse(null);
        long completedSeconds = sessions.stream()
                .filter(session -> session.getEndedAt() != null)
                .mapToLong(session -> durationSeconds(session.getStartedAt(), session.getEndedAt()))
                .sum();
        long activeSeconds = activeSession == null
                ? 0
                : durationSeconds(activeSession.getStartedAt(), now);

        return new ActivityTimerResponse(
                activity.getActivityId(),
                activity.getLabel(),
                activity.getActivityType().name(),
                null,
                null,
                activeSession != null,
                activeSession == null ? null : activeSession.getSessionId(),
                activeSession == null ? null : activeSession.getStartedAt(),
                completedSeconds,
                completedSeconds + activeSeconds
        );
    }

    private long durationSeconds(Instant start, Instant end) {
        return Math.max(0, Duration.between(start, end).getSeconds());
    }

    private String playingLabel(String title) {
        return "Igranje — " + title;
    }

    private GameStatus parseStatus(String rawStatus) {
        try {
            return GameStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            String allowed = Arrays.stream(GameStatus.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            throw new InvalidRequestException(
                    "Nepoznat status igre. Dopuštene vrijednosti su: " + allowed + "."
            );
        }
    }

    private GameEntity findEntity(String gameId) {
        return gameRepository.findByGameId(gameId)
                .orElseThrow(() -> new GameNotFoundException(gameId));
    }
}
