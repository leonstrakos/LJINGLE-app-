import { Image } from 'react-native';

const shareArtwork = require(
  '../../assets/ljingle-share-icon-clean.png',
);

type Props = {
  size?: number;
};

export function ShareGlyph({
  size = 25,
}: Props) {
  return (
    <Image
      resizeMode="contain"
      source={shareArtwork}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
