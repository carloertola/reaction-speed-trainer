const $ = (id) => document.getElementById(id);

const state = {
  running: false,
  currentRound: 0,
  totalRounds: 0,
  expectedStimulusTime: 0,
  actualStimulusTime: 0,
  sessionResults: [],
  responseListenerCleanup: null,
  audioContext: null,
  micStream: null,
  analyser: null,
  micData: null,
};

const STORAGE_KEY = "reaction-speed-trainer.sessions.v1";
const OFFSET_KEY = "reaction-speed-trainer.offsets.v1";

function loadOffsets() {
  const defaults = { visual: 16, audio: 0, tactile: 15, tap: 24, mic: 35, network: 0, backendUrl: "http://localhost:8787" };
  const saved = JSON.parse(localStorage.getItem(OFFSET_KEY) || "null");
  return { ...defaults, ...(saved || {}) };
}

function saveOffsets(offsets) {
  localStorage.setItem(OFFSET_KEY, JSON.stringify(offsets));
}

function getOffsets() {
  return {
    visual: Number($("visualOffset").value || 0),
    audio: Number($('audioOffset').value || 0),
    tactile: Number($("tactileOffset").value || 0),
    tap: Number($("tapOffset").value || 0),
    mic: Number($("micOffset").value || 0),
    network: Number($("networkOffset").value || 0),
    backendUrl: $("backendUrl").value.trim() || "http://localhost:8787",
  };
}

function renderHistory() {
  const container = $("historyList");
  const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!sessions.length) {
    container.innerHTML = '<p class="muted">No saved sessions yet.</p>';
    return;
  }
  container.innerHTML = sessions
    .map((s) => {
      const avg = s.rounds.reduce((a, r) => a + r.compensatedMs, 0) / s.rounds.length;
      return `
      <article class="session-item">
        <div class="row">
          <strong>${new Date(s.date).toLocaleString()}</strong>
          <button data-delete="${s.id}">Delete</button>
        </div>
        <div>${s.mode} • ${s.stimulus} stimulus • ${s.response} response</div>
        <div>Rounds: ${s.rounds.length} | Avg compensated: <strong>${avg.toFixed(1)} ms</strong></div>
      </article>`;
    })
    .join("");

  container.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.delete;
      const next = sessions.filter((x) => x.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      renderHistory();
    });
  });
}

function saveSession(payload) {
  const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  sessions.unshift(payload);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 200)));
  renderHistory();
}

function setPanel(text, active = false) {
  const panel = $("stimulusPanel");
  panel.textContent = text;
  panel.classList.toggle("active", active);
}

function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function addLiveResult(round, rawMs, compensatedMs) {
  const li = document.createElement("li");
  li.innerHTML = `Round ${round}: raw ${rawMs.toFixed(1)} ms → compensated <strong>${compensatedMs.toFixed(1)} ms</strong>`;
  $("liveResults").appendChild(li);
}

async function ensureMicPipeline() {
  if (state.analyser) return;
  state.audioContext = state.audioContext || new AudioContext();
  state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = state.audioContext.createMediaStreamSource(state.micStream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 2048;
  source.connect(state.analyser);
  state.micData = new Uint8Array(state.analyser.fftSize);
}

function waitForTapResponse(onResponse) {
  const handler = (e) => {
    e.preventDefault();
    onResponse(performance.now());
  };
  window.addEventListener("pointerdown", handler, { once: true });
  return () => window.removeEventListener("pointerdown", handler);
}

function waitForMicResponse(onResponse) {
  let raf = 0;
  const THRESHOLD = 22;
  let baseline = null;

  const poll = () => {
    state.analyser.getByteTimeDomainData(state.micData);
    const avgAbs = state.micData.reduce((sum, v) => sum + Math.abs(v - 128), 0) / state.micData.length;
    baseline = baseline == null ? avgAbs : baseline * 0.98 + avgAbs * 0.02;
    const delta = avgAbs - baseline;
    if (delta > THRESHOLD) {
      onResponse(performance.now());
      return;
    }
    raf = requestAnimationFrame(poll);
  };
  raf = requestAnimationFrame(poll);
  return () => cancelAnimationFrame(raf);
}

function getStimulusLatency(stimulus, offsets, renderDelay) {
  if (stimulus === "visual") return offsets.visual + renderDelay;
  if (stimulus === "auditory") return offsets.audio;
  return offsets.tactile;
}

function getResponseLatency(response, offsets) {
  return (response === "tap" ? offsets.tap : offsets.mic) + offsets.network;
}

function playAuditoryCue() {
  state.audioContext = state.audioContext || new AudioContext();
  const ctx = state.audioContext;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 1100;
  g.gain.value = 0.001;
  o.connect(g).connect(ctx.destination);
  const now = ctx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  o.start(now);
  o.stop(now + 0.14);
}

async function runRound(config, offsets) {
  return new Promise(async (resolve, reject) => {
    try {
      state.currentRound += 1;
      $("roundLabel").textContent = `Round ${state.currentRound} / ${state.totalRounds}`;
      setPanel("Wait for the signal...");

      if (config.response === "mic") {
        await ensureMicPipeline();
      }

      const waitMs = 1500 + Math.random() * 2500;
      state.expectedStimulusTime = performance.now() + waitMs;

      setTimeout(() => {
        let renderDelay = 0;
        const before = performance.now();
        if (config.stimulus === "visual") {
          setPanel("NOW!", true);
          requestAnimationFrame(() => {
            renderDelay = performance.now() - before;
          });
        } else if (config.stimulus === "auditory") {
          setPanel("Audio cue played — respond now");
          playAuditoryCue();
        } else {
          setPanel("Vibration cue sent — respond now");
          if (navigator.vibrate) navigator.vibrate([100]);
        }
        state.actualStimulusTime = performance.now();

        const done = (responseTime) => {
          const rawMs = responseTime - state.actualStimulusTime;
          const compensatedMs = Math.max(
            0,
            rawMs -
              getStimulusLatency(config.stimulus, offsets, renderDelay) -
              getResponseLatency(config.response, offsets)
          );

          addLiveResult(state.currentRound, rawMs, compensatedMs);
          setPanel("Captured. Preparing next round...");
          state.sessionResults.push({
            round: state.currentRound,
            rawMs,
            compensatedMs,
            stimulusLatencyMs: getStimulusLatency(config.stimulus, offsets, renderDelay),
            responseLatencyMs: getResponseLatency(config.response, offsets),
          });
          if (state.responseListenerCleanup) state.responseListenerCleanup();
          state.responseListenerCleanup = null;
          resolve();
        };

        state.responseListenerCleanup =
          config.response === "tap" ? waitForTapResponse(done) : waitForMicResponse(done);
      }, waitMs);
    } catch (err) {
      reject(err);
    }
  });
}

async function startSession() {
  if (state.running) return;
  const config = {
    mode: $("modeSelect").value,
    stimulus: $("stimulusSelect").value,
    response: $("responseSelect").value,
    rounds: Math.max(3, Number($("roundsInput").value || 7)),
  };
  const offsets = getOffsets();
  saveOffsets(offsets);

  state.running = true;
  state.currentRound = 0;
  state.totalRounds = config.rounds;
  state.sessionResults = [];
  $("liveResults").innerHTML = "";
  $("startBtn").disabled = true;
  $("stopBtn").disabled = false;

  try {
    for (let i = 0; i < config.rounds && state.running; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await runRound(config, offsets);
    }
    if (state.running && state.sessionResults.length) {
      const avg = average(state.sessionResults.map((r) => r.compensatedMs));
      const quality = avg < 220 ? "good" : "warn";
      setPanel(`Session complete. Average compensated reaction time: ${avg.toFixed(1)} ms`, true);
      const msg = document.createElement("li");
      msg.innerHTML = `<span class="${quality}">Average compensated score: ${avg.toFixed(1)} ms</span>`;
      $("liveResults").appendChild(msg);

      saveSession({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        ...config,
        offsets,
        rounds: state.sessionResults,
      });
    }
  } catch (error) {
    setPanel(`Error: ${error.message || error}`);
  } finally {
    stopSession(false);
  }
}

function stopSession(resetLabel = true) {
  state.running = false;
  if (state.responseListenerCleanup) state.responseListenerCleanup();
  state.responseListenerCleanup = null;
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
  if (resetLabel) setPanel("Session stopped. Ready.");
}

async function autoEstimateLatency() {
  const status = $("calibrationStatus");
  status.textContent = "Preparing audio pipeline...";
  try {
    await ensureMicPipeline();
    const ctx = state.audioContext;
    const baseOutMs = (ctx.baseLatency || 0) * 1000;
    const out = baseOutMs + 8;
    const inEstimate = ((ctx.outputLatency || 0) * 1000 || 20) + 15;

    $("audioOffset").value = Math.round(out);
    $("micOffset").value = Math.round(inEstimate);
    saveOffsets(getOffsets());

    status.textContent = `Estimated output latency ${out.toFixed(1)} ms, mic latency ${inEstimate.toFixed(1)} ms. Fine-tune if needed.`;
  } catch (error) {
    status.textContent = "Could not auto-estimate latency. Ensure microphone permission is granted.";
  }
}



async function syncWithBackendClock() {
  const status = $("calibrationStatus");
  const { backendUrl } = getOffsets();
  const samples = [];

  status.textContent = "Syncing with backend clock...";
  for (let i = 0; i < 5; i += 1) {
    const t0 = performance.now();
    const wall0 = Date.now();
    const response = await fetch(`${backendUrl}/api/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSentAt: wall0 }),
    });
    const body = await response.json();
    const t1 = performance.now();
    const rtt = t1 - t0;
    const midpoint = wall0 + rtt / 2;
    const clockOffset = body.serverReceivedAt - midpoint;
    samples.push({ rtt, clockOffset });
  }

  samples.sort((a, b) => a.rtt - b.rtt);
  const best = samples[0];
  const jitterCompensation = best.rtt / 2;

  $("networkOffset").value = Math.round(jitterCompensation);
  saveOffsets(getOffsets());

  status.textContent = `Backend sync complete. Best RTT ${best.rtt.toFixed(1)} ms, clock offset ${best.clockOffset.toFixed(1)} ms, network compensation set to ${jitterCompensation.toFixed(1)} ms.`;
}

function init() {
  const offsets = loadOffsets();
  $("visualOffset").value = offsets.visual;
  $("audioOffset").value = offsets.audio;
  $("tactileOffset").value = offsets.tactile;
  $("tapOffset").value = offsets.tap;
  $("micOffset").value = offsets.mic;
  $("networkOffset").value = offsets.network || 0;
  $("backendUrl").value = offsets.backendUrl || "http://localhost:8787";

  $("startBtn").addEventListener("click", startSession);
  $("stopBtn").addEventListener("click", () => stopSession());
  $("autoCalibrateBtn").addEventListener("click", autoEstimateLatency);
  $("syncBackendBtn").addEventListener("click", syncWithBackendClock);
  renderHistory();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js");
  }
}

init();
