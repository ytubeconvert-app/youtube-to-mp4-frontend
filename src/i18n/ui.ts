// i18n Configuration and Dictionary Helper
export const languages = {
  en: { name: 'English', dir: 'ltr', flag: '🇺🇸' },
  es: { name: 'Español', dir: 'ltr', flag: '🇪🇸' },
  hi: { name: 'हिन्दी', dir: 'ltr', flag: '🇮🇳' },
  pt: { name: 'Português', dir: 'ltr', flag: '🇧🇷' },
  fr: { name: 'Français', dir: 'ltr', flag: '🇫🇷' },
  de: { name: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  id: { name: 'Bahasa Indonesia', dir: 'ltr', flag: '🇮🇩' },
  ar: { name: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  ru: { name: 'Русский', dir: 'ltr', flag: '🇷🇺' },
  ja: { name: '日本語', dir: 'ltr', flag: '🇯🇵' },
  tr: { name: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
  it: { name: 'Italiano', dir: 'ltr', flag: '🇮🇹' },
  ko: { name: '한국어', dir: 'ltr', flag: '🇰🇷' },
  vi: { name: 'Tiếng Việt', dir: 'ltr', flag: '🇻🇳' }
} as const;

export type SupportedLanguage = keyof typeof languages;
export const defaultLang: SupportedLanguage = 'en';

import en from './translations/en.json';
import es from './translations/es.json';
import hi from './translations/hi.json';
import pt from './translations/pt.json';
import fr from './translations/fr.json';
import de from './translations/de.json';
import id from './translations/id.json';
import ar from './translations/ar.json';
import ru from './translations/ru.json';
import ja from './translations/ja.json';
import tr from './translations/tr.json';
import it from './translations/it.json';
import ko from './translations/ko.json';
import vi from './translations/vi.json';

export const translations: Record<SupportedLanguage, typeof en> = {
  en, es, hi, pt, fr, de, id, ar, ru, ja, tr, it, ko, vi
};

export function useTranslations(lang: SupportedLanguage = 'en') {
  const current = translations[lang] || translations.en;
  return function t(key: keyof typeof en): string {
    return current[key] || translations.en[key] || (key as string);
  };
}
