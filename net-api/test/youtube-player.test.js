const test = require('node:test');
const assert = require('node:assert/strict');

const { youtubeEmbedUrl, youtubeVideoId } = require('../public/js/youtube-player');

test('convierte variantes de YouTube al reproductor interno', () => {
  const variants = [
    'https://youtu.be/jbeRIvRRxdE?si=demo',
    'https://www.youtube.com/watch?v=jbeRIvRRxdE',
    'https://www.youtube.com/embed/jbeRIvRRxdE',
    'https://youtube.com/shorts/jbeRIvRRxdE',
    'https://youtube.com/live/jbeRIvRRxdE',
  ];
  for (const url of variants) {
    assert.equal(youtubeVideoId(url), 'jbeRIvRRxdE');
    assert.equal(youtubeEmbedUrl(url), 'https://www.youtube-nocookie.com/embed/jbeRIvRRxdE?autoplay=1&rel=0&modestbranding=1');
  }
});

test('rechaza URLs que no pueden reproducirse como video de YouTube', () => {
  for (const url of ['', 'javascript:alert(1)', 'https://example.com/watch?v=jbeRIvRRxdE', 'https://youtube.com/watch']) {
    assert.equal(youtubeVideoId(url), null);
    assert.equal(youtubeEmbedUrl(url), null);
  }
});
