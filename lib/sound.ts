export const playSound = (type: 'scan-success' | 'error') => {
  const audio = new Audio(
    type === 'scan-success' 
      ? 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'
      : 'https://actions.google.com/sounds/v1/alarms/error_tone.ogg'
  );
  audio.play().catch(e => console.error("Sound playback failed", e));
};
