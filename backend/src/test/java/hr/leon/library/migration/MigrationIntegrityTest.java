package hr.leon.library.migration;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MigrationIntegrityTest {

    private static final Map<String, String> FROZEN_MIGRATIONS = frozenMigrations();

    @Test
    void releasedV1ThroughV7RemainByteForByteImmutable() throws Exception {
        for (Map.Entry<String, String> migration : FROZEN_MIGRATIONS.entrySet()) {
            assertThat(sha256(migration.getKey()))
                    .as("checksum for %s", migration.getKey())
                    .isEqualTo(migration.getValue());
        }
    }

    private String sha256(String filename) throws IOException, NoSuchAlgorithmException {
        String resource = "/db/migration/" + filename;
        try (InputStream input = MigrationIntegrityTest.class.getResourceAsStream(resource)) {
            assertThat(input).as("migration resource %s", resource).isNotNull();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        }
    }

    private static Map<String, String> frozenMigrations() {
        Map<String, String> migrations = new LinkedHashMap<>();
        migrations.put(
                "V1__create_books_table.sql",
                "ae4be5a52f4b9c162176268f67d90060c9b2da3775991818bb90617c0b1d9c49"
        );
        migrations.put(
                "V2__seed_books.sql",
                "92ef9ce9eb64bda885f786cebd0fee281f64485a34c52b566037383eb420ac14"
        );
        migrations.put(
                "V3__seed_catalog.sql",
                "49f8084959b7e7c997d7316051c09a1b2dddb3a632ca8e19203ab722c4414db2"
        );
        migrations.put(
                "V4__create_activities_and_time_sessions.sql",
                "6e4ade21be3262de8e2be155493809f1ce3ba119716f67dfecadb819313aaf4a"
        );
        migrations.put(
                "V5__add_personal_book_tracking.sql",
                "b66060ff72e70c0d658900c5beacda96a47d04de963955473eebf441fa8de624"
        );
        migrations.put(
                "V6__create_topics_and_link_activities.sql",
                "2f0445405222a1af2de8a14d289c936b551e65b688e8bc8672d6662af1a13818"
        );
        migrations.put(
                "V7__create_entries.sql",
                "e79e01606f72eab1da7528dbff365043029a17a8d0fb286d6a9ec3e32f6e793b"
        );
        return Map.copyOf(migrations);
    }
}
