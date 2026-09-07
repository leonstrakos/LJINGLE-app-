// ljingleSemanticAliveR1
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { LjingleStar } from './LjingleStar';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { useReducedMotion } from '../utils/useReducedMotion';

const seen = new Set<string>();
const WINDOW_MS = 60 * 1000;

type Props = { entityKey: string; createdAt?: string | null };

export function FreshItemShimmer({ entityKey, createdAt }: Props) {
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ((activeVisualSkinId !== 'classic' && activeVisualSkinId !== 'classic-ljingle') || reduced || !entityKey || seen.has(entityKey)) return;
    const timestamp = createdAt ? Date.parse(createdAt) : NaN;
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > WINDOW_MS || timestamp - Date.now() > 5000) return;
    seen.add(entityKey);
    setVisible(true);
    p.setValue(0);
    const a = Animated.sequence([
      Animated.delay(110),
      Animated.timing(p, { toValue:1, duration:920, easing:Easing.out(Easing.cubic), useNativeDriver:true }),
    ]);
    a.start(({ finished }) => { if (finished) setVisible(false); });
    return () => a.stop();
  }, [createdAt, entityKey, p, reduced]);

  return <View pointerEvents="none" onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.layer}>
    {visible && width > 0 ? (
      <Animated.View style={[styles.shimmer, {
        opacity:p.interpolate({ inputRange:[0,.10,.52,.90,1], outputRange:[0,.48,.78,.20,0] }),
        transform:[
          { translateX:p.interpolate({ inputRange:[0,1], outputRange:[-80,width+80] }) },
          { rotate:'-16deg' },
        ],
      }]}>
        <View style={styles.far} /><View style={styles.near} />
        <LjingleStar variant="spark" size={9} color={colors.text} opacity={.92} style={styles.star} />
        <LjingleStar variant="dot" size={2} color={colors.textMuted} opacity={.55} style={styles.dot} />
      </Animated.View>
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  layer:{ ...StyleSheet.absoluteFillObject, overflow:'hidden', zIndex:3 },
  shimmer:{ position:'absolute', top:-26, bottom:-26, width:72, alignItems:'center', justifyContent:'center' },
  far:{ position:'absolute', top:0, bottom:0, width:1, backgroundColor:colors.textMuted, opacity:.10 },
  near:{ position:'absolute', top:12, bottom:12, width:1, backgroundColor:colors.text, opacity:.24 },
  star:{ position:'absolute', top:'45%', left:28 },
  dot:{ position:'absolute', top:'58%', left:46 },
});
