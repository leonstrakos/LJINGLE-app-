package hr.leon.library.provider.igdb;

import hr.leon.library.dto.GameMetadataResponse;

import java.util.List;

public interface IgdbGameProvider {
    List<GameMetadataResponse> search(String query);
}
