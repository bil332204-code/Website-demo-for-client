import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export default function useCinematicMotion(reduced, active, modal) {
 useEffect(() => {
  if (reduced) return;
  const compact = window.matchMedia('(max-width: 800px)').matches;
  const context = gsap.context(() => {
   gsap.from('.hero-line > span', { yPercent: 115, rotate: 3, stagger: .14, duration: 1.25, ease: 'power4.out' });
   gsap.from('.hero-intro, .hero-actions, .hero-footnote', { opacity: 0, y: 24, duration: 1, stagger: .14, delay: .55 });
   gsap.from('.hero-art', { opacity: 0, scale: .85, duration: 1.8, ease: 'power3.out', delay: .2 });
   gsap.to('.hero-art', { yPercent: compact ? 5 : 16, rotation: 6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.4 } });
   gsap.utils.toArray('[data-reveal]').forEach((element, index) => {
    gsap.from(element, {
     y: compact ? 28 : 55, opacity: 0, rotateX: compact ? 0 : 5,
     duration: 1.05, delay: element.matches('.application-card') ? (index % 3) * .09 : 0,
     ease: 'power3.out', clearProps: 'transform,opacity',
     scrollTrigger: { trigger: element, start: 'top 93%', once: true },
    });
   });
   gsap.utils.toArray('main .section-label').forEach(element => {
    gsap.from(element, { x: -20, opacity: 0, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 96%', once: true } });
   });
   gsap.utils.toArray('.application-image, .founder-image').forEach(element => {
    gsap.fromTo(element, { '--scroll-y': '15px' }, { '--scroll-y': '-15px', ease: 'none', scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
   });
   gsap.from('.journey-step', { y: 36, opacity: 0, stagger: .16, duration: .8, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '.journey', start: 'top 88%', once: true } });
   gsap.fromTo('.journey', { '--journey-progress': 0 }, { '--journey-progress': 1, scrollTrigger: { trigger: '.journey', start: 'top 85%', end: 'bottom 45%', scrub: .8 } });
   gsap.from('.learning-card', { x: compact ? 20 : 50, opacity: 0, stagger: .14, duration: 1, clearProps: 'transform,opacity', ease: 'power3.out', scrollTrigger: { trigger: '.learning-cards', start: 'top 90%', once: true } });
   gsap.fromTo('.footer-wordmark', { xPercent: -3 }, { xPercent: 3, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: 1 } });
  });
  const refresh = () => ScrollTrigger.refresh();
  document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh, { once: true });
  return () => { context.revert(); window.removeEventListener('load', refresh); };
 }, [reduced]);

 useEffect(() => {
  const elements = document.querySelectorAll('[data-motion]');
  const observer = new IntersectionObserver(entries => {
   entries.forEach(({ target, isIntersecting }) => target.classList.toggle('motion-in-view', isIntersecting));
  }, { rootMargin: '80px', threshold: 0 });
  elements.forEach(element => observer.observe(element));
  return () => { observer.disconnect(); elements.forEach(element => element.classList.remove('motion-in-view')); };
 }, [active, modal]);

 useEffect(() => {
  const updateVisibility = () => { document.documentElement.dataset.pageHidden = String(document.hidden); };
  document.addEventListener('visibilitychange', updateVisibility);
  updateVisibility();
  if (reduced) return () => document.removeEventListener('visibilitychange', updateVisibility);
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let frame = 0, latest, card, image, magnet;
  const reset = (element, names) => names.forEach(name => element?.style.removeProperty(name));
  const resetAll = () => {
   reset(card, ['--tilt-x', '--tilt-y', '--glow-x', '--glow-y']);
   reset(image, ['--pointer-x', '--pointer-y']);
   reset(magnet, ['--magnet-x', '--magnet-y']);
   card = image = magnet = null;
  };
  const move = event => {
   if (!fine.matches || event.pointerType !== 'mouse') return;
   latest = event;
   if (frame) return;
   frame = requestAnimationFrame(() => {
    frame = 0;
    const { clientX, clientY, target } = latest;
    const nextCard = target.closest?.('[data-tilt]');
    if (nextCard !== card) reset(card, ['--tilt-x', '--tilt-y', '--glow-x', '--glow-y']);
    card = nextCard;
    if (card) {
     const rect = card.getBoundingClientRect(), x = (clientX - rect.left) / rect.width, y = (clientY - rect.top) / rect.height;
     card.style.setProperty('--tilt-x', `${(y - .5) * -7}deg`);
     card.style.setProperty('--tilt-y', `${(x - .5) * 7}deg`);
     card.style.setProperty('--glow-x', `${x * 100}%`);
     card.style.setProperty('--glow-y', `${y * 100}%`);
    }
    const nextImage = target.closest?.('[data-motion-image]');
    if (nextImage !== image) reset(image, ['--pointer-x', '--pointer-y']);
    image = nextImage;
    if (image) {
     const rect = image.getBoundingClientRect();
     image.style.setProperty('--pointer-x', `${((clientX - rect.left) / rect.width - .5) * 12}px`);
     image.style.setProperty('--pointer-y', `${((clientY - rect.top) / rect.height - .5) * 9}px`);
    }
    const nextMagnet = target.closest?.('[data-magnetic]');
    if (nextMagnet !== magnet) reset(magnet, ['--magnet-x', '--magnet-y']);
    magnet = nextMagnet;
    if (magnet) {
     const rect = magnet.getBoundingClientRect();
     magnet.style.setProperty('--magnet-x', `${((clientX - rect.left) / rect.width - .5) * 9}px`);
     magnet.style.setProperty('--magnet-y', `${((clientY - rect.top) / rect.height - .5) * 7}px`);
    }
   });
  };
  const leave = event => { if (!event.relatedTarget) resetAll(); };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerout', leave);
  window.addEventListener('blur', resetAll);
  return () => {
   cancelAnimationFrame(frame); resetAll();
   document.removeEventListener('pointermove', move);
   document.removeEventListener('pointerout', leave);
   window.removeEventListener('blur', resetAll);
   document.removeEventListener('visibilitychange', updateVisibility);
  };
 }, [reduced]);
}
