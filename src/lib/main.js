/* Orquestación y formulario de confirmación. No hay peticiones de registro. */
import { CONFIG } from "./constants";
import { ParticleSystem } from "./particles";
import { wait, Scenes, DoorFX, runBootSequence, runIntroSequence } from "./scenes";

export async function runExperience() {
  const copy = (path) => path.split(".").reduce((obj, key) => obj[key], CONFIG.copy);
  document.querySelectorAll("[data-copy]").forEach((el) => { el.textContent = copy(el.dataset.copy); });
  document.querySelectorAll("[data-placeholder]").forEach((el) => { el.placeholder = copy(el.dataset.placeholder); });
  document.title = CONFIG.copy.title;
  const cssTimes = {
    "scene-fade": CONFIG.timings.sceneFade, "merge-duration": CONFIG.particles.mergeDuration,
    "boot-fade": CONFIG.timings.bootFade, "door-expand": CONFIG.timings.doorExpand,
    "door-content": CONFIG.timings.doorContent, "door-stagger": CONFIG.timings.doorStagger,
    "door-content-out": CONFIG.timings.doorContentOut, "door-vanish": CONFIG.timings.doorVanish,
  };
  for (const [key, value] of Object.entries(cssTimes)) document.documentElement.style.setProperty("--" + key, value + "ms");
  initCustomCursor();
  const particles = new ParticleSystem(document.getElementById("particles"), CONFIG.colors, CONFIG.particles);
  const btnAccept = document.getElementById("btn-accept");
  const form = document.getElementById("assistance-form");
  const btnSubmit = document.getElementById("btn-submit");
  const inputDni = document.getElementById("input-dni");
  const inputName = document.getElementById("input-name");
  const isDigits = (value) => /^\d+$/.test(value);
  const fields = [
    { input: inputDni, block: document.getElementById("field-dni"), error: document.getElementById("error-dni"), digits: CONFIG.validation.dniDigits },
    { input: inputName, block: document.getElementById("field-name"), error: document.getElementById("error-name"), min: CONFIG.validation.nameMin },
  ];
  let submitted = false;
  let accepted = false;
  let validated = false;

  document.getElementById("confirm-address").textContent = CONFIG.direccion;
  document.getElementById("confirm-datetime").textContent = CONFIG.fechaHora;
  document.getElementById("btn-maps").href = CONFIG.mapsUrl;

  const updateFields = (showErrors = false) => {
    let count = 0;
    for (const f of fields) {
      const value = f.input.value.trim();
      const valid = f.digits ? value.length === f.digits && isDigits(value) : value.length >= f.min;
      const invalid = showErrors && !valid;
      count += Number(valid);
      f.block.classList.toggle("valid", valid);
      f.block.classList.toggle("invalid", invalid);
      f.error.hidden = !invalid;
      f.input.setAttribute("aria-invalid", String(invalid));
      f.block.querySelector(".input-indicator").textContent = invalid ? "!" : valid ? "✓" : "↳";
    }
    document.getElementById("field-progress").textContent = CONFIG.copy.form.progress.replace("{count}", String(count).padStart(2, "0"));
    return count === fields.length;
  };
  for (const f of fields) {
    if (!f.digits) f.input.minLength = f.min;
    f.input.addEventListener("input", () => {
      if (f.digits) f.input.value = f.input.value.replace(/\D/g, "").slice(0, f.digits);
      updateFields(validated);
    });
  }
  updateFields();

  btnAccept.addEventListener("click", async (event) => {
    if (accepted || btnAccept.disabled) return;
    accepted = true;
    btnAccept.disabled = true;
    document.getElementById("intro-actions").inert = true;
    document.getElementById("intro-actions").classList.remove("visible");
    document.getElementById("scene-intro").inert = true;
    document.getElementById("scene-intro").classList.add("leaving");
    particles.scatter();
    particles.canvas.classList.add("faded");
    await wait(CONFIG.timings.sceneFade);
    particles.pause();
    particles.canvas.style.visibility = "hidden";
    Scenes.hide("scene-intro");
    document.body.dataset.stage = "form";
    Scenes.progress(1);
    Scenes.show("scene-form");
    await DoorFX.open(form);
    if (event.detail === 0 || matchMedia("(pointer: fine)").matches) inputDni.focus({ preventScroll: true });
    else {
      const heading = document.getElementById("form-title");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitted || form.inert) return;
    validated = true;
    if (!updateFields(true)) {
      fields.find((f) => f.input.getAttribute("aria-invalid") === "true").input.focus();
      return;
    }
    submitted = true;
    // Capturar antes del reset; nunca usar innerHTML con datos del invitado.
    const guestName = inputName.value.trim().replace(/\s+/g, " ");
    btnSubmit.disabled = true;
    for (const f of fields) f.input.readOnly = true;
    form.setAttribute("aria-busy", "true");
    document.getElementById("submit-label").textContent = CONFIG.copy.form.submitting;
    const process = document.getElementById("process-console");
    process.hidden = false;
    for (const text of CONFIG.copy.form.processLines) {
      const line = document.createElement("div");
      line.className = "pc-line";
      line.textContent = text;
      process.appendChild(line);
      await wait(CONFIG.timings.processLine);
    }
    await wait(CONFIG.fakeSubmitDelay);
    form.removeAttribute("aria-busy");
    await DoorFX.close(form);
    Scenes.hide("scene-form");
    form.reset();
    document.getElementById("confirm-greeting").textContent = CONFIG.copy.confirm.greeting.replace("{nombre}", () => guestName);
    document.body.dataset.stage = "confirm";
    Scenes.progress(2);
    Scenes.show("scene-confirm");
    window.scrollTo({ top: 0, behavior: "instant" });
    await DoorFX.open(document.getElementById("confirm-panel"));
    document.getElementById("confirm-greeting").focus({ preventScroll: true });
  });

  // La fuente puede fallar sin bloquear la experiencia. Una carga tardía
  // vuelve a medir el texto a través de ParticleSystem.
  await Promise.all([runBootSequence(), Promise.race([document.fonts.ready, wait(2000)])]);
  document.body.dataset.stage = "intro";
  Scenes.show("scene-intro");
  particles.resume();
  await runIntroSequence(particles);
}

function initCustomCursor() {
  const fine = matchMedia("(pointer: fine)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const outer = document.getElementById("cursorOuter");
  const inner = document.getElementById("cursorInner");
  let x = 0, y = 0, ox = 0, oy = 0, frame = 0, active = false;
  const stop = () => {
    active = false;
    cancelAnimationFrame(frame);
    frame = 0;
    document.body.classList.remove("custom-cursor");
  };
  const draw = () => {
    if (!active) return;
    ox += (x - ox) * CONFIG.timings.cursorEase;
    oy += (y - oy) * CONFIG.timings.cursorEase;
    outer.style.transform = "translate(" + ox + "px," + oy + "px) translate(-50%, -50%)";
    if (Math.abs(x - ox) + Math.abs(y - oy) > 0.1) frame = requestAnimationFrame(draw);
    else frame = 0;
  };
  document.addEventListener("pointermove", (event) => {
    if (!fine.matches || reduced.matches || event.pointerType === "touch") { stop(); return; }
    x = event.clientX; y = event.clientY;
    if (!active) { ox = x; oy = y; active = true; document.body.classList.add("custom-cursor"); }
    inner.style.transform = "translate(" + x + "px," + y + "px) translate(-50%, -50%)";
    outer.classList.toggle("is-hovering", Boolean(event.target.closest("a, button, input, label")));
    if (!frame) frame = requestAnimationFrame(draw);
  });
  document.documentElement.addEventListener("pointerleave", stop);
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  fine.addEventListener("change", stop);
  reduced.addEventListener("change", stop);
}
