package hr.leon.library.exception;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import hr.leon.library.entity.ActivityType;
import hr.leon.library.entity.EntryType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler({
            BookNotFoundException.class,
            ActivityNotFoundException.class,
            TopicNotFoundException.class,
            EntryNotFoundException.class,
            MetadataItemNotFoundException.class
    })
    public ResponseEntity<ApiError> handleNotFound(
            RuntimeException exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.NOT_FOUND, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler(MetadataProviderException.class)
    public ResponseEntity<ApiError> handleMetadataProvider(
            MetadataProviderException exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.BAD_GATEWAY, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler(TopicAlreadyExistsException.class)
    public ResponseEntity<ApiError> handleConflict(
            TopicAlreadyExistsException exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.CONFLICT, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ApiError> handleBadRequest(
            InvalidRequestException exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.BAD_REQUEST, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        Map<String, String> fields = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fields.putIfAbsent(error.getField(), error.getDefaultMessage())
        );
        return build(HttpStatus.BAD_REQUEST, "Provjerite unesene podatke.", request, fields);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleMalformedJson(
            HttpMessageNotReadableException exception,
            HttpServletRequest request
    ) {
        InvalidFormatException invalidFormat = findCause(exception, InvalidFormatException.class);
        if (invalidFormat != null && invalidFormat.getTargetType() == ActivityType.class) {
            String allowed = Arrays.stream(ActivityType.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            return build(
                    HttpStatus.BAD_REQUEST,
                    "Nepoznata kategorija aktivnosti. Dopuštene vrijednosti su: " + allowed + ".",
                    request,
                    Map.of("activityType", "Odaberite jednu od dopuštenih kategorija.")
            );
        }
        if (invalidFormat != null && invalidFormat.getTargetType() == EntryType.class) {
            String allowed = Arrays.stream(EntryType.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            return build(
                    HttpStatus.BAD_REQUEST,
                    "Nepoznata vrsta zapisa. Dopuštene vrijednosti su: " + allowed + ".",
                    request,
                    Map.of("type", "Odaberite jednu od dopuštenih vrsta zapisa.")
            );
        }
        return build(HttpStatus.BAD_REQUEST, "Tijelo zahtjeva nije valjan JSON.", request, Map.of());
    }

    @ExceptionHandler({ConstraintViolationException.class, HandlerMethodValidationException.class})
    public ResponseEntity<ApiError> handleParameterValidation(
            Exception exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.BAD_REQUEST, "Parametri zahtjeva nisu valjani.", request, Map.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleParameterTypeMismatch(
            MethodArgumentTypeMismatchException exception,
            HttpServletRequest request
    ) {
        return build(
                HttpStatus.BAD_REQUEST,
                "Parametar '" + exception.getName() + "' nije valjan.",
                request,
                Map.of()
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(
            Exception exception,
            HttpServletRequest request
    ) {
        return build(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Dogodila se neočekivana pogreška.",
                request,
                Map.of()
        );
    }

    private ResponseEntity<ApiError> build(
            HttpStatus status,
            String message,
            HttpServletRequest request,
            Map<String, String> fieldErrors
    ) {
        ApiError error = new ApiError(
                Instant.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI(),
                fieldErrors
        );
        return ResponseEntity.status(status).body(error);
    }

    private <T extends Throwable> T findCause(Throwable throwable, Class<T> type) {
        Throwable current = throwable;
        while (current != null) {
            if (type.isInstance(current)) {
                return type.cast(current);
            }
            current = current.getCause();
        }
        return null;
    }
}
