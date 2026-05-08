const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const STRINGS = [
  { name: "E", midi: 64 },
  { name: "B", midi: 59 },
  { name: "G", midi: 55 },
  { name: "D", midi: 50 },
  { name: "A", midi: 45 },
  { name: "E", midi: 40 },
];
const SCALES = {
  "Major": [0, 2, 4, 5, 7, 9, 11],
  "Natural Minor": [0, 2, 3, 5, 7, 8, 10],
  "Major Pentatonic": [0, 2, 4, 7, 9],
  "Minor Pentatonic": [0, 3, 5, 7, 10],
  "Blues": [0, 3, 5, 6, 7, 10],
  "Dorian": [0, 2, 3, 5, 7, 9, 10],
  "Mixolydian": [0, 2, 4, 5, 7, 9, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
};

const CHORDS = {
  "Major": [0, 4, 7],
  "Minor": [0, 3, 7],
  "7": [0, 4, 7, 10],
  "maj7": [0, 4, 7, 11],
  "m7": [0, 3, 7, 10],
  "sus4": [0, 5, 7],
  "dim": [0, 3, 6],
  "aug": [0, 4, 8],
  "add9": [0, 2, 4, 7],
  "6": [0, 4, 7, 9],
  "m6": [0, 3, 7, 9],
};

const DEGREE_LABELS = {
  0: "1",
  1: "b2",
  2: "2",
  3: "b3",
  4: "3",
  5: "4",
  6: "b5",
  7: "5",
  8: "#5",
  9: "6",
  10: "b7",
  11: "7",
};

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

const state = {
  key: 0,
  mode: "scale",
  scale: "Major",
  chord: "Major",
  display: "notes",
  octaveRange: 2,
  startString: "auto",
  startOctave: "auto",
  startTone: "0",
  stopTone: "top",
  positionMode: "box5",
  fretCount: 12,
  activeBox: null,
  marked: new Map(),
  audioContext: null,
  playbackTimers: [],
  repeatTimer: null,
};

const els = {
  keySelect: document.querySelector("#keySelect"),
  modeSelect: document.querySelector("#modeSelect"),
  scaleSelect: document.querySelector("#scaleSelect"),
  chordSelect: document.querySelector("#chordSelect"),
  scaleControl: document.querySelector("#scaleControl"),
  chordControl: document.querySelector("#chordControl"),
  tempoInput: document.querySelector("#tempoInput"),
  noteValueSelect: document.querySelector("#noteValueSelect"),
  octaveSelect: document.querySelector("#octaveSelect"),
  startStringSelect: document.querySelector("#startStringSelect"),
  startOctaveSelect: document.querySelector("#startOctaveSelect"),
  startToneSelect: document.querySelector("#startToneSelect"),
  stopToneSelect: document.querySelector("#stopToneSelect"),
  positionModeSelect: document.querySelector("#positionModeSelect"),
  fretCountSelect: document.querySelector("#fretCountSelect"),
  displayNotes: document.querySelector("#displayNotes"),
  displayDegrees: document.querySelector("#displayDegrees"),
  repeatToggle: document.querySelector("#repeatToggle"),
  playUpDown: document.querySelector("#playUpDown"),
  playMarked: document.querySelector("#playMarked"),
  clearMarks: document.querySelector("#clearMarks"),
  fretboard: document.querySelector("#fretboard"),
  fretNumbers: document.querySelector("#fretNumbers"),
  selectedSummary: document.querySelector("#selectedSummary"),
  analysisResults: document.querySelector("#analysisResults"),
  chordResults: document.querySelector("#chordResults"),
  practiceStatus: document.querySelector("#practiceStatus"),
};

function noteName(pc) {
  return NOTES_SHARP[((pc % 12) + 12) % 12];
}

function midiToPc(midi) {
  return ((midi % 12) + 12) % 12;
}

function patternIntervals() {
  return state.mode === "scale" ? SCALES[state.scale] : CHORDS[state.chord];
}

function patternPitchClasses(root = state.key, intervals = patternIntervals()) {
  return new Set(intervals.map((interval) => (root + interval) % 12));
}

function degreeLabel(pc, root = state.key) {
  return DEGREE_LABELS[(pc - root + 12) % 12] ?? "";
}

function degreeIndex(pc, root = state.key) {
  return (pc - root + 12) % 12;
}

function initControls() {
  NOTES_SHARP.forEach((name, pc) => {
    els.keySelect.add(new Option(name, String(pc)));
  });
  Object.keys(SCALES).forEach((name) => els.scaleSelect.add(new Option(name, name)));
  Object.keys(CHORDS).forEach((name) => els.chordSelect.add(new Option(name, name)));

  els.keySelect.value = String(state.key);
  els.scaleSelect.value = state.scale;
  els.chordSelect.value = state.chord;
  updateToneControls();
}

function updateToneControls() {
  const intervals = patternIntervals();
  const currentStart = state.startTone;
  const currentStop = state.stopTone;

  els.startToneSelect.innerHTML = "";
  els.stopToneSelect.innerHTML = "";

  intervals.forEach((interval, index) => {
    const label = `${degreeLabel((state.key + interval) % 12)} ${noteName((state.key + interval) % 12)}`;
    els.startToneSelect.add(new Option(label, String(index)));
    els.stopToneSelect.add(new Option(label, String(index)));
  });
  els.stopToneSelect.add(new Option("上のルート", "top"));

  state.startTone = intervals[Number(currentStart)] === undefined ? "0" : currentStart;
  state.stopTone = currentStop === "top" || intervals[Number(currentStop)] !== undefined ? currentStop : "top";
  els.startToneSelect.value = state.startTone;
  els.stopToneSelect.value = state.stopTone;
}

function makePosition(stringIndex, fret) {
  const midi = STRINGS[stringIndex].midi + fret;
  const pc = midiToPc(midi);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `position string-${stringIndex}`;
  button.dataset.string = String(stringIndex);
  button.dataset.fret = String(fret);
  button.dataset.midi = String(midi);
  button.dataset.pc = String(pc);
  button.classList.toggle("open", fret === 0);
  button.title = `${STRINGS[stringIndex].name}弦 ${fret}フレット ${noteName(pc)}`;

  const dot = document.createElement("span");
  dot.className = "note-dot";
  button.appendChild(dot);

  button.addEventListener("click", () => toggleMark(button));
  return button;
}

function renderFretboard() {
  els.fretboard.innerHTML = "";
  els.fretNumbers.innerHTML = "";
  const columns = state.fretCount + 1;
  els.fretboard.style.setProperty("--fret-columns", String(columns));
  els.fretNumbers.style.setProperty("--fret-columns", String(columns));

  for (let stringIndex = 0; stringIndex < STRINGS.length; stringIndex += 1) {
    for (let fret = 0; fret <= state.fretCount; fret += 1) {
      els.fretboard.appendChild(makePosition(stringIndex, fret));
    }
  }

  for (let fret = 0; fret <= state.fretCount; fret += 1) {
    const number = document.createElement("div");
    number.textContent = fret === 0 ? "Open" : String(fret);
    els.fretNumbers.appendChild(number);
  }
}

function toggleMark(button) {
  const id = `${button.dataset.string}:${button.dataset.fret}`;
  if (state.marked.has(id)) {
    state.marked.delete(id);
  } else {
    state.marked.set(id, {
      string: Number(button.dataset.string),
      fret: Number(button.dataset.fret),
      midi: Number(button.dataset.midi),
      pc: Number(button.dataset.pc),
    });
  }
  updateView();
}

function updateModeControls() {
  const chordMode = state.mode === "chord";
  els.scaleControl.hidden = chordMode;
  els.chordControl.hidden = !chordMode;
}

function fixedBoxWidth() {
  if (state.positionMode === "box4") return 4;
  if (state.positionMode === "box5") return 5;
  return null;
}

function refreshPracticeBox() {
  if (!fixedBoxWidth()) {
    state.activeBox = null;
    return;
  }

  const rootPosition = practiceRootPosition(Number(state.octaveRange));
  state.activeBox = rootPosition ? boxForRoot(rootPosition) : null;
}

function updateFretboard() {
  const pitchClasses = patternPitchClasses();
  els.fretboard.classList.toggle("position-limited", Boolean(fixedBoxWidth()) && Boolean(state.activeBox));
  document.querySelectorAll(".position").forEach((position) => {
    const pc = Number(position.dataset.pc);
    const id = `${position.dataset.string}:${position.dataset.fret}`;
    const interval = degreeIndex(pc);
    const color = DEGREE_COLORS[interval];
    const inPattern = pitchClasses.has(pc);
    const isRoot = pc === state.key;
    const isMarked = state.marked.has(id);
    const fret = Number(position.dataset.fret);
    const inBox =
      Boolean(fixedBoxWidth()) &&
      state.activeBox &&
      fret >= state.activeBox.start &&
      fret <= state.activeBox.end;
    const label = state.display === "notes" ? noteName(pc) : degreeLabel(pc);

    position.style.setProperty("--note-color", color.bg);
    position.style.setProperty("--note-ink", color.ink);
    position.classList.toggle("in-pattern", inPattern);
    position.classList.toggle("in-box", Boolean(inBox));
    position.classList.toggle("root", isRoot && inPattern);
    position.classList.toggle("marked", isMarked);
    position.classList.toggle("accidental", (inPattern || isMarked) && [1, 3, 6, 8, 10].includes(interval));
    position.querySelector(".note-dot").textContent = inPattern || isMarked ? label : "";
  });
}

function clearPlaying() {
  state.playbackTimers.forEach((timer) => window.clearTimeout(timer));
  state.playbackTimers = [];
  if (state.repeatTimer) {
    window.clearTimeout(state.repeatTimer);
    state.repeatTimer = null;
  }
  document.querySelectorAll(".position.playing").forEach((position) => position.classList.remove("playing"));
}

function selectedPitchClasses() {
  return [...new Set([...state.marked.values()].map((mark) => mark.pc))].sort((a, b) => a - b);
}

function updateSelectedSummary() {
  const pcs = selectedPitchClasses();
  if (!pcs.length) {
    els.selectedSummary.className = "summary empty";
    els.selectedSummary.textContent = "まだマーキングがありません";
    return;
  }

  els.selectedSummary.className = "summary";
  els.selectedSummary.innerHTML = "";
  pcs.forEach((pc) => {
    const color = DEGREE_COLORS[degreeIndex(pc)];
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.style.setProperty("--note-color", color.bg);
    pill.style.setProperty("--note-ink", color.ink);
    pill.textContent = `${noteName(pc)} / ${degreeLabel(pc)}`;
    els.selectedSummary.appendChild(pill);
  });
}

function scoreCandidate(selected, root, intervals) {
  const candidate = patternPitchClasses(root, intervals);
  const selectedSet = new Set(selected);
  const matching = selected.filter((pc) => candidate.has(pc)).length;
  const missing = [...candidate].filter((pc) => !selectedSet.has(pc));
  const extra = selected.filter((pc) => !candidate.has(pc));
  const fit = selected.length ? matching / selected.length : 0;
  const coverage = candidate.size ? matching / candidate.size : 0;
  const score = Math.round((fit * 0.7 + coverage * 0.3) * 100);
  return { score, matching, missing, extra };
}

function rankedMatches(collection, selected, limit = 6) {
  if (!selected.length) return [];
  const rows = [];
  NOTES_SHARP.forEach((rootName, root) => {
    Object.entries(collection).forEach(([name, intervals]) => {
      const stats = scoreCandidate(selected, root, intervals);
      if (stats.matching > 0) {
        rows.push({ rootName, name, ...stats });
      }
    });
  });
  return rows
    .sort((a, b) => b.score - a.score || a.extra.length - b.extra.length || a.missing.length - b.missing.length)
    .slice(0, limit);
}

function renderScaleAnalysis() {
  const selected = selectedPitchClasses();
  const matches = rankedMatches(SCALES, selected, 7);
  els.analysisResults.innerHTML = "";

  if (!selected.length) {
    els.analysisResults.innerHTML = '<p class="summary empty">クリックすると近いスケール候補を表示します</p>';
    return;
  }

  matches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "result";
    item.innerHTML = `
      <strong>${match.rootName} ${match.name} <span>${match.score}%</span></strong>
      <div class="meter"><span style="width: ${match.score}%"></span></div>
      <small>不足: ${formatPcList(match.missing)} / 外音: ${formatPcList(match.extra)}</small>
    `;
    els.analysisResults.appendChild(item);
  });
}

function renderChordAnalysis() {
  const selected = selectedPitchClasses();
  const matches = rankedMatches(CHORDS, selected, 5);
  els.chordResults.innerHTML = "";

  if (!selected.length) {
    els.chordResults.innerHTML = '<p class="summary empty">コード候補もここに出ます</p>';
    return;
  }

  matches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "result";
    item.innerHTML = `<strong>${match.rootName}${match.name}</strong><span>${match.score}%</span>`;
    els.chordResults.appendChild(item);
  });
}

function formatPcList(pcs) {
  return pcs.length ? pcs.map(noteName).join(", ") : "なし";
}

function updateView() {
  updateModeControls();
  updateToneControls();
  refreshPracticeBox();
  updateFretboard();
  updateSelectedSummary();
  renderScaleAnalysis();
  renderChordAnalysis();
}

function getAudioContext() {
  if (!state.audioContext) {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioEngine();
  }
  return state.audioContext;
}

function playMidi(midi, startTime, duration) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const freq = 440 * 2 ** ((midi - 69) / 12);

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.04);
}

function positionsForMidi(midi) {
  return [...document.querySelectorAll(`.position[data-midi="${midi}"]`)];
}

function positionSelector(position) {
  return `.position[data-string="${position.string}"][data-fret="${position.fret}"]`;
}

function positionElement(position) {
  return document.querySelector(positionSelector(position));
}

function highlightPositionForEvent(event) {
  if (event.position) return positionElement(event.position);
  const positions = positionsForMidi(event.midi);
  if (state.startString !== "auto") {
    const preferred = positions.find((position) => position.dataset.string === state.startString);
    if (preferred) return preferred;
  }

  return positions.sort((a, b) => {
    const fretDiff = Number(a.dataset.fret) - Number(b.dataset.fret);
    return fretDiff || Number(b.dataset.string) - Number(a.dataset.string);
  })[0];
}

function playableMidiRange() {
  const midis = [...document.querySelectorAll(".position")].map((position) => Number(position.dataset.midi));
  return {
    min: Math.min(...midis),
    max: Math.max(...midis),
  };
}

function rootMidiForRange(octaves) {
  const { min, max } = playableMidiRange();
  const roots = [];
  for (let midi = min; midi <= max; midi += 1) {
    if (midiToPc(midi) === state.key) roots.push(midi);
  }
  const requiredTop = 12 * octaves;
  return roots.find((midi) => midi + requiredTop <= max) ?? roots[0] ?? min;
}

function setPracticeStatus(message, isWarning = false) {
  els.practiceStatus.textContent = message;
  els.practiceStatus.classList.toggle("warning", isWarning);
}

function midiForOctave(pc, octave) {
  return 12 * (octave + 1) + pc;
}

function rootsOnString(stringIndex) {
  const string = STRINGS[stringIndex];
  const roots = [];
  for (let fret = 0; fret <= state.fretCount; fret += 1) {
    const midi = string.midi + fret;
    if (midiToPc(midi) === state.key) roots.push(midi);
  }
  return roots;
}

function allPositions() {
  return [...document.querySelectorAll(".position")].map((position) => ({
    string: Number(position.dataset.string),
    fret: Number(position.dataset.fret),
    midi: Number(position.dataset.midi),
    pc: Number(position.dataset.pc),
  }));
}

function boxForRoot(rootPosition) {
  const width = fixedBoxWidth() ?? 5;
  const rootFret = rootPosition.fret;
  const maxStart = Math.max(0, state.fretCount - (width - 1));
  const offset = width === 5 ? 1 : 0;
  const start = Math.min(Math.max(rootFret - offset, 0), maxStart);
  return { start, end: start + width - 1 };
}

function positionMatchesOctave(position) {
  if (state.startOctave === "auto") return true;
  return position.midi === midiForOctave(state.key, Number(state.startOctave));
}

function candidateRootPositions(octaves) {
  const requiredTop = octaves * 12;
  const roots = allPositions().filter((position) => position.pc === state.key);
  const filteredByString =
    state.startString === "auto"
      ? roots
      : roots.filter((position) => position.string === Number(state.startString));
  const base = filteredByString.length ? filteredByString : roots;
  const candidates = state.startOctave === "auto" ? base : base.filter(positionMatchesOctave);

  return candidates
    .filter((position) => position.midi + requiredTop <= playableMidiRange().max)
    .sort((a, b) => {
      const stringScoreA = state.startString === "auto" ? Math.abs(a.string - 5) : 0;
      const stringScoreB = state.startString === "auto" ? Math.abs(b.string - 5) : 0;
      return stringScoreA - stringScoreB || a.midi - b.midi;
    });
}

function practiceRootPosition(octaves) {
  return candidateRootPositions(octaves)[0] ?? null;
}

function practiceRootMidi(octaves) {
  const requestedString = state.startString;
  const requestedOctave = state.startOctave;

  if (requestedString === "auto") {
    if (requestedOctave !== "auto") {
      const midi = midiForOctave(state.key, Number(requestedOctave));
      return positionsForMidi(midi).length ? midi : null;
    }
    return rootMidiForRange(octaves);
  }

  const stringRoots = rootsOnString(Number(requestedString));
  if (!stringRoots.length) return null;

  if (requestedOctave !== "auto") {
    const exact = midiForOctave(state.key, Number(requestedOctave));
    if (stringRoots.includes(exact)) return exact;
    return null;
  }

  const requiredTop = 12 * octaves;
  const { max } = playableMidiRange();
  return stringRoots.find((midi) => midi + requiredTop <= max) ?? stringRoots[0];
}

function buildCurrentPatternSequence() {
  const intervals = patternIntervals();
  const octaveRange = Number(state.octaveRange);
  if (fixedBoxWidth()) return buildBoxPatternSequence(intervals, octaveRange);

  const rootMidi = practiceRootMidi(octaveRange);
  if (rootMidi === null) {
    setPracticeStatus("指定した開始弦と開始Octのルート音が指板上にありません。", true);
    return [];
  }
  const { max } = playableMidiRange();
  const up = [];
  const startIndex = Number(state.startTone);
  const stopIndex = state.stopTone === "top" ? "top" : Number(state.stopTone);

  for (let octave = 0; octave < octaveRange; octave += 1) {
    intervals.forEach((interval, index) => {
      if (octave === 0 && index < startIndex) return;
      if (octave === octaveRange - 1 && stopIndex !== "top" && index > stopIndex) return;
      const midi = rootMidi + octave * 12 + interval;
      if (midi <= max && positionsForMidi(midi).length) up.push(midi);
    });
  }

  if (stopIndex === "top") {
    const topRoot = rootMidi + octaveRange * 12;
    if (topRoot <= max && positionsForMidi(topRoot).length) up.push(topRoot);
  }

  setPracticeStatus(up.length ? "" : "指定条件で再生できる音がありません。", !up.length);

  return [...up, ...up.slice(0, -1).reverse()];
}

function chooseBoxPosition(midi, box, previousPosition) {
  const candidates = allPositions()
    .filter((position) => position.midi === midi && position.fret >= box.start && position.fret <= box.end)
    .sort((a, b) => {
      const previousString = previousPosition?.string ?? 5;
      const stringDistance = Math.abs(a.string - previousString) - Math.abs(b.string - previousString);
      return stringDistance || b.string - a.string || a.fret - b.fret;
    });
  return candidates[0] ?? null;
}

function buildBoxPatternSequence(intervals, octaveRange) {
  const rootPosition = practiceRootPosition(octaveRange);
  if (!rootPosition) {
    setPracticeStatus("No root exists for the selected start string/octave.", true);
    return [];
  }

  const box = boxForRoot(rootPosition);
  state.activeBox = box;

  const { max } = playableMidiRange();
  const up = [];
  let previousPosition = rootPosition;
  const startIndex = Number(state.startTone);
  const stopIndex = state.stopTone === "top" ? "top" : Number(state.stopTone);

  for (let octave = 0; octave < octaveRange; octave += 1) {
    intervals.forEach((interval, index) => {
      if (octave === 0 && index < startIndex) return;
      if (octave === octaveRange - 1 && stopIndex !== "top" && index > stopIndex) return;
      const midi = rootPosition.midi + octave * 12 + interval;
      if (midi > max) return;
      const position = chooseBoxPosition(midi, box, previousPosition);
      if (!position) return;
      up.push({ midi, position });
      previousPosition = position;
    });
  }

  if (stopIndex === "top") {
    const topRoot = rootPosition.midi + octaveRange * 12;
    const topPosition = chooseBoxPosition(topRoot, box, previousPosition);
    if (topRoot <= max && topPosition) up.push({ midi: topRoot, position: topPosition });
  }

  setPracticeStatus(
    up.length
      ? `${box.start}-${box.end} fret fixed position (${fixedBoxWidth()} frets)`
      : `Cannot build the selected range inside frets ${box.start}-${box.end}.`,
    !up.length,
  );

  return [...up, ...up.slice(0, -1).reverse()];
}
function normalizeEvent(event) {
  return typeof event === "number" ? { midi: event } : event;
}

function playSequence(events, shouldHighlight = true, repeatFactory = null) {
  clearPlaying();
  const sequence = events.map(normalizeEvent);
  if (!sequence.length) return;
  const ctx = getAudioContext();
  const beat = 60 / Number(els.tempoInput.value || 90);
  const step = beat * Number(els.noteValueSelect.value || 1);
  const now = ctx.currentTime + 0.04;
  sequence.forEach((event, index) => {
    playMidi(event.midi, now + index * step, step * 0.82);
    if (!shouldHighlight) return;

    const onTimer = window.setTimeout(() => {
      document.querySelectorAll(".position.playing").forEach((position) => position.classList.remove("playing"));
      highlightPositionForEvent(event)?.classList.add("playing");
    }, index * step * 1000);
    const offTimer = window.setTimeout(() => {
      highlightPositionForEvent(event)?.classList.remove("playing");
    }, (index * step + step * 0.82) * 1000);
    state.playbackTimers.push(onTimer, offTimer);
  });

  if (repeatFactory && els.repeatToggle.checked) {
    state.repeatTimer = window.setTimeout(() => {
      playSequence(repeatFactory(), shouldHighlight, repeatFactory);
    }, sequence.length * step * 1000);
  }
}

function playCurrentPattern() {
  playSequence(buildCurrentPatternSequence(), true, buildCurrentPatternSequence);
}

function playMarkedNotes() {
  const marks = [...state.marked.values()].sort((a, b) => a.midi - b.midi);
  playSequence(marks.map((mark) => mark.midi));
}

function bindEvents() {
  els.keySelect.addEventListener("change", (event) => {
    state.key = Number(event.target.value);
    updateView();
  });
  els.modeSelect.addEventListener("change", (event) => {
    state.mode = event.target.value;
    updateView();
  });
  els.scaleSelect.addEventListener("change", (event) => {
    state.scale = event.target.value;
    updateView();
  });
  els.chordSelect.addEventListener("change", (event) => {
    state.chord = event.target.value;
    updateView();
  });
  els.displayNotes.addEventListener("click", () => {
    state.display = "notes";
    els.displayNotes.classList.add("active");
    els.displayDegrees.classList.remove("active");
    updateView();
  });
  els.displayDegrees.addEventListener("click", () => {
    state.display = "degrees";
    els.displayDegrees.classList.add("active");
    els.displayNotes.classList.remove("active");
    updateView();
  });
  els.playUpDown.addEventListener("click", playCurrentPattern);
  els.playMarked.addEventListener("click", playMarkedNotes);
  els.clearMarks.addEventListener("click", () => {
    state.marked.clear();
    updateView();
  });
  els.repeatToggle.addEventListener("change", () => {
    if (!els.repeatToggle.checked && state.repeatTimer) {
      window.clearTimeout(state.repeatTimer);
      state.repeatTimer = null;
    }
  });
  els.octaveSelect.addEventListener("change", (event) => {
    state.octaveRange = Number(event.target.value);
    updateView();
  });
  els.startStringSelect.addEventListener("change", (event) => {
    state.startString = event.target.value;
    updateView();
  });
  els.startOctaveSelect.addEventListener("change", (event) => {
    state.startOctave = event.target.value;
    updateView();
  });
  els.startToneSelect.addEventListener("change", (event) => {
    state.startTone = event.target.value;
    updateView();
  });
  els.stopToneSelect.addEventListener("change", (event) => {
    state.stopTone = event.target.value;
    updateView();
  });
  els.positionModeSelect.addEventListener("change", (event) => {
    state.positionMode = event.target.value;
    updateView();
  });
  els.fretCountSelect.addEventListener("change", (event) => {
    state.fretCount = Number(event.target.value);
    state.marked.clear();
    clearPlaying();
    renderFretboard();
    updateView();
  });
}

initControls();
renderFretboard();
bindEvents();
updateView();

