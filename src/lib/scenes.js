/* Secuencias explícitas: cada fase espera a que termine la anterior. */
import { CONFIG } from "./constants";
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

export const Scenes = {
  show(id) {
    const el = document.getElementById(id);
    el.hidden = false;
    el.inert = false;
  },
  hide(id) {
    const el = document.getElementById(id);
    el.inert = true;
    el.hidden = true;
  },
  progress(step) {
    document.querySelectorAll(".journey li").forEach((el, i) => {
      el.classList.toggle("is-complete", i < step);
      if (i === step) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
  },
};

export const DoorFX = {
  async open(el) {
    const t = CONFIG.timings;
    el.inert = true;
    el.classList.remove("gone", "closing", "open", "content-visible", "line-visible");
    await nextFrame();
    void el.offsetWidth;
    el.classList.add("line-visible");
    await wait(t.doorLine);
    el.classList.add("open");
    await wait(t.doorExpand);
    el.classList.add("content-visible");
    await wait(t.doorContent + 7 * t.doorStagger);
    el.inert = false;
  },
  async close(el) {
    const t = CONFIG.timings;
    el.inert = true;
    el.classList.add("closing");
    await wait(t.doorContentOut);
    el.classList.remove("content-visible", "open");
    await wait(t.doorExpand);
    el.classList.add("gone");
    await wait(t.doorVanish);
  },
};

export function fitIntroText() {
  const el = document.getElementById("intro-text");
  el.style.fontSize = "";
  const width = el.parentElement.clientWidth;
  const widest = Math.max(0, ...[...el.children].map((line) => line.getBoundingClientRect().width));
  if (widest > width && width > 0) {
    el.style.fontSize = parseFloat(getComputedStyle(el).fontSize) * width / widest * 0.98 + "px";
  }
}

function prepareIntroText(text, invitation = false) {
  const el = document.getElementById("intro-text");
  el.classList.remove("materialized");
  el.classList.toggle("invitation", invitation);
  el.setAttribute("aria-hidden", "true");
  el.replaceChildren();
  for (const line of Array.isArray(text) ? text : [text]) {
    const span = document.createElement("span");
    span.className = "intro-line";
    span.textContent = line;
    el.appendChild(span);
  }
  fitIntroText();
  return el;
}

export async function runBootSequence() {
  const t = CONFIG.timings;
  const container = document.getElementById("boot-lines");
  for (let i = 0; i < CONFIG.bootLines.length; i++) {
    const line = document.createElement("div");
    line.className = "boot-line";
    line.textContent = CONFIG.bootLines[i];
    container.appendChild(line);
    const percent = Math.round((i + 1) / CONFIG.bootLines.length * 100);
    document.getElementById("boot-progress").style.width = percent + "%";
    document.getElementById("boot-percent").textContent = String(percent).padStart(2, "0") + "%";
    await wait(t.bootLineDelay);
  }
  document.getElementById("boot-status").textContent = CONFIG.copy.boot.ready;
  await wait(t.bootHold);
  const boot = document.getElementById("boot");
  boot.classList.add("boot-done");
  await wait(t.bootFade);
  boot.remove();
}

export async function runIntroSequence(particles) {
  const t = CONFIG.timings;
  const phase = (name) => { document.body.dataset.phase = name; };
  const materialize = async (text, isInvitation) => {
    const el = prepareIntroText(text, isInvitation);
    await particles.formText(el);
    await wait(CONFIG.particles.formedHold);
    el.classList.add("materialized");
    el.removeAttribute("aria-hidden");
    await particles.merge();
  };

  phase("ring");
  await wait(t.initialRing);
  phase("welcome");
  await materialize(CONFIG.bienvenida, false);
  await wait(t.welcomeHold);

  phase("reform");
  document.getElementById("intro-text").classList.remove("materialized");
  document.getElementById("intro-text").setAttribute("aria-hidden", "true");
  await particles.reform();
  await wait(t.reformPause);

  phase("invitation");
  await materialize(CONFIG.invitacion, true);
  await wait(t.invitationHold);
  phase("ready");
  const actions = document.getElementById("intro-actions");
  actions.hidden = false;
  document.getElementById("intro-stage").classList.add("ready");
  await nextFrame();
  void actions.offsetWidth;
  actions.classList.add("visible");
  await wait(t.sceneFade);
  actions.inert = false;
  document.getElementById("btn-accept").disabled = false;
}
