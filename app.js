const patternGrid = document.querySelector("#patternGrid");
const rowReadout = document.querySelector("#rowReadout");
const bpmTile = document.querySelector("#bpmTile");
const bpmReadout = document.querySelector("#bpmReadout");
const channelReadout = document.querySelector("#channelReadout");
const octaveReadout = document.querySelector("#octaveReadout");
const patternReadout = document.querySelector("#patternReadout");
const rowsReadout = document.querySelector("#rowsReadout");
const patternLabel = document.querySelector(".top-bar .eyebrow");
const patternControls = document.querySelector("#patternControls");
const patternToggleButton = document.querySelector("#patternToggleButton");
const patternTitleToggle = document.querySelector("#patternTitleToggle");
const patternAdd = document.querySelector("#patternAdd");
const rowsSelect = document.querySelector("#rowsSelect");
const rowsMenu = document.querySelector("#rowsMenu");
const saveProject = document.querySelector("#saveProject");
const loadProject = document.querySelector("#loadProject");
const projectFileInput = document.querySelector("#projectFileInput");
const exportMp3 = document.querySelector("#exportMp3");
const patternLoopToggle = document.querySelector("#patternLoopToggle");
const sequenceLane = document.querySelector("#sequenceLane");
const patternBank = document.querySelector("#patternBank");
const channelHeaderButtons = document.querySelectorAll(".channel-head button[data-channel]");
const sampleDeck = document.querySelector(".sample-deck");
const sampleRack = document.querySelector("#sampleRack");
const editorNoteGrid = document.querySelector("#editorNoteGrid");
const volumeSlider = document.querySelector("#volumeSlider");
const volumeReadout = document.querySelector("#volumeReadout");
const playButton = document.querySelector("#playButton");
const copyStatus = document.querySelector("#copyStatus");
const copyStatusText = document.querySelector("#copyStatusText");
const copyCancel = document.querySelector("#copyCancel");
const octaveDown = document.querySelector("#octaveDown");
const octaveUp = document.querySelector("#octaveUp");
const recordButton = document.querySelector("#recordButton");
const clearCell = document.querySelector("#clearCell");
const tempoPanel = document.querySelector("#tempoPanel");
const bpmSlider = document.querySelector("#bpmSlider");
const bpmDown = document.querySelector("#bpmDown");
const bpmUp = document.querySelector("#bpmUp");
const tempoDone = document.querySelector("#tempoDone");
const phoneShell = document.querySelector(".phone-shell");

const sampleVoices = {
  "01": { name: "Kick", preview: "C-2" },
  "02": { name: "Snare", preview: "D-2" },
  "03": { name: "Bassline", preview: "C-3" },
  "04": { name: "Lead", preview: "C-4" },
  "05": { name: "Hat", preview: "F#2" },
  "06": { name: "Pluck", preview: "C-4" },
  "07": { name: "Chord", preview: "C-4" },
  "08": { name: "Bell", preview: "C-5" },
};

const projectFileFormat = "pocket-tracker";
const projectFileVersion = 1;
const emptyCell = "--- .. ...";
const defaultPatternRows = 64;
const minPatternRows = 16;
const maxPatternRows = 128;
const rowStep = 16;
const maxVisiblePatternRows = 18;
const minVisiblePatternRows = 8;
const minPatternRowHeight = 22;
const defaultVolume = 48;
const cellDragDelay = 420;
const rangeSelectTapWindow = 560;
const cellDragAutoScrollEdge = 26;
const cellDragAutoScrollInterval = 360;
const sequenceDragAutoScrollEdge = 28;
const sequenceDragAutoScrollAmount = 32;
const patterns = [createPattern(defaultPatternRows)];
const patternSequence = [0, null];
let nextPatternRows = defaultPatternRows;

let pattern = patterns[0].cells;
let activePatternIndex = 0;
let activeSequenceStep = 0;
let activeRow = 0;
let activeChannel = 0;
let octave = 3;
let bpm = 126;
let selectedSample = "03";
let isPlaying = false;
let isDemoLoaded = false;
let isRecording = false;
let isPatternLooping = true;
let timer;
let patternTouchStartX = 0;
let patternTouchStartY = 0;
let patternTouchLastX = 0;
let patternTouchLastY = 0;
let patternDidSwipe = false;
let patternHandledTap = false;
let cellDragTimer;
let lastCellDragScrollAt = 0;
let cellDragFirstVisibleRow = null;
let draggedCell = null;
let isDraggingCell = false;
let isSelectingRange = false;
let isRangeSelectionArmed = false;
let didMoveRangeSelection = false;
let selectionStartCell = null;
let selectionEndCell = null;
let selectionAnchorX = 0;
let pendingCopiedBlock = null;
let pastePending = false;
let lastGridTapAt = 0;
let lastGridTapCell = null;
let rangeStatusMessage = "";
let sequenceDrag = null;
let queuedPatternForSequence = null;
let sequenceGhost = null;
let selectedVolume = defaultVolume;
let armedNote = null;
let lastTouchEnd = 0;
let ignoreNextNoteClick = false;
let ignoreNextPlayClick = false;
let paneScrollDrag = null;
let pendingPaneGesture = null;
let suppressPaneClick = false;
let sampleRackDrag = null;
let suppressSampleRackClickUntil = 0;
let mutedChannels = Array(4).fill(false);
let audioContext;
const noiseBuffers = new Map();

function createPattern(rows) {
  return {
    rows,
    cells: Array.from({ length: rows }, () => Array(4).fill(emptyCell)),
  };
}

function clampPatternPosition() {
  activeRow = Math.min(Math.max(activeRow, 0), pattern.length - 1);
  activeChannel = Math.min(Math.max(activeChannel, 0), 3);
}

function formatRow(row) {
  return row.toString().padStart(2, "0");
}

function formatVolume(volume) {
  return `V${Math.round(volume).toString().padStart(2, "0")}`;
}

function volumeToGain(volume) {
  return Math.max(0, Math.min(64, Number(volume))) / 64;
}

function makeCell(note, sample = selectedSample, volume = selectedVolume) {
  return `${note} ${sample} ${formatVolume(volume)}`;
}

function noteToTrackerNote(note) {
  return note.length === 1 ? `${note}-${octave}` : `${note}${octave}`;
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
  const key = ctx.sampleRate;
  if (noiseBuffers.has(key)) return noiseBuffers.get(key);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  noiseBuffers.set(key, noiseBuffer);
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

function playKick(ctx, when, volume = defaultVolume) {
  const level = volumeToGain(volume);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(132, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.18);
  gain.gain.setValueAtTime(0.95 * level, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.24);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.26);
}

function playSnare(ctx, when, volume = defaultVolume) {
  const level = volumeToGain(volume);
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const snap = ctx.createOscillator();
  const snapGain = ctx.createGain();

  noise.buffer = getNoiseBuffer(ctx);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, when);
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.5 * level, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.16);

  snap.type = "triangle";
  snap.frequency.setValueAtTime(185, when);
  snapGain.gain.setValueAtTime(0.22 * level, when);
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

function playHat(ctx, when, volume = defaultVolume) {
  const level = volumeToGain(volume);
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  noise.buffer = getNoiseBuffer(ctx);
  filter.type = "highpass";
  filter.frequency.setValueAtTime(5200, when);
  gain.gain.setValueAtTime(0.26 * level, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.07);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(when);
  noise.stop(when + 0.08);
}

function playBass(ctx, note, when, volume = defaultVolume) {
  const level = volumeToGain(volume);
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
  gain.gain.exponentialRampToValueAtTime(0.24 * level, when + 0.018);
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

function playChord(ctx, note, sample, when, volume = defaultVolume) {
  const level = volumeToGain(volume);
  const root = noteToFrequency(note);
  const intervals = [1, 2 ** (4 / 12), 2 ** (7 / 12)];
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const isBell = sample === "08";

  filter.type = isBell ? "highpass" : "lowpass";
  filter.frequency.setValueAtTime(isBell ? 680 : 1450, when);
  gain.gain.setValueAtTime(0.001, when);
  gain.gain.exponentialRampToValueAtTime((isBell ? 0.16 : 0.13) * level, when + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.001, when + (isBell ? 0.72 : 0.48));

  intervals.forEach((ratio, index) => {
    const osc = ctx.createOscillator();
    osc.type = isBell ? "sine" : "triangle";
    osc.frequency.setValueAtTime(root * ratio, when);
    osc.detune.setValueAtTime(isBell ? index * 5 : index * -4, when);
    osc.connect(filter);
    osc.start(when);
    osc.stop(when + (isBell ? 0.78 : 0.52));
  });

  filter.connect(gain);
  gain.connect(ctx.destination);
}

function playTone(ctx, note, sample, when, volume = defaultVolume) {
  const level = volumeToGain(volume);
  const frequency = noteToFrequency(note);
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const isLead = sample === "04";
  const isPluck = sample === "06";

  osc.type = isLead ? "sawtooth" : isPluck ? "triangle" : "square";
  osc.frequency.setValueAtTime(frequency, when);
  osc.detune.setValueAtTime(isLead ? 4 : isPluck ? 0 : -7, when);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(isLead ? 2600 : isPluck ? 1900 : 720, when);
  filter.frequency.exponentialRampToValueAtTime(isLead ? 1800 : isPluck ? 520 : 360, when + 0.28);
  gain.gain.setValueAtTime(0.001, when);
  gain.gain.exponentialRampToValueAtTime((isLead ? 0.2 : isPluck ? 0.22 : 0.28) * level, when + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, when + (isLead ? 0.42 : isPluck ? 0.18 : 0.3));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + (isLead ? 0.46 : isPluck ? 0.22 : 0.34));
}

function parseCell(cell) {
  const [note, sample, volumeToken] = cell.split(/\s+/);
  if (!note || note === "---") return null;
  const parsedVolume = volumeToken?.startsWith("V")
    ? Number(volumeToken.slice(1))
    : Number(volumeToken);
  const volume = Number.isFinite(parsedVolume) ? parsedVolume : defaultVolume;
  return { note, sample, volume };
}

function scheduleParsedCell(ctx, parsed, when) {
  if (!parsed) return;

  if (parsed.sample === "01") {
    playKick(ctx, when, parsed.volume);
  } else if (parsed.sample === "02") {
    playSnare(ctx, when, parsed.volume);
  } else if (parsed.sample === "05") {
    playHat(ctx, when, parsed.volume);
  } else if (parsed.sample === "03") {
    playBass(ctx, parsed.note, when, parsed.volume);
  } else if (parsed.sample === "07" || parsed.sample === "08") {
    playChord(ctx, parsed.note, parsed.sample, when, parsed.volume);
  } else {
    playTone(ctx, parsed.note, parsed.sample, when, parsed.volume);
  }
}

function playCell(cell, when = getAudioContext().currentTime) {
  const parsed = parseCell(cell);
  if (!parsed) return;

  scheduleParsedCell(getAudioContext(), parsed, when);
}

function playRow(rowIndex) {
  const ctx = getAudioContext();
  pattern[rowIndex].forEach((cell, channelIndex) => {
    if (mutedChannels[channelIndex]) return;

    playCell(cell, ctx.currentTime + channelIndex * 0.006);
  });
}

function getRowDuration() {
  return Math.round(60000 / (bpm * 2.5));
}

function getPlayableSequence() {
  return patternSequence
    .map((patternIndex, step) => ({ patternIndex, step }))
    .filter((item) => Number.isInteger(item.patternIndex) && patterns[item.patternIndex]);
}

function getSongExportSequence() {
  const playable = getPlayableSequence();
  if (playable.length > 0) {
    return playable.map((item) => patterns[item.patternIndex]);
  }

  return [patterns[activePatternIndex]];
}

function scheduleSongRender(ctx, sequence) {
  const rowDuration = getRowDuration() / 1000;
  let playhead = 0;

  sequence.forEach((songPattern) => {
    songPattern.cells.forEach((row) => {
      row.forEach((cell, channelIndex) => {
        if (mutedChannels[channelIndex]) return;

        scheduleParsedCell(ctx, parseCell(cell), playhead + channelIndex * 0.006);
      });
      playhead += rowDuration;
    });
  });

  return playhead;
}

function floatTo16BitPcm(input) {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function encodeMp3(audioBuffer) {
  const left = floatTo16BitPcm(audioBuffer.getChannelData(0));
  const right = audioBuffer.numberOfChannels > 1
    ? floatTo16BitPcm(audioBuffer.getChannelData(1))
    : left;
  const encoder = new window.lamejs.Mp3Encoder(2, audioBuffer.sampleRate, 128);
  const chunks = [];
  const blockSize = 1152;

  for (let index = 0; index < left.length; index += blockSize) {
    const encoded = encoder.encodeBuffer(
      left.subarray(index, index + blockSize),
      right.subarray(index, index + blockSize),
    );
    if (encoded.length > 0) chunks.push(encoded);
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(finalChunk);

  return new Blob(chunks, { type: "audio/mpeg" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createPocketTrackerProject() {
  normalizeSequence();

  return {
    format: projectFileFormat,
    version: projectFileVersion,
    savedAt: new Date().toISOString(),
    transport: {
      bpm,
      isPatternLooping,
      sequence: patternSequence.filter((item) => Number.isInteger(item)),
    },
    editor: {
      activePatternIndex,
      activeSequenceStep,
      activeRow,
      activeChannel,
      octave,
      selectedSample,
      selectedVolume,
      mutedChannels: [...mutedChannels],
    },
    patterns: patterns.map((item) => ({
      rows: item.cells.length,
      cells: item.cells.map((row) => row.map((cell) => cell)),
    })),
  };
}

function savePocketTrackerProject() {
  const blob = new Blob([`${JSON.stringify(createPocketTrackerProject(), null, 2)}\n`], {
    type: "application/json",
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadBlob(blob, `pocket-tracker-${timestamp}.pockettracker`);
  showCopyStatus("Pocket Tracker file saved.");
}

function sanitizeProjectCell(cell) {
  return typeof cell === "string" ? cell : emptyCell;
}

function sanitizeProjectPattern(item) {
  if (!item || !Array.isArray(item.cells)) {
    throw new Error("Missing pattern cells.");
  }

  const rowCount = Math.min(maxPatternRows, Math.max(minPatternRows, item.cells.length));
  const cells = Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = Array.isArray(item.cells[rowIndex]) ? item.cells[rowIndex] : [];
    return Array.from({ length: 4 }, (_, channel) => sanitizeProjectCell(sourceRow[channel]));
  });

  return { rows: rowCount, cells };
}

function sanitizeProjectData(data) {
  if (!data || data.format !== projectFileFormat || data.version !== projectFileVersion) {
    throw new Error("Unsupported Pocket Tracker file.");
  }

  if (!Array.isArray(data.patterns) || data.patterns.length === 0) {
    throw new Error("Pocket Tracker file has no patterns.");
  }

  const loadedPatterns = data.patterns.map(sanitizeProjectPattern);
  const transport = data.transport ?? {};
  const editor = data.editor ?? {};
  const sequence = Array.isArray(transport.sequence)
    ? transport.sequence
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && loadedPatterns[item])
    : [];

  return {
    patterns: loadedPatterns,
    sequence: sequence.length > 0 ? sequence : [0],
    bpm: Math.min(180, Math.max(80, Number(transport.bpm) || 126)),
    isPatternLooping: transport.isPatternLooping !== false,
    activePatternIndex: Math.min(
      Math.max(Number(editor.activePatternIndex) || 0, 0),
      loadedPatterns.length - 1,
    ),
    activeSequenceStep: Math.max(Number(editor.activeSequenceStep) || 0, 0),
    activeRow: Math.max(Number(editor.activeRow) || 0, 0),
    activeChannel: Math.min(Math.max(Number(editor.activeChannel) || 0, 0), 3),
    octave: Math.min(Math.max(Number(editor.octave) || 3, 1), 6),
    selectedSample: sampleVoices[editor.selectedSample] ? editor.selectedSample : "03",
    selectedVolume: Math.min(Math.max(Number(editor.selectedVolume) || defaultVolume, 0), 64),
    mutedChannels: Array.from({ length: 4 }, (_, index) => Boolean(editor.mutedChannels?.[index])),
  };
}

function loadPocketTrackerProject(data) {
  const loaded = sanitizeProjectData(data);

  stopPlayback();
  cancelCellDrag();
  clearPendingCopy();

  patterns.splice(0, patterns.length, ...loaded.patterns);
  patternSequence.length = 0;
  patternSequence.push(...loaded.sequence, null);
  activePatternIndex = loaded.activePatternIndex;
  activeSequenceStep = Math.min(loaded.activeSequenceStep, patternSequence.length - 2);
  pattern = patterns[activePatternIndex].cells;
  activeRow = Math.min(loaded.activeRow, pattern.length - 1);
  activeChannel = loaded.activeChannel;
  octave = loaded.octave;
  bpm = loaded.bpm;
  selectedSample = loaded.selectedSample;
  selectedVolume = loaded.selectedVolume;
  mutedChannels = loaded.mutedChannels;
  isPatternLooping = loaded.isPatternLooping;
  isDemoLoaded = false;
  isRecording = false;
  nextPatternRows = pattern.length;
  queuedPatternForSequence = null;
  sequenceGhost = null;
  sequenceDrag = null;
  normalizeSequence();
  syncReadouts();
  syncChannelMutes();
  renderPattern();
  renderSequencer();
  showCopyStatus("Pocket Tracker file loaded.");
}

async function loadPocketTrackerFile(file) {
  if (!file) return;

  try {
    loadPocketTrackerProject(JSON.parse(await file.text()));
  } catch (error) {
    console.error(error);
    showCopyStatus("Could not load Pocket Tracker file.");
  } finally {
    projectFileInput.value = "";
  }
}

async function exportSongToMp3() {
  const OfflineEngine = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineEngine) {
    showCopyStatus("MP3 export is not supported in this browser.");
    return;
  }

  if (!window.lamejs?.Mp3Encoder) {
    showCopyStatus("MP3 encoder did not load. Try again online.");
    return;
  }

  const sequence = getSongExportSequence();
  const sampleRate = 44100;
  const rowCount = sequence.reduce((total, songPattern) => total + songPattern.cells.length, 0);
  const tailSeconds = 1;
  const durationSeconds = Math.max(1, (rowCount * getRowDuration()) / 1000 + tailSeconds);
  const exportContext = new OfflineEngine(2, Math.ceil(durationSeconds * sampleRate), sampleRate);
  const originalLabel = exportMp3.textContent;

  exportMp3.disabled = true;
  exportMp3.textContent = "Exporting...";
  showCopyStatus("Rendering MP3...");

  try {
    scheduleSongRender(exportContext, sequence);
    const renderedBuffer = await exportContext.startRendering();
    const blob = encodeMp3(renderedBuffer);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadBlob(blob, `pocket-tracker-${timestamp}.mp3`);
    showCopyStatus("MP3 downloaded.");
  } catch (error) {
    console.error(error);
    showCopyStatus("Could not export MP3.");
  } finally {
    exportMp3.disabled = false;
    exportMp3.textContent = originalLabel;
  }
}

function normalizeSequence() {
  const filled = patternSequence.filter((patternIndex) => (
    Number.isInteger(patternIndex) && patterns[patternIndex]
  ));

  patternSequence.length = 0;
  patternSequence.push(...filled);
  if (patternSequence.length === 0) {
    patternSequence.push(0);
  }

  patternSequence.push(null);
}

function setActivePattern(index, { resetRow = false, sequenceStep = activeSequenceStep } = {}) {
  activePatternIndex = Math.min(Math.max(index, 0), patterns.length - 1);
  activeSequenceStep = sequenceStep;
  pattern = patterns[activePatternIndex].cells;
  if (resetRow) activeRow = 0;
  clampPatternPosition();
}

function findSequenceStepForPattern(patternIndex) {
  const found = patternSequence.findIndex((item) => item === patternIndex);
  return found >= 0 ? found : activeSequenceStep;
}

function advanceSequencedPattern() {
  if (isPatternLooping) {
    activeRow = 0;
    return;
  }

  const playable = getPlayableSequence();
  if (playable.length === 0) {
    activeRow = 0;
    return;
  }

  const currentPlayableIndex = playable.findIndex((item) => item.step === activeSequenceStep);
  const nextPlayable = playable[(currentPlayableIndex + 1 + playable.length) % playable.length];
  setActivePattern(nextPlayable.patternIndex, {
    resetRow: true,
    sequenceStep: nextPlayable.step,
  });
}

function schedulePlaybackTick() {
  clearTimeout(timer);
  if (!isPlaying) return;

  timer = setTimeout(() => {
    if (activeRow >= pattern.length - 1) {
      advanceSequencedPattern();
    } else {
      activeRow += 1;
    }
    syncReadouts();
    renderPattern();
    renderSequencer();
    playRow(activeRow);
    schedulePlaybackTick();
  }, getRowDuration());
}

function startPlayback(fromBeginning = false) {
  clearTimeout(timer);
  isPlaying = true;
  if (fromBeginning) {
    const playable = isPatternLooping ? [] : getPlayableSequence();
    if (!isPatternLooping && playable.length > 0) {
      setActivePattern(playable[0].patternIndex, {
        resetRow: true,
        sequenceStep: playable[0].step,
      });
    } else {
      activeRow = 0;
    }
  }

  document.body.classList.add("playing");
  playButton.textContent = "Stop";
  syncReadouts();
  renderPattern();
  renderSequencer();
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

  const visibleRows = getVisiblePatternRows();
  const firstRow = getFirstVisibleRow();
  patternGrid.style.gridTemplateRows = `repeat(${visibleRows}, minmax(${minPatternRowHeight}px, 1fr))`;

  for (let offset = 0; offset < visibleRows; offset += 1) {
    const row = firstRow + offset;
    const rowCells = pattern[row] ?? Array(4).fill(emptyCell);
    const rowEl = document.createElement("div");
    rowEl.className = `pattern-row${row === activeRow ? " active" : ""}`;
    rowEl.dataset.row = row;

    const rowNum = document.createElement("span");
    rowNum.className = "row-num";
    rowNum.textContent = formatRow(row);
    rowEl.append(rowNum);

    rowCells.forEach((cell, channel) => {
      const span = document.createElement("span");
      const isSelected = row === activeRow && channel === activeChannel;
      const isDragSource = draggedCell?.fromRow === row && draggedCell?.fromChannel === channel;
      const isDragTarget = draggedCell?.targetRow === row && draggedCell?.targetChannel === channel;
      const isInCopiedRange = isCellInSelectedRange(row, channel);
      span.className = [
        "pattern-cell",
        isSelected ? "selected" : "",
        isDragSource ? "drag-source" : "",
        isDragTarget ? "drag-target" : "",
        isInCopiedRange ? "range-selected" : "",
        mutedChannels[channel] ? "muted" : "",
      ].filter(Boolean).join(" ");
      span.dataset.channel = channel;
      span.dataset.row = row;
      span.textContent = cell;
      span.addEventListener("click", (event) => {
        event.stopPropagation();
        if (patternDidSwipe || patternHandledTap) return;
        handlePatternCellTap(row, channel);
      });
      rowEl.append(span);
    });

    rowEl.addEventListener("click", () => {
      if (patternDidSwipe || patternHandledTap) return;
      handlePatternCellTap(row, activeChannel);
    });

    patternGrid.append(rowEl);
  }
}

function renderSequencer() {
  normalizeSequence();
  sequenceLane.innerHTML = "";
  patternBank.innerHTML = "";
  patternBank.classList.toggle("remove-target", Boolean(sequenceDrag?.removeTarget));
  patternLoopToggle.hidden = patterns.length <= 1;
  patternLoopToggle.classList.toggle("looping", isPatternLooping);
  patternLoopToggle.setAttribute("aria-pressed", isPatternLooping.toString());
  patternLoopToggle.setAttribute("aria-label", isPatternLooping
    ? "Loop current pattern"
    : "Play full song sequence");

  patternSequence.forEach((patternIndex, step) => {
    const isFilled = Number.isInteger(patternIndex);
    if (!isFilled) {
      const dropZone = document.createElement("div");
      dropZone.className = [
        "sequence-end-drop",
        sequenceDrag?.targetStep === step ? "insert-target" : "",
      ].filter(Boolean).join(" ");
      dropZone.dataset.step = step;
      sequenceLane.append(dropZone);
      return;
    }

    const slot = document.createElement("button");
    slot.className = [
      "sequence-slot",
      "filled",
      step === activeSequenceStep ? "active" : "",
      sequenceDrag?.targetStep === step ? "drop-target" : "",
      sequenceDrag?.targetStep === step ? "insert-target" : "",
    ].filter(Boolean).join(" ");
    slot.type = "button";
    slot.dataset.step = step;
    slot.innerHTML = `<span>${(step + 1).toString().padStart(2, "0")}</span><strong>PATTERN ${(patternIndex + 1).toString().padStart(2, "0")}</strong>`;
    slot.setAttribute("aria-label", `Sequence step ${step + 1}, pattern ${patternIndex + 1}`);
    sequenceLane.append(slot);
  });

  patterns.forEach((item, index) => {
    const pad = document.createElement("button");
    pad.className = [
      "bank-pattern",
      index === activePatternIndex ? "active" : "",
      index === queuedPatternForSequence ? "queued" : "",
    ].filter(Boolean).join(" ");
    pad.type = "button";
    pad.dataset.pattern = index;
    pad.innerHTML = `<strong>PATTERN ${(index + 1).toString().padStart(2, "0")}</strong><span>${item.cells.length}</span>`;
    pad.setAttribute("aria-label", `Pattern ${index + 1}`);
    patternBank.append(pad);
  });
  updateScrollRails();
}

function updateScrollRail(element, prefix) {
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  const trackHeight = Math.max(1, element.clientHeight - 12);
  const thumbSize = maxScroll > 0
    ? Math.max(34, Math.round((element.clientHeight / element.scrollHeight) * trackHeight))
    : 0;
  const thumbTravel = Math.max(0, trackHeight - thumbSize);
  const thumbTop = 6 + (maxScroll > 0 ? (element.scrollTop / maxScroll) * thumbTravel : 0);

  element.style.setProperty(`--${prefix}-scroll-size`, `${thumbSize}px`);
  element.style.setProperty(`--${prefix}-scroll-top`, `${thumbTop}px`);
}

function updateScrollRails() {
  updateScrollRail(sequenceLane, "sequence");
  updateScrollRail(patternBank, "bank");
}

function getRangeBounds(startCell = selectionStartCell, endCell = selectionEndCell) {
  if (!startCell || !endCell) return null;

  return {
    channel: startCell.channel,
    startRow: Math.min(startCell.row, endCell.row),
    endRow: Math.max(startCell.row, endCell.row),
  };
}

function isCellInSelectedRange(row, channel) {
  const bounds = getRangeBounds();
  if (!bounds || channel !== bounds.channel) return false;

  return row >= bounds.startRow && row <= bounds.endRow;
}

function updateCopyStatus() {
  copyStatus.hidden = !rangeStatusMessage && !pastePending;
  copyStatusText.textContent = rangeStatusMessage;
}

function showCopyStatus(message) {
  rangeStatusMessage = message;
  updateCopyStatus();
}

function clearPendingCopy() {
  isSelectingRange = false;
  isRangeSelectionArmed = false;
  didMoveRangeSelection = false;
  selectionStartCell = null;
  selectionEndCell = null;
  selectionAnchorX = 0;
  pendingCopiedBlock = null;
  pastePending = false;
  rangeStatusMessage = "";
  cellDragFirstVisibleRow = null;
  lastCellDragScrollAt = 0;
  updateCopyStatus();
  renderPattern();
}

function isDoubleTapRangeGesture(row, channel) {
  const now = Date.now();
  const matchesLastCell = (
    lastGridTapCell?.row === row &&
    lastGridTapCell?.channel === channel
  );

  return matchesLastCell && now - lastGridTapAt <= rangeSelectTapWindow;
}

function beginRangeSelection(row, channel, anchorX = patternTouchStartX) {
  window.clearTimeout(cellDragTimer);
  isSelectingRange = true;
  isRangeSelectionArmed = false;
  didMoveRangeSelection = false;
  selectionStartCell = { row, channel };
  selectionEndCell = { row, channel };
  selectionAnchorX = anchorX;
  pendingCopiedBlock = null;
  pastePending = false;
  rangeStatusMessage = "";
  patternDidSwipe = true;
  patternHandledTap = true;
  lastCellDragScrollAt = 0;
  cellDragFirstVisibleRow = getFirstVisibleRow();
  activeRow = row;
  activeChannel = channel;
  syncReadouts();
  updateCopyStatus();
  renderPattern();
}

function updateRangeSelection(clientY) {
  if (!isSelectingRange || !selectionStartCell) return;

  const gridRect = patternGrid.getBoundingClientRect();
  const now = window.performance.now();
  const canAutoScroll = now - lastCellDragScrollAt >= cellDragAutoScrollInterval;
  if (canAutoScroll && clientY < gridRect.top + cellDragAutoScrollEdge) {
    cellDragFirstVisibleRow = Math.max(0, getFirstVisibleRow() - 1);
    renderPattern();
    lastCellDragScrollAt = now;
  } else if (canAutoScroll && clientY > gridRect.bottom - cellDragAutoScrollEdge) {
    const maxFirstRow = Math.max(0, pattern.length - getVisiblePatternRows());
    cellDragFirstVisibleRow = Math.min(maxFirstRow, getFirstVisibleRow() + 1);
    renderPattern();
    lastCellDragScrollAt = now;
  }

  const target = getPatternCellFromPoint(selectionAnchorX, clientY);
  if (!target) return;

  selectionEndCell = {
    row: target.row,
    channel: selectionStartCell.channel,
  };
  didMoveRangeSelection = didMoveRangeSelection || target.row !== selectionStartCell.row;
  activeRow = target.row;
  activeChannel = selectionStartCell.channel;
  syncReadouts();
  renderPattern();
}

function armRangeSelection() {
  if (!selectionStartCell || !selectionEndCell) return;

  isSelectingRange = false;
  isRangeSelectionArmed = true;
  didMoveRangeSelection = false;
  cellDragFirstVisibleRow = null;
  lastCellDragScrollAt = 0;
  showCopyStatus("Selection ready. Touch and drag to choose rows.");
  renderPattern();
}

function finishRangeSelection({ armIfSingleCell = false } = {}) {
  if (!isSelectingRange) return;

  const bounds = getRangeBounds();
  isSelectingRange = false;
  if (!bounds) {
    clearPendingCopy();
    return;
  }

  if (armIfSingleCell && !didMoveRangeSelection && bounds.startRow === bounds.endRow) {
    armRangeSelection();
    return;
  }

  const values = [];
  for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
    values.push(pattern[row][bounds.channel]);
  }

  pendingCopiedBlock = {
    sourceChannel: bounds.channel,
    startRow: bounds.startRow,
    endRow: bounds.endRow,
    values,
  };
  pastePending = true;
  isRangeSelectionArmed = false;
  cellDragFirstVisibleRow = null;
  lastCellDragScrollAt = 0;
  showCopyStatus(
    `Copied ${values.length} ${values.length === 1 ? "row" : "rows"} from CH ${bounds.channel + 1}. Tap destination to paste.`,
  );
  renderPattern();
}

function pasteCopiedBlock(row, channel) {
  if (!pastePending || !pendingCopiedBlock) return false;

  const pasteEndRow = row + pendingCopiedBlock.values.length - 1;
  if (pasteEndRow >= pattern.length) {
    showCopyStatus("Not enough rows to paste here.");
    return true;
  }

  pendingCopiedBlock.values.forEach((value, index) => {
    pattern[row + index][channel] = value;
  });
  activeRow = row;
  activeChannel = channel;
  selectionStartCell = null;
  selectionEndCell = null;
  selectionAnchorX = 0;
  pendingCopiedBlock = null;
  pastePending = false;
  isRangeSelectionArmed = false;
  didMoveRangeSelection = false;
  rangeStatusMessage = "";
  syncReadouts();
  updateCopyStatus();
  renderPattern();
  return true;
}

function rememberGridTap(row, channel) {
  lastGridTapAt = Date.now();
  lastGridTapCell = { row, channel };
}

function handlePatternCellTap(row, channel) {
  if (pasteCopiedBlock(row, channel)) {
    patternHandledTap = true;
    return;
  }

  selectPatternCell(row, channel);
  rememberGridTap(row, channel);
}

function syncChannelMutes() {
  channelHeaderButtons.forEach((button, index) => {
    const muted = mutedChannels[index];
    button.classList.toggle("muted", muted);
    button.setAttribute("aria-pressed", muted.toString());
    button.setAttribute("aria-label", `${muted ? "Unmute" : "Mute"} channel ${index + 1}`);
  });
}

function scrollPaneBy(element, deltaY) {
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  if (maxScroll <= 0) return false;

  const nextScrollTop = Math.min(maxScroll, Math.max(0, element.scrollTop + deltaY));
  if (nextScrollTop === element.scrollTop) return false;

  element.scrollTop = nextScrollTop;
  updateScrollRails();
  return true;
}

function getPatternCellFromPoint(clientX, clientY) {
  const gridRect = patternGrid.getBoundingClientRect();
  if (
    clientX < gridRect.left ||
    clientX > gridRect.right ||
    clientY < gridRect.top ||
    clientY > gridRect.bottom
  ) {
    return null;
  }

  const firstRow = getFirstVisibleRow();
  const visibleRows = getVisiblePatternRows();
  const rowOffset = Math.min(
    visibleRows - 1,
    Math.max(0, Math.floor(((clientY - gridRect.top) / gridRect.height) * visibleRows)),
  );
  const row = Math.min(pattern.length - 1, firstRow + rowOffset);
  const rowNumberWidth = patternGrid.querySelector(".row-num")?.getBoundingClientRect().width ?? 30;
  const channelAreaWidth = gridRect.width - rowNumberWidth;
  const channelX = clientX - gridRect.left - rowNumberWidth;
  const channel = channelX < 0
    ? activeChannel
    : Math.min(3, Math.max(0, Math.floor((channelX / channelAreaWidth) * 4)));

  return { row, channel };
}

function getVisiblePatternRows() {
  const fittedRows = patternGrid.clientHeight
    ? Math.floor(patternGrid.clientHeight / minPatternRowHeight)
    : maxVisiblePatternRows;

  return Math.min(
    pattern.length,
    maxVisiblePatternRows,
    Math.max(minVisiblePatternRows, fittedRows),
  );
}

function getFirstVisibleRow() {
  const visibleRows = getVisiblePatternRows();
  if ((isDraggingCell || isSelectingRange) && cellDragFirstVisibleRow !== null) {
    return Math.min(
      Math.max(cellDragFirstVisibleRow, 0),
      Math.max(0, pattern.length - visibleRows),
    );
  }

  const halfWindow = Math.floor(visibleRows / 2);
  return Math.min(
    Math.max(activeRow - halfWindow, 0),
    Math.max(0, pattern.length - visibleRows),
  );
}

function selectPatternCellFromPoint(clientX, clientY) {
  const cell = getPatternCellFromPoint(clientX, clientY);
  if (!cell) return false;

  handlePatternCellTap(cell.row, cell.channel);
  return true;
}

function getSequenceStepFromPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY)?.closest(".sequence-slot, .sequence-end-drop");
  if (!target || !sequenceLane.contains(target)) return null;

  return Number(target.dataset.step);
}

function isPatternBankPoint(clientX, clientY) {
  const rect = patternBank.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function getPaneScrollTarget(event) {
  const sequenceRect = sequenceLane.getBoundingClientRect();
  const bankRect = patternBank.getBoundingClientRect();
  const inSequence = (
    event.clientX >= sequenceRect.left &&
    event.clientX <= sequenceRect.right &&
    event.clientY >= sequenceRect.top &&
    event.clientY <= sequenceRect.bottom
  );
  const inBank = (
    event.clientX >= bankRect.left &&
    event.clientX <= bankRect.right &&
    event.clientY >= bankRect.top &&
    event.clientY <= bankRect.bottom
  );

  if (
    inSequence &&
    event.clientX < sequenceRect.left + 72 &&
    sequenceLane.scrollHeight > sequenceLane.clientHeight
  ) {
    return sequenceLane;
  }

  if (
    inBank &&
    event.clientX > bankRect.right - 68 &&
    patternBank.scrollHeight > patternBank.clientHeight
  ) {
    return patternBank;
  }

  return null;
}

function beginPaneScroll(event) {
  const element = getPaneScrollTarget(event);
  if (!element) return false;

  paneScrollDrag = {
    element,
    startY: event.clientY,
    startScrollTop: element.scrollTop,
  };
  suppressPaneClick = true;
  event.preventDefault();
  patternControls.setPointerCapture(event.pointerId);
  return true;
}

function beginPendingPaneGesture(event, bankPad, sequenceSlot) {
  const element = getPaneScrollTarget(event);
  if (!element) return false;

  pendingPaneGesture = {
    element,
    bankPad,
    sequenceSlot,
    startX: event.clientX,
    startY: event.clientY,
    startScrollTop: element.scrollTop,
  };
  suppressPaneClick = true;
  event.preventDefault();
  patternControls.setPointerCapture(event.pointerId);
  return true;
}

function startPendingPaneScroll() {
  if (!pendingPaneGesture) return;

  paneScrollDrag = {
    element: pendingPaneGesture.element,
    startY: pendingPaneGesture.startY,
    startScrollTop: pendingPaneGesture.startScrollTop,
  };
  pendingPaneGesture = null;
}

function startPendingSequenceDrag(clientX, clientY) {
  if (!pendingPaneGesture) return false;

  if (pendingPaneGesture.bankPad) {
    beginSequenceDrag(Number(pendingPaneGesture.bankPad.dataset.pattern), null, clientX, clientY);
  } else if (pendingPaneGesture.sequenceSlot) {
    const sourceStep = Number(pendingPaneGesture.sequenceSlot.dataset.step);
    beginSequenceDrag(patternSequence[sourceStep], sourceStep, clientX, clientY);
  } else {
    return false;
  }

  pendingPaneGesture = null;
  suppressPaneClick = false;
  return true;
}

function updatePendingPaneGesture(event) {
  if (!pendingPaneGesture) return false;

  const dx = event.clientX - pendingPaneGesture.startX;
  const dy = event.clientY - pendingPaneGesture.startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < 8) return true;

  if (absX > absY && startPendingSequenceDrag(event.clientX, event.clientY)) {
    updateSequenceDrag(event.clientX, event.clientY);
    return true;
  }

  startPendingPaneScroll();
  updatePaneScroll(event.clientY);
  return true;
}

function updatePaneScroll(clientY) {
  if (!paneScrollDrag) return;

  paneScrollDrag.element.scrollTop = paneScrollDrag.startScrollTop - (clientY - paneScrollDrag.startY);
  updateScrollRails();
}

function finishPaneScroll() {
  paneScrollDrag = null;
  pendingPaneGesture = null;
  window.setTimeout(() => {
    suppressPaneClick = false;
  }, 0);
}

function syncActiveSequenceAfterEdit() {
  const currentStepPattern = patternSequence[activeSequenceStep];
  if (Number.isInteger(currentStepPattern) && patterns[currentStepPattern]) {
    return;
  }

  const matchingStep = patternSequence.findIndex((item) => item === activePatternIndex);
  if (matchingStep >= 0) {
    activeSequenceStep = matchingStep;
    return;
  }

  const playable = getPlayableSequence();
  if (playable.length > 0) {
    activeSequenceStep = playable[0].step;
  }
}

function moveSequenceGhost(clientX, clientY) {
  if (!sequenceGhost) return;

  sequenceGhost.style.left = `${clientX}px`;
  sequenceGhost.style.top = `${clientY}px`;
}

function showSequenceGhost(patternIndex, clientX, clientY) {
  sequenceGhost?.remove();
  sequenceGhost = document.createElement("div");
  sequenceGhost.className = "sequence-ghost";
  sequenceGhost.textContent = `PATTERN ${(patternIndex + 1).toString().padStart(2, "0")}`;
  document.body.append(sequenceGhost);
  moveSequenceGhost(clientX, clientY);
}

function hideSequenceGhost() {
  sequenceGhost?.remove();
  sequenceGhost = null;
}

function beginSequenceDrag(patternIndex, sourceStep = null, clientX = 0, clientY = 0) {
  if (!Number.isInteger(patternIndex) || !patterns[patternIndex]) return;

  sequenceDrag = {
    patternIndex,
    sourceStep,
    targetStep: sourceStep,
    removeTarget: false,
  };
  document.body.classList.add("sequencing-drag");
  showSequenceGhost(patternIndex, clientX, clientY);
  renderSequencer();
}

function updateSequenceDrag(clientX, clientY) {
  if (!sequenceDrag) return;
  moveSequenceGhost(clientX, clientY);

  const laneRect = sequenceLane.getBoundingClientRect();
  if (clientY < laneRect.top + sequenceDragAutoScrollEdge) {
    sequenceLane.scrollTop -= sequenceDragAutoScrollAmount;
    updateScrollRails();
  } else if (clientY > laneRect.bottom - sequenceDragAutoScrollEdge) {
    sequenceLane.scrollTop += sequenceDragAutoScrollAmount;
    updateScrollRails();
  }

  const removeTarget = sequenceDrag.sourceStep !== null && isPatternBankPoint(clientX, clientY);
  const targetStep = getSequenceStepFromPoint(clientX, clientY);
  if (targetStep === null && !removeTarget && !sequenceDrag.removeTarget) return;
  if (targetStep === sequenceDrag.targetStep && removeTarget === sequenceDrag.removeTarget) return;

  sequenceDrag.targetStep = targetStep;
  sequenceDrag.removeTarget = removeTarget;
  renderSequencer();
}

function finishSequenceDrag() {
  if (!sequenceDrag) return;

  const { patternIndex, sourceStep, targetStep } = sequenceDrag;
  if (sequenceDrag.removeTarget && sourceStep !== null) {
    patternSequence.splice(sourceStep, 1);
    normalizeSequence();
    syncActiveSequenceAfterEdit();
  } else if (targetStep !== null) {
    let insertStep = targetStep;
    if (sourceStep !== null) {
      patternSequence.splice(sourceStep, 1);
      if (sourceStep < insertStep) {
        insertStep -= 1;
      }
    }
    patternSequence.splice(insertStep, 0, patternIndex);
    activeSequenceStep = insertStep;
    setActivePattern(patternIndex, { sequenceStep: insertStep });
    normalizeSequence();
  } else if (sourceStep === null) {
    queuedPatternForSequence = patternIndex;
    switchPattern(patternIndex);
    sequenceDrag = null;
    document.body.classList.remove("sequencing-drag");
    hideSequenceGhost();
    renderSequencer();
    return;
  }

  sequenceDrag = null;
  document.body.classList.remove("sequencing-drag");
  hideSequenceGhost();
  syncReadouts();
  renderPattern();
  renderSequencer();
}

function cancelSequenceDrag() {
  sequenceDrag = null;
  queuedPatternForSequence = null;
  document.body.classList.remove("sequencing-drag");
  hideSequenceGhost();
  renderSequencer();
}

function beginCellDrag(row, channel) {
  const value = pattern[row]?.[channel];
  if (!value || value === emptyCell) return;

  draggedCell = {
    fromRow: row,
    fromChannel: channel,
    targetRow: row,
    targetChannel: channel,
    value,
  };
  isDraggingCell = true;
  patternDidSwipe = true;
  patternHandledTap = true;
  lastCellDragScrollAt = 0;
  cellDragFirstVisibleRow = getFirstVisibleRow();
  activeRow = row;
  activeChannel = channel;
  document.body.classList.add("cell-dragging");
  syncReadouts();
  renderPattern();
}

function updateCellDrag(clientX, clientY) {
  if (!isDraggingCell || !draggedCell) return;

  const gridRect = patternGrid.getBoundingClientRect();
  const now = window.performance.now();
  const canAutoScroll = now - lastCellDragScrollAt >= cellDragAutoScrollInterval;
  if (canAutoScroll && clientY < gridRect.top + cellDragAutoScrollEdge) {
    cellDragFirstVisibleRow = Math.max(0, getFirstVisibleRow() - 1);
    renderPattern();
    lastCellDragScrollAt = now;
  } else if (canAutoScroll && clientY > gridRect.bottom - cellDragAutoScrollEdge) {
    const maxFirstRow = Math.max(0, pattern.length - getVisiblePatternRows());
    cellDragFirstVisibleRow = Math.min(maxFirstRow, getFirstVisibleRow() + 1);
    renderPattern();
    lastCellDragScrollAt = now;
  }

  const target = getPatternCellFromPoint(clientX, clientY);
  if (!target) return;

  draggedCell.targetRow = target.row;
  draggedCell.targetChannel = target.channel;
  activeRow = target.row;
  activeChannel = target.channel;
  syncReadouts();
  renderPattern();
}

function finishCellDrag() {
  if (!isDraggingCell || !draggedCell) return;

  const { fromRow, fromChannel, targetRow, targetChannel, value } = draggedCell;
  const targetValue = pattern[targetRow][targetChannel];
  if (fromRow !== targetRow || fromChannel !== targetChannel) {
    pattern[targetRow][targetChannel] = value;
    pattern[fromRow][fromChannel] = targetValue === emptyCell ? emptyCell : targetValue;
  }

  activeRow = targetRow;
  activeChannel = targetChannel;
  draggedCell = null;
  isDraggingCell = false;
  lastCellDragScrollAt = 0;
  cellDragFirstVisibleRow = null;
  document.body.classList.remove("cell-dragging");
  syncReadouts();
  renderPattern();
}

function cancelCellDrag() {
  window.clearTimeout(cellDragTimer);
  if (!isDraggingCell) return;

  draggedCell = null;
  isDraggingCell = false;
  lastCellDragScrollAt = 0;
  cellDragFirstVisibleRow = null;
  document.body.classList.remove("cell-dragging");
  syncReadouts();
  renderPattern();
}

function selectPatternCell(row, channel) {
  activeRow = row;
  activeChannel = channel;
  clampPatternPosition();
  syncReadouts();
  renderPattern();
}

function moveRows(delta) {
  activeRow = Math.min(Math.max(activeRow + delta, 0), pattern.length - 1);
  syncReadouts();
  renderPattern();
}

function moveChannels(delta) {
  activeChannel = Math.min(Math.max(activeChannel + delta, 0), 3);
  syncReadouts();
  renderPattern();
}

function syncReadouts() {
  clampPatternPosition();
  const parsed = parseCell(pattern[activeRow][activeChannel]);
  if (parsed) {
    selectedSample = parsed.sample;
    selectedVolume = parsed.volume;
  }

  bpmReadout.textContent = bpm.toString();
  bpmSlider.value = bpm.toString();
  patternReadout.textContent = (activePatternIndex + 1).toString().padStart(2, "0");
  patternLabel.textContent = `Pattern ${(activePatternIndex + 1).toString().padStart(2, "0")}`;
  rowsReadout.textContent = pattern.length.toString();
  if (!rowsMenu.hidden) {
    renderRowsMenu();
  }
  rowReadout.textContent = formatRow(activeRow);
  channelReadout.textContent = (activeChannel + 1).toString().padStart(2, "0");
  octaveReadout.textContent = octave.toString().padStart(2, "0");
  volumeSlider.value = selectedVolume.toString();
  volumeReadout.textContent = selectedVolume.toString().padStart(2, "0");
  document.querySelectorAll(".sample-pad").forEach((item) => item.classList.remove("active"));
  document.querySelector(`.sample-pad[data-code="${selectedSample}"]`)?.classList.add("active");
  document.querySelectorAll(".piano-keyboard button").forEach((item) => {
    item.classList.toggle("active", item.dataset.note === armedNote);
  });
  syncRecordButton();
}

function syncRecordButton() {
  recordButton.classList.toggle("recording", isRecording);
  recordButton.setAttribute("aria-pressed", isRecording.toString());
  recordButton.setAttribute("aria-label", isRecording ? "Recording on" : "Recording off");
}

function writeNoteToActiveCell(note) {
  const trackerNote = noteToTrackerNote(note);
  pattern[activeRow][activeChannel] = makeCell(trackerNote);
  playCell(pattern[activeRow][activeChannel]);
}

function previewNote(note) {
  playCell(makeCell(noteToTrackerNote(note)));
}

function setActiveCellNote(note) {
  armedNote = note;
  if (isRecording) {
    writeNoteToActiveCell(note);
    renderPattern();
  } else {
    previewNote(note);
  }
  syncReadouts();
}

function updateActiveCellSample(sample) {
  selectedSample = sample;
  const parsed = parseCell(pattern[activeRow][activeChannel]);
  if (parsed) {
    pattern[activeRow][activeChannel] = makeCell(parsed.note, sample, selectedVolume);
  }
  syncReadouts();
  renderPattern();
}

function selectSample(sample) {
  selectedSample = sample;
  syncReadouts();
}

function switchPattern(index) {
  if (pastePending || isSelectingRange) {
    clearPendingCopy();
  }

  const nextIndex = Math.min(Math.max(index, 0), patterns.length - 1);
  setActivePattern(nextIndex, {
    resetRow: true,
    sequenceStep: findSequenceStepForPattern(nextIndex),
  });
  activeRow = 0;
  activeChannel = 0;
  syncReadouts();
  renderPattern();
  renderSequencer();
}

function addPattern() {
  patterns.push(createPattern(nextPatternRows));
  normalizeSequence();
  switchPattern(patterns.length - 1);
}

function resizePattern(rowCount) {
  if (pastePending || isSelectingRange) {
    clearPendingCopy();
  }

  const nextRows = Math.min(maxPatternRows, Math.max(minPatternRows, rowCount));
  nextPatternRows = nextRows;
  const activePattern = patterns[activePatternIndex];
  if (nextRows === activePattern.cells.length) return;

  if (nextRows > activePattern.cells.length) {
    while (activePattern.cells.length < nextRows) {
      activePattern.cells.push(Array(4).fill(emptyCell));
    }
  } else {
    activePattern.cells.length = nextRows;
  }

  activePattern.rows = nextRows;
  pattern = activePattern.cells;
  clampPatternPosition();
  syncReadouts();
  renderPattern();
  renderSequencer();
}

function clearPattern() {
  pattern.forEach((row) => row.fill(emptyCell));
}

function resetComposition() {
  clearPattern();
  activeRow = 0;
  activeChannel = 0;
  isDemoLoaded = false;
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
    pattern[row][3] = makeCell(melody[row % melody.length], "04", 52);
    if (row % 4 === 0) pattern[row][0] = makeCell("C-2", "01", 56);
    if (row % 4 === 2) pattern[row][1] = makeCell("D-2", "02", 46);
    if (row % 2 === 0) pattern[row][2] = makeCell(bass[(row / 2) % bass.length], "03", 44);
  }

  activeRow = 0;
  activeChannel = 3;
  isDemoLoaded = true;
  selectSample("04");
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

function togglePatternControls() {
  patternControls.hidden = !patternControls.hidden;
  const label = patternControls.hidden ? "Open pattern controls" : "Close pattern controls";
  patternToggleButton.setAttribute("aria-label", label);
  patternTitleToggle.setAttribute("aria-label", label);
  if (patternControls.hidden) {
    rowsMenu.hidden = true;
  }
  renderPattern();
  renderSequencer();
}

function renderRowsMenu() {
  rowsMenu.innerHTML = "";
  for (let rows = minPatternRows; rows <= maxPatternRows; rows += rowStep) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = `rows-option${rows === pattern.length ? " active" : ""}`;
    option.dataset.rows = rows;
    option.textContent = rows.toString();
    option.setAttribute("aria-label", `${rows} rows`);
    rowsMenu.append(option);
  }
}

function beginSampleRackDrag(event) {
  if (sampleRack.scrollWidth <= sampleRack.clientWidth) return;

  sampleRackDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startScrollLeft: sampleRack.scrollLeft,
    didMove: false,
    didCapture: false,
  };
}

function updateSampleRackDrag(event) {
  if (!sampleRackDrag || event.pointerId !== sampleRackDrag.pointerId) return;

  const deltaX = event.clientX - sampleRackDrag.startX;
  if (Math.abs(deltaX) > 5) {
    if (!sampleRackDrag.didCapture) {
      sampleRack.setPointerCapture(event.pointerId);
      sampleRackDrag.didCapture = true;
    }
    sampleRackDrag.didMove = true;
    event.preventDefault();
    sampleRack.scrollLeft = sampleRackDrag.startScrollLeft - deltaX;
  }
}

function finishSampleRackDrag(event) {
  if (!sampleRackDrag || event.pointerId !== sampleRackDrag.pointerId) return;

  if (sampleRackDrag.didCapture && sampleRack.hasPointerCapture(event.pointerId)) {
    sampleRack.releasePointerCapture(event.pointerId);
  }
  if (sampleRackDrag.didMove) {
    suppressSampleRackClickUntil = Date.now() + 180;
  }
  sampleRackDrag = null;
}

sampleRack.addEventListener("pointerdown", beginSampleRackDrag);
sampleRack.addEventListener("pointermove", updateSampleRackDrag);
sampleRack.addEventListener("pointerup", finishSampleRackDrag);
sampleRack.addEventListener("pointercancel", finishSampleRackDrag);

sampleDeck.addEventListener("click", (event) => {
  if (Date.now() < suppressSampleRackClickUntil) {
    event.preventDefault();
    return;
  }

  const pad = event.target.closest(".sample-pad");
  if (!pad) return;

  updateActiveCellSample(pad.dataset.code);
  playCell(makeCell(sampleVoices[selectedSample].preview, selectedSample));
});

patternAdd.addEventListener("click", addPattern);
saveProject.addEventListener("click", savePocketTrackerProject);
loadProject.addEventListener("click", () => projectFileInput.click());
projectFileInput.addEventListener("change", () => {
  loadPocketTrackerFile(projectFileInput.files?.[0]);
});
exportMp3.addEventListener("click", exportSongToMp3);
rowsSelect.addEventListener("click", () => {
  renderRowsMenu();
  rowsMenu.hidden = !rowsMenu.hidden;
});
rowsMenu.addEventListener("click", (event) => {
  const option = event.target.closest(".rows-option");
  if (!option) return;

  resizePattern(Number(option.dataset.rows));
  rowsMenu.hidden = true;
});
patternLoopToggle.addEventListener("click", () => {
  isPatternLooping = !isPatternLooping;
  renderSequencer();
});

channelHeaderButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const channel = Number(button.dataset.channel);
    mutedChannels[channel] = !mutedChannels[channel];
    syncChannelMutes();
    renderPattern();
  });
});

patternToggleButton.addEventListener("click", togglePatternControls);
patternTitleToggle.addEventListener("click", togglePatternControls);
patternTitleToggle.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  togglePatternControls();
});

patternBank.addEventListener("click", (event) => {
  if (sequenceDrag || suppressPaneClick) return;

  const pad = event.target.closest(".bank-pattern");
  if (!pad) return;

  queuedPatternForSequence = Number(pad.dataset.pattern);
  switchPattern(queuedPatternForSequence);
  renderSequencer();
});

sequenceLane.addEventListener("click", (event) => {
  if (sequenceDrag || suppressPaneClick) return;

  const slot = event.target.closest(".sequence-slot, .sequence-end-drop");
  if (!slot) return;

  const patternIndex = patternSequence[Number(slot.dataset.step)];
  if (Number.isInteger(queuedPatternForSequence)) {
    const insertStep = Number(slot.dataset.step);
    patternSequence.splice(insertStep, 0, queuedPatternForSequence);
    activeSequenceStep = insertStep;
    normalizeSequence();
    setActivePattern(queuedPatternForSequence, {
      resetRow: true,
      sequenceStep: activeSequenceStep,
    });
    queuedPatternForSequence = null;
    syncReadouts();
    renderPattern();
    renderSequencer();
    return;
  }

  if (Number.isInteger(patternIndex)) {
    setActivePattern(patternIndex, {
      resetRow: true,
      sequenceStep: Number(slot.dataset.step),
    });
    activeChannel = 0;
    syncReadouts();
    renderPattern();
    renderSequencer();
  }
});

patternControls.addEventListener("pointerdown", (event) => {
  const bankPad = event.target.closest(".bank-pattern");
  const sequenceSlot = event.target.closest(".sequence-slot.filled");

  if (beginPendingPaneGesture(event, bankPad, sequenceSlot)) return;

  if (!bankPad && !sequenceSlot) return;
  const sequenceRect = sequenceLane.getBoundingClientRect();
  const bankRect = patternBank.getBoundingClientRect();
  const isSequenceScrollGutter = (
    sequenceLane.scrollHeight > sequenceLane.clientHeight &&
    event.clientX < sequenceRect.left + 72
  );
  const isBankScrollGutter = (
    patternBank.scrollHeight > patternBank.clientHeight &&
    event.clientX > bankRect.right - 68
  );
  if (isSequenceScrollGutter || isBankScrollGutter) return;

  if (bankPad) {
    beginSequenceDrag(Number(bankPad.dataset.pattern), null, event.clientX, event.clientY);
  } else {
    event.preventDefault();
    const sourceStep = Number(sequenceSlot.dataset.step);
    beginSequenceDrag(patternSequence[sourceStep], sourceStep, event.clientX, event.clientY);
  }
  patternControls.setPointerCapture(event.pointerId);
});

patternControls.addEventListener("pointermove", (event) => {
  if (pendingPaneGesture && patternControls.hasPointerCapture(event.pointerId)) {
    updatePendingPaneGesture(event);
    return;
  }

  if (paneScrollDrag && patternControls.hasPointerCapture(event.pointerId)) {
    updatePaneScroll(event.clientY);
    return;
  }

  if (!sequenceDrag || !patternControls.hasPointerCapture(event.pointerId)) return;

  updateSequenceDrag(event.clientX, event.clientY);
});

patternControls.addEventListener("pointerup", (event) => {
  if (pendingPaneGesture && patternControls.hasPointerCapture(event.pointerId)) {
    finishPaneScroll();
    patternControls.releasePointerCapture(event.pointerId);
    return;
  }

  if (paneScrollDrag && patternControls.hasPointerCapture(event.pointerId)) {
    updatePaneScroll(event.clientY);
    finishPaneScroll();
    patternControls.releasePointerCapture(event.pointerId);
    return;
  }

  if (!sequenceDrag || !patternControls.hasPointerCapture(event.pointerId)) return;

  updateSequenceDrag(event.clientX, event.clientY);
  finishSequenceDrag();
  patternControls.releasePointerCapture(event.pointerId);
});

patternControls.addEventListener("pointercancel", () => {
  finishPaneScroll();
  cancelSequenceDrag();
});

document.addEventListener("pointermove", (event) => {
  if (pendingPaneGesture) {
    updatePendingPaneGesture(event);
    return;
  }

  if (paneScrollDrag) {
    updatePaneScroll(event.clientY);
    return;
  }

  if (!sequenceDrag) return;

  updateSequenceDrag(event.clientX, event.clientY);
});

document.addEventListener("pointerup", (event) => {
  if (pendingPaneGesture) {
    finishPaneScroll();
    return;
  }

  if (paneScrollDrag) {
    updatePaneScroll(event.clientY);
    finishPaneScroll();
    return;
  }

  if (!sequenceDrag) return;

  updateSequenceDrag(event.clientX, event.clientY);
  finishSequenceDrag();
});

function handleNoteInput(button) {
  setActiveCellNote(button.dataset.note);
}

editorNoteGrid.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  event.preventDefault();
  ignoreNextNoteClick = true;
  handleNoteInput(button);
});

editorNoteGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (ignoreNextNoteClick) {
    event.preventDefault();
    ignoreNextNoteClick = false;
    return;
  }

  handleNoteInput(button);
});

volumeSlider.addEventListener("input", (event) => {
  selectedVolume = Number(event.target.value);
  const parsed = parseCell(pattern[activeRow][activeChannel]);
  if (parsed) {
    pattern[activeRow][activeChannel] = makeCell(parsed.note, parsed.sample, selectedVolume);
  }
  syncReadouts();
  renderPattern();
});

octaveDown.addEventListener("click", () => {
  octave = Math.max(1, octave - 1);
  syncReadouts();
});

octaveUp.addEventListener("click", () => {
  octave = Math.min(7, octave + 1);
  syncReadouts();
});

phoneShell.addEventListener("touchend", (event) => {
  if (event.touches.length > 0) return;
  if (event.target.closest("button, input, .pattern-cell, .pattern-row, .sample-pad, .piano-keyboard")) {
    lastTouchEnd = 0;
    return;
  }

  const now = Date.now();
  if (now - lastTouchEnd < 320) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

patternGrid.addEventListener("pointerdown", (event) => {
  const touchedCell = event.target.closest(".pattern-cell");
  const touchedPointCell = touchedCell
    ? {
      row: Number(touchedCell.dataset.row),
      channel: Number(touchedCell.dataset.channel),
    }
    : getPatternCellFromPoint(event.clientX, event.clientY);
  const touchedRow = touchedPointCell?.row;
  const touchedChannel = touchedPointCell?.channel;

  patternTouchStartX = event.clientX;
  patternTouchStartY = event.clientY;
  patternTouchLastX = event.clientX;
  patternTouchLastY = event.clientY;
  patternDidSwipe = false;
  patternHandledTap = false;
  window.clearTimeout(cellDragTimer);

  if (isRangeSelectionArmed && selectionStartCell) {
    event.preventDefault();
    isRangeSelectionArmed = false;
    isSelectingRange = true;
    didMoveRangeSelection = false;
    patternDidSwipe = true;
    patternHandledTap = true;
    rangeStatusMessage = "";
    cellDragFirstVisibleRow = getFirstVisibleRow();
    lastCellDragScrollAt = 0;
    updateCopyStatus();
    updateRangeSelection(event.clientY);
    patternGrid.setPointerCapture(event.pointerId);
    return;
  }

  if (touchedPointCell && isDoubleTapRangeGesture(touchedRow, touchedChannel)) {
    event.preventDefault();
    lastGridTapAt = 0;
    lastGridTapCell = null;
    beginRangeSelection(touchedRow, touchedChannel, event.clientX);
    patternGrid.setPointerCapture(event.pointerId);
    return;
  }

  const touchedValue = pattern[touchedRow]?.[touchedChannel];
  if (touchedPointCell && touchedValue && touchedValue !== emptyCell) {
    cellDragTimer = window.setTimeout(() => {
      beginCellDrag(touchedRow, touchedChannel);
    }, cellDragDelay);
  }

  patternGrid.setPointerCapture(event.pointerId);
});

patternGrid.addEventListener("pointermove", (event) => {
  if (!patternGrid.hasPointerCapture(event.pointerId)) return;

  if (isSelectingRange) {
    event.preventDefault();
    updateRangeSelection(event.clientY);
    patternTouchLastX = event.clientX;
    patternTouchLastY = event.clientY;
    return;
  }

  const deltaX = event.clientX - patternTouchLastX;
  const deltaY = event.clientY - patternTouchLastY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (isDraggingCell) {
    updateCellDrag(event.clientX, event.clientY);
    patternTouchLastX = event.clientX;
    patternTouchLastY = event.clientY;
    return;
  }

  if (
    Math.abs(event.clientX - patternTouchStartX) > 10 ||
    Math.abs(event.clientY - patternTouchStartY) > 10
  ) {
    window.clearTimeout(cellDragTimer);
  }

  if (absX >= 26 && absX > absY * 1.2) {
    patternDidSwipe = true;
    moveChannels(deltaX < 0 ? 1 : -1);
    patternTouchLastX = event.clientX;
    patternTouchLastY = event.clientY;
    return;
  }

  if (absY < 18 || absY <= absX) return;

  patternDidSwipe = true;
  moveRows(deltaY > 0 ? -1 : 1);
  patternTouchLastX = event.clientX;
  patternTouchLastY = event.clientY;
});

patternGrid.addEventListener("pointerup", (event) => {
  if (!patternGrid.hasPointerCapture(event.pointerId)) return;

  window.clearTimeout(cellDragTimer);
  if (isSelectingRange) {
    event.preventDefault();
    updateRangeSelection(event.clientY);
    finishRangeSelection({ armIfSingleCell: true });
    patternGrid.releasePointerCapture(event.pointerId);
    window.setTimeout(() => {
      patternDidSwipe = false;
    }, 0);
    return;
  }

  if (isDraggingCell) {
    updateCellDrag(event.clientX, event.clientY);
    finishCellDrag();
    patternGrid.releasePointerCapture(event.pointerId);
    window.setTimeout(() => {
      patternDidSwipe = false;
    }, 0);
    return;
  }

  const totalDeltaX = event.clientX - patternTouchStartX;
  const totalDeltaY = event.clientY - patternTouchStartY;
  const absTotalX = Math.abs(totalDeltaX);
  const absTotalY = Math.abs(totalDeltaY);
  if (absTotalX > 58 && absTotalX > absTotalY * 1.2) {
    patternDidSwipe = true;
    moveChannels(totalDeltaX < 0 ? 1 : -1);
  } else if (absTotalY > 52 && absTotalY > absTotalX) {
    patternDidSwipe = true;
    moveRows(totalDeltaY > 0 ? -2 : 2);
  } else if (!patternDidSwipe && absTotalX < 10 && absTotalY < 10) {
    const tappedCell = event.target.closest(".pattern-cell");
    if (tappedCell) {
      patternHandledTap = true;
      const tappedRow = Number(tappedCell.dataset.row);
      const tappedChannel = Number(tappedCell.dataset.channel);
      handlePatternCellTap(tappedRow, tappedChannel);
      lastGridTapAt = Date.now();
      lastGridTapCell = { row: tappedRow, channel: tappedChannel };
    } else if (selectPatternCellFromPoint(event.clientX, event.clientY)) {
      patternHandledTap = true;
      lastGridTapAt = Date.now();
      lastGridTapCell = { row: activeRow, channel: activeChannel };
    }
  }

  patternGrid.releasePointerCapture(event.pointerId);
  window.setTimeout(() => {
    patternDidSwipe = false;
  }, 0);
});

patternGrid.addEventListener("pointercancel", () => {
  if (isSelectingRange) {
    clearPendingCopy();
  }
  cancelCellDrag();
});

copyCancel.addEventListener("click", clearPendingCopy);

clearCell.addEventListener("click", () => {
  pattern[activeRow][activeChannel] = emptyCell;
  syncReadouts();
  renderPattern();
});

recordButton.addEventListener("click", () => {
  isRecording = !isRecording;
  syncRecordButton();
});

bpmTile.addEventListener("click", showTempoPanel);

bpmSlider.addEventListener("input", (event) => {
  setBpm(event.target.value);
});

bpmDown.addEventListener("click", () => setBpm(bpm - 1));
bpmUp.addEventListener("click", () => setBpm(bpm + 1));
tempoDone.addEventListener("click", hideTempoPanel);

window.addEventListener("resize", renderPattern);
sequenceLane.addEventListener("scroll", updateScrollRails);
patternBank.addEventListener("scroll", updateScrollRails);
sequenceLane.addEventListener("wheel", (event) => {
  if (!scrollPaneBy(sequenceLane, event.deltaY)) return;

  event.preventDefault();
}, { passive: false });
patternBank.addEventListener("wheel", (event) => {
  if (!scrollPaneBy(patternBank, event.deltaY)) return;

  event.preventDefault();
}, { passive: false });

function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback(true);
  }
}

playButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  ignoreNextPlayClick = true;
  togglePlayback();
});

playButton.addEventListener("click", (event) => {
  if (ignoreNextPlayClick) {
    event.preventDefault();
    ignoreNextPlayClick = false;
    return;
  }

  togglePlayback();
});

syncReadouts();
syncChannelMutes();
renderPattern();
renderSequencer();
