// ljingleSemanticAliveR1
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { LjingleStar } from './LjingleStar';
import { colors } from '../theme/colors';
import { activeVisualSkinId } from '../theme/visualSkins';
import { useReducedMotion } from '../utils/useReducedMotion';

type Mode='timer'|'radio'|'capsule'|'reading';
type Props={mode:Mode;active:boolean};
const points=[['12%','16%'],['30%','42%'],['54%','20%'],['73%','58%'],['88%','34%'],['42%','76%']] as const;

function Particle({index,mode}:{index:number;mode:Mode}){
  const p=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const d=mode==='radio'?3600:mode==='timer'?5400:mode==='reading'?7200:8600;
    const a=Animated.loop(Animated.sequence([
      Animated.delay(index*270),
      Animated.timing(p,{toValue:1,duration:d,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(p,{toValue:0,duration:d*.82,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ])); a.start(); return()=>a.stop();
  },[index,mode,p]);
  const point=points[index]||points[0];
  const dx=mode==='radio'?42:mode==='timer'?20:mode==='reading'?14:8;
  const dy=mode==='reading'?46:mode==='timer'?26:mode==='radio'?8:-10;
  return <Animated.View style={{position:'absolute',left:point[0],top:point[1],
    opacity:p.interpolate({inputRange:[0,.45,1],outputRange:[.10,.42,.14]}),
    transform:[
      {translateX:p.interpolate({inputRange:[0,1],outputRange:[-dx*.35,dx]})},
      {translateY:p.interpolate({inputRange:[0,1],outputRange:[-8,dy]})},
      {scale:p.interpolate({inputRange:[0,.55,1],outputRange:[.82,1.06,.90]})},
    ],
  }}>
    <LjingleStar variant={index%3===1?'dot':'spark'} size={index%3===1?1.8:5+(index%2)*2}
      color={index%2===0?colors.text:colors.textMuted} opacity={1}/>
  </Animated.View>;
}

export function ReactiveAmbientField({mode,active}:Props){
  const reduced=useReducedMotion();
  if(!active||reduced||(activeVisualSkinId !== 'classic' && activeVisualSkinId !== 'classic-ljingle'))return null;
  return <View pointerEvents="none" style={styles.layer}>{points.map((_,i)=><Particle key={mode+':'+i} index={i} mode={mode}/>)}</View>;
}
const styles=StyleSheet.create({layer:{...StyleSheet.absoluteFillObject,overflow:'hidden'}});
