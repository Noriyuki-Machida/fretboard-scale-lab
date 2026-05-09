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
  labelSelect: document.querySelector("#labelSelect"),
  toneSelect: document.querySelector("#toneSelect"),
  fretSelect: document.querySelector("#fretSelect"),
  activeNotes: document.querySelector("#activeNotes"),
  voiceCount: document.querySelector("#voiceCount"),
};

const state = {
  key: 0,
  labels: "notes",
  tone: "clean",
  fretCount: 12,
  audio: null,
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
  voice.oscillators.forEach((osc) => osc.stop(now + 0.18));
}

function toneSettings() {
  if (state.tone === "warm") return { type: "triangle", filter: 1900, mix: [0.85, 0.12, 0.05] };
  if (state.tone === "lead") return { type: "sawtooth", filter: 3200, mix: [0.55, 0.18, 0.08] };
  return { type: "triangle", filter: 2600, mix: [0.9, 0.16, 0.05] };
}

function startVoice(pointerId, midi, pad) {
  stopVoice(pointerId);
  const ctx = audioContext();
  const now = ctx.currentTime;
  const settings = toneSettings();
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const oscillators = [];

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(settings.filter, now);
  envelopeStart(output, now);
  filter.connect(output).connect(ctx.destination);

  [1, 2, 3.01].forEach((multiple, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = settings.type;
    osc.frequency.setValueAtTime(frequencyFor(midi) * multiple, now);
    gain.gain.setValueAtTime(settings.mix[index], now);
    osc.connect(gain).connect(filter);
    osc.start(now);
    oscillators.push(osc);
  });

  pad.classList.add("active");
  state.voices.set(pointerId, { midi, pad, output, oscillators });
  renderStatus();
}

function stopVoice(pointerId) {
  const voice = state.voices.get(pointerId);
  if (!voice) return;
  voice.pad.classList.remove("active");
  envelopeStop(voice);
  state.voices.delete(pointerId);
  renderStatus();
}

function stopAllVoices() {
  [...state.voices.keys()].forEach((pointerId) => stopVoice(pointerId));
}

function renderStatus() {
  const notes = [...state.voices.values()].map((voice) => NOTE_NAMES[pc(voice.midi)]);
  els.activeNotes.textContent = notes.length ? notes.join("  ") : "-";
  els.voiceCount.textContent = String(notes.length);
}

function renderControls() {
  NOTE_NAMES.forEach((name, index) => els.keySelect.add(new Option(name, String(index))));
  els.keySelect.value = String(state.key);
}

function renderBoard() {
  stopAllVoices();
  els.board.innerHTML = "";
  els.fretNumbers.innerHTML = "";
  const columns = state.fretCount + 1;
  els.board.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  els.fretNumbers.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

  STRINGS.forEach((string, stringIndex) => {
    for (let fret = 0; fret <= state.fretCount; fret += 1) {
      const midi = string.midi + fret;
      const color = colorFor(midi);
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "touch-pad";
      pad.classList.toggle("open", fret === 0);
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
        pad.setPointerCapture(event.pointerId);
        startVoice(event.pointerId, midi, pad);
      });
      pad.addEventListener("pointerup", (event) => stopVoice(event.pointerId));
      pad.addEventListener("pointercancel", (event) => stopVoice(event.pointerId));
      pad.addEventListener("lostpointercapture", (event) => stopVoice(event.pointerId));

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
  els.keySelect.addEventListener("change", (event) => {
    state.key = Number(event.target.value);
    renderBoard();
  });
  els.labelSelect.addEventListener("change", (event) => {
    state.labels = event.target.value;
    renderBoard();
  });
  els.toneSelect.addEventListener("change", (event) => {
    state.tone = event.target.value;
  });
  els.fretSelect.addEventListener("change", (event) => {
    state.fretCount = Number(event.target.value);
    renderBoard();
  });
  window.addEventListener("blur", stopAllVoices);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAllVoices();
  });
}

renderControls();
bindEvents();
renderBoard();
