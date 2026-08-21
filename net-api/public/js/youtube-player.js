(function exposeYouTubeTools(globalObject) {
  function youtubeVideoId(value) {
    if (!value) return null;
    try {
      const url = new URL(String(value).trim());
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
      let candidate = null;

      if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0];
      if (['youtube.com', 'youtube-nocookie.com'].includes(host)) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (url.pathname === '/watch') candidate = url.searchParams.get('v');
        else if (['embed', 'shorts', 'live'].includes(parts[0])) candidate = parts[1];
      }

      return /^[A-Za-z0-9_-]{6,20}$/.test(candidate || '') ? candidate : null;
    } catch {
      return null;
    }
  }

  function youtubeEmbedUrl(value) {
    const id = youtubeVideoId(value);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1` : null;
  }

  const api = Object.freeze({ youtubeVideoId, youtubeEmbedUrl });
  if (globalObject) globalObject.CometYouTube = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : null));
