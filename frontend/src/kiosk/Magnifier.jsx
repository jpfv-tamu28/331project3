import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const REBUILD_MS = 120;

export default function Magnifier({ sourceRef, zoom }) {
  const lensRef = useRef(null);
  const stageRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const lens = lensRef.current;
    const stage = stageRef.current;
    const ring = ringRef.current;
    const source = sourceRef.current;
    if (!lens || !stage || !source) return undefined;

    const canPopover = typeof lens.showPopover === 'function';
    const raise = () => {
      if (!canPopover) return;
      try {
        if (lens.matches(':popover-open')) lens.hidePopover();
        lens.showPopover();
      } catch {}
    };
    raise();

    let pairs = new Map();
    let openModals = 0;
    let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const place = () => {
      const w = lens.clientWidth;
      const h = lens.clientHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tx = Math.min(0, Math.max(w - vw * zoom, w / 2 - pointer.x * zoom));
      const ty = Math.min(0, Math.max(h - vh * zoom, h / 2 - pointer.y * zoom));
      stage.style.width = `${vw}px`;
      stage.style.height = `${vh}px`;
      stage.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
      ring.style.transform = `translate(${pointer.x * zoom + tx}px, ${pointer.y * zoom + ty}px)`;
    };

    const rebuild = () => {
      const rect = source.getBoundingClientRect();
      const copy = source.cloneNode(true);
      copy.setAttribute('inert', '');
      Object.assign(copy.style, {
        position: 'absolute',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
      });
      stage.replaceChildren(copy);

      const sources = [source, ...source.querySelectorAll('*')];
      const copies = [copy, ...copy.querySelectorAll('*')];
      pairs = new Map();
      let modals = 0;
      sources.forEach((el, i) => {
        const c = copies[i];
        if (!c) return;
        pairs.set(el, c);
        c.removeAttribute('id');
        if (el.scrollTop || el.scrollLeft) {
          c.scrollTop = el.scrollTop;
          c.scrollLeft = el.scrollLeft;
        }
        if (el.tagName === 'CANVAS') {
          try {
            c.getContext('2d').drawImage(el, 0, 0);
          } catch {}
        } else if (el.tagName === 'DIALOG' && el.open) {
          const r = el.getBoundingClientRect();
          Object.assign(c.style, {
            position: 'fixed',
            inset: 'auto',
            left: `${r.left}px`,
            top: `${r.top}px`,
            width: `${r.width}px`,
            height: `${r.height}px`,
            margin: '0',
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: '1001',
          });
          if (el.matches(':modal')) {
            modals += 1;
            const backdrop = document.createElement('div');
            backdrop.className = 'magnifier-backdrop';
            backdrop.style.background = getComputedStyle(el, '::backdrop').background;
            c.before(backdrop);
          }
        }
      });

      if (modals !== openModals) {
        openModals = modals;
        raise();
      }
      place();
    };

    let timer = null;
    let last = 0;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        last = performance.now();
        rebuild();
      }, Math.max(0, REBUILD_MS - (performance.now() - last)));
    };

    let frame = 0;
    const onPointer = (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          place();
        });
      }
    };

    const onScroll = (e) => {
      const copy = pairs.get(e.target);
      if (!copy) {
        schedule();
        return;
      }
      copy.scrollTop = e.target.scrollTop;
      copy.scrollLeft = e.target.scrollLeft;
    };

    const observer = new MutationObserver(schedule);
    observer.observe(source, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('input', schedule, true);
    document.addEventListener('animationend', schedule, true);
    document.addEventListener('transitionend', schedule, true);
    rebuild();

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('input', schedule, true);
      document.removeEventListener('animationend', schedule, true);
      document.removeEventListener('transitionend', schedule, true);
      stage.replaceChildren();
      if (canPopover && lens.matches(':popover-open')) lens.hidePopover();
    };
  }, [sourceRef, zoom]);

  return createPortal(
    <div ref={lensRef} className="magnifier" popover="manual" aria-hidden="true" translate="no">
      <div ref={stageRef} className="magnifier-stage" />
      <div ref={ringRef} className="magnifier-ring" />
      <span className="magnifier-zoom">{zoom}×</span>
    </div>,
    document.body,
  );
}
