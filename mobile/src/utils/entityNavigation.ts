import type {
  EntityReference,
  EntityReferenceType,
} from '../types/collection';

type NavigationLike = {
  navigate: (
    screen: string,
    params?: unknown,
  ) => void;
  getParent?: () =>
    | NavigationLike
    | null
    | undefined;
};

type EntityLike = Pick<
  EntityReference,
  'entityType' | 'entityId'
>;

function rootNavigation(
  navigation: NavigationLike,
) {
  let current = navigation;

  while (true) {
    const parent = current.getParent?.();

    if (!parent) return current;

    current = parent;
  }
}

export function openEntityReference(
  navigationValue: unknown,
  entity: EntityLike,
) {
  const navigation =
    rootNavigation(
      navigationValue as NavigationLike,
    );

  switch (
    entity.entityType as EntityReferenceType
  ) {
    case 'BOOK':
      navigation.navigate('BookDetails', {
        bookId: entity.entityId,
      });
      return;

    case 'TOPIC':
      navigation.navigate('TopicDetails', {
        topicId: entity.entityId,
      });
      return;

    case 'ENTRY':
      navigation.navigate('EntryForm', {
        entryId: entity.entityId,
      });
      return;

    case 'GAME':
      navigation.navigate('Games', {
        screen: 'GameDetails',
        params: {
          gameId: entity.entityId,
        },
      });
      return;

    case 'MEDIA':
      navigation.navigate('Media', {
        screen: 'MediaDetails',
        params: {
          mediaId: entity.entityId,
        },
      });
      return;

    case 'FREQUENCY':
      navigation.navigate('MemoryRadio', {
        trackId: entity.entityId,
      });
      return;

    default:
      return;
  }
}

export function openCollectionReference(
  navigationValue: unknown,
  collectionId: string,
) {
  rootNavigation(
    navigationValue as NavigationLike,
  ).navigate('CollectionDetails', {
    collectionId,
  });
}
