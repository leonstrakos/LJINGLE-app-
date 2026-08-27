import { semanticFeedback } from './semanticFeedback';

// crudFeedbackV1
// Call ONLY after a mutation actually succeeds.
export function createdFeedback() {
  void semanticFeedback.create();
}

export function deletedFeedback() {
  void semanticFeedback.delete();
}
