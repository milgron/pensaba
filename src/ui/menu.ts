import { t, getLang, setLang } from '../i18n';
import { state } from '../state';
import {
  startWhiteNoise, stopWhiteNoise, isPlaying, isAudioEnabled,
  setVolume, getStoredVolume, setFrequency, getStoredFrequency,
} from './audio';

let menuOpen = false;
let menuBar: HTMLDivElement | null = null;
let trigger: HTMLButtonElement | null = null;
let statsInterval: ReturnType<typeof setInterval> | null = null;

export function initMenu(uiRoot: HTMLElement): void {
  trigger = document.createElement('button');
  trigger.className = 'menu-trigger';
  trigger.innerHTML = '<span></span><span></span><span></span>';
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(uiRoot);
  });
  document.body.appendChild(trigger);

  document.addEventListener('click', (e) => {
    if (menuOpen && menuBar && !menuBar.contains(e.target as Node) && e.target !== trigger) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) closeMenu();
  });
}

function toggleMenu(uiRoot: HTMLElement): void {
  if (menuOpen) {
    closeMenu();
  } else {
    openMenu(uiRoot);
  }
}

function getOnlineCount(): number {
  // Self + remote cursors
  return 1 + state.cursors.size;
}

function getThoughtCount(): number {
  return state.thoughts.size;
}

function updateStats(): void {
  if (!menuBar) return;
  const onlineEl = menuBar.querySelector('.stat-online');
  const thoughtsEl = menuBar.querySelector('.stat-thoughts');
  if (onlineEl) onlineEl.textContent = String(getOnlineCount());
  if (thoughtsEl) thoughtsEl.textContent = String(getThoughtCount());
}

function openMenu(uiRoot: HTMLElement): void {
  if (menuBar) menuBar.remove();

  menuBar = document.createElement('div');
  menuBar.className = 'menu-bar';

  const lang = getLang();
  const vol = getStoredVolume();
  const freq = getStoredFrequency();

  menuBar.innerHTML = `
    <div class="menu-row menu-row-header">
      <div class="menu-center">
        <span class="menu-stat"><span class="menu-stat-value stat-online">${getOnlineCount()}</span> ${t('menu.online')}</span>
        <span class="menu-stat-sep">/</span>
        <span class="menu-stat"><span class="menu-stat-value stat-thoughts">${getThoughtCount()}</span> ${t('menu.thoughts_today')}</span>
      </div>
      <button class="menu-close" data-action="close">&times;</button>
    </div>
    <div class="menu-row menu-row-audio">
      <div class="menu-audio-controls">
        <button class="menu-audio-toggle" data-action="audio-toggle" aria-label="toggle audio">${isPlaying() ? '⏸' : '▶'}</button>
        <label class="menu-slider-label">${t('menu.volume')}</label>
        <input type="range" class="menu-slider" data-control="volume" min="0" max="100" value="${Math.round(vol * 100)}" />
      </div>
      <div class="menu-audio-controls">
        <label class="menu-slider-label">${t('menu.frequency')}</label>
        <input type="range" class="menu-slider" data-control="frequency" min="0" max="100" value="${Math.round(freq * 100)}" />
      </div>
    </div>
    <div class="menu-row menu-row-nav">
      <div class="menu-left">
        <a href="#" class="menu-link" data-action="manifesto">${t('menu.manifesto')}</a>
        <a href="https://talleroliva.com" target="_blank" rel="noopener" class="menu-link">talleroliva.com</a>
      </div>
      <div class="menu-right">
        <div class="menu-lang">
          <span class="menu-lang-opt ${lang === 'es' ? 'active' : ''}" data-lang="es">ES</span>
          <span class="menu-lang-sep">|</span>
          <span class="menu-lang-opt ${lang === 'en' ? 'active' : ''}" data-lang="en">EN</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(menuBar);

  menuBar.querySelector('[data-action="close"]')!.addEventListener('click', () => closeMenu());

  // Update stats every 2s while menu is open
  updateStats();
  statsInterval = setInterval(updateStats, 2000);

  // Bind events
  menuBar.querySelector('[data-action="manifesto"]')!.addEventListener('click', (e) => {
    e.preventDefault();
    showManifesto();
  });

  menuBar.querySelectorAll('.menu-lang-opt').forEach((el) => {
    el.addEventListener('click', () => {
      const newLang = (el as HTMLElement).dataset.lang as 'es' | 'en';
      setLang(newLang);
      location.reload();
    });
  });

  const audioToggle = menuBar.querySelector('[data-action="audio-toggle"]') as HTMLButtonElement;
  const volSlider = menuBar.querySelector('[data-control="volume"]') as HTMLInputElement;

  function syncToggleIcon(): void {
    audioToggle.textContent = isPlaying() ? '⏸' : '▶';
  }

  audioToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPlaying()) {
      stopWhiteNoise();
    } else {
      // If volume is 0, bump to default so play is audible
      if (parseInt(volSlider.value) === 0) {
        volSlider.value = '15';
        setVolume(0.15);
      }
      startWhiteNoise();
    }
    syncToggleIcon();
  });

  volSlider.addEventListener('input', () => {
    const val = parseInt(volSlider.value) / 100;
    setVolume(val);
    if (val > 0 && !isPlaying() && isAudioEnabled()) {
      startWhiteNoise();
    } else if (val === 0 && isPlaying()) {
      stopWhiteNoise();
    }
    syncToggleIcon();
  });

  const freqSlider = menuBar.querySelector('[data-control="frequency"]') as HTMLInputElement;
  freqSlider.addEventListener('input', () => {
    setFrequency(parseInt(freqSlider.value) / 100);
    if (!isPlaying() && isAudioEnabled()) {
      startWhiteNoise();
    }
    syncToggleIcon();
  });

  menuBar.addEventListener('wheel', (e) => e.stopPropagation());

  menuOpen = true;
  trigger?.classList.add('active');
}

function closeMenu(): void {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  if (menuBar) {
    menuBar.remove();
    menuBar = null;
  }
  menuOpen = false;
  trigger?.classList.remove('active');
}

function showManifesto(): void {
  closeMenu();

  const overlay = document.createElement('div');
  overlay.className = 'about-overlay';

  const card = document.createElement('div');
  card.className = 'about-card manifesto-card';
  card.innerHTML = `
    <h1>${t('manifesto.title')}</h1>
    <h2>${t('manifesto.s1_title')}</h2>
    <p>${t('manifesto.s1')}</p>
    <h2>${t('manifesto.s2_title')}</h2>
    <p>${t('manifesto.s2')}</p>
    <h2>${t('manifesto.s3_title')}</h2>
    <p>${t('manifesto.s3')}</p>
    <h2>${t('manifesto.s4_title')}</h2>
    <p>${t('manifesto.s4')}</p>
    <h2>${t('manifesto.s5_title')}</h2>
    <p>${t('manifesto.s5')}</p>
    <button class="about-close">${t('manifesto.close')}</button>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('visible'));

  const close = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 300);
  };

  card.querySelector('.about-close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handler);
    }
  });
}
