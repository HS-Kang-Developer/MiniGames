import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko/translation.json';
import ja from './locales/ja/translation.json';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    ja: { translation: ja },
  },
  lng: 'ko', // 기본 언어 (초기값)
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

export default i18n;
