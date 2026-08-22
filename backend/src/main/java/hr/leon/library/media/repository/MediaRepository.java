package hr.leon.library.media.repository;

import hr.leon.library.media.entity.MediaEntity;
import hr.leon.library.media.entity.MediaType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MediaRepository extends JpaRepository<MediaEntity, Long> {
    Optional<MediaEntity> findByMediaId(String mediaId);

    Optional<MediaEntity> findByMediaTypeAndTmdbId(MediaType mediaType, Long tmdbId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select media from MediaEntity media where media.mediaId = :mediaId")
    Optional<MediaEntity> findByMediaIdForUpdate(@Param("mediaId") String mediaId);
}
