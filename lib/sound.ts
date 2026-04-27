export const playSound = (type: 'scan-success' | 'error') => {
  // Using more reliable MP3 sources for cross-browser compatibility (especially iOS/Safari)
  const soundUrls = {
    'scan-success': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Professional beep
    'error': 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' // Clear error tone
  };

  const audio = new Audio(soundUrls[type]);
  audio.volume = 0.5; // Set volume to a comfortable 50%
  
  // Browsers require user interaction before playing audio
  audio.play().catch(e => {
    // We log but don't throw to avoid breaking the UI flow if sound is blocked by browser policy
    console.warn("Sound playback was prevented by the browser. Interaction required.", e);
  });
};
