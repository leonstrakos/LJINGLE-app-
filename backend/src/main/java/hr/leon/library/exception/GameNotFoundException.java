package hr.leon.library.exception;

public class GameNotFoundException extends RuntimeException {

    public GameNotFoundException(String gameId) {
        super("Igra s identifikatorom " + gameId + " nije pronađena.");
    }
}
