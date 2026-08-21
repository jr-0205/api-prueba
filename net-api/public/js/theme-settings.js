(() => {
  const cssVariables = {
    auth_background_url: '--auth-background-image',
    landing_background_url: '--landing-background-image',
    admin_hero_background_url: '--admin-hero-background-image',
  };

  function cssUrl(value) {
    return `url(${JSON.stringify(String(value || ''))})`;
  }

  function applyCometSettings(settings = {}) {
    window.cometSettings = { ...(window.cometSettings || {}), ...settings };
    for (const [key, variable] of Object.entries(cssVariables)) {
      if (window.cometSettings[key]) document.documentElement.style.setProperty(variable, cssUrl(window.cometSettings[key]));
    }
    document.dispatchEvent(new CustomEvent('comet:settings', { detail:window.cometSettings }));
    return window.cometSettings;
  }

  window.applyCometSettings = applyCometSettings;
  window.getCometSetting = (key, fallback = '') => window.cometSettings?.[key] || fallback;
  window.cometSettingsReady = fetch('/api/settings')
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('No fue posible cargar la apariencia.')))
    .then(applyCometSettings)
    .catch(() => applyCometSettings({}));
})();
