import { activityTypeLabels } from '../types/topic';
import type { EntryLinkLabels, EntryLinkOption, EntryLinks } from '../types/entry';
import { gameApi } from '../games/services/gameApi';
import { activityApi } from './activityApi';
import { bookApi } from './bookApi';
import { mediaApi } from './mediaApi';
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

export const entryLinksApi = {
  async getAll(force = false): Promise<EntryLinks> {
    if (cachedLinks && !force) return cachedLinks;

    const [books, topics, games, mediaItems] = await Promise.all([
      bookApi.getAll(),
      topicApi.getAll(),
      gameApi.getAll(),
      mediaApi.getAll(),
    ]);
    const [activityGroups, readingTimers, gameTimers, mediaTimers] = await Promise.all([
      Promise.all(topics.map((topic) => topicApi.getActivities(topic.topicId))),
      Promise.all(
        books.map((book) =>
          activityApi.getReadingTimer(book.bookId).catch(() => null),
        ),
      ),
      Promise.all(games.map((game) => gameApi.getTimer(game.gameId).catch(() => null))),
      Promise.all(
        mediaItems.map((item) => mediaApi.getTimer(item.mediaId).catch(() => null)),
      ),
    ]);
    const topicNames = Object.fromEntries(
      topics.map((topic) => [topic.topicId, topic.name]),
    );
    const bookNames = Object.fromEntries(books.map((book) => [book.bookId, book.title]));
    const activitiesById = new Map<string, EntryLinkOption>(
      activityGroups.flat().map((activity) => [
        activity.activityId,
        {
          id: activity.activityId,
          label: activity.label,
          detail: [
            activity.topicId ? topicNames[activity.topicId] : undefined,
            activityTypeLabels[activity.activityType],
          ]
            .filter(Boolean)
            .join(' · '),
          topicId: activity.topicId ?? undefined,
        },
      ]),
    );
    readingTimers.forEach((timer) => {
      if (!timer?.activityId || activitiesById.has(timer.activityId)) return;
      activitiesById.set(timer.activityId, {
        id: timer.activityId,
        label: timer.label,
        detail: [timer.bookId ? bookNames[timer.bookId] : undefined, 'Čitanje']
          .filter(Boolean)
          .join(' · '),
      });
    });
    gameTimers.forEach((timer, index) => {
      if (!timer?.activityId || activitiesById.has(timer.activityId)) return;
      activitiesById.set(timer.activityId, {
        id: timer.activityId,
        label: timer.label,
        detail: `${games[index]?.title ?? 'Igra'} · Igranje`,
      });
    });
    mediaTimers.forEach((timer, index) => {
      if (!timer?.activityId || activitiesById.has(timer.activityId)) return;
      const item = mediaItems[index];
      const kind = item?.mediaType === 'MOVIE' ? 'Film' : 'Serija';
      activitiesById.set(timer.activityId, {
        id: timer.activityId,
        label: timer.label,
        detail: `${item?.title ?? kind} · Gledanje`,
      });
    });

    cachedLinks = {
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
      activities: alphabetically(Array.from(activitiesById.values())),
    };
    return cachedLinks;
  },

  clearCache() {
    cachedLinks = null;
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
