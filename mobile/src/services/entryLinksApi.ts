import { activityTypeLabels } from '../types/topic';
import type { EntryLinkLabels, EntryLinkOption, EntryLinks } from '../types/entry';
import { bookApi } from './bookApi';
import { topicApi } from './topicApi';

export const emptyEntryLinks: EntryLinks = {
  books: [],
  topics: [],
  activities: [],
};

export const emptyEntryLinkLabels: EntryLinkLabels = {
  books: {},
  topics: {},
  activities: {},
};

function alphabetically<T extends { label: string }>(items: T[]) {
  return items.sort((left, right) => left.label.localeCompare(right.label, 'hr'));
}

let cachedLinks: EntryLinks | null = null;
let cachedRequest: Promise<EntryLinks> | null = null;
let latestRequest = 0;

export const entryLinksApi = {
  async getAll(force = false): Promise<EntryLinks> {
    if (cachedLinks && !force) return cachedLinks;
    if (cachedRequest && !force) return cachedRequest;

    const requestNumber = ++latestRequest;

    // settingsApplyNotesSpeedV1: three flat local queries replace one request per catalogue
    // item/timer. Existing activity labels already contain their owner names.
    const request = (async (): Promise<EntryLinks> => {
      const [books, topics, activities] = await Promise.all([
        bookApi.getAll(),
        topicApi.getAll(),
        topicApi.getAllActivities(),
      ]);

      const topicNames = Object.fromEntries(
        topics.map((topic) => [topic.topicId, topic.name]),
      );
      const bookNames = Object.fromEntries(
        books.map((book) => [book.bookId, book.title]),
      );

      return {
        books: alphabetically(
          books.map((book) => ({
            id: book.bookId,
            label: book.title,
            detail: book.author,
          })),
        ),
        topics: alphabetically(
          topics.map((topic) => ({
            id: topic.topicId,
            label: topic.name,
            detail: topic.description ?? undefined,
          })),
        ),
        activities: alphabetically(
          activities.map((activity) => ({
            id: activity.activityId,
            label: activity.label,
            detail: [
              activity.topicId
                ? topicNames[activity.topicId]
                : activity.bookId
                  ? bookNames[activity.bookId]
                  : undefined,
              activityTypeLabels[activity.activityType],
            ]
              .filter(Boolean)
              .join(' · '),
            topicId: activity.topicId ?? undefined,
          })),
        ),
      };
    })();

    cachedRequest = request;

    try {
      const links = await request;
      if (requestNumber === latestRequest) {
        cachedLinks = links;
      }
      return links;
    } finally {
      if (cachedRequest === request) {
        cachedRequest = null;
      }
    }
  },

  clearCache() {
    latestRequest += 1;
    cachedLinks = null;
    cachedRequest = null;
  },

  toLabels(links: EntryLinks): EntryLinkLabels {
    return {
      books: Object.fromEntries(links.books.map((item) => [item.id, item.label])),
      topics: Object.fromEntries(links.topics.map((item) => [item.id, item.label])),
      activities: Object.fromEntries(
        links.activities.map((item) => [item.id, item.label]),
      ),
    };
  },
};
