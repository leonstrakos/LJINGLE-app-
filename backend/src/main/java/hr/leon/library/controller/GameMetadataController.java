package hr.leon.library.controller;

import hr.leon.library.dto.GameMetadataResponse;
import hr.leon.library.provider.igdb.IgdbGameProvider;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/games/metadata")
public class GameMetadataController {

    private final IgdbGameProvider igdbGameProvider;

    public GameMetadataController(IgdbGameProvider igdbGameProvider) {
        this.igdbGameProvider = igdbGameProvider;
    }

    @GetMapping("/search")
    public List<GameMetadataResponse> search(
            @RequestParam
            @NotBlank(message = "Pojam za pretraživanje je obvezan.")
            @Size(max = 120, message = "Pojam za pretraživanje smije imati najviše 120 znakova.")
            String query
    ) {
        return igdbGameProvider.search(query.trim());
    }
}
