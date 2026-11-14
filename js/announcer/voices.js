// ElevenLabs voices for the announcer, chosen by Noah.
// These are public voice ids from the ElevenLabs voice library, not keys.
// Never put an ElevenLabs API key in this file or anywhere in the repository.
(function (root) {
  'use strict';

  var VOICES = {
    provider: 'elevenlabs',
    model: 'eleven_v4',   // supports audio tags such as [shouting] and [building excitement]
    football: {
      voice_id: 'DcLiO3XaUWTu3gyon6hW',
      name: 'Ninja - Hype Gaming Commentary',
      style: 'American, young, high energy play-by-play'
    },
    soccer: {
      voice_id: '9rR45HW0vcBmpCbkc4m9',
      name: 'Nathaniel - Live Football Commentator',
      style: 'British, calm build-up, big roar on goals'
    }
  };

  root.FF_ANNOUNCER_VOICES = VOICES;
  if (typeof module !== 'undefined' && module.exports) module.exports = VOICES;
})(typeof window !== 'undefined' ? window : globalThis);
