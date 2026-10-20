/** A decoded, local click. Audio failures never interrupt navigation. */
export function createUISounds(volume: number) {
  let context: AudioContext | null = null;
  let gain: GainNode | null = null;
  let buffer: AudioBuffer | null = null;
  let request: XMLHttpRequest | null = null;
  let failed = false;
  let generation = 0;
  let playback = 0;
  const voices = new Set<AudioBufferSourceNode>();

  function preload(): void {
    if (context || failed || volume === 0) return;
    try {
      const audio = new AudioContext();
      context = audio;
      gain = audio.createGain();
      gain.gain.value = volume;
      gain.connect(audio.destination);
      const token = generation;
      // Packaged Tizen widgets also read local file URLs, which fetch does not support.
      const xhr = new XMLHttpRequest();
      request = xhr;
      xhr.open('GET', 'assets/sounds/ui-click.mp3', true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = 8000;
      const fail = () => {
        if (token === generation) failed = true;
      };
      xhr.addEventListener('error', fail, { once: true });
      xhr.addEventListener('timeout', fail, { once: true });
      xhr.addEventListener(
        'load',
        () => {
          if (token !== generation) return;
          if (
            (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) ||
            !(xhr.response instanceof ArrayBuffer)
          ) {
            fail();
            return;
          }
          void audio
            .decodeAudioData(xhr.response)
            .then((decoded) => {
              if (token === generation) buffer = decoded;
            })
            .catch(fail);
        },
        { once: true },
      );
      xhr.send();
    } catch {
      failed = true;
    }
  }

  function silence(): void {
    playback++;
    for (const voice of voices) {
      try {
        voice.stop();
        voice.disconnect();
      } catch {
        // An unavailable audio device must not break visibility or preference updates.
      }
    }
    voices.clear();
  }

  function play(allowed: () => boolean): void {
    if (!allowed()) return;
    preload();
    const audio = context,
      output = gain,
      click = buffer,
      token = playback;
    if (!audio || !output || !click || failed) return;
    const start = () => {
      if (token !== playback || !allowed() || audio.state !== 'running') return;
      silence();
      const voice = audio.createBufferSource();
      voice.buffer = click;
      voice.connect(output);
      voice.addEventListener(
        'ended',
        () => {
          voices.delete(voice);
          voice.disconnect();
        },
        { once: true },
      );
      voice.start();
      voices.add(voice);
    };
    try {
      // Resume inside the actual gesture. Recheck visibility/preferences if it completes later.
      if (audio.state === 'suspended')
        void audio
          .resume()
          .then(start)
          .catch(() => {});
      else start();
    } catch {
      // Sound is optional; a rejected or unavailable audio device must leave the UI usable.
    }
  }

  function stop(): void {
    generation++;
    request?.abort();
    request = null;
    silence();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    context = null;
    gain = null;
    buffer = null;
    failed = false;
  }

  return { preload, play, silence, stop };
}
