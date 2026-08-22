import { Platform } from 'react-native';

const emulatorDefault = Platform.select({
  android: 'http://10.0.2.2:8080/api',
  ios: 'http://localhost:8080/api',
  default: 'http://localhost:8080/api',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? emulatorDefault;
