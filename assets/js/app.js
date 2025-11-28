(function () {
  // DOM-Referenzen
  const fileInput = document.getElementById("fileInput");
  const fitMode = document.getElementById("fitMode");

  const matrixWidthInput = document.getElementById("matrixWidth");
  const matrixHeightInput = document.getElementById("matrixHeight");

  const brightnessInput = document.getElementById("brightness");
  const brightnessValue = document.getElementById("brightnessValue");

  const contrastInput = document.getElementById("contrast");
  const contrastValue = document.getElementById("contrastValue");
  const saturationInput = document.getElementById("saturation");
  const saturationValue = document.getElementById("saturationValue");
  const gammaInput = document.getElementById("gamma");
  const gammaValue = document.getElementById("gammaValue");

  const invertColorsInput = document.getElementById("invertColors");
  const mirrorHInput = document.getElementById("mirrorH");

  const paletteContainer = document.getElementById("colorPalette");
  const selectedColorPreview = document.getElementById("selectedColorPreview");
  const selectedColorLabel = document.getElementById("selectedColorLabel");

  const frameCountSlider = document.getElementById("frameCount");
  const frameCountValue = document.getElementById("frameCountValue");
  const frameDurationSlider = document.getElementById("frameDuration");
  const frameDurationValue = document.getElementById("frameDurationValue");
  const frameButtonsDiv = document.getElementById("frameButtons");
  const duplicateFrameBtn = document.getElementById("duplicateFrameBtn");

  const transitionTypeContainer = document.getElementById("transitionTypeContainer");
  const transitionExtra = document.getElementById("transitionExtra");
  const transitionIntensitySlider = document.getElementById("transitionIntensity");
  const transitionIntensityValue = document.getElementById("transitionIntensityValue");

  const playPauseBtn = document.getElementById("playPauseBtn");
  const currentFrameInfo = document.getElementById("currentFrameInfo");

  const workCanvas = document.getElementById("workCanvas");
  const pixelCanvas = document.getElementById("pixelCanvas");

  const resetBtn = document.getElementById("resetBtn");
  const saveBtn = document.getElementById("saveBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const uploadInput = document.getElementById("uploadInput");

  const boardSelect = document.getElementById("boardSelect");
  const output = document.getElementById("output");
  const message = document.getElementById("message");
  const copyBtn = document.getElementById("copyBtn");
  const copyStatus = document.getElementById("copyStatus");

  const workCtx = workCanvas.getContext("2d");
  const simCtx = pixelCanvas.getContext("2d");

  function resizePixelCanvas() {
    const wrapperWidth = pixelCanvas.parentElement.getBoundingClientRect().width || 360;
    const target = Math.max(280, Math.min(wrapperWidth - 8, 540));
    pixelCanvas.width = target;
    pixelCanvas.height = target;
    pixelCanvas.style.width = target + "px";
    pixelCanvas.style.height = target + "px";
  }

  // Zustand Matrix und Frames
  let matrixW = 16;
  let matrixH = 16;

  let basePixels = null;      // aktueller Frame: Grundbild
  let overlayPixels = null;   // aktueller Frame: Bemalung
  let lastImage = null;

  const MAX_FRAMES = 12;
  let numFrames = 1;
  let currentFrame = 0;
  let framesData = [];        // [{ basePixels, overlayPixels, duration }, ...]

  // Farbpalette
  const paletteColors = [
    "#ffffff", "#ff0000", "#00ff00", "#0000ff",
    "#ffff00", "#ff00ff", "#00ffff", "#6b7280"
  ];
  let currentColor = { r: 255, g: 255, b: 255 };
  let selectedPaletteElement = null;
  let isPainting = false;

  // Animation / Uebergaenge
  let transitionType = "none";
  let transitionIntensity = 5;

  // Vorschau-Animation im Browser
  let previewFrames = [];      // Array von 2D-Pixelarrays
  let previewDurations = [];   // ms pro Frame
  let previewPlaying = false;
  let previewCurrentFrameIndex = 0;
  let previewState = "hold";   // "hold" oder "fade"
  let previewStateElapsed = 0;
  let previewLastTimestamp = null;
  let animationFrameHandle = null;

  // Hilfsfunktionen Matrix
  function clampMatrixSize() {
    let w = parseInt(matrixWidthInput.value, 10);
    let h = parseInt(matrixHeightInput.value, 10);
    if (isNaN(w) || w < 1) w = 1;
    if (isNaN(h) || h < 1) h = 1;
    if (w > 64) w = 64;
    if (h > 64) h = 64;
    matrixW = w;
    matrixH = h;
    matrixWidthInput.value = w;
    matrixHeightInput.value = h;
  }

  function makeEmptyBase() {
    const arr = [];
    for (let y = 0; y < matrixH; y++) {
      const row = [];
      for (let x = 0; x < matrixW; x++) {
        row.push({ r: 88, g: 92, b: 100 });
      }
      arr.push(row);
    }
    return arr;
  }

  function makeEmptyOverlay() {
    const arr = [];
    for (let y = 0; y < matrixH; y++) {
      const row = [];
      for (let x = 0; x < matrixW; x++) {
        row.push(null);
      }
      arr.push(row);
    }
    return arr;
  }

  function clonePixels(pixels) {
    if (!pixels) return null;
    return pixels.map(row =>
      row.map(p => (p ? { r: p.r, g: p.g, b: p.b } : null))
    );
  }

  // Frames initialisieren
  function initFramesData() {
    framesData = [];
    for (let i = 0; i < MAX_FRAMES; i++) {
      framesData.push({
        basePixels: null,
        overlayPixels: null,
        duration: 500
      });
    }
    numFrames = 1;
    currentFrame = 0;
    basePixels = makeEmptyBase();
    overlayPixels = makeEmptyOverlay();
    framesData[0].basePixels = clonePixels(basePixels);
    framesData[0].overlayPixels = clonePixels(overlayPixels);
    frameCountSlider.value = numFrames;
    frameCountValue.textContent = String(numFrames);
    frameDurationSlider.value = framesData[0].duration;
    frameDurationValue.textContent = String(framesData[0].duration);
    updateFrameButtons();
  }

  function setTransitionRadio(value) {
    let found = false;
    const radios = transitionTypeContainer.querySelectorAll("input[name='transitionType']");
    radios.forEach(function (r) {
      if (r.value === value) {
        r.checked = true;
        found = true;
      } else {
        r.checked = false;
      }
    });
    if (!found) {
      radios.forEach(function (r) {
        if (r.value === "none") {
          r.checked = true;
        }
      });
      value = "none";
    }
    transitionType = value;
    if (transitionType === "none" || transitionType === "switch") {
      transitionExtra.style.display = "none";
    } else {
      transitionExtra.style.display = "block";
    }
  }

  function normalizeBasePixels(source) {
    const target = makeEmptyBase();
    if (!source) return target;
    for (let y = 0; y < Math.min(matrixH, source.length); y++) {
      for (let x = 0; x < Math.min(matrixW, source[y].length); x++) {
        const p = source[y][x];
        if (p) {
          target[y][x] = { r: p.r ?? 0, g: p.g ?? 0, b: p.b ?? 0 };
        }
      }
    }
    return target;
  }

  function normalizeOverlayPixels(source) {
    const target = makeEmptyOverlay();
    if (!source) return target;
    for (let y = 0; y < Math.min(matrixH, source.length); y++) {
      for (let x = 0; x < Math.min(matrixW, source[y].length); x++) {
        const p = source[y][x];
        if (p) {
          target[y][x] = { r: p.r ?? 0, g: p.g ?? 0, b: p.b ?? 0 };
        }
      }
    }
    return target;
  }

  function snapshotSettings() {
    saveCurrentFrame();

    const sliders = getSliderValues();
    const frames = [];
    for (let i = 0; i < numFrames; i++) {
      const f = framesData[i];
      frames.push({
        base: f.basePixels || makeEmptyBase(),
        overlay: f.overlayPixels || makeEmptyOverlay(),
        duration: f.duration || 500
      });
    }

    return {
      version: 1,
      matrix: { w: matrixW, h: matrixH },
      fitMode: fitMode.value,
      sliders: sliders,
      invert: invertColorsInput.checked,
      mirror: mirrorHInput.checked,
      transition: { type: transitionType, intensity: transitionIntensity },
      framesCount: numFrames,
      frames: frames,
      board: boardSelect.value,
      currentColor: currentColor
    };
  }

  function loadSettingsObject(obj) {
    if (!obj || typeof obj !== "object") {
      message.textContent = "Ungültige Einstellungen.";
      return;
    }

    const w = obj.matrix?.w ?? 16;
    const h = obj.matrix?.h ?? 16;
    matrixWidthInput.value = w;
    matrixHeightInput.value = h;
    clampMatrixSize();

    fitMode.value = obj.fitMode || "cover";

    brightnessInput.value = obj.sliders?.brightness ?? 100;
    contrastInput.value = obj.sliders?.contrast ?? 100;
    saturationInput.value = obj.sliders?.saturation ?? 100;
    gammaInput.value = obj.sliders?.gamma ?? 100;
    invertColorsInput.checked = !!obj.sliders?.invert || !!obj.invert;
    mirrorHInput.checked = !!obj.sliders?.mirrorH || !!obj.mirror;

    const framesCount = Math.min(Math.max(obj.framesCount || 1, 1), MAX_FRAMES);
    frameCountSlider.value = framesCount;
    frameCountValue.textContent = String(framesCount);

    transitionIntensity = obj.transition?.intensity ?? 5;
    transitionIntensitySlider.value = transitionIntensity;
    transitionIntensityValue.textContent = String(transitionIntensity);
    setTransitionRadio(obj.transition?.type || "none");

    if (obj.board) {
      boardSelect.value = obj.board;
    }

    numFrames = framesCount;
    framesData = [];
    for (let i = 0; i < MAX_FRAMES; i++) {
      framesData.push({ basePixels: null, overlayPixels: null, duration: 500 });
    }

    const framesPayload = Array.isArray(obj.frames) ? obj.frames : [];
    for (let i = 0; i < framesCount; i++) {
      const payload = framesPayload[i] || {};
      framesData[i].basePixels = normalizeBasePixels(payload.base);
      framesData[i].overlayPixels = normalizeOverlayPixels(payload.overlay);
      framesData[i].duration = payload.duration || 500;
    }

    currentFrame = 0;
    basePixels = clonePixels(framesData[0].basePixels);
    overlayPixels = clonePixels(framesData[0].overlayPixels);
    frameDurationSlider.value = framesData[0].duration;
    frameDurationValue.textContent = String(framesData[0].duration);

    updateFrameButtons();

    if (obj.currentColor) {
      setCurrentColorFromRGB(obj.currentColor.r ?? 255, obj.currentColor.g ?? 255, obj.currentColor.b ?? 255);
    }

    updatePreviewAndExport();
    message.textContent = "Einstellungen geladen.";
  }

  function resetAll() {
    stopPreviewAnimation();
    fitMode.value = "cover";
    brightnessInput.value = "100";
    contrastInput.value = "100";
    saturationInput.value = "100";
    gammaInput.value = "100";
    invertColorsInput.checked = false;
    mirrorHInput.checked = false;
    matrixWidthInput.value = "16";
    matrixHeightInput.value = "16";
    clampMatrixSize();
    transitionIntensity = 5;
    transitionIntensitySlider.value = "5";
    transitionIntensityValue.textContent = "5";
    setTransitionRadio("none");
    boardSelect.value = "arduino";
    lastImage = null;
    initFramesData();
    if (paletteContainer.firstElementChild) {
      paletteContainer.firstElementChild.click();
    }
    updatePreviewAndExport();
    message.textContent = "Zurückgesetzt.";
  }

  function saveCurrentFrame() {
    const f = framesData[currentFrame];
    if (!f) return;
    f.basePixels = clonePixels(basePixels);
    f.overlayPixels = clonePixels(overlayPixels);
  }

  function loadFrame(index) {
    if (index < 0 || index >= numFrames) return;
    saveCurrentFrame();
    currentFrame = index;
    const f = framesData[currentFrame];
    if (!f.basePixels ||
        f.basePixels.length !== matrixH ||
        f.basePixels[0].length !== matrixW) {
      f.basePixels = makeEmptyBase();
    }
    if (!f.overlayPixels ||
        f.overlayPixels.length !== matrixH ||
        f.overlayPixels[0].length !== matrixW) {
      f.overlayPixels = makeEmptyOverlay();
    }
    basePixels = clonePixels(f.basePixels);
    overlayPixels = clonePixels(f.overlayPixels);
    frameDurationSlider.value = f.duration;
    frameDurationValue.textContent = String(f.duration);
    updateFrameButtonsHighlight();
    updatePreviewAndExport();
  }

  function updateFrameButtons() {
    frameButtonsDiv.innerHTML = "";
    for (let i = 0; i < numFrames; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(i + 1);
      btn.style.minWidth = "2rem";
      btn.dataset.index = String(i);
      btn.addEventListener("click", function () {
        const idx = parseInt(this.dataset.index, 10);
        loadFrame(idx);
      });
      frameButtonsDiv.appendChild(btn);
    }
    updateFrameButtonsHighlight();
  }

  function updateFrameButtonsHighlight() {
    const buttons = frameButtonsDiv.querySelectorAll("button");
    buttons.forEach((b, idx) => {
      b.style.background = (idx === currentFrame) ? "#ccc" : "#eee";
    });
  }

  // Bild laden
  function resetStateButKeepSettings() {
    basePixels = makeEmptyBase();
    overlayPixels = makeEmptyOverlay();
    framesData[currentFrame].basePixels = clonePixels(basePixels);
    framesData[currentFrame].overlayPixels = clonePixels(overlayPixels);
    lastImage = null;
  }

  function loadImageFromFile(file) {
    resetStateButKeepSettings();
    if (!file || !file.type.startsWith("image/")) {
      message.textContent = "Bitte eine Bilddatei waehlen.";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        lastImage = img;
        processImageToMatrix(img);
      };
      img.onerror = function () {
        message.textContent = "Bild konnte nicht geladen werden.";
      };
      img.src = e.target.result;
    };
    reader.onerror = function () {
      message.textContent = "Fehler beim Lesen der Datei.";
    };
    reader.readAsDataURL(file);
  }

  function processImageToMatrix(img) {
    clampMatrixSize();

    const mode = fitMode.value;
    const wc = workCanvas;
    const wctx = workCtx;

    wc.width = matrixW;
    wc.height = matrixH;

    wctx.clearRect(0, 0, matrixW, matrixH);

    if (mode === "stretch") {
      wctx.drawImage(img, 0, 0, matrixW, matrixH);
    } else {
      const srcW = img.width;
      const srcH = img.height;
      const targetW = matrixW;
      const targetH = matrixH;
      const scaleX = targetW / srcW;
      const scaleY = targetH / srcH;

      let scale;
      if (mode === "cover") {
        scale = Math.max(scaleX, scaleY);
      } else {
        scale = Math.min(scaleX, scaleY);
      }

      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const dx = (targetW - drawW) / 2;
      const dy = (targetH - drawH) / 2;

      wctx.save();
      wctx.imageSmoothingEnabled = true;
      wctx.imageSmoothingQuality = "high";
      wctx.drawImage(img, dx, dy, drawW, drawH);
      wctx.restore();
    }

    const imgData = wctx.getImageData(0, 0, matrixW, matrixH).data;
    basePixels = [];
    for (let y = 0; y < matrixH; y++) {
      const row = [];
      for (let x = 0; x < matrixW; x++) {
        const idx = (y * matrixW + x) * 4;
        row.push({
          r: imgData[idx],
          g: imgData[idx + 1],
          b: imgData[idx + 2]
        });
      }
      basePixels.push(row);
    }

    overlayPixels = makeEmptyOverlay();
    framesData[currentFrame].basePixels = clonePixels(basePixels);
    framesData[currentFrame].overlayPixels = clonePixels(overlayPixels);

    message.textContent = "Bild auf " + matrixW + "×" + matrixH + " verarbeitet.";
    updatePreviewAndExport();
  }

  // Sliderwerte
  function getSliderValues() {
    return {
      brightness: parseInt(brightnessInput.value, 10) || 0,
      contrast: parseInt(contrastInput.value, 10) || 0,
      saturation: parseInt(saturationInput.value, 10) || 0,
      gamma: parseInt(gammaInput.value, 10) || 0,
      invert: invertColorsInput.checked,
      mirrorH: mirrorHInput.checked
    };
  }

  function updateSliderLabels(s) {
    brightnessValue.textContent = String(s.brightness);
    contrastValue.textContent = String(s.contrast);
    saturationValue.textContent = String(s.saturation);
    gammaValue.textContent = String(s.gamma);
  }

  // Bild-Transformation
  function applyTransforms(base, s) {
    if (!base) return null;

    const bf = s.brightness / 100;

    const cf = s.contrast / 100;
    const sf = s.saturation / 100;
    let gamma = s.gamma / 100;
    if (gamma <= 0) gamma = 0.01;

    const invert = s.invert;
    const mirrorH = s.mirrorH;

    const out = [];
    for (let y = 0; y < matrixH; y++) {
      const row = [];
      const srcY = y;
      for (let x = 0; x < matrixW; x++) {
        const srcX = mirrorH ? (matrixW - 1 - x) : x;
        const p = base[srcY][srcX];

        let r = (p.r / 255) * bf;
        let g = (p.g / 255) * bf;
        let b = (p.b / 255) * bf;

        r = Math.max(0, Math.min(1, r));
        g = Math.max(0, Math.min(1, g));
        b = Math.max(0, Math.min(1, b));

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum + (r - lum) * sf;
        g = lum + (g - lum) * sf;
        b = lum + (b - lum) * sf;

        r = (r - 0.5) * cf + 0.5;
        g = (g - 0.5) * cf + 0.5;
        b = (b - 0.5) * cf + 0.5;

        r = Math.pow(Math.max(0, Math.min(1, r)), gamma);
        g = Math.pow(Math.max(0, Math.min(1, g)), gamma);
        b = Math.pow(Math.max(0, Math.min(1, b)), gamma);

        if (invert) {
          r = 1 - r;
          g = 1 - g;
          b = 1 - b;
        }

        const rr = Math.max(0, Math.min(255, Math.round(r * 255)));
        const gg = Math.max(0, Math.min(255, Math.round(g * 255)));
        const bb = Math.max(0, Math.min(255, Math.round(b * 255)));

        row.push({ r: rr, g: gg, b: bb });
      }
      out.push(row);
    }
    return out;
  }

  function computeFinalPixelsForData(base, overlay, sliders) {
    if (!base) return null;
    const transformed = applyTransforms(base, sliders);
    if (!transformed) return null;

    const finalPixels = [];
    for (let y = 0; y < matrixH; y++) {
      const row = [];
      for (let x = 0; x < matrixW; x++) {
        let p = transformed[y][x];
        if (overlay && overlay[y] && overlay[y][x]) {
          p = overlay[y][x];
        }
        row.push(p);
      }
      finalPixels.push(row);
    }
    return finalPixels;
  }

  function computeFinalPixels(sliders) {
    return computeFinalPixelsForData(basePixels, overlayPixels, sliders);
  }

  // Simulator zeichnen
  function drawSimulator(pixels) {
    const cell = 22;
    pixelCanvas.width = matrixW * cell;
    pixelCanvas.height = matrixH * cell;

    simCtx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height);
    simCtx.fillStyle = "#0d1628";
    simCtx.fillRect(0, 0, pixelCanvas.width, pixelCanvas.height);

    const neutral = { r: 82, g: 88, b: 96 };

    for (let y = 0; y < matrixH; y++) {
      for (let x = 0; x < matrixW; x++) {
        const p = pixels[y][x] || neutral;
        const cellX = x * cell;
        const cellY = y * cell;
        const cx = cellX + cell / 2;
        const cy = cellY + cell / 2;
        const radius = cell * 0.38;

        simCtx.fillStyle = "rgba(255,255,255,0.03)";
        simCtx.fillRect(cellX, cellY, cell, cell);

        const gradient = simCtx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
        const glowR = Math.min(255, p.r + 25);
        const glowG = Math.min(255, p.g + 25);
        const glowB = Math.min(255, p.b + 25);
        gradient.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, 0.95)`);
        gradient.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0.85)`);

        simCtx.fillStyle = gradient;
        simCtx.beginPath();
        simCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        simCtx.fill();

        simCtx.strokeStyle = "rgba(255,255,255,0.35)";
        simCtx.lineWidth = 1;
        simCtx.stroke();
      }
    }

    simCtx.strokeStyle = "rgba(255,255,255,0.07)";
    simCtx.lineWidth = 1;
    for (let i = 0; i <= matrixW; i++) {
      const pos = i * cell + 0.5;
      simCtx.beginPath();
      simCtx.moveTo(pos, 0);
      simCtx.lineTo(pos, pixelCanvas.height);
      simCtx.stroke();
    }
    for (let i = 0; i <= matrixH; i++) {
      const pos = i * cell + 0.5;
      simCtx.beginPath();
      simCtx.moveTo(0, pos);
      simCtx.lineTo(pixelCanvas.width, pos);
      simCtx.stroke();
    }
  }

  // Export-Helfer
  function flattenToSerpentineRGB(pixels) {
    const flat = [];
    for (let y = 0; y < matrixH; y++) {
      for (let x = 0; x < matrixW; x++) {
        const p = pixels[y][x];
        const idx = y * matrixW + x;
        flat[idx] = { r: p.r, g: p.g, b: p.b, x: x, y: y, i: idx };
      }
    }
    return flat;
  }

  function getAllFinalFrames(sliders) {
    const frames = [];
    for (let f = 0; f < numFrames; f++) {
      const fd = framesData[f];
      const base = fd.basePixels || makeEmptyBase();
      const overlay = fd.overlayPixels || makeEmptyOverlay();
      frames.push(computeFinalPixelsForData(base, overlay, sliders));
    }
    return frames;
  }

  function getArduinoTransitionConst() {
    switch (transitionType) {
      case "fadeSlow": return "TRANSITION_FADE_SLOW";
      case "fadeFast": return "TRANSITION_FADE_FAST";
      case "scroll":   return "TRANSITION_SCROLL";
      case "switch":   return "TRANSITION_SWITCH";
      default:         return "TRANSITION_NONE";
    }
  }

  // Export Arduino
  function exportArduino(allFrames) {
    const total = matrixW * matrixH;
    const nf = allFrames.length;
    const lines = [];

    const durations = [];
    for (let f = 0; f < nf; f++) {
      durations.push(framesData[f].duration || 500);
    }

    lines.push("#include <Adafruit_NeoPixel.h>");
    lines.push("");
    lines.push("// Auto-generiert von NeoPixel Matrix Converter & Painter");
    lines.push("// Matrix: " + matrixW + " x " + matrixH);
    lines.push("");
    lines.push("#define PIN 6  // NeoPixel-Datenpin");
    lines.push("");
    lines.push("const uint16_t MATRIX_WIDTH  = " + matrixW + ";");
    lines.push("const uint16_t MATRIX_HEIGHT = " + matrixH + ";");
    lines.push("const uint16_t NUM_PIXELS    = " + total + ";");
    lines.push("const uint8_t  NUM_FRAMES    = " + nf + ";");
    lines.push("");
    lines.push("const uint16_t frameDurations[NUM_FRAMES] = { " +
      durations.join(", ") + " };");
    lines.push("");
    lines.push("enum TransitionType {");
    lines.push("  TRANSITION_NONE,");
    lines.push("  TRANSITION_FADE_SLOW,");
    lines.push("  TRANSITION_FADE_FAST,");
    lines.push("  TRANSITION_SCROLL,");
    lines.push("  TRANSITION_SWITCH");
    lines.push("};");
    lines.push("");
    lines.push("const uint8_t transitionType      = " + getArduinoTransitionConst() + ";");
    lines.push("const uint8_t transitionIntensity = " + transitionIntensity + ";");
    lines.push("");
    lines.push("Adafruit_NeoPixel strip(NUM_PIXELS, PIN, NEO_GRB + NEO_KHZ800);");
    lines.push("");
    lines.push("const uint8_t frames[NUM_FRAMES][NUM_PIXELS][3] = {");

    for (let f = 0; f < nf; f++) {
      const flat = flattenToSerpentineRGB(allFrames[f]);
      lines.push("  {");
      for (let i = 0; i < flat.length; i++) {
        const p = flat[i];
        lines.push("    { " + p.r + ", " + p.g + ", " + p.b + " }, // f=" + f + ", i=" + p.i + ", y=" + p.y + ", x=" + p.x);
      }
      lines.push("  }" + (f < nf - 1 ? "," : ""));
    }

    lines.push("};");
    lines.push("");
    lines.push("void showFrame(uint8_t frameIndex) {");
    lines.push("  for (uint16_t i = 0; i < NUM_PIXELS; i++) {");
    lines.push("    strip.setPixelColor(i, frames[frameIndex][i][0], frames[frameIndex][i][1], frames[frameIndex][i][2]);");
    lines.push("  }");
    lines.push("  strip.show();");
    lines.push("}");
    lines.push("");
    lines.push("void fadeBetweenFrames(uint8_t fromIndex, uint8_t toIndex, uint8_t steps, uint16_t stepDelay) {");
    lines.push("  for (uint8_t s = 1; s <= steps; s++) {");
    lines.push("    for (uint16_t i = 0; i < NUM_PIXELS; i++) {");
    lines.push("      uint8_t r1 = frames[fromIndex][i][0];");
    lines.push("      uint8_t g1 = frames[fromIndex][i][1];");
    lines.push("      uint8_t b1 = frames[fromIndex][i][2];");
    lines.push("      uint8_t r2 = frames[toIndex][i][0];");
    lines.push("      uint8_t g2 = frames[toIndex][i][1];");
    lines.push("      uint8_t b2 = frames[toIndex][i][2];");
    lines.push("      uint8_t r = (uint16_t(r1) * (steps - s) + uint16_t(r2) * s) / steps;");
    lines.push("      uint8_t g = (uint16_t(g1) * (steps - s) + uint16_t(g2) * s) / steps;");
    lines.push("      uint8_t b = (uint16_t(b1) * (steps - s) + uint16_t(b2) * s) / steps;");
    lines.push("      strip.setPixelColor(i, r, g, b);");
    lines.push("    }");
    lines.push("    strip.show();");
    lines.push("    delay(stepDelay);");
    lines.push("  }");
    lines.push("}");
    lines.push("");
    lines.push("void scrollBetweenFrames(uint8_t fromIndex, uint8_t toIndex, uint8_t smoothSteps, uint16_t stepDelay) {");
    lines.push("  uint16_t totalSteps = uint16_t(MATRIX_WIDTH) * smoothSteps;");
    lines.push("  for (uint16_t s = 0; s <= totalSteps; s++) {");
    lines.push("    for (uint16_t y = 0; y < MATRIX_HEIGHT; y++) {");
    lines.push("      for (uint16_t x = 0; x < MATRIX_WIDTH; x++) {");
    lines.push("        uint32_t shifted = uint32_t(x) * smoothSteps + s;");
    lines.push("        uint16_t baseCol = shifted / smoothSteps;");
    lines.push("        uint8_t frac = shifted % smoothSteps;");
    lines.push("        uint16_t idx1 = y * MATRIX_WIDTH + (baseCol % MATRIX_WIDTH);");
    lines.push("        uint16_t idx2 = y * MATRIX_WIDTH + ((baseCol + 1) % MATRIX_WIDTH);");
    lines.push("        bool firstFromA = baseCol < MATRIX_WIDTH;");
    lines.push("        bool secondFromA = (baseCol + 1) < MATRIX_WIDTH;");
    lines.push("        uint8_t r1 = frames[firstFromA ? fromIndex : toIndex][idx1][0];");
    lines.push("        uint8_t g1 = frames[firstFromA ? fromIndex : toIndex][idx1][1];");
    lines.push("        uint8_t b1 = frames[firstFromA ? fromIndex : toIndex][idx1][2];");
    lines.push("        uint8_t r2 = frames[secondFromA ? fromIndex : toIndex][idx2][0];");
    lines.push("        uint8_t g2 = frames[secondFromA ? fromIndex : toIndex][idx2][1];");
    lines.push("        uint8_t b2 = frames[secondFromA ? fromIndex : toIndex][idx2][2];");
    lines.push("        uint8_t r = (uint16_t(r1) * (smoothSteps - frac) + uint16_t(r2) * frac) / smoothSteps;");
    lines.push("        uint8_t g = (uint16_t(g1) * (smoothSteps - frac) + uint16_t(g2) * frac) / smoothSteps;");
    lines.push("        uint8_t b = (uint16_t(b1) * (smoothSteps - frac) + uint16_t(b2) * frac) / smoothSteps;");
    lines.push("        uint16_t outIdx = y * MATRIX_WIDTH + x;");
    lines.push("        strip.setPixelColor(outIdx, r, g, b);");
    lines.push("      }");
    lines.push("    }");
    lines.push("    strip.show();");
    lines.push("    delay(stepDelay);");
    lines.push("  }");
    lines.push("}");
    lines.push("");
    lines.push("void setup() {");
    lines.push("  strip.begin();");
    lines.push("  strip.show();");
    lines.push("}");
    lines.push("");
    lines.push("void loop() {");
    lines.push("  static uint8_t current = 0;");
    lines.push("  uint8_t next = (current + 1) % NUM_FRAMES;");
    lines.push("");
    lines.push("  showFrame(current);");
    lines.push("  delay(frameDurations[current]);");
    lines.push("");
    lines.push("  if (transitionType == TRANSITION_FADE_SLOW || transitionType == TRANSITION_FADE_FAST) {");
    lines.push("    uint8_t steps = transitionIntensity;");
    lines.push("    uint16_t stepDelay = (transitionType == TRANSITION_FADE_SLOW) ? 40 : 15;");
    lines.push("    fadeBetweenFrames(current, next, steps, stepDelay);");
    lines.push("  } else if (transitionType == TRANSITION_SCROLL) {");
    lines.push("    uint8_t smoothSteps = transitionIntensity < 2 ? 2 : transitionIntensity;");
    lines.push("    scrollBetweenFrames(current, next, smoothSteps, 16);");
    lines.push("  } else if (transitionType == TRANSITION_SWITCH) {");
    lines.push("    showFrame(next);");
    lines.push("  }");
    lines.push("  // Alle Uebergaenge sind oben umgesetzt.");
    lines.push("");
    lines.push("  current = next;");
    lines.push("}");

  return lines.join("\n");
  }

  // Export micro:bit
  function exportMicrobitTS(allFrames) {
    const total = matrixW * matrixH;
    const nf = allFrames.length;
    const lines = [];

    const durations = [];
    for (let f = 0; f < nf; f++) {
      durations.push(framesData[f].duration || 500);
    }

    lines.push("// Auto-generiert von NeoPixel Matrix Converter & Painter");
    lines.push("// Matrix: " + matrixW + " x " + matrixH + ", Serpentin: " + (serp ? "true" : "false"));
    lines.push("");
    lines.push("let width = " + matrixW);
    lines.push("let height = " + matrixH);
    lines.push("let numPixels = " + total);
    lines.push("let numFrames = " + nf);
    lines.push("let strip = neopixel.create(DigitalPin.P0, numPixels, NeoPixelMode.RGB)");
    lines.push("");
    lines.push("let frameDurations: number[] = [ " + durations.join(", ") + " ]");
    lines.push("");
    lines.push("let frames: number[][] = [");

    for (let f = 0; f < nf; f++) {
      const flat = flattenToSerpentineRGB(allFrames[f]);
      const arr = flat.map(p => {
        const hex = ((p.r << 16) | (p.g << 8) | p.b) >>> 0;
        return "0x" + hex.toString(16).padStart(6, "0");
      });
      lines.push("  [ " + arr.join(", ") + " ]" + (f < nf - 1 ? "," : ""));
    }
    lines.push("]");
    lines.push("");
    lines.push("let transitionType = \"" + transitionType + "\"");
    lines.push("let transitionIntensity = " + transitionIntensity);
    lines.push("");
    lines.push("function showFrame(idx: number) {");
    lines.push("  for (let i = 0; i < numPixels; i++) {");
    lines.push("    strip.setPixelColor(i, frames[idx][i]);");
    lines.push("  }");
    lines.push("  strip.show();");
    lines.push("}");
    lines.push("");
    lines.push("function fadeBetween(fromIdx: number, toIdx: number, steps: number, stepDelay: number) {");
    lines.push("  for (let s = 1; s <= steps; s++) {");
    lines.push("    for (let i = 0; i < numPixels; i++) {");
    lines.push("      const c1 = frames[fromIdx][i];");
    lines.push("      const c2 = frames[toIdx][i];");
    lines.push("      const r1 = (c1 >> 16) & 0xff;");
    lines.push("      const g1 = (c1 >> 8) & 0xff;");
    lines.push("      const b1 = c1 & 0xff;");
    lines.push("      const r2 = (c2 >> 16) & 0xff;");
    lines.push("      const g2 = (c2 >> 8) & 0xff;");
    lines.push("      const b2 = c2 & 0xff;");
    lines.push("      const r = Math.idiv(r1 * (steps - s) + r2 * s, steps);");
    lines.push("      const g = Math.idiv(g1 * (steps - s) + g2 * s, steps);");
    lines.push("      const b = Math.idiv(b1 * (steps - s) + b2 * s, steps);");
    lines.push("      strip.setPixelColor(i, (r << 16) | (g << 8) | b);");
    lines.push("    }");
    lines.push("    strip.show();");
    lines.push("    basic.pause(stepDelay);");
    lines.push("  }");
    lines.push("}");
    lines.push("");
    lines.push("function scrollBetween(fromIdx: number, toIdx: number, smoothSteps: number, stepDelay: number) {");
    lines.push("  const totalSteps = width * smoothSteps");
    lines.push("  for (let s = 0; s <= totalSteps; s++) {");
    lines.push("    for (let y = 0; y < height; y++) {");
    lines.push("      for (let x = 0; x < width; x++) {");
    lines.push("        const shifted = x * smoothSteps + s");
    lines.push("        const baseCol = Math.idiv(shifted, smoothSteps)");
    lines.push("        const frac = shifted % smoothSteps");
    lines.push("        const idx1 = y * width + (baseCol % width)");
    lines.push("        const idx2 = y * width + ((baseCol + 1) % width)");
    lines.push("        const firstFromA = baseCol < width");
    lines.push("        const secondFromA = (baseCol + 1) < width");
    lines.push("        const c1 = firstFromA ? frames[fromIdx][idx1] : frames[toIdx][idx1]");
    lines.push("        const c2 = secondFromA ? frames[fromIdx][idx2] : frames[toIdx][idx2]");
    lines.push("        const r1 = (c1 >> 16) & 0xff");
    lines.push("        const g1 = (c1 >> 8) & 0xff");
    lines.push("        const b1 = c1 & 0xff");
    lines.push("        const r2 = (c2 >> 16) & 0xff");
    lines.push("        const g2 = (c2 >> 8) & 0xff");
    lines.push("        const b2 = c2 & 0xff");
    lines.push("        const r = Math.idiv(r1 * (smoothSteps - frac) + r2 * frac, smoothSteps)");
    lines.push("        const g = Math.idiv(g1 * (smoothSteps - frac) + g2 * frac, smoothSteps)");
    lines.push("        const b = Math.idiv(b1 * (smoothSteps - frac) + b2 * frac, smoothSteps)");
    lines.push("        strip.setPixelColor(y * width + x, (r << 16) | (g << 8) | b)");
    lines.push("      }");
    lines.push("    }");
    lines.push("    strip.show();");
    lines.push("    basic.pause(stepDelay);");
    lines.push("  }");
    lines.push("}");
    lines.push("");
    lines.push("basic.forever(function () {");
    lines.push("  let current = 0");
    lines.push("  while (true) {");
    lines.push("    let next = (current + 1) % numFrames");
    lines.push("    showFrame(current)");
    lines.push("    basic.pause(frameDurations[current])");
    lines.push("    if (transitionType == \"fadeSlow\" || transitionType == \"fadeFast\") {");
    lines.push("      const steps = transitionIntensity");
    lines.push("      const stepDelay = (transitionType == \"fadeSlow\") ? 40 : 15");
    lines.push("      fadeBetween(current, next, steps, stepDelay)");
    lines.push("    } else if (transitionType == \"scroll\") {");
    lines.push("      const smoothSteps = Math.max(transitionIntensity, 2)");
    lines.push("      scrollBetween(current, next, smoothSteps, 16)");
    lines.push("    } else if (transitionType == \"switch\") {");
    lines.push("      showFrame(next)");
    lines.push("    }");
    lines.push("    current = next");
    lines.push("  }");
    lines.push("})");

    return lines.join("\n");
  }

  // Animation im Browser
  function blendFrames(a, b, t) {
    const h = matrixH;
    const w = matrixW;
    const out = new Array(h);
    const inv = 1 - t;
    for (let y = 0; y < h; y++) {
      const row = new Array(w);
      for (let x = 0; x < w; x++) {
        const pa = a[y][x];
        const pb = b[y][x];
        row[x] = {
          r: Math.round(pa.r * inv + pb.r * t),
          g: Math.round(pa.g * inv + pb.g * t),
          b: Math.round(pa.b * inv + pb.b * t)
        };
      }
      out[y] = row;
    }
    return out;
  }

  function scrollFrames(a, b, t) {
    const h = matrixH;
    const w = matrixW;
    const out = new Array(h);
    const shift = t * w;
    for (let y = 0; y < h; y++) {
      const row = new Array(w);
      for (let x = 0; x < w; x++) {
        const src = x + shift;
        const base = Math.floor(src);
        const frac = src - base;

        const idxA = base % w;
        const idxB = (base + 1) % w;

        const useFromA1 = base < w;
        const useFromA2 = (base + 1) < w;

        const p1 = useFromA1 ? a[y][idxA] : b[y][idxA];
        const p2 = useFromA2 ? a[y][idxB] : b[y][idxB];

        row[x] = {
          r: Math.round(p1.r * (1 - frac) + p2.r * frac),
          g: Math.round(p1.g * (1 - frac) + p2.g * frac),
          b: Math.round(p1.b * (1 - frac) + p2.b * frac)
        };
      }
      out[y] = row;
    }
    return out;
  }

  function animationLoop(timestamp) {
    if (!previewPlaying) return;
    if (!previewFrames.length) {
      stopPreviewAnimation();
      return;
    }

    if (previewLastTimestamp === null) {
      previewLastTimestamp = timestamp;
    }
    const dt = timestamp - previewLastTimestamp;
    previewLastTimestamp = timestamp;
    previewStateElapsed += dt;

    const currentIndex = previewCurrentFrameIndex;
    const nextIndex = (currentIndex + 1) % previewFrames.length;
    const holdDuration = Math.max(10, previewDurations[currentIndex] || 500);

    const animatedTransition =
      transitionType === "fadeSlow" || transitionType === "fadeFast" || transitionType === "scroll";

    if (animatedTransition) {
      const isFade = transitionType === "fadeSlow" || transitionType === "fadeFast";
      const durationBase = isFade
        ? (transitionType === "fadeSlow" ? 40 : 18)
        : Math.max(16, 55 - transitionIntensity * 3);
      const transitionTotal = isFade
        ? durationBase * transitionIntensity
        : Math.max(durationBase * matrixW, durationBase * 12);

      if (previewState === "hold") {
        if (previewStateElapsed >= holdDuration) {
          previewState = "transition";
          previewStateElapsed = 0;
        }
        drawSimulator(previewFrames[currentIndex]);
      } else if (previewState === "transition") {
        const t = transitionTotal > 0 ? previewStateElapsed / transitionTotal : 1;
        if (t >= 1) {
          previewCurrentFrameIndex = nextIndex;
          currentFrameInfo.textContent =
            "Frame " + (previewCurrentFrameIndex + 1) + " / " + previewFrames.length;
          previewState = "hold";
          previewStateElapsed = 0;
          drawSimulator(previewFrames[previewCurrentFrameIndex]);
        } else {
          const frameA = previewFrames[currentIndex];
          const frameB = previewFrames[nextIndex];
          const blended = isFade ? blendFrames(frameA, frameB, t) : scrollFrames(frameA, frameB, t);
          drawSimulator(blended);
        }
      }
    } else {
      // keine animierte Ueberblendung: entweder direkt wechseln oder hart umschalten
      if (previewStateElapsed >= holdDuration) {
        previewCurrentFrameIndex = nextIndex;
        currentFrameInfo.textContent =
          "Frame " + (previewCurrentFrameIndex + 1) + " / " + previewFrames.length;
        previewStateElapsed = 0;
      }
      drawSimulator(previewFrames[previewCurrentFrameIndex]);
    }

    animationFrameHandle = requestAnimationFrame(animationLoop);
  }

  function startPreviewAnimation() {
    if (!previewFrames.length) return;
    previewPlaying = true;
    playPauseBtn.textContent = "⏸ Animation pausieren";
    previewState = "hold";
    previewStateElapsed = 0;
    previewLastTimestamp = null;
    if (animationFrameHandle !== null) {
      cancelAnimationFrame(animationFrameHandle);
    }
    animationFrameHandle = requestAnimationFrame(animationLoop);
  }

  function stopPreviewAnimation() {
    previewPlaying = false;
    playPauseBtn.textContent = "▶ Animation starten";
    if (animationFrameHandle !== null) {
      cancelAnimationFrame(animationFrameHandle);
      animationFrameHandle = null;
    }
    // aktuelles Frame statisch zeigen
    if (previewFrames.length) {
      drawSimulator(previewFrames[previewCurrentFrameIndex]);
    }
  }

  // Preview, Export, Frames
  function updatePreviewAndExport() {
    if (!basePixels) {
      basePixels = makeEmptyBase();
    }
    if (!overlayPixels) {
      overlayPixels = makeEmptyOverlay();
    }

    saveCurrentFrame();

    const sliders = getSliderValues();
    updateSliderLabels(sliders);

    const finalPixelsCurrent = computeFinalPixels(sliders);
    if (!finalPixelsCurrent) return;

    // alle Frames fuer Export und Vorschau berechnen
    const allFrames = getAllFinalFrames(sliders);

    // Preview-Daten aktualisieren
    previewFrames = allFrames;
    const durations = [];
    for (let f = 0; f < numFrames; f++) {
      durations.push(framesData[f].duration || 500);
    }
    previewDurations = durations;
    previewState = "hold";
    previewStateElapsed = 0;
    previewLastTimestamp = null;
    if (previewCurrentFrameIndex >= previewFrames.length) {
      previewCurrentFrameIndex = 0;
    }
    currentFrameInfo.textContent =
      "Frame " + (previewCurrentFrameIndex + 1) + " / " + previewFrames.length;

    // wenn nicht animiert, aktuelles Frame anzeigen
    if (!previewPlaying) {
      drawSimulator(finalPixelsCurrent);
    }

    // Code generieren
    let text;
    if (boardSelect.value === "arduino") {
      text = exportArduino(allFrames);
    } else {
      text = exportMicrobitTS(allFrames);
    }
    output.value = text;
  }

  // Farbauswahl / CMYK
  function setCurrentColorFromRGB(r, g, b) {
    currentColor = { r: r, g: g, b: b };
    selectedColorPreview.style.backgroundColor = "rgb(" + r + "," + g + "," + b + ")";
    selectedColorLabel.textContent = "R:" + r + " G:" + g + " B:" + b;
  }

  function hexToRgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    const num = parseInt(h, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function buildPalette() {
    paletteColors.forEach(function (hex, idx) {
      const swatch = document.createElement("div");
      swatch.style.width = "1.4rem";
      swatch.style.height = "1.4rem";
      swatch.style.border = "1px solid #444";
      swatch.style.cursor = "pointer";
      swatch.style.backgroundColor = hex;
      swatch.addEventListener("click", function () {
        const rgb = hexToRgb(hex);
        setCurrentColorFromRGB(rgb.r, rgb.g, rgb.b);
        if (selectedPaletteElement) {
          selectedPaletteElement.style.outline = "none";
        }
        swatch.style.outline = "2px solid #fff";
        swatch.style.outlineOffset = "-2px";
        selectedPaletteElement = swatch;
      });
      paletteContainer.appendChild(swatch);
      if (idx === 0) {
        swatch.click();
      }
    });
  }

  // Malen
  function paintAtClientPosition(clientX, clientY) {
    const rect = pixelCanvas.getBoundingClientRect();
    const scaleX = pixelCanvas.width / rect.width;
    const scaleY = pixelCanvas.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    const cellW = pixelCanvas.width / matrixW;
    const cellH = pixelCanvas.height / matrixH;

    const px = Math.floor(canvasX / cellW);
    const py = Math.floor(canvasY / cellH);

    if (px < 0 || px >= matrixW || py < 0 || py >= matrixH) return;

    if (!overlayPixels) {
      overlayPixels = makeEmptyOverlay();
    }
    overlayPixels[py][px] = {
      r: currentColor.r,
      g: currentColor.g,
      b: currentColor.b
    };
    updatePreviewAndExport();
  }

  function downloadSettingsFile() {
    const snapshot = snapshotSettings();
    const text = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neopixel-einstellungen.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    message.textContent = "Einstellungen gespeichert.";
  }

  function handleUploadFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const obj = JSON.parse(e.target.result);
        loadSettingsObject(obj);
      } catch (err) {
        message.textContent = "Datei konnte nicht gelesen werden.";
      }
    };
    reader.readAsText(file);
  }

  // Events
  fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    loadImageFromFile(file);
  });

  resetBtn.addEventListener("click", function () {
    resetAll();
  });

  saveBtn.addEventListener("click", function () {
    downloadSettingsFile();
  });

  uploadBtn.addEventListener("click", function () {
    uploadInput.value = "";
    uploadInput.click();
  });

  uploadInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    handleUploadFile(file);
  });

  fitMode.addEventListener("change", function () {
    if (lastImage) {
      processImageToMatrix(lastImage);
    } else {
      resetStateButKeepSettings();
      updatePreviewAndExport();
    }
  });

  brightnessInput.addEventListener("input", updatePreviewAndExport);
  contrastInput.addEventListener("input", updatePreviewAndExport);
  saturationInput.addEventListener("input", updatePreviewAndExport);
  gammaInput.addEventListener("input", updatePreviewAndExport);
  invertColorsInput.addEventListener("change", updatePreviewAndExport);
  mirrorHInput.addEventListener("change", updatePreviewAndExport);

  boardSelect.addEventListener("change", updatePreviewAndExport);

  matrixWidthInput.addEventListener("change", function () {
    clampMatrixSize();
    initFramesData();
    updatePreviewAndExport();
  });

  matrixHeightInput.addEventListener("change", function () {
    clampMatrixSize();
    initFramesData();
    updatePreviewAndExport();
  });

  frameCountSlider.addEventListener("input", function () {
    let val = parseInt(frameCountSlider.value, 10) || 1;
    if (val < 1) val = 1;
    if (val > MAX_FRAMES) val = MAX_FRAMES;
    numFrames = val;
    frameCountValue.textContent = String(numFrames);
    if (currentFrame >= numFrames) {
      loadFrame(numFrames - 1);
    } else {
      updateFrameButtons();
      updatePreviewAndExport();
    }
  });

  frameDurationSlider.addEventListener("input", function () {
    const val = parseInt(frameDurationSlider.value, 10) || 0;
    frameDurationValue.textContent = String(val);
    if (framesData[currentFrame]) {
      framesData[currentFrame].duration = val;
    }
  });

  duplicateFrameBtn.addEventListener("click", function () {
    if (numFrames >= MAX_FRAMES) return;
    saveCurrentFrame();
    const src = framesData[currentFrame];
    const targetIndex = numFrames;
    framesData[targetIndex].basePixels = clonePixels(src.basePixels);
    framesData[targetIndex].overlayPixels = clonePixels(src.overlayPixels);
    framesData[targetIndex].duration = src.duration;
    numFrames++;
    frameCountSlider.value = numFrames;
    frameCountValue.textContent = String(numFrames);
    updateFrameButtons();
    updatePreviewAndExport();
  });

  transitionTypeContainer.addEventListener("change", function (e) {
    if (e.target && e.target.name === "transitionType") {
      transitionType = e.target.value;
      if (transitionType === "none" || transitionType === "switch") {
        transitionExtra.style.display = "none";
      } else {
        transitionExtra.style.display = "block";
      }
      updatePreviewAndExport();
    }
  });

  transitionIntensitySlider.addEventListener("input", function () {
    transitionIntensity = parseInt(transitionIntensitySlider.value, 10) || 1;
    transitionIntensityValue.textContent = String(transitionIntensity);
    updatePreviewAndExport();
  });

  playPauseBtn.addEventListener("click", function () {
    if (previewPlaying) {
      stopPreviewAnimation();
    } else {
      startPreviewAnimation();
    }
  });

  pixelCanvas.addEventListener("mousedown", function (e) {
    isPainting = true;
    paintAtClientPosition(e.clientX, e.clientY);
  });

  pixelCanvas.addEventListener("mousemove", function (e) {
    if (!isPainting) return;
    paintAtClientPosition(e.clientX, e.clientY);
  });

  window.addEventListener("mouseup", function () {
    isPainting = false;
  });

  pixelCanvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    isPainting = true;
    if (e.touches.length > 0) {
      const t = e.touches[0];
      paintAtClientPosition(t.clientX, t.clientY);
    }
  }, { passive: false });

  pixelCanvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (!isPainting) return;
    if (e.touches.length > 0) {
      const t = e.touches[0];
      paintAtClientPosition(t.clientX, t.clientY);
    }
  }, { passive: false });

  window.addEventListener("touchend", function () {
    isPainting = false;
  });

  copyBtn.addEventListener("click", function () {
    if (!output.value.trim()) {
      copyStatus.textContent = "Nichts zu kopieren.";
      return;
    }
    navigator.clipboard.writeText(output.value)
      .then(function () {
        copyStatus.textContent = "Kopiert.";
        setTimeout(function () { copyStatus.textContent = ""; }, 1500);
      })
      .catch(function () {
        copyStatus.textContent = "Kopieren nicht moeglich.";
      });
  });

  // Initialisierung
  buildPalette();
  clampMatrixSize();
  initFramesData();
  resizePixelCanvas();
  transitionIntensityValue.textContent = String(transitionIntensity);
  updatePreviewAndExport();

  window.addEventListener("resize", function () {
    resizePixelCanvas();
    if (!previewPlaying && previewFrames.length) {
      drawSimulator(previewFrames[previewCurrentFrameIndex]);
    }
  });
})();
