const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NATURAL_PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const KEY_OPTIONS = [
  { label: "C", pc: 0, spelling: "C" },
  { label: "C#", pc: 1, spelling: "C#" },
  { label: "Db", pc: 1, spelling: "Db" },
  { label: "D", pc: 2, spelling: "D" },
  { label: "D#", pc: 3, spelling: "D#" },
  { label: "Eb", pc: 3, spelling: "Eb" },
  { label: "E", pc: 4, spelling: "E" },
  { label: "F", pc: 5, spelling: "F" },
  { label: "F#", pc: 6, spelling: "F#" },
  { label: "Gb", pc: 6, spelling: "Gb" },
  { label: "G", pc: 7, spelling: "G" },
  { label: "G#", pc: 8, spelling: "G#" },
  { label: "Ab", pc: 8, spelling: "Ab" },
  { label: "A", pc: 9, spelling: "A" },
  { label: "A#", pc: 10, spelling: "A#" },
  { label: "Bb", pc: 10, spelling: "Bb" },
  { label: "B", pc: 11, spelling: "B" },
];

const SCALES = {
  "Major (Ionian)": [0, 2, 4, 5, 7, 9, 11],
  "Natural Minor (Aeolian)": [0, 2, 3, 5, 7, 8, 10],
  "Major Pentatonic": [0, 2, 4, 7, 9],
  "Minor Pentatonic": [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
};

const CHORDS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  "9": [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  "11": [0, 4, 7, 10, 14, 17],
  "13": [0, 4, 7, 10, 14, 17, 21],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  add9: [0, 4, 7, 14],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
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

const STRINGS = [
  { name: "E", midi: 64 },
  { name: "B", midi: 59 },
  { name: "G", midi: 55 },
  { name: "D", midi: 50 },
  { name: "A", midi: 45 },
  { name: "E", midi: 40 },
];

const state = {
  key: 0,
  keySpelling: "C",
  mode: "scale",
  scale: "Major (Ionian)",
  chord: "Major",
  labels: "notes",
  audio: null,
};

const els = {
  keySelect: document.querySelector("#keySelect"),
  scaleTab: document.querySelector("#scaleTab"),
  chordTab: document.querySelector("#chordTab"),
  scaleControl: document.querySelector("#scaleControl"),
  chordControl: document.querySelector("#chordControl"),
  scaleSelect: document.querySelector("#scaleSelect"),
  chordSelect: document.querySelector("#chordSelect"),
  labelSelect: document.querySelector("#labelSelect"),
  playHarmony: document.querySelector("#playHarmony"),
  playScale: document.querySelector("#playScale"),
  patternSummary: document.querySelector("#patternSummary"),
  staff: document.querySelector("#staff"),
  piano: document.querySelector("#piano"),
  fretboard: document.querySelector("#fretboard"),
  fretNumbers: document.querySelector("#fretNumbers"),
};

function pc(midi) {
  return ((midi % 12) + 12) % 12;
}

function degreeIndex(notePc, root = state.key) {
  return (notePc - root + 12) % 12;
}

function degreeLabel(notePc) {
  return DEGREE_LABELS[degreeIndex(notePc)] ?? "";
}

function intervalLabel(interval) {
  const normalized = ((interval % 12) + 12) % 12;
  if (interval >= 12) {
    return {
      1: "b9",
      2: "9",
      3: "#9",
      5: "11",
      6: "#11",
      8: "b13",
      9: "13",
      10: "b7",
      11: "7",
    }[normalized] ?? DEGREE_LABELS[normalized] ?? "";
  }
  return DEGREE_LABELS[normalized] ?? "";
}

function tonicLetterIndex(rootSpelling = state.keySpelling) {
  return LETTERS.indexOf(rootSpelling[0]);
}

function accidentalForDistance(distance) {
  if (distance === 0) return "";
  if (distance === 1) return "#";
  if (distance === 2) return "##";
  if (distance === 11) return "b";
  if (distance === 10) return "bb";
  return "";
}

function noteName(notePc, root = state.key, rootSpelling = state.keySpelling) {
  const interval = degreeIndex(notePc, root);
  const degreeNumber = {
    0: 0,
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
    6: 4,
    7: 4,
    8: 4,
    9: 5,
    10: 6,
    11: 6,
  }[interval];
  const letter = LETTERS[(tonicLetterIndex(rootSpelling) + degreeNumber) % LETTERS.length];
  const distance = (notePc - NATURAL_PITCH_CLASS[letter] + 12) % 12;
  return `${letter}${accidentalForDistance(distance)}`;
}

function preferredIntervalForPc(notePc) {
  const intervals = activeIntervals().filter((interval) => (state.key + interval) % 12 === notePc);
  return intervals.find((interval) => interval >= 12) ?? intervals[0] ?? degreeIndex(notePc);
}

function labelFor(notePc, interval = preferredIntervalForPc(notePc)) {
  return state.labels === "degrees" ? intervalLabel(interval) : noteName(notePc);
}

function accidentalSymbol(name) {
  if (name.includes("bb")) return "bb";
  if (name.includes("##")) return "x";
  if (name.includes("b")) return "b";
  if (name.includes("#")) return "#";
  return "";
}

function diatonicStepFromC4(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const letterSteps = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  const notePc = pc(midi);
  const naturalPc = [0, 2, 4, 5, 7, 9, 11].reduce((best, candidate) => {
    const bestDistance = Math.min((notePc - best + 12) % 12, (best - notePc + 12) % 12);
    const candidateDistance = Math.min((notePc - candidate + 12) % 12, (candidate - notePc + 12) % 12);
    return candidateDistance < bestDistance ? candidate : best;
  }, 0);
  return (octave - 4) * 7 + letterSteps[naturalPc];
}

function diatonicStepForWrittenNote(midi, writtenName) {
  const letterSteps = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  let octave = Math.floor(midi / 12) - 1;
  const letter = writtenName[0];
  if (letter === "C" && pc(midi) === 11) octave += 1;
  if (letter === "B" && pc(midi) === 0) octave -= 1;
  return (octave - 4) * 7 + letterSteps[letter];
}

function activeIntervals() {
  return state.mode === "scale" ? SCALES[state.scale] : CHORDS[state.chord];
}

function activePitchClasses() {
  return new Set(activeIntervals().map((interval) => (state.key + interval) % 12));
}

function colorFor(notePc) {
  return DEGREE_COLORS[degreeIndex(notePc)];
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function audioContext() {
  if (!state.audio) {
    const Engine = window.AudioContext || window.webkitAudioContext;
    state.audio = new Engine();
  }
  return state.audio;
}

function playPiano(midi) {
  const ctx = audioContext();
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  out.connect(ctx.destination);

  [1, 2, 3].forEach((multiple, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(midiToFrequency(midi) * multiple, now);
    gain.gain.setValueAtTime([0.9, 0.18, 0.08][index], now);
    osc.connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 1.45);
  });
}

function playHarmony() {
  const baseMidi = 60 + state.key;
  activeIntervals().forEach((interval) => playPiano(baseMidi + interval));
}

function playScaleOctave() {
  const baseMidi = 60 + state.key;
  const intervals = state.mode === "scale" ? [...activeIntervals(), 12] : activeIntervals();
  intervals.forEach((interval, index) => {
    window.setTimeout(() => playPiano(baseMidi + interval), index * 280);
  });
}

function playGuitar(midi) {
  const ctx = audioContext();
  const now = ctx.currentTime;
  const out = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600, now);
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.26, now + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  filter.connect(out).connect(ctx.destination);

  [1, 2, 3.01].forEach((multiple, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(midiToFrequency(midi) * multiple, now);
    gain.gain.setValueAtTime([0.9, 0.16, 0.05][index], now);
    osc.connect(gain).connect(filter);
    osc.start(now);
    osc.stop(now + 1.12);
  });
}

function flash(element) {
  element.classList.add("playing");
  window.setTimeout(() => element.classList.remove("playing"), 280);
}

function initControls() {
  KEY_OPTIONS.forEach((key) => els.keySelect.add(new Option(key.label, `${key.pc}:${key.spelling}`)));
  Object.keys(SCALES).forEach((scale) => els.scaleSelect.add(new Option(scale, scale)));
  Object.keys(CHORDS).forEach((chord) => els.chordSelect.add(new Option(chord, chord)));
  els.keySelect.value = "0:C";
  els.scaleSelect.value = state.scale;
  els.chordSelect.value = state.chord;
}

function renderSummary() {
  const name = state.mode === "scale" ? state.scale : state.chord;
  const notes = activeIntervals().map((interval) => noteName((state.key + interval) % 12)).join("  ");
  els.patternSummary.textContent = `${state.keySpelling} ${name}: ${notes}`;
}

function renderStaff() {
  const intervals = activeIntervals();
  const width = Math.max(900, 150 + intervals.length * 92);
  const height = 184;
  const trebleTop = 34;
  const bassTop = 110;
  const lineGap = 10;
  const trebleBottomLineY = trebleTop + 4 * lineGap;
  const bassBottomLineY = bassTop + 4 * lineGap;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  [trebleTop, bassTop].forEach((top) => {
    for (let i = 0; i < 5; i += 1) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "staff-line");
      line.setAttribute("x1", "40");
      line.setAttribute("x2", String(width - 28));
      line.setAttribute("y1", String(top + i * lineGap));
      line.setAttribute("y2", String(top + i * lineGap));
      svg.appendChild(line);
    }
  });

  const trebleClef = document.createElementNS("http://www.w3.org/2000/svg", "text");
  trebleClef.setAttribute("class", "clef");
  trebleClef.setAttribute("x", "50");
  trebleClef.setAttribute("y", "78");
  trebleClef.textContent = "\uD834\uDD1E";
  svg.appendChild(trebleClef);

  const bassClef = document.createElementNS("http://www.w3.org/2000/svg", "text");
  bassClef.setAttribute("class", "clef");
  bassClef.setAttribute("x", "52");
  bassClef.setAttribute("y", "145");
  bassClef.setAttribute("font-size", "42");
  bassClef.textContent = "\uD834\uDD22";
  svg.appendChild(bassClef);

  function drawLedgerLines(x, y, bottomLineY, topLineY) {
    for (let ledgerY = bottomLineY + lineGap; ledgerY <= y + 0.1; ledgerY += lineGap) {
      const ledger = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ledger.setAttribute("class", "ledger-line");
      ledger.setAttribute("x1", String(x - 14));
      ledger.setAttribute("x2", String(x + 14));
      ledger.setAttribute("y1", String(ledgerY));
      ledger.setAttribute("y2", String(ledgerY));
      svg.appendChild(ledger);
    }
    for (let ledgerY = topLineY - lineGap; ledgerY >= y - 0.1; ledgerY -= lineGap) {
      const ledger = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ledger.setAttribute("class", "ledger-line");
      ledger.setAttribute("x1", String(x - 14));
      ledger.setAttribute("x2", String(x + 14));
      ledger.setAttribute("y1", String(ledgerY));
      ledger.setAttribute("y2", String(ledgerY));
      svg.appendChild(ledger);
    }
  }

  function drawNote({ interval, index, baseMidi, bottomLineY, topLineY, yOffset = 0, instrument = "piano" }) {
    const notePc = (state.key + interval) % 12;
    const midi = baseMidi + interval;
    const writtenName = noteName(notePc);
    const step = diatonicStepForWrittenNote(midi, writtenName);
    const x = 170 + index * 86;
    const bottomStep = bottomLineY === bassBottomLineY ? -10 : 2;
    const y = bottomLineY - (step - bottomStep) * 5 + yOffset;
    const color = colorFor(notePc);
    const accidental = accidentalSymbol(writtenName);

    drawLedgerLines(x, y, bottomLineY, topLineY);

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "staff-note");
    group.style.setProperty("--note-color", color.bg);
    group.addEventListener("click", () => (instrument === "guitar" ? playGuitar(midi) : playPiano(midi)));

    if (accidental) {
      const accidentalText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      accidentalText.setAttribute("class", "staff-accidental");
      accidentalText.setAttribute("x", String(x - 22));
      accidentalText.setAttribute("y", String(y + 7));
      accidentalText.textContent = accidental;
      group.appendChild(accidentalText);
    }

    const head = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    head.setAttribute("class", "note-head");
    head.setAttribute("cx", String(x));
    head.setAttribute("cy", String(y));
    head.setAttribute("rx", "6.5");
    head.setAttribute("ry", "4.5");
    head.setAttribute("transform", `rotate(-18 ${x} ${y})`);
    group.appendChild(head);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "note-label");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y + 28));
    label.textContent = labelFor(notePc, interval);
    group.appendChild(label);
    svg.appendChild(group);
  }

  const trebleRoot = 60 + state.key;
  const bassRoot = 36 + state.key;
  intervals.forEach((interval, index) => {
    drawNote({ interval, index, baseMidi: trebleRoot, bottomLineY: trebleBottomLineY, topLineY: trebleTop });
    drawNote({ interval, index, baseMidi: bassRoot, bottomLineY: bassBottomLineY, topLineY: bassTop, instrument: "guitar" });
  });

  els.staff.replaceChildren(svg);
}
function renderPiano() {
  const startMidi = 48;
  const endMidi = 83;
  const whitePcs = new Set([0, 2, 4, 5, 7, 9, 11]);
  const pattern = activePitchClasses();
  let whiteIndex = 0;
  els.piano.innerHTML = "";

  for (let midi = startMidi; midi <= endMidi; midi += 1) {
    const notePc = pc(midi);
    const inPattern = pattern.has(notePc);
    const color = colorFor(notePc);

    if (whitePcs.has(notePc)) {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "white-key";
      key.style.left = `${whiteIndex * 52}px`;
      key.style.setProperty("--note-color", color.bg);
      key.style.setProperty("--note-ink", color.ink);
      key.classList.toggle("in-pattern", inPattern);
      key.classList.toggle("root", notePc === state.key && inPattern);
      const label = document.createElement("span");
      label.className = "key-label";
      label.textContent = inPattern ? labelFor(notePc) : "";
      key.appendChild(label);
      key.addEventListener("click", () => {
        playPiano(midi);
        flash(key);
      });
      els.piano.appendChild(key);
      whiteIndex += 1;
    } else {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "black-key";
      key.style.left = `${whiteIndex * 52 - 16}px`;
      key.style.setProperty("--note-color", color.bg);
      key.style.setProperty("--note-ink", color.ink);
      key.classList.toggle("in-pattern", inPattern);
      key.classList.toggle("root", notePc === state.key && inPattern);
      const label = document.createElement("span");
      label.className = "key-label";
      label.textContent = inPattern ? labelFor(notePc) : "";
      key.appendChild(label);
      key.addEventListener("click", () => {
        playPiano(midi);
        flash(key);
      });
      els.piano.appendChild(key);
    }
  }

  els.piano.style.minWidth = `${whiteIndex * 52}px`;
}

function renderFretboard() {
  const pattern = activePitchClasses();
  els.fretboard.innerHTML = "";
  els.fretNumbers.innerHTML = "";

  STRINGS.forEach((string, stringIndex) => {
    for (let fret = 0; fret <= 12; fret += 1) {
      const midi = string.midi + fret;
      const notePc = pc(midi);
      const inPattern = pattern.has(notePc);
      const color = colorFor(notePc);
      const position = document.createElement("button");
      position.type = "button";
      position.className = `fret-position string-${stringIndex}`;
      position.classList.toggle("open", fret === 0);
      position.classList.toggle("in-pattern", inPattern);
      position.classList.toggle("root", notePc === state.key && inPattern);
      position.style.setProperty("--note-color", color.bg);
      position.style.setProperty("--note-ink", color.ink);

      const dot = document.createElement("span");
      dot.className = "fret-dot";
      dot.textContent = inPattern ? labelFor(notePc) : "";
      position.appendChild(dot);

      position.addEventListener("click", () => {
        playGuitar(midi);
        flash(position);
      });

      els.fretboard.appendChild(position);
    }
  });

  for (let fret = 0; fret <= 12; fret += 1) {
    const number = document.createElement("div");
    number.textContent = fret === 0 ? "Open" : String(fret);
    els.fretNumbers.appendChild(number);
  }
}

function updateTabs() {
  const scaleMode = state.mode === "scale";
  els.scaleTab.classList.toggle("active", scaleMode);
  els.chordTab.classList.toggle("active", !scaleMode);
  els.scaleControl.hidden = !scaleMode;
  els.chordControl.hidden = scaleMode;
}

function render() {
  updateTabs();
  renderSummary();
  renderStaff();
  renderPiano();
  renderFretboard();
}

function bindEvents() {
  els.keySelect.addEventListener("change", (event) => {
    const [notePc, spelling] = event.target.value.split(":");
    state.key = Number(notePc);
    state.keySpelling = spelling;
    render();
  });
  els.scaleTab.addEventListener("click", () => {
    state.mode = "scale";
    render();
  });
  els.chordTab.addEventListener("click", () => {
    state.mode = "chord";
    render();
  });
  els.scaleSelect.addEventListener("change", (event) => {
    state.scale = event.target.value;
    render();
  });
  els.chordSelect.addEventListener("change", (event) => {
    state.chord = event.target.value;
    render();
  });
  els.labelSelect.addEventListener("change", (event) => {
    state.labels = event.target.value;
    render();
  });
  els.playHarmony.addEventListener("click", playHarmony);
  els.playScale.addEventListener("click", playScaleOctave);
}

initControls();
bindEvents();
render();


