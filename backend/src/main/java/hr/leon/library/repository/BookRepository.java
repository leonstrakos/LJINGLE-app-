package hr.leon.library.repository;

import hr.leon.library.entity.BookEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BookRepository extends JpaRepository<BookEntity, Long> {
    Optional<BookEntity> findByBookId(String bookId);

    boolean existsByBookId(String bookId);

    void deleteByBookId(String bookId);
}
