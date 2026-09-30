import {SITE_CONFIG} from './site-config.js';
let revealObserver;
export function revealElements() {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.documentElement.classList.add('motion-enabled');
  revealObserver ||= new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target);}}),{threshold:.08});
  document.querySelectorAll('.reveal:not(.visible)').forEach((element,index)=>{element.style.transitionDelay=`${Math.min(index%3*70,140)}ms`;revealObserver.observe(element);});
}
export function initializeAnimations() {
  revealElements();
  const media=matchMedia('(prefers-reduced-motion: reduce)'),hero=document.querySelector('[data-parallax]');
  let framePending=false;
  const update=()=>{framePending=false;if(!hero)return;hero.style.transform=media.matches?'':`translateY(${Math.min(scrollY,800)*SITE_CONFIG.animation.parallaxStrength}px)`;};
  window.addEventListener('scroll',()=>{if(!framePending){framePending=true;requestAnimationFrame(update);}},{passive:true});
  media.addEventListener('change',()=>{if(media.matches){document.documentElement.classList.remove('motion-enabled');document.querySelectorAll('.reveal').forEach(e=>e.classList.add('visible'));}else revealElements();update();});
  const navigation=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)document.querySelectorAll('.mobile-nav a').forEach(link=>link.classList.toggle('active',link.hash===`#${entry.target.id}`));}),{rootMargin:'-10% 0px -65% 0px'});
  ['now','projects','timetable','map','my-plan'].forEach(id=>navigation.observe(document.getElementById(id)));
}
