import { state } from '../state';
import { bus } from '../events';
import { setNickname, getNickname } from '../input/nickname';
import { startWhiteNoise, isAudioEnabled } from './audio';
import { t, getLang, setLang } from '../i18n';

const LS_ONBOARDED = 'pensaba:onboarded';

export function isOnboarded(): boolean {
  return localStorage.getItem(LS_ONBOARDED) === 'true';
}

export function showOnboarding(uiRoot: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    if (isOnboarded()) {
      showWelcomeBack(uiRoot);
      resolve();
      return;
    }

    showStep1(uiRoot, resolve);
  });
}

function langToggleHTML(): string {
  const lang = getLang();
  return `<div class="lang-toggle">
    <span class="lang-opt ${lang === 'es' ? 'active' : ''}" data-lang="es">ES</span>
    <span class="lang-sep">|</span>
    <span class="lang-opt ${lang === 'en' ? 'active' : ''}" data-lang="en">EN</span>
  </div>`;
}

function bindLangToggle(container: HTMLElement): void {
  container.querySelectorAll('.lang-opt').forEach((el) => {
    el.addEventListener('click', () => {
      const lang = (el as HTMLElement).dataset.lang as 'es' | 'en';
      setLang(lang);
      location.reload();
    });
  });
}

function showStep1(uiRoot: HTMLElement, resolve: () => void): void {
  const overlay = createOverlay();
  const card = createCard();

  card.innerHTML = `
    ${langToggleHTML()}
    <h1>${t('onboarding.title')}</h1>
    <p>${t('onboarding.subtitle')}</p>
    <p>${t('onboarding.body1')}</p>
    <p>${t('onboarding.body2')}</p>
    <button class="onboarding-next">${t('onboarding.enter')}</button>
  `;

  overlay.appendChild(card);
  uiRoot.appendChild(overlay);
  bindLangToggle(card);

  card.querySelector('.onboarding-next')!.addEventListener('click', () => {
    overlay.remove();
    showStep2(uiRoot, resolve);
  });
}

function showStep2(uiRoot: HTMLElement, resolve: () => void): void {
  const overlay = createOverlay();
  const card = createCard();

  card.innerHTML = `
    <h1>${t('onboarding.nickname_title')}</h1>
    <p>${t('onboarding.nickname_body')}</p>
    <input type="text" placeholder="${t('onboarding.nickname_placeholder')}" maxlength="20" class="onboarding-nick" />
    <button class="onboarding-next" disabled>${t('onboarding.next')}</button>
  `;

  overlay.appendChild(card);
  uiRoot.appendChild(overlay);

  const input = card.querySelector('.onboarding-nick') as HTMLInputElement;
  const btn = card.querySelector('.onboarding-next') as HTMLButtonElement;

  input.addEventListener('input', () => {
    btn.disabled = input.value.trim().length < 2;
  });

  btn.addEventListener('click', () => {
    setNickname(input.value.trim());
    state.nickname = input.value.trim();
    overlay.remove();
    showStep3(uiRoot, resolve);
  });

  setTimeout(() => input.focus(), 50);
}

function showStep3(uiRoot: HTMLElement, resolve: () => void): void {
  const overlay = createOverlay();
  const card = createCard();

  const audioOn = isAudioEnabled();

  card.innerHTML = `
    <h1>${t('onboarding.noise_title')}</h1>
    <p>${t('onboarding.noise_body')}</p>
    <div class="toggle-row">
      <span>${t('onboarding.sound')}</span>
      <div class="toggle-switch ${audioOn ? 'active' : ''}" data-toggle="audio"></div>
    </div>
    <button class="onboarding-next">${t('onboarding.start')}</button>
  `;

  overlay.appendChild(card);
  uiRoot.appendChild(overlay);

  const toggle = card.querySelector('[data-toggle="audio"]') as HTMLElement;
  let audioEnabled = audioOn;

  toggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    toggle.classList.toggle('active', audioEnabled);
  });

  card.querySelector('.onboarding-next')!.addEventListener('click', () => {
    localStorage.setItem(LS_ONBOARDED, 'true');
    state.isOnboarded = true;

    if (audioEnabled) {
      startWhiteNoise();
    }

    overlay.remove();
    bus.emit('onboarding:complete', undefined);
    resolve();
  });
}

function showWelcomeBack(uiRoot: HTMLElement): void {
  const nick = getNickname() || t('onboarding.default_nick');
  state.nickname = nick;
  state.isOnboarded = true;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = t('onboarding.welcome_back', { nick });
  uiRoot.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));

  if (isAudioEnabled()) {
    const startOnInteraction = () => {
      startWhiteNoise();
      document.removeEventListener('click', startOnInteraction);
      document.removeEventListener('wheel', startOnInteraction);
    };
    document.addEventListener('click', startOnInteraction, { once: true });
    document.addEventListener('wheel', startOnInteraction, { once: true });
  }

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 600);
  }, 2500);
}

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  return overlay;
}

function createCard(): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'onboarding-card';
  return card;
}
