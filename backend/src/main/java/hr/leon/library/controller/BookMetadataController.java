package hr.leon.library.controller;

import hr.leon.library.dto.BookImportConfirmRequest;
import hr.leon.library.dto.BookImportPreviewRequest;
import hr.leon.library.dto.BookImportPreviewResponse;
import hr.leon.library.dto.BookImportResultResponse;
import hr.leon.library.dto.BookMetadataCandidate;
import hr.leon.library.dto.BookMetadataIsbnResponse;
import hr.leon.library.dto.BookMetadataReconcileRequest;
import hr.leon.library.dto.BookMetadataSearchResponse;
import hr.leon.library.metadata.MetadataProvider;
import hr.leon.library.service.BookImportService;
import hr.leon.library.service.BookMetadataService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/book-metadata")
public class BookMetadataController {

    private final BookMetadataService metadataService;
    private final BookImportService importService;

    public BookMetadataController(
            BookMetadataService metadataService,
            BookImportService importService
    ) {
        this.metadataService = metadataService;
        this.importService = importService;
    }

    @GetMapping("/search")
    public BookMetadataSearchResponse search(
            @RequestParam @Size(min = 2, max = 200) String q,
            @RequestParam(required = false) MetadataProvider provider,
            @RequestParam(defaultValue = "20") @Min(1) @Max(40) int limit
    ) {
        return metadataService.search(q, provider, limit);
    }

    @GetMapping("/isbn/{isbn}")
    public BookMetadataIsbnResponse lookupIsbn(
            @PathVariable @Size(min = 10, max = 32) String isbn
    ) {
        return metadataService.lookupIsbn(isbn);
    }

    @PostMapping("/reconcile")
    public BookMetadataCandidate reconcile(
            @Valid @RequestBody BookMetadataReconcileRequest request
    ) {
        return metadataService.reconcile(request.sources());
    }

    @PostMapping("/imports/preview")
    public BookImportPreviewResponse previewImport(
            @Valid @RequestBody BookImportPreviewRequest request
    ) {
        return importService.preview(request);
    }

    @PostMapping("/imports/confirm")
    public ResponseEntity<BookImportResultResponse> confirmImport(
            @Valid @RequestBody BookImportConfirmRequest request
    ) {
        BookImportResultResponse result = importService.confirm(request);
        HttpStatus status = result.action() == hr.leon.library.dto.BookImportAction.CREATE
                ? HttpStatus.CREATED
                : HttpStatus.OK;
        return ResponseEntity.status(status).body(result);
    }
}
