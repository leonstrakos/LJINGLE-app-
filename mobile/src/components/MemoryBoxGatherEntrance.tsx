// ljingleSemanticAliveR1
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useRef } from 'react';
import { LjingleStar } from './LjingleStar';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { useReducedMotion } from '../utils/useReducedMotion';

const points = [[.08,.14,9],[.25,.06,5],[.77,.08,7],[.93,.24,4],[.07,.72,6],[.22,.88,4],[.72,.91,8],[.92,.70,5],[.14,.43,3],[.84,.47,4]] as const;

function Point({ index, width, height }: { index:number; width:number; height:number }) {
  const p = useRef(new Animated.Value(0)).current;
  const c = points[index];
  useEffect(() => {
    const a = Animated.sequence([
      Animated.delay(index * 24),
      Animated.timing(p, { toValue:1, duration:610 + index*12, easing:Easing.inOut(Easing.cubic), useNativeDriver:true }),
    ]);
    a.start(); return () => a.stop();
  }, [index,p]);
  if (!c) return null;
  const x=c[0]*width, y=c[1]*height, tx=width*.5, ty=Math.min(height*.34,280);
  return <Animated.View style={{ position:'absolute', left:x, top:y,
    opacity:p.interpolate({ inputRange:[0,.10,.68,1], outputRange:[0,.46,.58,0] }),
    transform:[
      { translateX:p.interpolate({ inputRange:[0,1], outputRange:[0,tx-x] }) },
      { translateY:p.interpolate({ inputRange:[0,1], outputRange:[0,ty-y] }) },
      { scale:p.interpolate({ inputRange:[0,.55,1], outputRange:[.72,1.03,.42] }) },
    ],
  }}>
    <LjingleStar variant={index%4===1?'dot':'spark'} size={index%4===1?2:c[2]}
      color={index%2===0?colors.text:colors.textMuted} opacity={1} />
  </Animated.View>;
}

export function MemoryBoxGatherEntrance({ identity }: { identity:string }) {
  const reduced=useReducedMotion(); const {width,height}=useWindowDimensions();
  if ((activeVisualSkinId !== 'classic' && activeVisualSkinId !== 'classic-ljingle')||reduced) return null;
  return <View key={identity} pointerEvents="none" style={styles.layer}>
    {points.map((_,i)=><Point key={identity+':'+i} index={i} width={width} height={height}/>)}
  </View>;
}
const styles=StyleSheet.create({layer:{...StyleSheet.absoluteFillObject,overflow:'hidden',zIndex:2}});
