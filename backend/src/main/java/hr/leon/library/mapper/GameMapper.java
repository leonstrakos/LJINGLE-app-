package hr.leon.library.mapper;

import hr.leon.library.dto.GameRequest;
import hr.leon.library.dto.GameResponse;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.GameEntity;
import org.springframework.stereotype.Component;

@Component
public class GameMapper {

    public GameEntity toEntity(GameRequest request) {
        GameEntity entity = new GameEntity();
        updateEntity(entity, request);
        return entity;
    }

    public void updateEntity(GameEntity entity, GameRequest request) {
        entity.setTitle(request.title().trim());
        entity.setDeveloper(normalizeOptional(request.developer()));
        entity.setPlatform(request.platform().trim());
        entity.setReleaseYear(request.releaseYear());
        entity.setGameStatus(request.gameStatus());
        entity.setProgress(request.progress());
        entity.setEnjoyment(request.enjoyment());
        entity.setFavourite(request.favourite());
        entity.setStartedOn(request.startedOn());
        entity.setFinishedOn(request.finishedOn());
        entity.setIgdbId(request.igdbId());
        entity.setCoverUrl(normalizeOptional(request.coverUrl()));
    }

    public GameResponse toResponse(GameEntity entity) {
        ActivityEntity activity = entity.getPlayingActivity();
        return new GameResponse(
                entity.getGameId(),
                entity.getTitle(),
                entity.getDeveloper(),
                entity.getPlatform(),
                entity.getReleaseYear(),
                entity.getGameStatus(),
                entity.getProgress(),
                entity.getEnjoyment(),
                entity.isFavourite(),
                entity.getStartedOn(),
                entity.getFinishedOn(),
                entity.getIgdbId(),
                entity.getCoverUrl(),
                activity == null ? null : activity.getActivityId()
        );
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
