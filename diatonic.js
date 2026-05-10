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
  rhythmSelect: document.querySelector("#rhythmSelect"),
  autoButton: document.querySelector("#autoButton"),
  startButton: document.querySelector("#startButton"),
  undoMemoryButton: document.querySelector("#undoMemoryButton"),
  clearMemoryButton: document.querySelector("#clearMemoryButton"),
  stopButton: document.querySelector("#stopButton"),
  currentChord: document.querySelector("#currentChord"),
  currentFunction: document.querySelector("#currentFunction"),
  playMode: document.querySelector("#playMode"),
  memoryCount: document.querySelector("#memoryCount"),
  memoryList: document.querySelector("#memoryList"),
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
  mode: "manual",
  fourBeat: false,
  rhythm: "8",
  repeat: false,
  sequence: [],
  sequenceIndex: 0,
  activeMemoryIndex: -1,
  stepIndex: 0,
  activeAutoChordId: null,
  activeAuto: null,
  pendingAuto: null,
  autoStop: null,
  soundingAutoId: null,
  beatTimer: null,
  audio: null,
  lastChordTones: null,
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

function chordEntry(rootPc, def, pad) {
  return { rootPc, def, pad, id: chordId(rootPc, def) };
}

function recordSequence(entry) {
  state.sequence.push(entry);
  if (state.sequence.length > 8) state.sequence.shift();
  renderMemory();
}

function renderMemory() {
  els.memoryCount.textContent = `${state.sequence.length} / 8`;
  els.playMode.textContent = state.mode === "memory"
    ? "メモリー"
    : state.mode === "record"
      ? "記録"
      : "マニュアル";
  els.memoryList.innerHTML = "";
  if (!state.sequence.length) {
    const empty = document.createElement("span");
    empty.className = "memory-empty";
    empty.textContent = "自動伴奏または記録のみでコードを押すとここに記録されます";
    els.memoryList.appendChild(empty);
    syncTransportButton();
    return;
  }
  state.sequence.forEach((entry, index) => {
    const chip = document.createElement("span");
    chip.className = "memory-chip";
    chip.classList.toggle("active", state.repeat && state.activeMemoryIndex === index);
    chip.textContent = `${index + 1}. ${chordName(entry.rootPc, entry.def)}`;
    els.memoryList.appendChild(chip);
  });
  syncTransportButton();
}

function syncTransportButton() {
  els.autoButton.classList.toggle("active", state.mode !== "manual");
  const labels = { manual: "モード: マニュアル", memory: "モード: メモリー", record: "モード: 記録" };
  els.autoButton.textContent = labels[state.mode];
  els.startButton.classList.toggle("active", state.fourBeat || state.repeat);
}

function clearMemory() {
  state.sequence = [];
  state.sequenceIndex = 0;
  state.activeMemoryIndex = -1;
  state.repeat = false;
  state.fourBeat = false;
  if (state.mode === "memory") state.mode = "manual";
  stopAll();
  renderMemory();
}

function undoMemoryStep() {
  if (!state.sequence.length) return;
  state.sequence.pop();
  state.sequenceIndex = Math.min(state.sequenceIndex, state.sequence.length);
  state.activeMemoryIndex = -1;
  if (!state.sequence.length && state.repeat) {
    state.repeat = false;
    if (state.mode === "memory") state.mode = "manual";
    stopAll();
    return;
  }
  renderMemory();
}

function stepsPerBar() {
  if (state.rhythm === "8") return 8;
  if (state.rhythm === "4") return 4;
  return 1;
}

function stepDurationMs() {
  if (state.rhythm === "8") return 60000 / state.bpm / 2;
  if (state.rhythm === "4") return 60000 / state.bpm;
  return 60000 / state.bpm * 4;
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
  const previous = state.lastChordTones?.length === pitchClasses.length ? state.lastChordTones : null;
  const homeTargets = voicingTargets(pitchClasses.length);
  const targets = previous ?? homeTargets;
  let best = null;

  permutations(pitchClasses).forEach((order) => {
    const base = ascendingPitches(order.map((notePc, index) => pitchNear(notePc, targets[index])));
    [-12, 0, 12].forEach((shift) => {
      const pitches = base.map((pitch) => pitch + shift);
      const motion = previous ? pitches.reduce((sum, pitch, index) => sum + Math.abs(pitch - previous[index]), 0) : 0;
      const homeDistance = pitches.reduce((sum, pitch, index) => sum + Math.abs(pitch - homeTargets[index]), 0);
      const span = pitches[pitches.length - 1] - pitches[0];
      const score = motion * 1.4 + homeDistance * 1.1 + Math.max(0, span - 12) * 1.4;
      if (!best || score < best.score) best = { pitches, score };
    });
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
  if (state.instrument === "guitar") return "sawtooth";
  if (state.instrument === "lead") return "sawtooth";
  return "sine";
}

function filterSettings() {
  if (state.instrument === "guitar") return { type: "lowpass", frequency: 6200, q: 1.4 };
  if (state.instrument === "lead") return { type: "lowpass", frequency: 3600, q: 8 };
  if (state.instrument === "strings") return { type: "lowpass", frequency: 1500, q: 1.1 };
  if (state.instrument === "organ") return { type: "lowpass", frequency: 2100, q: 0.6 };
  return { type: "lowpass", frequency: 3200, q: 0.7 };
}

function voiceLevel(index, voiceCount) {
  if (index === 0 && state.instrument === "lead") return 0.42;
  if (index === 0) return state.instrument === "guitar" ? 0.2 : 0.2;
  const levels = {
    organ: 0.3,
    strings: 0.34,
    guitar: 0.78,
    lead: 0.72,
    piano: 0.65,
  };
  return (levels[state.instrument] ?? 0.6) / voiceCount;
}

function startSingleNote(pointerId, midi, key) {
  if (state.instrument === "lead") {
    [...state.keyboardVoices.keys()].forEach((id) => stopSingleNote(id));
  }
  stopSingleNote(pointerId);
  const ctx = audioContext();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const osc = ctx.createOscillator();

  const settings = filterSettings();
  filter.type = settings.type;
  filter.frequency.setValueAtTime(settings.frequency, now);
  filter.Q.setValueAtTime(settings.q, now);
  startEnvelope(master, now, false);
  osc.type = oscType();
  osc.frequency.setValueAtTime(frequencyFor(midi), now);
  osc.connect(filter).connect(master).connect(ctx.destination);
  osc.start(now);
  key.classList.add("active");
  state.keyboardVoices.set(pointerId, { osc, master, key, baseMidi: midi, startX: null });
}

function stopSingleNote(pointerId) {
  const voice = state.keyboardVoices.get(pointerId);
  if (!voice) return;
  const ctx = audioContext();
  const now = ctx.currentTime;
  voice.master.gain.cancelScheduledValues(now);
  const release = state.instrument === "piano" ? 0.12 : 0.06;
  voice.master.gain.setTargetAtTime(0.0001, now, release);
  try {
    voice.osc.stop(now + release * 4);
  } catch {
    // Already stopped.
  }
  voice.key.classList.remove("active");
  state.keyboardVoices.delete(pointerId);
}

function bendSingleNote(pointerId, clientX) {
  if (state.instrument !== "lead") return;
  const voice = state.keyboardVoices.get(pointerId);
  if (!voice) return;
  if (voice.startX === null) voice.startX = clientX;
  const semitones = ((clientX - voice.startX) / 52) * 2;
  const frequency = frequencyFor(voice.baseMidi) * 2 ** (semitones / 12);
  const ctx = audioContext();
  voice.osc.frequency.cancelScheduledValues(ctx.currentTime);
  voice.osc.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.018);
}

function startEnvelope(gain, now, pulse, accent = false, durationBeats = 1) {
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  if (state.instrument === "piano") {
    const peak = accent ? 0.26 : 0.2;
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.018);
    if (pulse) {
      const hold = Math.max(0.28, 60 / state.bpm * durationBeats * 0.95);
      gain.gain.setValueAtTime(peak, now + hold * 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + hold);
    }
    return;
  }
  if (state.instrument === "lead") {
    const peak = accent ? 0.28 : 0.23;
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.018);
    if (pulse) gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.22, 60 / state.bpm * durationBeats * 0.9));
    return;
  }
  if (pulse) {
    const beatLength = 60 / state.bpm;
    const basePeak = state.instrument === "guitar" ? 0.36 : state.instrument === "organ" ? 0.2 : state.instrument === "strings" ? 0.24 : 0.22;
    const peak = accent ? basePeak * 1.22 : basePeak;
    const attack = state.instrument === "strings" ? 0.14 : state.instrument === "organ" ? 0.02 : 0.008;
    const holdRatio = state.instrument === "strings" || state.instrument === "organ" ? 0.98 : 0.72;
    const hold = Math.max(0.12, beatLength * durationBeats * holdRatio);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.setValueAtTime(peak, now + Math.max(attack, hold * 0.45));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + hold);
    return;
  }
  const attack = state.instrument === "strings" ? 0.32 : state.instrument === "organ" ? 0.03 : 0.014;
  const sustain = state.instrument === "guitar" ? 0.18 : state.instrument === "organ" ? 0.11 : state.instrument === "strings" ? 0.13 : 0.2;
  gain.gain.exponentialRampToValueAtTime(sustain, now + attack);
}

function startChord(rootPc, def, pad, { pulse = false, accent = false, sustain = false, durationBeats = 1 } = {}) {
  const ctx = audioContext();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const midis = chordMidis(rootPc, def);
  const playableMidis = state.instrument === "lead" ? [midis[midis.length - 1]] : midis;
  const oscillators = [];
  const voiceCount = Math.max(1, playableMidis.length - 1);
  state.lastChordTones = midis.slice(1);

  const settings = filterSettings();
  filter.type = settings.type;
  filter.frequency.setValueAtTime(settings.frequency, now);
  filter.Q.setValueAtTime(settings.q, now);
  startEnvelope(master, now, pulse && !sustain, accent, durationBeats);
  filter.connect(master).connect(ctx.destination);

  playableMidis.forEach((midi, index) => {
    const osc = ctx.createOscillator();
    const voiceGain = ctx.createGain();
    osc.type = oscType();
    osc.frequency.setValueAtTime(frequencyFor(midi), now);
    voiceGain.gain.setValueAtTime(voiceLevel(index, voiceCount), now);
    osc.connect(voiceGain).connect(filter);
    osc.start(now);
    oscillators.push(osc);
  });

  pad.classList.add("playing");
  highlightKeys(playableMidis);
  els.currentChord.textContent = chordName(rootPc, def);
  els.currentFunction.textContent = def.function === "-" ? "Outside" : `${def.function} - ${def.functionName}`;

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    const release = state.instrument === "piano" ? 0.12 : 0.06;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0.0001, t, release);
    oscillators.forEach((osc) => {
      try {
        osc.stop(t + release * 4);
      } catch {
        // Already stopped.
      }
    });
    if (pulse) {
      document.querySelectorAll(".white-key.active, .black-key.active").forEach((key) => key.classList.remove("active"));
    }
    if (!state.fourBeat) pad.classList.remove("playing");
  };

  if (pulse && !sustain) {
    if (state.instrument === "piano") {
      const hold = Math.max(120, 60000 / state.bpm * durationBeats * 1.2);
      window.setTimeout(() => {
        document.querySelectorAll(".white-key.active, .black-key.active").forEach((key) => key.classList.remove("active"));
        if (!state.fourBeat) pad.classList.remove("playing");
      }, hold);
      return () => {};
    }
    const stopRatio = state.instrument === "strings" || state.instrument === "organ" ? 0.98 : 0.78;
    window.setTimeout(stop, Math.max(120, 60000 / state.bpm * durationBeats * stopRatio));
    return () => {};
  }

  if (!pulse) state.activeStops.push(stop);
  return stop;
}

function stopAll({ clearAuto = true } = {}) {
  if (state.autoStop) state.autoStop();
  state.autoStop = null;
  state.soundingAutoId = null;
  if (clearAuto) {
    window.clearInterval(state.beatTimer);
    state.beatTimer = null;
    state.activeAutoChordId = null;
    state.activeAuto = null;
    state.pendingAuto = null;
    state.sequenceIndex = 0;
    state.activeMemoryIndex = -1;
    state.stepIndex = 0;
    state.lastChordTones = null;
    document.querySelectorAll(".chord-pad.auto-playing").forEach((pad) => pad.classList.remove("auto-playing"));
  }
  state.activeStops.splice(0).forEach((stop) => stop());
  [...state.keyboardVoices.keys()].forEach((pointerId) => stopSingleNote(pointerId));
  document.querySelectorAll(".white-key.active, .black-key.active").forEach((key) => key.classList.remove("active"));
  document.querySelectorAll(".chord-pad.playing").forEach((pad) => pad.classList.remove("playing"));
  renderMemory();
}

function stopTransport() {
  state.fourBeat = false;
  state.repeat = false;
  els.autoButton.classList.remove("active");
  stopAll();
}

function cycleMode() {
  const order = ["manual", "memory", "record"];
  state.mode = order[(order.indexOf(state.mode) + 1) % order.length];
  state.fourBeat = false;
  state.repeat = false;
  stopAll();
  renderMemory();
}

function startTransport() {
  state.sequenceIndex = 0;
  state.activeMemoryIndex = -1;

  if (state.mode === "memory") {
    if (!state.sequence.length) {
      state.mode = "record";
      state.fourBeat = true;
      renderMemory();
      return;
    }
    state.repeat = true;
    state.fourBeat = true;
    const entry = state.sequence[0];
    stopAll();
    startFourBeat(entry.rootPc, entry.def, entry.pad, { record: false });
    return;
  }

  state.repeat = false;
  state.fourBeat = true;
  renderMemory();
}

function setAutoEntry(entry, memoryIndex = -1) {
  state.activeMemoryIndex = memoryIndex;
  state.activeAuto = entry;
  state.activeAutoChordId = entry.id;
  document.querySelectorAll(".chord-pad.auto-playing").forEach((button) => button.classList.remove("auto-playing", "playing"));
  entry.pad.classList.add("auto-playing", "playing");
  renderMemory();
}

function playAutoStep() {
  if (!state.activeAuto) return;

  if (state.rhythm === "4" || state.rhythm === "8") {
    state.soundingAutoId = null;
    startChord(state.activeAuto.rootPc, state.activeAuto.def, state.activeAuto.pad, {
      pulse: true,
      durationBeats: state.rhythm === "8" ? 0.5 : 1,
    });
    return;
  }

  if (state.rhythm === "drone" && state.autoStop && state.soundingAutoId === state.activeAuto.id) return;

  if (state.autoStop) state.autoStop();
  state.autoStop = startChord(state.activeAuto.rootPc, state.activeAuto.def, state.activeAuto.pad, { pulse: true, sustain: true });
  state.soundingAutoId = state.activeAuto.id;
}

function startFourBeat(rootPc, def, pad, { record = true } = {}) {
  const entry = chordEntry(rootPc, def, pad);
  if (record && state.mode === "record" && !state.repeat) recordSequence(entry);

  if (state.mode === "record") {
    startChord(rootPc, def, pad, { pulse: true, durationBeats: 0.75 });
    els.currentChord.textContent = chordName(rootPc, def);
    els.currentFunction.textContent = def.function === "-" ? "Outside" : `${def.function} - ${def.functionName}`;
    document.querySelectorAll(".chord-pad.auto-playing").forEach((button) => button.classList.remove("auto-playing", "playing"));
    pad.classList.add("auto-playing");
    renderMemory();
    return;
  }

  state.pendingAuto = entry;
  pad.classList.add("auto-playing");

  if (state.rhythm === "drone" && state.mode === "manual" && !state.repeat) {
    setAutoEntry(entry);
    playAutoStep();
    return;
  }

  const tick = () => {
    const barSteps = stepsPerBar();
    const isBarStart = state.stepIndex % barSteps === 0;

    if (state.repeat && state.sequence.length && isBarStart) {
      const memoryIndex = state.sequenceIndex % state.sequence.length;
      if (memoryIndex === 0) state.lastChordTones = null;
      setAutoEntry(state.sequence[memoryIndex], memoryIndex);
      state.sequenceIndex += 1;
    } else if (state.pendingAuto && isBarStart) {
      setAutoEntry(state.pendingAuto);
      state.pendingAuto = null;
    }

    playAutoStep();
    state.stepIndex = (state.stepIndex + 1) % barSteps;
  };
  if (state.beatTimer) return;
  tick();
  state.beatTimer = window.setInterval(tick, stepDurationMs());
}

function restartAutoPlayback() {
  if (!state.activeAuto) return;
  const entry = state.activeAuto;
  stopAll({ clearAuto: false });
  window.clearInterval(state.beatTimer);
  state.beatTimer = null;
  state.activeAutoChordId = null;
  state.activeAuto = null;
  state.pendingAuto = entry;
  state.stepIndex = 0;
  startFourBeat(entry.rootPc, entry.def, entry.pad, { record: false });
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
      if (state.mode === "record") {
        startFourBeat(rootPc, def, pad);
        return;
      }
      if (state.mode === "manual" && state.fourBeat) {
        startFourBeat(rootPc, def, pad);
        return;
      }
      if (state.mode === "memory") return;
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
      bendSingleNote(event.pointerId, event.clientX);
    });
    key.addEventListener("pointermove", (event) => bendSingleNote(event.pointerId, event.clientX));
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
  renderMemory();
}

function bindEvents() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("selectstart", (event) => event.preventDefault());
  NOTE_NAMES.forEach((note, index) => els.keySelect.add(new Option(note, String(index))));
  els.keySelect.value = String(state.key);
  els.bpmInput.value = String(state.bpm);
  els.rhythmSelect.value = state.rhythm;

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
    state.lastChordTones = null;
  });
  els.viewSelect.addEventListener("change", (event) => {
    state.view = event.target.value;
    renderPads();
  });
  els.instrumentSelect.addEventListener("change", (event) => {
    state.instrument = event.target.value;
    if (state.autoStop && state.activeAuto) {
      state.soundingAutoId = null;
      playAutoStep();
    }
  });
  els.bpmInput.addEventListener("change", (event) => {
    state.bpm = Math.max(40, Math.min(240, Number(event.target.value) || 100));
    event.target.value = String(state.bpm);
    restartAutoPlayback();
  });
  els.rhythmSelect.addEventListener("change", (event) => {
    state.rhythm = event.target.value;
    restartAutoPlayback();
    renderMemory();
  });
  els.autoButton.addEventListener("click", cycleMode);
  els.startButton.addEventListener("click", startTransport);
  els.undoMemoryButton.addEventListener("click", undoMemoryStep);
  els.clearMemoryButton.addEventListener("click", clearMemory);
  els.stopButton.addEventListener("click", stopTransport);
}

bindEvents();
render();
