import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';
import { celestial } from '../theme/celestial';

type Birthday = { day: number; month: number };
const BirthdayContext = createContext<Birthday | null>(null);
export function validBirthday(day: number, month: number) {
  return Number.isInteger(day) && Number.isInteger(month) && month >= 1 && month <= 12 && day >= 1 && day <= [31,29,31,30,31,30,31,31,30,31,30,31][month - 1];
}
// Conventional tropical sun-sign dates; no year or birth time is collected.
export function zodiacFor({ day, month }: Birthday) {
  const cutoffs = [20,19,21,20,21,21,23,23,23,23,22,22];
  const signs = [
    ['Jarac','♑'], ['Vodenjak','♒'], ['Ribe','♓'], ['Ovan','♈'],
    ['Bik','♉'], ['Blizanci','♊'], ['Rak','♋'], ['Lav','♌'],
    ['Djevica','♍'], ['Vaga','♎'], ['Škorpion','♏'], ['Strijelac','♐'],
  ];
  return signs[(month - 1 + (day >= cutoffs[month - 1] ? 1 : 0)) % 12];
}
function storageKey(userId: string) {
  return 'ljingle.birthday.v1.' + Array.from(userId).map(c => c.codePointAt(0)!.toString(16)).join('_');
}
async function load(key: string) {
  return Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : SecureStore.getItemAsync(key);
}
async function save(key: string, value: string) {
  if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
export function BirthdayGate({ userId, children }: React.PropsWithChildren<{userId: string}>) {
  const [ready, setReady] = useState(false);
  const [birthday, setBirthday] = useState<Birthday | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void load(storageKey(userId)).then(raw => {
      if (!live || !raw) return;
      const value = JSON.parse(raw);
      if (value && validBirthday(value.day, value.month)) setBirthday({day: value.day, month: value.month});
    }).catch(() => {}).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [userId]);
  async function submit() {
    const value = {day: Number(day), month: Number(month)};
    if (!validBirthday(value.day, value.month)) { setError('Provjeri dan i mjesec rođenja.'); return; }
    setBusy(true); setError('');
    try { await save(storageKey(userId), JSON.stringify(value)); setBirthday(value); }
    catch { setError('Spremanje nije uspjelo. Pokušaj ponovno ili odaberi Kasnije.'); }
    finally { setBusy(false); }
  }
  if (!ready) return <View style={{flex:1, backgroundColor:colors.background, justifyContent:'center'}}><ActivityIndicator color={colors.text} /></View>;
  if (birthday || skipped) return <BirthdayContext.Provider value={birthday}>{children}</BirthdayContext.Provider>;
  const preview = validBirthday(Number(day),Number(month)) ? zodiacFor({day:Number(day),month:Number(month)}) : null;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1, justifyContent:'center', padding:28, backgroundColor:colors.background}}>
    <Text style={{color:colors.text, fontSize:28, fontWeight:'700'}}>Tvoj znak na nebu</Text>
    <Text style={{color:colors.textMuted, marginTop:12, marginBottom:24, fontSize:15}}>Dan i mjesec rođenja — bez godine. Za mali osobni detalj na početnom zaslonu. Podatak ostaje na ovom uređaju.</Text>
    <View style={{flexDirection:'row', gap:12}}>
      <TextInput accessibilityLabel="Dan rođenja" placeholder="Dan" placeholderTextColor={colors.textMuted} value={day} onChangeText={v=>setDay(v.replace(/\D/g,''))} keyboardType="number-pad" maxLength={2} editable={!busy} style={{flex:1,padding:16,borderRadius:12,backgroundColor:colors.surface,color:colors.text,fontSize:20}} />
      <TextInput accessibilityLabel="Mjesec rođenja" placeholder="Mjesec" placeholderTextColor={colors.textMuted} value={month} onChangeText={v=>setMonth(v.replace(/\D/g,''))} keyboardType="number-pad" maxLength={2} editable={!busy} style={{flex:1,padding:16,borderRadius:12,backgroundColor:colors.surface,color:colors.text,fontSize:20}} />
    </View>
    {preview ? <Text style={{color:colors.text,marginTop:18,fontSize:22}}>{preview[1]}︎ · {preview[0]}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{color:colors.text,marginTop:16}}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void submit()} style={{padding:16,backgroundColor:colors.black,borderRadius:16,marginTop:24,alignItems:'center'}}>
      <Text style={{color:colors.onAccent,fontWeight:'700'}}>{busy ? 'Spremam…' : 'Spremi i nastavi'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setSkipped(true)} style={{padding:18,alignItems:'center'}}><Text style={{color:colors.text}}>Kasnije</Text></Pressable>
  </ScrollView>;
}
// ljinglePortalPersonalZodiacMarkR1:personal-component
export function PersonalZodiacMark() {
  const birthday =
    useContext(
      BirthdayContext,
    );

  if (!birthday) {
    return null;
  }

  const [
    ,
    personalGlyph,
  ] =
    zodiacFor(
      birthday,
    );

  return (
    <Text
      allowFontScaling={false}
      accessible={false}
      style={{
        color:
          celestial.accentText,
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '400',
        opacity: 0.14,
      }}
    >
      {
        personalGlyph +
        '\uFE0E'
      }
    </Text>
  );
}

export function ZodiacWatermark() {
  const birthday =
    useContext(
      BirthdayContext,
    );

  if (!birthday) {
    return null;
  }

  const [
    ,
    personalGlyph,
  ] =
    zodiacFor(
      birthday,
    );

  const now =
    new Date();

  const [
    ,
    seasonalGlyph,
  ] =
    zodiacFor({
      day:
        now.getDate(),
      month:
        now.getMonth() + 1,
    });

  const personalSeason =
    seasonalGlyph ===
    personalGlyph;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        right: 4,
        top: -22,
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        opacity:
          personalSeason
            ? 0.07
            : 0.018,
        transform: [
          {
            rotate: '14deg',
          },
        ],
      }}
    >
      <Text
        allowFontScaling={
          false
        }
        style={{
          color:
            celestial.accentText,
          fontSize: 86,
          lineHeight: 100,
          fontWeight: '400',
        }}
      >
        {
          seasonalGlyph +
          '\uFE0E'
        }
      </Text>
    </View>
  );
}

// ljingleCurrentSeasonZodiacWatermarkR11

// ljingleHomeZodiacBarelyVisibleR1
