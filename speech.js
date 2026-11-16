export function normalizeSpeech(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, '').replace(/[-\s]+/g, ' ').trim();
}

export function speechMatch(expected, transcript) {
  return normalizeSpeech(expected) === normalizeSpeech(transcript);
}

export function recognitionConstructor(scope = globalThis) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

// Recognition checks what was understood. It is not a phoneme/accent assessment.
export function createSpeechPractice({ scope = globalThis, onChange }) {
  let recognizer = null;
  let token = 0;
  let timeout = null;
  let listening = false;
  function stop(silent = false) {
    token++;
    clearTimeout(timeout);
    if (recognizer) {
      recognizer.onresult = recognizer.onerror = recognizer.onend = null;
      try { recognizer.abort(); } catch { /* The browser may already have ended this session. */ }
    }
    recognizer = null;
    const wasListening = listening;
    listening = false;
    if (!silent && wasListening) onChange({ status: 'stopped' });
  }
  function start(expected) {
    stop(true);
    const Recognition = recognitionConstructor(scope);
    if (!Recognition) { onChange({ status: 'unsupported' }); return; }
    scope.speechSynthesis?.cancel();
    const current = ++token;
    try {
      const engine = new Recognition();
      recognizer = engine;
      engine.lang = 'en-US';
      engine.continuous = false;
      engine.interimResults = false;
      engine.maxAlternatives = 3;
      listening = true;
      const finish = result => {
        if (current !== token) return;
        stop(true);
        onChange(result);
      };
      engine.onresult = event => {
        const alternatives = Array.from(event.results[0] || []).map(result => result.transcript);
        const transcript = alternatives.find(text => speechMatch(expected, text)) || alternatives[0] || '';
        finish({ status: 'result', transcript, matched: speechMatch(expected, transcript) });
      };
      engine.onerror = event => finish({ status: 'error', error: event.error });
      engine.onend = () => finish({ status: 'error', error: 'no-speech' });
      engine.start();
      if (current !== token) return;
      onChange({ status: 'listening' });
      timeout = setTimeout(() => finish({ status: 'error', error: 'no-speech' }), 15000);
    } catch {
      stop(true);
      onChange({ status: 'error', error: 'not-allowed' });
    }
  }
  return { start, stop, isListening: () => listening };
}
