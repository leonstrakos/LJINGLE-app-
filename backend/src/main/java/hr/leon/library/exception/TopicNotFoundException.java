package hr.leon.library.exception;

public class TopicNotFoundException extends RuntimeException {

    public TopicNotFoundException(String topicId) {
        super("Tema s identifikatorom '" + topicId + "' ne postoji.");
    }
}
