package hr.leon.library.repository;

import hr.leon.library.entity.GameEntity;
import hr.leon.library.entity.GameStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GameRepository extends JpaRepository<GameEntity, Long> {
    Optional<GameEntity> findByGameId(String gameId);

    List<GameEntity> findAllByOrderByTitleAsc();

    List<GameEntity> findAllByGameStatusOrderByTitleAsc(GameStatus gameStatus);
}
