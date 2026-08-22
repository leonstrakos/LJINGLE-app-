package hr.leon.library.exception;

public class TopicAlreadyExistsException extends RuntimeException {

    public TopicAlreadyExistsException(String name) {
        super("Tema s nazivom '" + name + "' već postoji.");
    }
}
