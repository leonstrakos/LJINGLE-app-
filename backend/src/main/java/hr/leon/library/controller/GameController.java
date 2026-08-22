package hr.leon.library.controller;

import hr.leon.library.dto.ActivityTimerResponse;
import hr.leon.library.dto.GameRequest;
import hr.leon.library.dto.GameResponse;
import hr.leon.library.service.GameService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping
    public List<GameResponse> getGames(@RequestParam(required = false) String status) {
        return gameService.getAll(status);
    }

    @GetMapping("/{gameId}")
    public GameResponse getGame(@PathVariable String gameId) {
        return gameService.getByGameId(gameId);
    }

    @PostMapping
    public ResponseEntity<GameResponse> createGame(@Valid @RequestBody GameRequest request) {
        GameResponse created = gameService.create(request);
        return ResponseEntity
                .created(URI.create("/api/games/" + created.gameId()))
                .body(created);
    }

    @PutMapping("/{gameId}")
    public GameResponse updateGame(
            @PathVariable String gameId,
            @Valid @RequestBody GameRequest request
    ) {
        return gameService.update(gameId, request);
    }

    @DeleteMapping("/{gameId}")
    public ResponseEntity<Void> deleteGame(@PathVariable String gameId) {
        gameService.delete(gameId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @GetMapping("/{gameId}/timer")
    public ActivityTimerResponse getTimer(@PathVariable String gameId) {
        return gameService.getTimer(gameId);
    }

    @PostMapping("/{gameId}/timer/start")
    public ActivityTimerResponse startPlaying(@PathVariable String gameId) {
        return gameService.startPlaying(gameId);
    }

    @PostMapping("/{gameId}/timer/stop")
    public ActivityTimerResponse stopPlaying(@PathVariable String gameId) {
        return gameService.stopPlaying(gameId);
    }
}
