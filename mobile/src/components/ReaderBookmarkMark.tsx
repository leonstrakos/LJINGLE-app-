// ljingleCompletionSealReaderBookmarksR1
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { hasReaderBookmarks, subscribeReaderBookmarkChanges } from '../services/bookReaderRepository';
import { ReaderBookmarkGlyph } from './ReaderBookmarkGlyph';

type Props = {
  bookId: string;
  style?: StyleProp<ViewStyle>;
};

export function ReaderBookmarkMark({ bookId, style }: Props) {
  const [visible, setVisible] = useState(false);

  const refresh = useCallback(() => {
    let alive = true;
    void hasReaderBookmarks(bookId)
      .then((value) => {
        if (alive) setVisible(value);
      })
      .catch(() => {
        if (alive) setVisible(false);
      });
    return () => { alive = false; };
  }, [bookId]);

  useEffect(() => {
    const cancelPending = refresh();
    const unsubscribe = subscribeReaderBookmarkChanges((changedBookId) => {
      if (changedBookId === bookId) refresh();
    });
    return () => {
      cancelPending();
      unsubscribe();
    };
  }, [bookId, refresh]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={style}>
      <ReaderBookmarkGlyph active size={18} />
    </View>
  );
}
