(function (root) {
  function createI18n(locale, translations) {
    if (!Object.hasOwn(translations, locale)) throw new Error(`Unsupported locale: ${locale}`);
    let activeLocale = locale;
    return {
      get locale() { return activeLocale; },
      t(key, values = {}) {
        const messages = translations[activeLocale];
        if (!Object.hasOwn(messages, key)) throw new Error(`Missing translation: ${key}`);
        return messages[key].replace(/\{(\w+)\}/g, (placeholder, name) => {
          if (!Object.hasOwn(values, name)) throw new Error(`Missing translation value: ${name}`);
          return String(values[name]);
        });
      },
      apply(document) {
        const selectors = [
          ['data-i18n', null],
          ['data-i18n-title', 'title'],
          ['data-i18n-aria-label', 'aria-label'],
          ['data-i18n-placeholder', 'placeholder']
        ];
        for (const [attribute, target] of selectors) {
          for (const element of document.querySelectorAll(`[${attribute}]`)) {
            const value = this.t(element.getAttribute(attribute));
            if (target) element.setAttribute(target, value);
            else element.textContent = value;
          }
        }
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    const translations = {
      nl: require('./translations/nl'),
      en: require('./translations/en'),
      fr: require('./translations/fr')
    };
    const i18n = createI18n('en', translations);
    i18n.create = (locale, resources = translations) => createI18n(locale, resources);
    module.exports = i18n;
  } else {
    let locale = 'en';
    try {
      const savedLocale = root.localStorage.getItem('garageboek-language');
      if (savedLocale) {
        if (Object.hasOwn(root.garageTranslations, savedLocale)) locale = savedLocale;
        else console.error(`Unsupported saved language: ${savedLocale}`);
      }
    } catch (error) {
      console.error('Could not read the saved language preference:', error);
    }
    root.garageI18n = createI18n(locale, root.garageTranslations);
    root.document.documentElement.lang = locale;
    root.garageI18n.apply(root.document);
  }
})(typeof window === 'undefined' ? globalThis : window);
