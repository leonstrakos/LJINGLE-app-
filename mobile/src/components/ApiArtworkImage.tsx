// ljingleCoverAssetsMobileR2
import { useEffect, useState } from 'react';
import { Image, View, type ImageProps } from 'react-native';

import { resolveApiArtwork } from '../services/apiArtworkCache';

type Props = Omit<ImageProps, 'source'> & {
  cacheKey: string;
  sourceUrl: string;
};

export function ApiArtworkImage({ cacheKey, sourceUrl, style, ...props }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    void resolveApiArtwork(cacheKey, sourceUrl).then((resolved) => {
      if (!cancelled) setUri(resolved || sourceUrl);
    });
    return () => { cancelled = true; };
  }, [cacheKey, sourceUrl]);

  if (!uri) return <View pointerEvents="none" style={style as any} />;
  return <Image {...props} source={{ uri }} style={style} />;
}
