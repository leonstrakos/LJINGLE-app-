// ljingleSemanticAliveR1
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { LjingleStar } from './LjingleStar';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { useReducedMotion } from '../utils/useReducedMotion';
import { subscribeSemanticAlive, type SemanticAliveEvent } from '../motion/semanticAlive';

type Live = { id: number; event: SemanticAliveEvent };
const burst = [[-54,-28],[-20,-54],[28,-46],[55,-10],[38,32],[-35,38]] as const;

function Reaction({ live, width, height, done }: { live: Live; width: number; height: number; done: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    p.setValue(0);
    const a = Animated.timing(p, {
      toValue: 1,
      duration:
        live.event.type === 'COLLECTION_ADD'
          ? 720
          : live.event.type === 'JINGLE'
            ? 1040
            : 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start(({ finished }) => { if (finished) done(); });
    return () => a.stop();
  }, [done, live.id, live.event.type, p]);

  if (live.event.type === 'JINGLE') {
    // ljingleBrainRadioJingleMotionR1:semantic
    // Floating Jingle anchor is left:50%, bottom:18, 84x84 -> center = height - 60.
    const ox = width * 0.50;
    const oy = Math.max(72, height - 60);
    return <>{burst.map((d, i) => (
      <Animated.View key={i} style={{
        position: 'absolute', left: ox, top: oy,
        opacity: p.interpolate({ inputRange: [0,.12,.48,1], outputRange: [0,.86,.50,0] }),
        transform: [
          { translateX: p.interpolate({ inputRange: [0,1], outputRange: [0,d[0]] }) },
          { translateY: p.interpolate({ inputRange: [0,1], outputRange: [0,d[1]] }) },
          { scale: p.interpolate({ inputRange: [0,.28,1], outputRange: [.54,1.05,.66] }) },
        ],
      }}>
        <LjingleStar variant={i % 3 === 1 ? 'dot' : 'spark'} size={i % 3 === 1 ? 2 : 7 + (i % 2) * 3}
          color={i % 2 === 0 ? colors.text : colors.textMuted} opacity={1} />
      </Animated.View>
    ))}</>;
  }

  if (live.event.type === 'ENTRY_SAVE') {
    const ox = width * .50, oy = height * .42;
    const starts = [[-72,-42],[78,-31],[-62,48],[66,52]] as const;
    return <>{starts.map((s, i) => (
      <Animated.View key={i} style={{
        position: 'absolute', left: ox, top: oy,
        opacity: p.interpolate({ inputRange: [0,.18,.76,1], outputRange: [0,.70,.74,0] }),
        transform: [
          { translateX: p.interpolate({ inputRange: [0,1], outputRange: [s[0],0] }) },
          { translateY: p.interpolate({ inputRange: [0,1], outputRange: [s[1],0] }) },
          { scale: p.interpolate({ inputRange: [0,.74,1], outputRange: [.75,1,.28] }) },
        ],
      }}>
        <LjingleStar variant="spark" size={6 + i * 1.25} color={i % 2 === 0 ? colors.text : colors.textMuted} opacity={1} />
      </Animated.View>
    ))}
      <Animated.View style={{ position:'absolute', left:ox-8, top:oy-8,
        opacity:p.interpolate({ inputRange:[0,.70,.88,1], outputRange:[0,0,.88,0] }),
        transform:[{ scale:p.interpolate({ inputRange:[0,.82,1], outputRange:[.3,1.08,.55] }) }],
      }}>
        <LjingleStar variant="spark" size={16} color={colors.text} opacity={1} />
      </Animated.View>
    </>;
  }

  const sx = width * .30, sy = height * .68, ex = width * .82, ey = height * .22;
  return <>
    <Animated.View style={{ position:'absolute', left:sx, top:sy,
      opacity:p.interpolate({ inputRange:[0,.08,.76,1], outputRange:[0,.90,.78,0] }),
      transform:[
        { translateX:p.interpolate({ inputRange:[0,1], outputRange:[0,ex-sx] }) },
        { translateY:p.interpolate({ inputRange:[0,.55,1], outputRange:[0,-80,ey-sy] }) },
        { scale:p.interpolate({ inputRange:[0,.45,1], outputRange:[.72,1.08,.58] }) },
      ],
    }}>
      <LjingleStar variant="spark" size={10} color={colors.text} opacity={1} />
    </Animated.View>
    <Animated.View style={{ position:'absolute', left:ex-3, top:ey-3,
      opacity:p.interpolate({ inputRange:[0,.76,.91,1], outputRange:[0,0,.68,0] }),
      transform:[{ scale:p.interpolate({ inputRange:[0,.82,1], outputRange:[.4,1.30,.72] }) }],
    }}>
      <LjingleStar variant="spark" size={12} color={colors.textMuted} opacity={1} />
    </Animated.View>
  </>;
}

export function SemanticAliveOverlay() {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [live, setLive] = useState<Live | null>(null);
  const serial = useRef(0);
  const lastJingleVisualAtR1 = useRef(0);
  useEffect(() => subscribeSemanticAlive(event => {
    // ljingleRadioWhiteSilentR1:semantic
    if (event.type === 'JINGLE') return;
    if (event.type === 'JINGLE') {
      const now = Date.now();
      if (now - lastJingleVisualAtR1.current < 720) return;
      lastJingleVisualAtR1.current = now;
    }

    serial.current += 1;
    setLive({ id: serial.current, event });
  }), []);
  if ((activeVisualSkinId !== 'classic' && activeVisualSkinId !== 'classic-ljingle') || reduced || !live) return null;
  return <View pointerEvents="none" style={styles.layer}>
    <Reaction live={live} width={width} height={height}
      done={() => setLive(current => current?.id === live.id ? null : current)} />
  </View>;
}

const styles = StyleSheet.create({ layer: { ...StyleSheet.absoluteFillObject, zIndex: 5000, elevation: 50 } });
