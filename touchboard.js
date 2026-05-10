const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DEGREE_LABELS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "#5", "6", "b7", "7"];
const DEGREE_COLORS = [
  { bg: "#ef4444", ink: "#ffffff" },
  { bg: "#f97373", ink: "#2b0b0b" },
  { bg: "#f97316", ink: "#ffffff" },
  { bg: "#f59e0b", ink: "#2c1600" },
  { bg: "#facc15", ink: "#241a00" },
  { bg: "#22c55e", ink: "#04170b" },
  { bg: "#1fbf95", ink: "#031612" },
  { bg: "#06b6d4", ink: "#031316" },
  { bg: "#3b82f6", ink: "#ffffff" },
  { bg: "#2563eb", ink: "#ffffff" },
  { bg: "#7c3aed", ink: "#ffffff" },
  { bg: "#a855f7", ink: "#ffffff" },
];
const SCALES = {
  "Major (Ionian)": [0, 2, 4, 5, 7, 9, 11],
  "Natural Minor (Aeolian)": [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  "Major Pentatonic": [0, 2, 4, 7, 9],
  "Minor Pentatonic": [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
};

const CHORD_PATTERNS = [
  { name: "maj13", intervals: [0, 4, 7, 11, 14, 21] },
  { name: "13", intervals: [0, 4, 7, 10, 14, 21] },
  { name: "maj9", intervals: [0, 4, 7, 11, 14] },
  { name: "m9", intervals: [0, 3, 7, 10, 14] },
  { name: "9", intervals: [0, 4, 7, 10, 14] },
  { name: "maj7", intervals: [0, 4, 7, 11] },
  { name: "m7", intervals: [0, 3, 7, 10] },
  { name: "7", intervals: [0, 4, 7, 10] },
  { name: "mMaj7", intervals: [0, 3, 7, 11] },
  { name: "m7b5", intervals: [0, 3, 6, 10] },
  { name: "dim7", intervals: [0, 3, 6, 9] },
  { name: "add9", intervals: [0, 2, 4, 7] },
  { name: "6", intervals: [0, 4, 7, 9] },
  { name: "m6", intervals: [0, 3, 7, 9] },
  { name: "sus4", intervals: [0, 5, 7] },
  { name: "sus2", intervals: [0, 2, 7] },
  { name: "aug", intervals: [0, 4, 8] },
  { name: "dim", intervals: [0, 3, 6] },
  { name: "m", intervals: [0, 3, 7] },
  { name: "", intervals: [0, 4, 7] },
  { name: "5", intervals: [0, 7] },
];

const ROMAN_MAJOR = {
  0: "I",
  2: "II",
  4: "III",
  5: "IV",
  7: "V",
  9: "VI",
  11: "VII",
};

const STRINGS = [
  { name: "E", midi: 64, width: 1 },
  { name: "B", midi: 59, width: 1 },
  { name: "G", midi: 55, width: 2 },
  { name: "D", midi: 50, width: 2.4 },
  { name: "A", midi: 45, width: 3 },
  { name: "E", midi: 40, width: 3.4 },
];

const els = {
  board: document.querySelector("#touchBoard"),
  fretNumbers: document.querySelector("#fretNumbers"),
  keySelect: document.querySelector("#keySelect"),
  scaleSelect: document.querySelector("#scaleSelect"),
  labelSelect: document.querySelector("#labelSelect"),
  colorSelect: document.querySelector("#colorSelect"),
  toneSelect: document.querySelector("#toneSelect"),
  fretSelect: document.querySelector("#fretSelect"),
  reverbSelect: document.querySelector("#reverbSelect"),
  driveSelect: document.querySelector("#driveSelect"),
  holdButton: document.querySelector("#holdButton"),
  bendButton: document.querySelector("#bendButton"),
  panicButton: document.querySelector("#panicButton"),
  activeNotes: document.querySelector("#activeNotes"),
  chordName: document.querySelector("#chordName"),
  voiceCount: document.querySelector("#voiceCount"),
};

const state = {
  key: 0,
  labels: "notes",
  colorMode: "plain",
  scale: "Major (Ionian)",
  tone: "clean",
  fretCount: 12,
  bendSemitonesPerFret: 2,
  reverb: 0,
  drive: 0,
  holdMode: false,
  bendEnabled: true,
  audio: null,
  audioUnlocked: false,
  effects: null,
  voices: new Map(),
};

function pc(midi) {
  return ((midi % 12) + 12) % 12;
}

function degreeIndex(notePc) {
  return (notePc - state.key + 12) % 12;
}

function labelFor(midi) {
  const notePc = pc(midi);
  return state.labels === "degrees" ? DEGREE_LABELS[degreeIndex(notePc)] : NOTE_NAMES[notePc];
}

function colorFor(midi) {
  return DEGREE_COLORS[degreeIndex(pc(midi))];
}

function isKeyTone(midi) {
  return new Set(SCALES[state.scale]).has(degreeIndex(pc(midi)));
}

function normalizedIntervalsFrom(rootPc, pitchClasses) {
  return [...new Set(pitchClasses.map((notePc) => (notePc - rootPc + 12) % 12))].sort((a, b) => a - b);
}

function intervalSet(intervals) {
  return new Set(intervals.map((interval) => interval % 12));
}

function chordMatchScore(candidate, held) {
  const chord = intervalSet(candidate.intervals);
  const heldSet = intervalSet(held);
  const allHeldInChord = [...heldSet].every((interval) => chord.has(interval));
  const rootPresent = heldSet.has(0);
  const essential = candidate.intervals.length <= 2 ? [0, 7] : [0, candidate.intervals.includes(3) ? 3 : 4, 7].filter((interval) => chord.has(interval));
  const essentialsPresent = essential.filter((interval) => heldSet.has(interval)).length;
  if (!allHeldInChord || !rootPresent || essentialsPresent < Math.min(essential.length, heldSet.size)) return -1;
  return essentialsPresent * 10 + heldSet.size - candidate.intervals.length * 0.1;
}

function romanFor(rootPc, quality) {
  const degree = degreeIndex(rootPc);
  const roman = ROMAN_MAJOR[degree] ?? DEGREE_LABELS[degree];
  if (!roman) return "";
  return quality.includes("m") && !quality.includes("Maj") ? roman.toLowerCase() : roman;
}

function detectChord() {
  const pitchClasses = [...new Set([...state.voices.values()].map((voice) => pc(voice.midi)))];
  if (pitchClasses.length === 0) return "-";
  if (pitchClasses.length === 1) return `${NOTE_NAMES[pitchClasses[0]]} single`;

  let best = null;
  pitchClasses.forEach((rootPc) => {
    const held = normalizedIntervalsFrom(rootPc, pitchClasses);
    CHORD_PATTERNS.forEach((candidate) => {
      const score = chordMatchScore(candidate, held);
      if (score < 0) return;
      if (!best || score > best.score) {
        best = { rootPc, candidate, score };
      }
    });
  });

  if (!best) return pitchClasses.map((notePc) => NOTE_NAMES[notePc]).join(" ");
  const chordName = `${NOTE_NAMES[best.rootPc]}${best.candidate.name}`;
  return `${chordName} (${romanFor(best.rootPc, best.candidate.name)})`;
}

function frequencyFor(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function audioContext() {
  if (!state.audio) {
    const Engine = window.AudioContext || window.webkitAudioContext;
    state.audio = new Engine();
  }
  return state.audio;
}

function unlockAudio() {
  const ctx = audioContext();
  if (ctx.state !== "running") {
    void ctx.resume();
  }
  ensureEffects(ctx);
  return ctx;
}

function primeAudio() {
  const ctx = unlockAudio();
  if (state.audioUnlocked) return ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.03);
  osc.frequency.setValueAtTime(440, now);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
  state.audioUnlocked = true;
  return ctx;
}

function makeImpulse(ctx, seconds = 1.5, decay = 2.4) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return impulse;
}

function makeDriveCurve(amount) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const k = Number(amount);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = k === 0 ? x : ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function ensureEffects(ctx) {
  if (state.effects?.ctx === ctx) {
    updateEffects();
    return state.effects;
  }

  const input = ctx.createGain();
  const drive = ctx.createWaveShaper();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();

  drive.oversample = "4x";
  convolver.buffer = makeImpulse(ctx);
  input.connect(drive);
  drive.connect(dry).connect(ctx.destination);
  drive.connect(wet).connect(convolver).connect(ctx.destination);

  state.effects = { ctx, input, drive, dry, wet };
  updateEffects();
  return state.effects;
}

function updateEffects() {
  if (!state.effects) return;
  state.effects.drive.curve = makeDriveCurve(state.drive);
  state.effects.dry.gain.value = Math.max(0.35, 1 - state.reverb * 0.35);
  state.effects.wet.gain.value = state.reverb;
}

function envelopeStart(gain, now) {
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.12);
}

function envelopeStop(voice) {
  const ctx = audioContext();
  const now = ctx.currentTime;
  voice.output.gain.cancelScheduledValues(now);
  voice.output.gain.setValueAtTime(Math.max(voice.output.gain.value, 0.0001), now);
  voice.output.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  voice.oscillators.forEach(({ osc }) => osc.stop(now + 0.18));
}

function toneSettings() {
  if (state.tone === "warm") return { type: "triangle", filter: 1900, mix: [0.85, 0.12, 0.05] };
  if (state.tone === "lead") return { type: "sawtooth", filter: 3200, mix: [0.55, 0.18, 0.08] };
  return { type: "triangle", filter: 2600, mix: [0.9, 0.16, 0.05] };
}

function voiceKeyForPad(pad) {
  return `hold:${pad.dataset.string}:${pad.dataset.fret}`;
}

function startVoice(pointerId, midi, pad, event, held = false) {
  stopVoice(pointerId);
  const ctx = primeAudio();
  const now = ctx.currentTime;
  const settings = toneSettings();
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const effects = ensureEffects(ctx);
  const oscillators = [];
  const baseFrequency = frequencyFor(midi);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(settings.filter, now);
  envelopeStart(output, now);
  filter.connect(output).connect(effects.input);

  [1, 2, 3.01].forEach((multiple, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = settings.type;
    osc.frequency.setValueAtTime(baseFrequency * multiple, now);
    gain.gain.setValueAtTime(settings.mix[index], now);
    osc.connect(gain).connect(filter);
    osc.start(now);
    oscillators.push({ osc, multiple });
  });

  pad.classList.add("active");
  state.voices.set(pointerId, {
    midi,
    pad,
    output,
    oscillators,
    baseFrequency,
    startX: event.clientX,
    bend: 0,
    held,
  });
  renderStatus();
}

function bendVoice(pointerId, event) {
  if (!state.bendEnabled) return;
  const voice = state.voices.get(pointerId);
  if (!voice) return;
  const ctx = audioContext();
  const width = Math.max(voice.pad.getBoundingClientRect().width, 1);
  const fretDistance = (event.clientX - voice.startX) / width;
  const bend = Math.max(-12, Math.min(12, fretDistance * state.bendSemitonesPerFret));
  const bendRatio = 2 ** (bend / 12);
  const now = ctx.currentTime;
  voice.bend = bend;
  voice.oscillators.forEach(({ osc, multiple }) => {
    osc.frequency.cancelScheduledValues(now);
    osc.frequency.setTargetAtTime(voice.baseFrequency * multiple * bendRatio, now, 0.015);
  });
  voice.pad.style.setProperty("--bend-x", `${Math.max(-12, Math.min(12, fretDistance * 8))}px`);
  renderStatus();
}

function stopVoice(pointerId) {
  const voice = state.voices.get(pointerId);
  if (!voice) return;
  voice.pad.classList.remove("active");
  voice.pad.style.removeProperty("--bend-x");
  envelopeStop(voice);
  state.voices.delete(pointerId);
  renderStatus();
}

function toggleHeldVoice(midi, pad, event) {
  const key = voiceKeyForPad(pad);
  if (state.voices.has(key)) {
    stopVoice(key);
    return;
  }
  startVoice(key, midi, pad, event, true);
}

function stopAllVoices() {
  [...state.voices.keys()].forEach((pointerId) => stopVoice(pointerId));
}

function resetAudio() {
  [...state.voices.values()].forEach((voice) => {
    voice.pad.classList.remove("active");
    voice.pad.style.removeProperty("--bend-x");
    voice.output.gain.cancelScheduledValues(0);
    voice.output.gain.value = 0.0001;
    voice.oscillators.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
    });
  });
  state.voices.clear();
  if (state.audio && state.audio.state !== "closed") {
    void state.audio.close();
  }
  state.audio = null;
  state.audioUnlocked = false;
  state.effects = null;
  renderStatus();
}

function renderStatus() {
  const notes = [...state.voices.values()].map((voice) => {
    const bend = Math.round(voice.bend * 10) / 10;
    return `${NOTE_NAMES[pc(voice.midi)]}${bend ? ` ${bend > 0 ? "+" : ""}${bend}` : ""}`;
  });
  els.activeNotes.textContent = notes.length ? notes.join("  ") : "-";
  els.chordName.textContent = detectChord();
  els.voiceCount.textContent = String(notes.length);
}

function renderControls() {
  NOTE_NAMES.forEach((name, index) => els.keySelect.add(new Option(name, String(index))));
  Object.keys(SCALES).forEach((scale) => els.scaleSelect.add(new Option(scale, scale)));
  els.keySelect.value = String(state.key);
  els.scaleSelect.value = state.scale;
}

function renderBoard() {
  stopAllVoices();
  els.board.innerHTML = "";
  els.fretNumbers.innerHTML = "";
  const columns = state.fretCount + 1;
  els.board.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  els.fretNumbers.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  els.board.style.setProperty("--columns", String(columns));
  els.fretNumbers.style.setProperty("--columns", String(columns));

  STRINGS.forEach((string, stringIndex) => {
    for (let fret = 0; fret <= state.fretCount; fret += 1) {
      const midi = string.midi + fret;
      const color = colorFor(midi);
      const keyTone = isKeyTone(midi);
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "touch-pad";
      pad.classList.toggle("open", fret === 0);
      pad.classList.toggle("key-colored", state.colorMode === "key" && keyTone);
      pad.classList.toggle("root", state.colorMode === "key" && keyTone && pc(midi) === state.key);
      pad.style.setProperty("--string-width", `${string.width}px`);
      pad.style.setProperty("--note", color.bg);
      pad.style.setProperty("--note-ink", color.ink);
      pad.dataset.midi = String(midi);
      pad.dataset.string = String(stringIndex);
      pad.dataset.fret = String(fret);

      const pill = document.createElement("span");
      pill.className = "note-pill";
      pill.textContent = labelFor(midi);
      pad.appendChild(pill);

      pad.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        primeAudio();
        pad.setPointerCapture(event.pointerId);
        if (state.holdMode) {
          toggleHeldVoice(midi, pad, event);
        } else {
          startVoice(event.pointerId, midi, pad, event);
        }
      });
      pad.addEventListener("pointermove", (event) => {
        event.preventDefault();
        bendVoice(event.pointerId, event);
      });
      pad.addEventListener("pointerup", (event) => {
        if (!state.holdMode) stopVoice(event.pointerId);
      });
      pad.addEventListener("pointercancel", (event) => {
        if (!state.holdMode) stopVoice(event.pointerId);
      });
      pad.addEventListener("lostpointercapture", (event) => {
        if (!state.holdMode) stopVoice(event.pointerId);
      });

      els.board.appendChild(pad);
    }
  });

  for (let fret = 0; fret <= state.fretCount; fret += 1) {
    const number = document.createElement("div");
    number.textContent = fret === 0 ? "Open" : String(fret);
    els.fretNumbers.appendChild(number);
  }
}

function bindEvents() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("selectstart", (event) => event.preventDefault());
  document.addEventListener("pointerdown", primeAudio, { capture: true });
  document.addEventListener("touchstart", () => primeAudio(), { capture: true, passive: true });
  els.keySelect.addEventListener("change", (event) => {
    state.key = Number(event.target.value);
    renderBoard();
    renderStatus();
  });
  els.scaleSelect.addEventListener("change", (event) => {
    state.scale = event.target.value;
    renderBoard();
  });
  els.labelSelect.addEventListener("change", (event) => {
    state.labels = event.target.value;
    renderBoard();
  });
  els.colorSelect.addEventListener("change", (event) => {
    state.colorMode = event.target.value;
    renderBoard();
  });
  els.toneSelect.addEventListener("change", (event) => {
    state.tone = event.target.value;
  });
  els.fretSelect.addEventListener("change", (event) => {
    state.fretCount = Number(event.target.value);
    renderBoard();
  });
  els.reverbSelect.addEventListener("change", (event) => {
    state.reverb = Number(event.target.value);
    updateEffects();
  });
  els.driveSelect.addEventListener("change", (event) => {
    state.drive = Number(event.target.value);
    updateEffects();
  });
  els.holdButton.addEventListener("click", () => {
    state.holdMode = !state.holdMode;
    els.holdButton.classList.toggle("active", state.holdMode);
    if (!state.holdMode) stopAllVoices();
  });
  els.bendButton.addEventListener("click", () => {
    state.bendEnabled = !state.bendEnabled;
    els.bendButton.classList.toggle("active", state.bendEnabled);
  });
  els.panicButton.addEventListener("click", resetAudio);
  window.addEventListener("blur", stopAllVoices);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAllVoices();
  });
}

renderControls();
bindEvents();
renderBoard();
