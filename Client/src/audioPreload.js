const audioElementCache = new Map();

export function preloadAudioElement(src) {
  if (typeof Audio === "undefined") return null;
  if (audioElementCache.has(src)) return audioElementCache.get(src);

  const audio = new Audio(src);
  audio.preload = "auto";
  audio.playsInline = true;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.load();
  audioElementCache.set(src, audio);
  return audio;
}

export function preloadAudioFiles(sources) {
  return Promise.all(sources.map((src) => new Promise((resolve) => {
    const audio = preloadAudioElement(src);
    if (!audio) {
      resolve();
      return;
    }

    if (audio.readyState >= 3) {
      resolve();
      return;
    }

    const finish = () => resolve();
    audio.addEventListener("canplay", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
  })));
}
