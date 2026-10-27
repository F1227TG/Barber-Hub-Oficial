/* Progressive enhancement: content is visible and links work without JavaScript. */
(() => {
  'use strict';
  document.querySelectorAll('[data-bh-preview]').forEach(preview => {
    const buttons = preview.querySelectorAll('[data-preview-target]');
    const panels = preview.querySelectorAll('[data-preview-panel]');
    buttons.forEach(button => button.addEventListener('click', () => {
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      panels.forEach(panel => { panel.hidden = panel.id !== button.dataset.previewTarget; });
    }));
    preview.classList.add('is-ready');
    buttons[0]?.click();
  });
  if (document.body.classList.contains('reduzir-movimento') || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('bh-reveal');
    observer.unobserve(entry.target);
  }), { threshold: .12 });
  document.querySelectorAll('.home-journey article, .home-metric-card, .story-copy, .showcase-copy, .mobile-action-card, .about-manifesto').forEach(element => observer.observe(element));
})();
