"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import { runExperience } from "@/lib/main";

const order = (n: number) => ({ "--order": n }) as CSSProperties;

let started = false;

export default function Experience() {
  useEffect(() => {
    if (started) return;
    started = true;
    runExperience();
  }, []);

  return (
    <>
      <div className="cursor-outer" id="cursorOuter" aria-hidden="true" />
      <div className="cursor-inner" id="cursorInner" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="boot" id="boot" role="status" aria-live="polite">
        <div className="boot-terminal">
          <div className="boot-meta"><span data-copy="boot.label"></span><span id="boot-percent" aria-hidden="true">00%</span></div>
          <h1 data-copy="boot.title"></h1>
          <div className="boot-sequence" id="boot-lines"></div>
          <div className="boot-track" aria-hidden="true"><span id="boot-progress"></span></div>
          <div className="boot-caption"><span id="boot-status" data-copy="boot.status"></span><span className="blink" aria-hidden="true">_</span></div>
        </div>
      </div>
      <canvas id="particles" aria-hidden="true"></canvas>
      <main>
        <section id="scene-intro" className="scene intro-scene" aria-label="Invitación" inert>
          <div className="intro-stage" id="intro-stage">
            <div className="intro-text-wrap"><h1 id="intro-text" aria-live="polite" aria-atomic="true"></h1></div>
            <div className="intro-actions" id="intro-actions" hidden inert>
              <button id="btn-accept" className="btn-terminal" type="button" disabled><span data-copy="intro.accept"></span><span className="button-arrow" aria-hidden="true">↗</span></button>
            </div>
          </div>
        </section>
        <section id="scene-form" className="scene panel-scene" hidden inert aria-labelledby="form-title">
          <form id="assistance-form" className="panel-door" noValidate>
            <span className="door-beam" aria-hidden="true"></span>
            <div className="panel-surface">
              <div className="panel-top stagger" style={order(0)}><span data-copy="form.code"></span></div>
              <div className="panel-layout">
                <aside className="panel-aside">
                  <p className="eyebrow stagger" style={order(1)} data-copy="form.eyebrow"></p>
                  <h2 className="display-title stagger" style={order(2)}><span data-copy="form.headline.0"></span><span className="title-accent" data-copy="form.headline.1"></span></h2>
                  <div className="access-mark stagger" style={order(4)} aria-hidden="true"><div className="barcode"></div><span data-copy="form.tag"></span></div>
                </aside>
                <div className="panel-main">
                  <div className="stagger" style={order(3)}><h2 id="form-title" className="section-title" data-copy="form.title"></h2><p className="form-hint" id="form-hint" data-copy="form.hint"></p></div>
                  <div className="field-block stagger" id="field-dni" style={order(4)}>
                    <div className="field-heading"><label htmlFor="input-dni" data-copy="form.dni"></label><span className="field-meta" data-copy="form.dniMeta"></span></div>
                    <div className="input-shell"><span className="input-prefix" aria-hidden="true">01 /</span><input type="text" id="input-dni" name="dni" autoComplete="off" inputMode="numeric" maxLength={8} required aria-describedby="error-dni form-hint" data-placeholder="form.dniPlaceholder" /><span className="input-indicator" aria-hidden="true">↳</span></div>
                    <p className="error-msg" id="error-dni" data-copy="form.errorDni" hidden></p>
                  </div>
                  <div className="field-block stagger" id="field-name" style={order(5)}>
                    <div className="field-heading"><label htmlFor="input-name" data-copy="form.name"></label><span className="field-meta" data-copy="form.nameMeta"></span></div>
                    <div className="input-shell"><span className="input-prefix" aria-hidden="true">02 /</span><input type="text" id="input-name" name="fullname" autoComplete="name" required aria-describedby="error-name form-hint" data-placeholder="form.namePlaceholder" /><span className="input-indicator" aria-hidden="true">↳</span></div>
                    <p className="error-msg" id="error-name" data-copy="form.errorName" hidden></p>
                  </div>
                  <div className="submit-area stagger" style={order(6)}>
                    <button type="submit" id="btn-submit" className="btn-terminal btn-full"><span id="submit-label" data-copy="form.submit"></span><span className="button-arrow" aria-hidden="true">↗</span></button>
                    <div className="process-console" id="process-console" role="log" aria-live="polite" aria-relevant="additions" hidden></div>
                  </div>
                </div>
              </div>
              <div className="panel-bottom stagger" style={order(7)}><span id="field-progress"></span></div>
            </div>
          </form>
        </section>
        <section id="scene-confirm" className="scene panel-scene" hidden inert aria-labelledby="confirm-greeting">
          <div className="panel-door" id="confirm-panel">
            <span className="door-beam" aria-hidden="true"></span>
            <div className="panel-surface">
              <div className="panel-top stagger" style={order(0)}><span data-copy="confirm.code"></span><span className="panel-status"><span className="status-dot"></span><span data-copy="confirm.status"></span></span></div>
              <div className="panel-layout">
                <aside className="panel-aside">
                  <p className="eyebrow stagger" style={order(1)} data-copy="confirm.eyebrow"></p>
                  <h2 className="display-title stagger" style={order(2)}><span data-copy="confirm.headline.0"></span><span className="title-accent" data-copy="confirm.headline.1"></span></h2>
                  <div className="access-mark stagger" style={order(4)} aria-hidden="true"><div className="access-seal"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="21"/><path d="m15 24 6 6 12-12"/></svg></div><span data-copy="confirm.tag"></span></div>
                </aside>
                <div className="panel-main">
                  <div className="stagger" style={order(3)}><p className="confirm-greeting" id="confirm-greeting" tabIndex={-1}></p></div>
                  <dl className="event-details">
                    <div className="event-row stagger" style={order(4)}><dt><span aria-hidden="true">↳</span><span data-copy="confirm.addressLabel"></span></dt><dd id="confirm-address"></dd></div>
                    <div className="event-row stagger" style={order(5)}><dt><span aria-hidden="true">◷</span><span data-copy="confirm.dateLabel"></span></dt><dd id="confirm-datetime"></dd></div>
                  </dl>
                  <p className="confirm-warning stagger" style={order(5)} data-copy="confirm.warning"></p>
                  <div className="maps-action stagger" style={order(6)}><a id="btn-maps" className="btn-terminal btn-full" target="_blank" rel="noopener noreferrer"><span data-copy="confirm.maps"></span><span className="button-arrow" aria-hidden="true">↗</span></a><p data-copy="confirm.mapsHint"></p></div>
                </div>
              </div>
              <div className="panel-bottom stagger" style={order(7)}><span><span className="tiny-cross" aria-hidden="true">+</span></span><span aria-hidden="true">✓ 03/03</span></div>
            </div>
          </div>
        </section>
      </main>
      <noscript><div className="noscript">Activa JavaScript para abrir esta invitación.</div></noscript>
    </>
  );
}
