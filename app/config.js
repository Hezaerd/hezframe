/* Wallpaper IDs and credits: assets/wallpapers/SOURCES.json.
   Bundled Unsplash photographs work offline; no API key is needed.
   Increase revision to apply changed defaults to existing installations. */
window.HezFrameConfig = {
  cinema: { enabled: true, idleSeconds: 60, dimAmount: 0.55 },
  crossfade: { enabled: true, durationMs: 900 },
  greeting: { enabled: true, name: '' },
  sounds: { enabled: true, volume: 0.2 }, // 0 (silent) to 1; app volume, independent of TV volume
  wallpapers: {
    revision: 1,
    collection: 'all',
    collections: [
      { id: 'forests', name: 'Forests', wallpapers: ['forest'] },
      {
        id: 'mountains',
        name: 'Mountains',
        wallpapers: ['peaks', 'ridge', 'summit', 'amber', 'alpine'],
      },
      { id: 'coasts', name: 'Coastlines', wallpapers: ['misty', 'cove', 'golden'] },
      { id: 'night', name: 'Night skies', wallpapers: ['night'] },
    ],
    initial: 'forest',
    rotation: '5', // fixed, open, 5, 15 or 60
    playlist: [
      'misty',
      'cove',
      'forest',
      'peaks',
      'ridge',
      'golden',
      'summit',
      'amber',
      'alpine',
      'night',
    ],
  },
};
