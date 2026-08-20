/**
 * Barber Hub — editor reutilizável de imagens.
 * Crop/zoom/reposicionamento/rotação sem dependências externas.
 */
(() => {
  "use strict";

  const CONFIG = {
    contaAvatar: { label: "Foto do perfil", aspect: 1, output: 1000, roundPreview: true },
    barbAvatar: { label: "Foto do profissional", aspect: 1, output: 1000, roundPreview: true },
    configFoto: { label: "Foto do estabelecimento", aspect: 1, output: 1200 },
    fotoArquivo: { label: "Foto do estabelecimento", aspect: 1, output: 1200 },
    configCapa: { label: "Capa do estabelecimento", aspect: 16 / 9, output: 1600, focal: true },
    capaArquivo: { label: "Capa do estabelecimento", aspect: 16 / 9, output: 1600, focal: true },
    portfolioFotos: { label: "Foto do portfólio", aspect: "choice", output: 1400, multiple: true }
  };

  let active = null;
  const editedFilesMap = new WeakMap();

  function ensureEditor() {
    if (document.getElementById("bhImageEditor")) return document.getElementById("bhImageEditor");
    const root = document.createElement("div");
    root.id = "bhImageEditor";
    root.className = "bh-image-editor";
    root.hidden = true;
    root.innerHTML = `
      <div class="bh-image-editor-backdrop" data-image-editor-cancel></div>
      <section class="bh-image-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="bhImageEditorTitle">
        <header class="bh-image-editor-head">
          <div><span>Ajustar imagem</span><h2 id="bhImageEditorTitle">Enquadrar foto</h2></div>
          <button class="icon-btn" type="button" data-image-editor-cancel aria-label="Fechar editor"><i class="bi bi-x-lg"></i></button>
        </header>
        <div class="bh-image-editor-aspects" data-image-aspects hidden>
          <button type="button" data-aspect="original">Original</button>
          <button type="button" data-aspect="1">1:1</button>
          <button type="button" data-aspect="0.8">4:5</button>
          <button type="button" data-aspect="1.7777777778">16:9</button>
        </div>
        <div class="bh-image-editor-stage" data-round="false">
          <canvas></canvas>
          <div class="bh-image-editor-mask" aria-hidden="true"></div>
        </div>
        <div class="bh-image-editor-tip"><i class="bi bi-arrows-move"></i><span>Arraste a foto para posicionar. Use o controle para aproximar ou afastar.</span></div>
        <div class="bh-image-editor-controls">
          <button class="icon-btn" type="button" data-image-rotate aria-label="Girar foto"><i class="bi bi-arrow-clockwise"></i></button>
          <label><i class="bi bi-dash-lg"></i><input type="range" min="1" max="3" step="0.01" value="1" data-image-zoom><i class="bi bi-plus-lg"></i></label>
          <button class="btn btn-outline btn-small" type="button" data-image-reset>Redefinir</button>
        </div>
        <div class="bh-image-editor-focal" data-image-focal hidden><i class="bi bi-crosshair"></i><span>O ponto central será preservado quando a capa for cortada em tamanhos diferentes.</span></div>
        <footer class="bh-image-editor-actions">
          <button class="btn btn-outline" type="button" data-image-editor-cancel>Cancelar</button>
          <button class="btn btn-primary" type="button" data-image-editor-confirm><i class="bi bi-check2"></i> Usar imagem</button>
        </footer>
      </section>`;
    document.body.appendChild(root);

    root.querySelectorAll("[data-image-editor-cancel]").forEach(btn => btn.addEventListener("click", () => finish(null)));
    root.querySelector("[data-image-editor-confirm]").addEventListener("click", confirm);
    root.querySelector("[data-image-rotate]").addEventListener("click", () => {
      if (!active) return;
      active.rotation = (active.rotation + 90) % 360;
      resetTransform(false);
    });
    root.querySelector("[data-image-reset]").addEventListener("click", () => resetTransform(true));
    root.querySelector("[data-image-zoom]").addEventListener("input", event => {
      if (!active) return;
      active.zoom = Number(event.target.value || 1);
      clampOffsets();
      render();
    });
    root.querySelectorAll("[data-aspect]").forEach(btn => btn.addEventListener("click", () => {
      if (!active) return;
      active.aspect = btn.dataset.aspect === "original" ? "original" : Number(btn.dataset.aspect);
      root.querySelectorAll("[data-aspect]").forEach(item => item.classList.toggle("ativo", item === btn));
      resetTransform(false);
    }));

    const stage = root.querySelector(".bh-image-editor-stage");
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    stage.addEventListener("pointerdown", event => {
      if (!active) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.setPointerCapture?.(event.pointerId);
      stage.classList.add("dragging");
    });
    stage.addEventListener("pointermove", event => {
      if (!dragging || !active) return;
      const rect = stage.getBoundingClientRect();
      const sx = active.outW / Math.max(1, rect.width);
      const sy = active.outH / Math.max(1, rect.height);
      active.offsetX += (event.clientX - lastX) * sx;
      active.offsetY += (event.clientY - lastY) * sy;
      lastX = event.clientX;
      lastY = event.clientY;
      clampOffsets();
      render();
    });
    const stop = event => {
      dragging = false;
      stage.classList.remove("dragging");
      try { stage.releasePointerCapture?.(event.pointerId); } catch (_) {}
    };
    stage.addEventListener("pointerup", stop);
    stage.addEventListener("pointercancel", stop);
    document.addEventListener("keydown", event => {
      if (!root.hidden && event.key === "Escape") finish(null);
    });
    return root;
  }

  function dimensions() {
    const image = active.image;
    const aspect = active.aspect === "original" ? image.naturalWidth / image.naturalHeight : active.aspect;
    const max = active.output || 1400;
    if (aspect >= 1) return [max, Math.max(1, Math.round(max / aspect))];
    return [Math.max(1, Math.round(max * aspect)), max];
  }

  function baseScale() {
    const angle = active.rotation % 180;
    const iw = angle ? active.image.naturalHeight : active.image.naturalWidth;
    const ih = angle ? active.image.naturalWidth : active.image.naturalHeight;
    return Math.max(active.outW / iw, active.outH / ih);
  }

  function clampOffsets() {
    if (!active) return;
    const angle = active.rotation % 180;
    const iw = angle ? active.image.naturalHeight : active.image.naturalWidth;
    const ih = angle ? active.image.naturalWidth : active.image.naturalHeight;
    const scale = baseScale() * active.zoom;
    const maxX = Math.max(0, (iw * scale - active.outW) / 2);
    const maxY = Math.max(0, (ih * scale - active.outH) / 2);
    active.offsetX = Math.max(-maxX, Math.min(maxX, active.offsetX));
    active.offsetY = Math.max(-maxY, Math.min(maxY, active.offsetY));
  }

  function resetTransform(resetRotation = true) {
    if (!active) return;
    if (resetRotation) active.rotation = 0;
    active.zoom = 1;
    active.offsetX = 0;
    active.offsetY = 0;
    const [w, h] = dimensions();
    active.outW = w;
    active.outH = h;
    const root = ensureEditor();
    root.querySelector("[data-image-zoom]").value = "1";
    render();
  }

  function render() {
    if (!active) return;
    const root = ensureEditor();
    const canvas = root.querySelector("canvas");
    const [w, h] = dimensions();
    active.outW = w;
    active.outH = h;
    canvas.width = w;
    canvas.height = h;
    canvas.style.aspectRatio = `${w} / ${h}`;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    const scale = baseScale() * active.zoom;
    ctx.save();
    ctx.translate(w / 2 + active.offsetX, h / 2 + active.offsetY);
    ctx.rotate(active.rotation * Math.PI / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(active.image, -active.image.naturalWidth / 2, -active.image.naturalHeight / 2);
    ctx.restore();
  }

  function open(file, config) {
    return new Promise(resolve => {
      const root = ensureEditor();
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        active = {
          file, config, image, url, resolve,
          aspect: config.aspect === "choice" ? "original" : config.aspect,
          output: config.output || 1400,
          rotation: 0, zoom: 1, offsetX: 0, offsetY: 0, outW: 1, outH: 1
        };
        root.hidden = false;
        document.body.classList.add("image-editor-open");
        root.querySelector("#bhImageEditorTitle").textContent = config.label || "Ajustar imagem";
        root.querySelector("[data-image-aspects]").hidden = config.aspect !== "choice";
        root.querySelector("[data-image-focal]").hidden = !config.focal;
        root.querySelector(".bh-image-editor-stage").dataset.round = config.roundPreview ? "true" : "false";
        root.querySelectorAll("[data-aspect]").forEach(btn => btn.classList.toggle("ativo", btn.dataset.aspect === "original"));
        resetTransform(false);
      };
      image.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      image.src = url;
    });
  }

  function finish(file) {
    if (!active) return;
    const { resolve, url } = active;
    URL.revokeObjectURL(url);
    active = null;
    const root = ensureEditor();
    root.hidden = true;
    document.body.classList.remove("image-editor-open");
    resolve(file);
  }

  function confirm() {
    if (!active) return;
    const canvas = ensureEditor().querySelector("canvas");
    const source = active.file;
    const type = source.type === "image/png" ? "image/png" : "image/webp";
    const quality = type === "image/png" ? undefined : .9;
    canvas.toBlob(blob => {
      if (!blob) return finish(source);
      const base = source.name.replace(/\.[^.]+$/, "");
      const ext = type === "image/png" ? "png" : "webp";
      const edited = new File([blob], `${base}-ajustada.${ext}`, { type, lastModified: Date.now() });
      finish(edited);
    }, type, quality);
  }

  function replaceInputFiles(input, files) {
    editedFilesMap.set(input, files);
    if (typeof DataTransfer === "undefined") return false;
    try {
      const transfer = new DataTransfer();
      files.forEach(file => transfer.items.add(file));
      input.files = transfer.files;
      return true;
    } catch (_) {
      return false;
    }
  }

  async function intercept(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
    const config = CONFIG[input.id];
    if (!config || !input.files?.length) return;
    if (input.dataset.bhImageEditorBypass === "1") {
      delete input.dataset.bhImageEditorBypass;
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
    const originals = [...input.files];
    const edited = [];
    for (const file of originals) {
      const result = await open(file, config);
      edited.push(result || file);
    }
    replaceInputFiles(input, edited);
    input.dataset.bhImageEditorBypass = "1";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  document.addEventListener("change", intercept, true);
  window.bhAbrirEditorImagem = open;
  window.bhArquivosImagem = input => editedFilesMap.get(input) || [...(input?.files || [])];
  window.bhArquivoImagem = input => window.bhArquivosImagem(input)[0] || null;
})();
