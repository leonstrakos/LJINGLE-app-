package hr.leon.library.service;

import hr.leon.library.dto.TopicRequest;
import hr.leon.library.dto.TopicResponse;
import hr.leon.library.entity.ActivityEntity;
import hr.leon.library.entity.TopicEntity;
import hr.leon.library.exception.TopicAlreadyExistsException;
import hr.leon.library.exception.TopicNotFoundException;
import hr.leon.library.repository.ActivityRepository;
import hr.leon.library.repository.TopicRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class TopicService {

    private final TopicRepository topicRepository;
    private final ActivityRepository activityRepository;

    public TopicService(
            TopicRepository topicRepository,
            ActivityRepository activityRepository
    ) {
        this.topicRepository = topicRepository;
        this.activityRepository = activityRepository;
    }

    public List<TopicResponse> getAll() {
        return topicRepository.findAll(Sort.by(Sort.Direction.ASC, "name"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public TopicResponse getByTopicId(String topicId) {
        return toResponse(findEntity(topicId));
    }

    @Transactional
    public TopicResponse create(TopicRequest request) {
        String normalizedName = normalizeRequired(request.name());
        ensureNameAvailable(normalizedName, null);

        TopicEntity topic = new TopicEntity();
        applyRequest(topic, normalizedName, request.description());
        return save(topic, normalizedName);
    }

    @Transactional
    public TopicResponse update(String topicId, TopicRequest request) {
        TopicEntity topic = findEntity(topicId);
        String normalizedName = normalizeRequired(request.name());
        ensureNameAvailable(normalizedName, topicId);
        applyRequest(topic, normalizedName, request.description());
        return save(topic, normalizedName);
    }

    @Transactional
    public void delete(String topicId) {
        TopicEntity topic = findEntity(topicId);
        List<ActivityEntity> activities =
                activityRepository.findAllByTopicTopicIdOrderByLabelAsc(topicId);
        activities.forEach(activity -> activity.setTopic(null));
        activityRepository.saveAll(activities);
        activityRepository.flush();
        topicRepository.delete(topic);
    }

    private TopicEntity findEntity(String topicId) {
        return topicRepository.findByTopicId(topicId)
                .orElseThrow(() -> new TopicNotFoundException(topicId));
    }

    private void ensureNameAvailable(String name, String currentTopicId) {
        boolean exists = currentTopicId == null
                ? topicRepository.existsByNameIgnoreCase(name)
                : topicRepository.existsByNameIgnoreCaseAndTopicIdNot(name, currentTopicId);
        if (exists) {
            throw new TopicAlreadyExistsException(name);
        }
    }

    private void applyRequest(TopicEntity topic, String name, String description) {
        topic.setName(name);
        topic.setDescription(normalizeOptional(description));
    }

    private TopicResponse save(TopicEntity topic, String requestedName) {
        try {
            TopicEntity saved = topicRepository.saveAndFlush(topic);
            return toResponse(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new TopicAlreadyExistsException(requestedName);
        }
    }

    private String normalizeRequired(String value) {
        return value.trim();
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private TopicResponse toResponse(TopicEntity topic) {
        return new TopicResponse(
                topic.getTopicId(),
                topic.getName(),
                topic.getDescription(),
                activityRepository.countByTopicTopicId(topic.getTopicId()),
                topic.getCreatedAt(),
                topic.getModifiedAt()
        );
    }
}
