const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const DIATONIC_TRIADS = [
  { roman: "I", quality: "major", intervals: [0, 4, 7], function: "T", functionName: "Tonic" },
  { roman: "ii", quality: "minor", intervals: [0, 3, 7], function: "SD", functionName: "Subdominant" },
  { roman: "iii", quality: "minor", intervals: [0, 3, 7], function: "T", functionName: "Tonic" },
  { roman: "IV", quality: "major", intervals: [0, 4, 7], function: "SD", functionName: "Subdominant" },
  { roman: "V", quality: "major", intervals: [0, 4, 7], function: "D", functionName: "Dominant" },
  { roman: "vi", quality: "minor", intervals: [0, 3, 7], function: "T", functionName: "Tonic" },
  { roman: "vii°", quality: "diminished", intervals: [0, 3, 6], function: "D", functionName: "Dominant" },
];
const DIATONIC_SEVENTHS = [
  { roman: "Imaj7", quality: "major", suffix: "maj7", intervals: [0, 4, 7, 11], function: "T", functionName: "Tonic" },
  { roman: "iim7", quality: "minor", suffix: "m7", intervals: [0, 3, 7, 10], function: "SD", functionName: "Subdominant" },
  { roman: "iiim7", quality: "minor", suffix: "m7", intervals: [0, 3, 7, 10], function: "T", functionName: "Tonic" },
  { roman: "IVmaj7", quality: "major", suffix: "maj7", intervals: [0, 4, 7, 11], function: "SD", functionName: "Subdominant" },
  { roman: "V7", quality: "dominant", suffix: "7", intervals: [0, 4, 7, 10], function: "D", functionName: "Dominant" },
  { roman: "vim7", quality: "minor", suffix: "m7", intervals: [0, 3, 7, 10], function: "T", functionName: "Tonic" },
  { roman: "viiø7", quality: "diminished", suffix: "m7b5", intervals: [0, 3, 6, 10], function: "D", functionName: "Dominant" },
];

const els = {
  keySelect: document.querySelector("#keySelect"),
  chordTypeSelect: document.querySelector("#chordTypeSelect"),
  octaveSelect: document.querySelector("#octaveSelect"),
  viewSelect: document.querySelector("#viewSelect"),
  instrumentSelect: document.querySelector("#instrumentSelect"),
  bpmInput: document.querySelector("#bpmInput"),
  fourBeatButton: document.querySelector("#fourBeatButton"),
  stopButton: document.querySelector("#stopButton"),
  currentChord: document.querySelector("#currentChord"),
  currentFunction: document.querySelector("#currentFunction"),
  chordPads: document.querySelector("#chordPads"),
  keyboard: document.querySelector("#keyboard"),
};

const state = {
  key: 0,
  chordType: "triad",
  octave: "mid",
  view: "function",
  instrument: "piano",
  bpm: 100,
  fourBeat: false,
  activeAutoChordId: null,
  activeAuto: null,
  pendingAuto: null,
  beatTimer: null,
  audio: null,
  activeStops: [],
  keyboardVoices: new Map(),
};

function pc(midi) {
  return ((midi % 12) + 12) % 12;
}

function audioContext() {
  if (!state.audio) {
    const Engine = window.AudioContext || window.webkitAudioContext;
    state.audio = new Engine();
  }
  if (state.audio.state === "suspended") void state.audio.resume();
  return state.audio;
}

function frequencyFor(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function chordDefs() {
  return state.chordType === "triad" ? DIATONIC_TRIADS : DIATONIC_SEVENTHS;
}

function diatonicMap() {
  const map = new Map();
  chordDefs().forEach((def, index) => {
    map.set((state.key + MAJOR_SCALE[index]) % 12, { ...def, degreeIndex: index });
  });
  return map;
}

function outsideDef() {
  const suffix = state.chordType === "triad" ? "" : "7";
  const intervals = state.chordType === "triad" ? [0, 4, 7] : [0, 4, 7, 10];
  return {
    roman: "out",
    quality: "outside",
    suffix,
    intervals,
    function: "-",
    functionName: "Outside",
    degreeIndex: -1,
  };
}

function chordName(rootPc, def) {
  const suffix = def.suffix ?? (def.quality === "minor" ? "m" : def.quality === "diminished" ? "dim" : "");
  return `${NOTE_NAMES[rootPc]}${suffix}`;
}

function chordId(rootPc, def) {
  return `${rootPc}:${def.roman}:${state.chordType}`;
}

function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    return permutations(rest).map((perm) => [item, ...perm]);
  });
}

function pitchNear(notePc, targetMidi) {
  const base = notePc + 12 * Math.round((targetMidi - notePc) / 12);
  const lower = base - 12;
  const upper = base + 12;
  return [lower, base, upper].reduce((best, candidate) => (Math.abs(candidate - targetMidi) < Math.abs(best - targetMidi) ? candidate : best), base);
}

function ascendingPitches(pitches) {
  return pitches.reduce((result, pitch) => {
    let next = pitch;
    while (result.length && next <= result[result.length - 1]) next += 12;
    result.push(next);
    return result;
  }, []);
}

function voicingTargets(count) {
  const targets = {
    low: [48, 52, 55, 59],
    mid: [60, 64, 67, 71],
    high: [72, 76, 79, 83],
  };
  return targets[state.octave].slice(0, count);
}

function smoothChordTones(rootPc, def) {
  const pitchClasses = [...new Set(def.intervals.map((interval) => (rootPc + interval) % 12))];
  const targets = voicingTargets(pitchClasses.length);
  let best = null;

  permutations(pitchClasses).forEach((order) => {
    const pitches = ascendingPitches(order.map((notePc, index) => pitchNear(notePc, targets[index])));
    const distance = pitches.reduce((sum, pitch, index) => sum + Math.abs(pitch - targets[index]), 0);
    const span = pitches[pitches.length - 1] - pitches[0];
    const score = distance + Math.max(0, span - 12) * 0.8;
    if (!best || score < best.score) best = { pitches, score };
  });

  return best?.pitches ?? [];
}

function chordMidis(rootPc, def) {
  const bassMidi = 36 + rootPc;
  const chordTones = smoothChordTones(rootPc, def);
  return [bassMidi, ...chordTones];
}

function oscType() {
  if (state.instrument === "organ") return "square";
  if (state.instrument === "strings") return "sawtooth";
  if (state.instrument === "guitar") return "triangle";
  return "sine";
}

function startSingleNote(pointerId, midi, key) {
  stopSingleNote(pointerId);
  const ctx = audioContext();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const osc = ctx.createOscillator();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(state.instrument === "strings" ? 1800 : 3200, now);
  startEnvelope(master, now, false);
  osc.type = oscType();
  osc.frequency.setValueAtTime(frequencyFor(midi), now);
  osc.connect(filter).connect(master).connect(ctx.destination);
  osc.start(now);
  key.classList.add("active");
  state.keyboardVoices.set(pointerId, { osc, master, key });
}

function stopSingleNote(pointerId) {
  const voice = state.keyboardVoices.get(pointerId);
  if (!voice) return;
  const ctx = audioContext();
  const now = ctx.currentTime;
  voice.master.gain.cancelScheduledValues(now);
  voice.master.gain.setTargetAtTime(0.0001, now, 0.04);
  try {
    voice.osc.stop(now + 0.16);
  } catch {
    // Already stopped.
  }
  voice.key.classList.remove("active");
  state.keyboardVoices.delete(pointerId);
}

function startEnvelope(gain, now, pulse) {
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  if (pulse) {
    const beatLength = 60 / state.bpm;
    const peak = state.instrument === "organ" ? 0.28 : state.instrument === "strings" ? 0.32 : 0.22;
    const attack = state.instrument === "strings" ? 0.08 : 0.012;
    const holdRatio = state.instrument === "strings" || state.instrument === "organ" ? 0.98 : 0.72;
    const hold = Math.max(0.2, beatLength * holdRatio);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.setValueAtTime(peak, now + Math.max(attack, hold * 0.45));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + hold);
    return;
  }
  const attack = state.instrument === "strings" ? 0.22 : 0.018;
  const sustain = state.instrument === "organ" ? 0.18 : 0.2;
  gain.gain.exponentialRampToValueAtTime(sustain, now + attack);
}

function startChord(rootPc, def, pad, { pulse = false } = {}) {
  const ctx = audioContext();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const midis = chordMidis(rootPc, def);
  const oscillators = [];
  const voiceCount = Math.max(1, midis.length - 1);

  filter.type = "lowpass";
  const filterFrequency = state.instrument === "strings" ? 2400 : state.instrument === "organ" ? 4600 : 3200;
  filter.frequency.setValueAtTime(filterFrequency, now);
  startEnvelope(master, now, pulse);
  filter.connect(master).connect(ctx.destination);

  midis.forEach((midi, index) => {
    const osc = ctx.createOscillator();
    const voiceGain = ctx.createGain();
    osc.type = oscType();
    osc.frequency.setValueAtTime(frequencyFor(midi), now);
    const level = state.instrument === "organ" ? 0.9 : state.instrument === "strings" ? 0.82 : 0.65;
    const gainLevel = index === 0 ? 0.24 : level / voiceCount;
    voiceGain.gain.setValueAtTime(gainLevel, now);
    osc.connect(voiceGain).connect(filter);
    osc.start(now);
    oscillators.push(osc);
  });

  pad.classList.add("playing");
  highlightKeys(midis);
  els.currentChord.textContent = chordName(rootPc, def);
  els.currentFunction.textContent = def.function === "-" ? "Outside" : `${def.function} - ${def.functionName}`;

  const stop = () => {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0.0001, t, 0.04);
    oscillators.forEach((osc) => {
      try {
        osc.stop(t + 0.16);
      } catch {
        // Already stopped.
      }
    });
    if (pulse) {
      document.querySelectorAll(".white-key.active, .black-key.active").forEach((key) => key.classList.remove("active"));
    }
    if (!state.fourBeat) pad.classList.remove("playing");
  };

  if (pulse) {
    const stopRatio = state.instrument === "strings" || state.instrument === "organ" ? 0.98 : 0.78;
    window.setTimeout(stop, Math.max(220, 60000 / state.bpm * stopRatio));
    return () => {};
  }

  state.activeStops.push(stop);
  return stop;
}

function stopAll({ clearAuto = true } = {}) {
  if (clearAuto) {
    window.clearInterval(state.beatTimer);
    state.beatTimer = null;
    state.activeAutoChordId = null;
    state.activeAuto = null;
    state.pendingAuto = null;
    document.querySelectorAll(".chord-pad.auto-playing").forEach((pad) => pad.classList.remove("auto-playing"));
  }
  state.activeStops.splice(0).forEach((stop) => stop());
  [...state.keyboardVoices.keys()].forEach((pointerId) => stopSingleNote(pointerId));
  document.querySelectorAll(".white-key.active, .black-key.active").forEach((key) => key.classList.remove("active"));
  document.querySelectorAll(".chord-pad.playing").forEach((pad) => pad.classList.remove("playing"));
}

function startFourBeat(rootPc, def, pad) {
  const id = chordId(rootPc, def);
  if (state.activeAutoChordId === id) {
    stopAll();
    return;
  }
  state.pendingAuto = { rootPc, def, pad, id };
  document.querySelectorAll(".chord-pad.auto-playing").forEach((button) => button.classList.remove("auto-playing", "playing"));
  pad.classList.add("auto-playing", "playing");

  const tick = () => {
    if (state.pendingAuto) {
      state.activeAuto = state.pendingAuto;
      state.activeAutoChordId = state.pendingAuto.id;
      state.pendingAuto = null;
    }
    if (!state.activeAuto) return;
    startChord(state.activeAuto.rootPc, state.activeAuto.def, state.activeAuto.pad, { pulse: true });
  };
  if (state.beatTimer) return;
  tick();
  state.beatTimer = window.setInterval(tick, 60000 / state.bpm);
}

function highlightKeys(midis) {
  const midiSet = new Set(midis);
  document.querySelectorAll(".white-key, .black-key").forEach((key) => {
    key.classList.toggle("active", midiSet.has(Number(key.dataset.midi)));
  });
}

function padClasses(def) {
  const classes = ["chord-pad"];
  if (def.quality !== "outside") classes.push("diatonic");
  if (state.view === "quality" && def.quality !== "outside") classes.push(`quality-${def.quality}`);
  if (state.view === "function" && def.quality !== "outside") {
    const fn = def.function === "T" ? "tonic" : def.function === "SD" ? "subdominant" : "dominant";
    classes.push(`function-${fn}`);
  }
  return classes.join(" ");
}

function renderPads() {
  const map = diatonicMap();
  els.chordPads.innerHTML = "";
  NOTE_NAMES.forEach((_, rootPc) => {
    const def = map.get(rootPc) ?? outsideDef();
    const pad = document.createElement("button");
    pad.type = "button";
    pad.className = padClasses(def);
    pad.innerHTML = `
      <span class="pad-chord">${chordName(rootPc, def)}</span>
      <span class="pad-function">${def.function === "-" ? "Outside" : `${def.roman} - ${def.functionName}`}</span>
    `;
    pad.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      pad.setPointerCapture(event.pointerId);
      if (state.fourBeat) {
        startFourBeat(rootPc, def, pad);
        return;
      }
      stopAll();
      startChord(rootPc, def, pad);
    });
    pad.addEventListener("pointerup", () => {
      if (!state.fourBeat) stopAll();
    });
    pad.addEventListener("pointercancel", () => {
      if (!state.fourBeat) stopAll();
    });
    pad.addEventListener("lostpointercapture", () => {
      if (!state.fourBeat) stopAll();
    });
    els.chordPads.appendChild(pad);
  });
}

function renderKeyboard() {
  els.keyboard.innerHTML = "";
  let whiteIndex = 0;
  for (let midi = 36; midi <= 95; midi += 1) {
    const notePc = pc(midi);
    const key = document.createElement("div");
    key.className = WHITE_PCS.has(notePc) ? "white-key" : "black-key";
    key.dataset.pc = String(notePc);
    key.dataset.midi = String(midi);
    if (WHITE_PCS.has(notePc)) {
      key.style.left = `${whiteIndex * 52}px`;
      whiteIndex += 1;
    } else {
      key.style.left = `${whiteIndex * 52 - 16}px`;
    }
    const label = document.createElement("span");
    label.className = "key-label";
    label.textContent = NOTE_NAMES[notePc];
    key.appendChild(label);
    key.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      key.setPointerCapture(event.pointerId);
      startSingleNote(event.pointerId, midi, key);
    });
    key.addEventListener("pointerup", (event) => stopSingleNote(event.pointerId));
    key.addEventListener("pointercancel", (event) => stopSingleNote(event.pointerId));
    key.addEventListener("lostpointercapture", (event) => stopSingleNote(event.pointerId));
    els.keyboard.appendChild(key);
  }
  els.keyboard.style.minWidth = `${whiteIndex * 52 + 48}px`;
}

function render() {
  stopAll();
  renderPads();
  renderKeyboard();
  els.currentChord.textContent = "-";
  els.currentFunction.textContent = "-";
}

function bindEvents() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("selectstart", (event) => event.preventDefault());
  NOTE_NAMES.forEach((note, index) => els.keySelect.add(new Option(note, String(index))));
  els.keySelect.value = String(state.key);
  els.bpmInput.value = String(state.bpm);

  els.keySelect.addEventListener("change", (event) => {
    state.key = Number(event.target.value);
    render();
  });
  els.chordTypeSelect.addEventListener("change", (event) => {
    state.chordType = event.target.value;
    render();
  });
  els.octaveSelect.addEventListener("change", (event) => {
    state.octave = event.target.value;
    render();
  });
  els.viewSelect.addEventListener("change", (event) => {
    state.view = event.target.value;
    renderPads();
  });
  els.instrumentSelect.addEventListener("change", (event) => {
    state.instrument = event.target.value;
  });
  els.bpmInput.addEventListener("change", (event) => {
    state.bpm = Math.max(40, Math.min(240, Number(event.target.value) || 100));
    event.target.value = String(state.bpm);
    if (state.activeAuto) {
      const { rootPc, def, pad } = state.activeAuto;
      stopAll({ clearAuto: false });
      window.clearInterval(state.beatTimer);
      state.beatTimer = null;
      state.activeAutoChordId = null;
      state.activeAuto = null;
      startFourBeat(rootPc, def, pad);
    }
  });
  els.fourBeatButton.addEventListener("click", () => {
    state.fourBeat = !state.fourBeat;
    els.fourBeatButton.classList.toggle("active", state.fourBeat);
    stopAll();
  });
  els.stopButton.addEventListener("click", () => stopAll());
}

bindEvents();
render();
