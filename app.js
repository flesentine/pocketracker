const patternGrid = document.querySelector("#patternGrid");
const rowReadout = document.querySelector("#rowReadout");
const bpmTile = document.querySelector("#bpmTile");
const bpmReadout = document.querySelector("#bpmReadout");
const channelReadout = document.querySelector("#channelReadout");
const octaveReadout = document.querySelector("#octaveReadout");
const sampleRack = document.querySelector("#sampleRack");
const sampleName = document.querySelector("#sampleName");
const sampleCode = document.querySelector("#sampleCode");
const noteRow = document.querySelector("#noteRow");
const playButton = document.querySelector("#playButton");
const octaveDown = document.querySelector("#octaveDown");
const octaveUp = document.querySelector("#octaveUp");
const demoButton = document.querySelector("#demoButton");
const waveform = document.querySelector(".waveform");
const cellPosition = document.querySelector("#cellPosition");
const cellValue = document.querySelector("#cellValue");
const rowPrev = document.querySelector("#rowPrev");
const rowNext = document.querySelector("#rowNext");
const channelPrev = document.querySelector("#channelPrev");
const channelNext = document.querySelector("#channelNext");
const previewCell = document.querySelector("#previewCell");
const clearCell = document.querySelector("#clearCell");
const tempoPanel = document.querySelector("#tempoPanel");
const bpmSlider = document.querySelector("#bpmSlider");
const bpmDown = document.querySelector("#bpmDown");
const bpmUp = document.querySelector("#bpmUp");
const tempoDone = document.querySelector("#tempoDone");
const notePopover = document.querySelector("#notePopover");
const notePopoverCell = document.querySelector("#notePopoverCell");
const notePopoverGrid = document.querySelector("#notePopoverGrid");
const notePopoverClose = document.querySelector("#notePopoverClose");

const sampleVoices = {
  "01": { name: "Kick", preview: "C-2", wave: [88, 64, 42, 24, 14, 9, 7, 5, 4, 3, 3, 2, 2, 2, 2, 2] },
  "02": { name: "Snare", preview: "D-2", wave: [32, 77, 43, 91, 56, 27, 83, 49, 68, 35, 95, 44, 72, 51, 86, 38] },
  "03": { name: "Bassline", preview: "C-3", wave: [36, 46, 58, 72, 86, 94, 90, 76, 61, 48, 38, 31, 29, 34, 43, 54] },
  "04": { name: "Lead", preview: "C-4", wave: [20, 42, 74, 96, 68, 34, 58, 91, 78, 45, 25, 52, 83, 99, 63, 29] },
};

const emptyCell = "--- .. ...";
const pattern = Array.from({ length: 64 }, () => Array(4).fill(emptyCell));
const visiblePatternRows = 18;
const pickerNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

let activeRow = 8;
let activeChannel = 0;
let octave = 3;
let bpm = 126;
let selectedSample = "03";
let isPlaying = false;
let isDemoLoaded = false;
let timer;
let patternTouchStartY = 0;
let patternTouchLastY = 0;
let cellPressTimer;
let suppressCellClick = false;
let audioContext;
let noiseBuffer;

function formatRow(row) {
  return row.toString().padStart(2, "0");
}

function getAudioContext() {
  if (!audioContext) {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioEngine();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  return noiseBuffer;
}

function noteToFrequency(note) {
  const match = note.match(/^([A-G])([#-])(\d)$/);
  if (!match) return 130.81;

  const [, letter, accidental, octaveValue] = match;
  const semitones = {
    "C-": -9,
    "C#": -8,
    "D-": -7,
    "D#": -6,
    "E-": -5,
    "F-": -4,
    "F#": -3,
    "G-": -2,
    "G#": -1,
    "A-": 0,
    "A#": 1,
    "B-": 2,
  };

  return 440 * 2 ** ((semitones[`${letter}${accidental}`] + (Number(octaveValue) - 4) * 12) / 12);
}

function playKick(ctx, when) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(132, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.18);
  gain.gain.setValueAtTime(0.95, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.24);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.26);
}

function playSnare(ctx, when) {
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const snap = ctx.createOscillator();
  const snapGain = ctx.createGain();

  noise.buffer = getNoiseBuffer(ctx);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, when);
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.5, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.16);

  snap.type = "triangle";
  snap.frequency.setValueAtTime(185, when);
  snapGain.gain.setValueAtTime(0.22, when);
  snapGain.gain.exponentialRampToValueAtTime(0.001, when + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  snap.connect(snapGain);
  snapGain.connect(ctx.destination);
  noise.start(when);
  snap.start(when);
  noise.stop(when + 0.18);
  snap.stop(when + 0.09);
}

function playBass(ctx, note, when) {
  const frequency = noteToFrequency(note);
  const saw = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const drive = ctx.createWaveShaper();
  const gain = ctx.createGain();

  const curve = new Float32Array(256);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / 128) - 1;
    curve[index] = Math.tanh(x * 2.4);
  }

  saw.type = "sawtooth";
  sub.type = "triangle";
  saw.frequency.setValueAtTime(frequency, when);
  sub.frequency.setValueAtTime(frequency / 2, when);
  saw.detune.setValueAtTime(-5, when);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1050, when);
  filter.frequency.exponentialRampToValueAtTime(260, when + 0.34);
  filter.Q.setValueAtTime(2.1, when);
  drive.curve = curve;
  drive.oversample = "2x";
  gain.gain.setValueAtTime(0.001, when);
  gain.gain.exponentialRampToValueAtTime(0.24, when + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.38);

  saw.connect(filter);
  sub.connect(filter);
  filter.connect(drive);
  drive.connect(gain);
  gain.connect(ctx.destination);
  saw.start(when);
  sub.start(when);
  saw.stop(when + 0.42);
  sub.stop(when + 0.42);
}

function playTone(ctx, note, sample, when) {
  const frequency = noteToFrequency(note);
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const isLead = sample === "04";

  osc.type = isLead ? "sawtooth" : "square";
  osc.frequency.setValueAtTime(frequency, when);
  osc.detune.setValueAtTime(isLead ? 4 : -7, when);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(isLead ? 2600 : 720, when);
  filter.frequency.exponentialRampToValueAtTime(isLead ? 1800 : 360, when + 0.28);
  gain.gain.setValueAtTime(0.001, when);
  gain.gain.exponentialRampToValueAtTime(isLead ? 0.2 : 0.28, when + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, when + (isLead ? 0.42 : 0.3));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + (isLead ? 0.46 : 0.34));
}

function parseCell(cell) {
  const [note, sample] = cell.split(/\s+/);
  if (!note || note === "---") return null;
  return { note, sample };
}

function playCell(cell, when = getAudioContext().currentTime) {
  const parsed = parseCell(cell);
  if (!parsed) return;

  const ctx = getAudioContext();
  if (parsed.sample === "01") {
    playKick(ctx, when);
  } else if (parsed.sample === "02") {
    playSnare(ctx, when);
  } else if (parsed.sample === "03") {
    playBass(ctx, parsed.note, when);
  } else {
    playTone(ctx, parsed.note, parsed.sample, when);
  }
}

function playRow(rowIndex) {
  const ctx = getAudioContext();
  pattern[rowIndex].forEach((cell, channelIndex) => {
    playCell(cell, ctx.currentTime + channelIndex * 0.006);
  });
}

function getRowDuration() {
  return Math.round(60000 / (bpm * 2.5));
}

function schedulePlaybackTick() {
  clearTimeout(timer);
  if (!isPlaying) return;

  timer = setTimeout(() => {
    activeRow = (activeRow + 1) % pattern.length;
    syncReadouts();
    renderPattern();
    playRow(activeRow);
    schedulePlaybackTick();
  }, getRowDuration());
}

function startPlayback(fromBeginning = false) {
  clearTimeout(timer);
  isPlaying = true;
  if (fromBeginning) {
    activeRow = 0;
  }

  document.body.classList.add("playing");
  playButton.textContent = "Stop";
  syncReadouts();
  renderPattern();
  playRow(activeRow);
  schedulePlaybackTick();
}

function stopPlayback() {
  isPlaying = false;
  clearTimeout(timer);
  document.body.classList.remove("playing");
  playButton.textContent = "Play";
}

function renderPattern() {
  patternGrid.innerHTML = "";

  const halfWindow = Math.floor(visiblePatternRows / 2);
  const firstRow = Math.min(
    Math.max(activeRow - halfWindow, 0),
    pattern.length - visiblePatternRows,
  );

  for (let offset = 0; offset < visiblePatternRows; offset += 1) {
    const row = firstRow + offset;
    const rowEl = document.createElement("div");
    rowEl.className = `pattern-row${row === activeRow ? " active" : ""}`;
    rowEl.dataset.row = row;

    const rowNum = document.createElement("span");
    rowNum.className = "row-num";
    rowNum.textContent = formatRow(row);
    rowEl.append(rowNum);

    pattern[row].forEach((cell, channel) => {
      const span = document.createElement("span");
      span.className = `pattern-cell${row === activeRow && channel === activeChannel ? " selected" : ""}`;
      span.dataset.channel = channel;
      span.dataset.row = row;
      span.textContent = cell;
      span.addEventListener("pointerdown", (event) => {
        suppressCellClick = false;
        clearTimeout(cellPressTimer);
        cellPressTimer = setTimeout(() => {
          suppressCellClick = true;
          activeRow = row;
          activeChannel = channel;
          syncReadouts();
          renderPattern();
          showNotePopover(event.clientX, event.clientY);
        }, 420);
      });
      span.addEventListener("pointerup", () => {
        clearTimeout(cellPressTimer);
      });
      span.addEventListener("pointerleave", () => {
        clearTimeout(cellPressTimer);
      });
      span.addEventListener("click", (event) => {
        event.stopPropagation();
        if (suppressCellClick) {
          suppressCellClick = false;
          return;
        }
        activeRow = row;
        activeChannel = channel;
        playCell(pattern[row][channel]);
        syncReadouts();
        renderPattern();
      });
      rowEl.append(span);
    });

    rowEl.addEventListener("click", () => {
      activeRow = row;
      syncReadouts();
      renderPattern();
    });

    patternGrid.append(rowEl);
  }
}

function moveRows(delta) {
  activeRow = Math.min(Math.max(activeRow + delta, 0), pattern.length - 1);
  syncReadouts();
  renderPattern();
}

function syncReadouts() {
  bpmReadout.textContent = bpm.toString();
  bpmSlider.value = bpm.toString();
  rowReadout.textContent = formatRow(activeRow);
  channelReadout.textContent = (activeChannel + 1).toString().padStart(2, "0");
  octaveReadout.textContent = octave.toString().padStart(2, "0");
  cellPosition.textContent = `${rowReadout.textContent} / CH ${channelReadout.textContent}`;
  cellValue.textContent = pattern[activeRow][activeChannel];
}

function insertNote(note) {
  const trackerNote = note.length === 1 ? `${note}-${octave}` : `${note}${octave}`;
  pattern[activeRow][activeChannel] = `${trackerNote} ${selectedSample} 000`;
  playCell(pattern[activeRow][activeChannel]);
  activeRow = (activeRow + 1) % pattern.length;
  syncReadouts();
  renderPattern();
}

function setCellNote(note) {
  const trackerNote = note.length === 1 ? `${note}-${octave}` : `${note}${octave}`;
  pattern[activeRow][activeChannel] = `${trackerNote} ${selectedSample} 000`;
  playCell(pattern[activeRow][activeChannel]);
  syncReadouts();
  renderPattern();
}

function renderNotePopoverButtons() {
  notePopoverGrid.innerHTML = "";
  pickerNotes.forEach((note) => {
    const button = document.createElement("button");
    button.textContent = note;
    button.addEventListener("click", () => {
      setCellNote(note);
      hideNotePopover();
    });
    notePopoverGrid.append(button);
  });
}

function showNotePopover(x, y) {
  notePopoverCell.textContent = `${formatRow(activeRow)} / CH ${(activeChannel + 1).toString().padStart(2, "0")}`;
  notePopover.hidden = false;

  const shellRect = document.querySelector(".phone-shell").getBoundingClientRect();
  const popoverRect = notePopover.getBoundingClientRect();
  const left = Math.min(Math.max(x - shellRect.left - popoverRect.width / 2, 8), shellRect.width - popoverRect.width - 8);
  const top = Math.min(Math.max(y - shellRect.top + 12, 8), shellRect.height - popoverRect.height - 8);

  notePopover.style.left = `${left}px`;
  notePopover.style.top = `${top}px`;
}

function hideNotePopover() {
  notePopover.hidden = true;
}

function selectSample(sample) {
  selectedSample = sample;
  document.querySelectorAll(".sample-pad").forEach((item) => item.classList.remove("active"));
  document.querySelector(`.sample-pad[data-code="${sample}"]`).classList.add("active");
  sampleName.textContent = `${sample} ${sampleVoices[sample].name}`;
  sampleCode.textContent = sample;
  renderWaveform(selectedSample);
}

function clearPattern() {
  pattern.forEach((row) => row.fill(emptyCell));
}

function resetComposition() {
  clearPattern();
  activeRow = 0;
  activeChannel = 0;
  isDemoLoaded = false;
  demoButton.textContent = "Demo";
  demoButton.setAttribute("aria-label", "Load demo song");
  selectSample("03");
  syncReadouts();
  renderPattern();
}

function loadDemoPattern() {
  const melody = [
    "G-4", "E-4", "C-4", "E-4", "G-4", "C-5", "B-4", "A-4",
    "G-4", "E-4", "C-4", "D-4", "E-4", "F-4", "G-4", "A-4",
    "G-4", "E-4", "C-4", "E-4", "G-4", "C-5", "B-4", "A-4",
  ];
  const bass = ["C-2", "C-2", "G-2", "G-2", "C-2", "C-2", "G-2", "G-2"];

  clearPattern();
  for (let row = 0; row < pattern.length; row += 1) {
    pattern[row][3] = `${melody[row % melody.length]} 04 000`;
    if (row % 4 === 0) pattern[row][0] = "C-2 01 000";
    if (row % 4 === 2) pattern[row][1] = "D-2 02 000";
    if (row % 2 === 0) pattern[row][2] = `${bass[(row / 2) % bass.length]} 03 000`;
  }

  activeRow = 0;
  activeChannel = 3;
  isDemoLoaded = true;
  demoButton.textContent = "Create";
  demoButton.setAttribute("aria-label", "Start a blank song");
  selectSample("04");
  syncReadouts();
  renderPattern();
}

function renderWaveform(sample) {
  waveform.querySelectorAll("span").forEach((bar, index) => {
    bar.style.height = `${sampleVoices[sample].wave[index]}%`;
  });
}

function moveSelection(rowDelta, channelDelta) {
  activeRow = (activeRow + rowDelta + pattern.length) % pattern.length;
  activeChannel = (activeChannel + channelDelta + 4) % 4;
  syncReadouts();
  renderPattern();
}

function setBpm(value) {
  bpm = Math.min(180, Math.max(80, Number(value)));
  syncReadouts();
  if (isPlaying) {
    schedulePlaybackTick();
  }
}

function showTempoPanel() {
  tempoPanel.hidden = false;
  document.body.classList.add("tempo-open");
}

function hideTempoPanel() {
  tempoPanel.hidden = true;
  document.body.classList.remove("tempo-open");
}

sampleRack.addEventListener("click", (event) => {
  const pad = event.target.closest(".sample-pad");
  if (!pad) return;

  selectSample(pad.dataset.code);
  playCell(`${sampleVoices[selectedSample].preview} ${selectedSample} 000`);
});

noteRow.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

noteRow.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  insertNote(button.dataset.note);
});

octaveDown.addEventListener("click", () => {
  octave = Math.max(1, octave - 1);
  syncReadouts();
});

octaveUp.addEventListener("click", () => {
  octave = Math.min(7, octave + 1);
  syncReadouts();
});

rowPrev.addEventListener("click", () => moveSelection(-1, 0));
rowNext.addEventListener("click", () => moveSelection(1, 0));
channelPrev.addEventListener("click", () => moveSelection(0, -1));
channelNext.addEventListener("click", () => moveSelection(0, 1));

patternGrid.addEventListener("pointerdown", (event) => {
  patternTouchStartY = event.clientY;
  patternTouchLastY = event.clientY;
  patternGrid.setPointerCapture(event.pointerId);
});

patternGrid.addEventListener("pointermove", (event) => {
  if (!patternGrid.hasPointerCapture(event.pointerId)) return;

  const delta = event.clientY - patternTouchLastY;
  if (Math.abs(delta) < 18) return;

  clearTimeout(cellPressTimer);
  moveRows(delta > 0 ? -1 : 1);
  patternTouchLastY = event.clientY;
});

patternGrid.addEventListener("pointerup", (event) => {
  if (!patternGrid.hasPointerCapture(event.pointerId)) return;

  const totalDelta = event.clientY - patternTouchStartY;
  if (Math.abs(totalDelta) > 52) {
    moveRows(totalDelta > 0 ? -2 : 2);
  }

  patternGrid.releasePointerCapture(event.pointerId);
});

previewCell.addEventListener("click", () => {
  playCell(pattern[activeRow][activeChannel]);
});

notePopoverClose.addEventListener("click", hideNotePopover);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideNotePopover();
  }
});

clearCell.addEventListener("click", () => {
  pattern[activeRow][activeChannel] = emptyCell;
  syncReadouts();
  renderPattern();
});

demoButton.addEventListener("click", () => {
  if (isDemoLoaded) {
    resetComposition();
  } else {
    loadDemoPattern();
  }
});

bpmTile.addEventListener("click", showTempoPanel);

bpmSlider.addEventListener("input", (event) => {
  setBpm(event.target.value);
});

bpmDown.addEventListener("click", () => setBpm(bpm - 1));
bpmUp.addEventListener("click", () => setBpm(bpm + 1));
tempoDone.addEventListener("click", hideTempoPanel);

playButton.addEventListener("click", () => {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback(true);
  }
});

syncReadouts();
renderWaveform(selectedSample);
renderNotePopoverButtons();
renderPattern();
