const LS_LANG = 'pensaba:lang';

type Lang = 'es' | 'en';

const es: Record<string, string> = {
  'onboarding.title': 'pensaba',
  'onboarding.subtitle': 'un lugar para pensar en compañía.',
  'onboarding.body1': 'cada pensamiento existe exactamente un día. a las 00:00 desaparece, sin archivo, sin posibilidad de recuperación.',
  'onboarding.body2': 'podés dejar un solo pensamiento por día. elegí bien.',
  'onboarding.enter': 'entrar',
  'onboarding.nickname_title': 'tu apodo',
  'onboarding.nickname_body': 'los demás van a ver tu nombre flotando por el túnel. no tiene que ser real.',
  'onboarding.nickname_placeholder': 'apodo',
  'onboarding.next': 'siguiente',
  'onboarding.noise_title': 'ruido blanco',
  'onboarding.noise_body': 'un murmullo suave para acompañar el viaje.',
  'onboarding.sound': 'sonido',
  'onboarding.start': 'empezar',
  'onboarding.default_nick': 'viajero',
  'onboarding.welcome_back': 'bienvenido de vuelta, {nick}',
  'composer.placeholder': 'un pensamiento...',
  'composer.submit': 'pensar',
  'rate_limit.message': 'ya pensaste hoy. volvé mañana.',
  'menu.manifesto': 'manifiesto',
  'manifesto.title': 'pensaba',
  'manifesto.s1_title': 'un lugar, no una plataforma',
  'manifesto.s1': 'pensaba no es una red social. no tiene perfil, no tiene seguidores, no tiene métricas. es un lugar al que vas a pensar, como vas a caminar al parque cuando necesitás ordenar la cabeza.',
  'manifesto.s2_title': 'la impermanencia como diseño',
  'manifesto.s2': 'cada pensamiento existe exactamente un día. a las 00:00 desaparece, sin aviso, sin archivo, sin posibilidad de recuperación. cuando sabés que algo va a desaparecer, lo hacés diferente. lo escribís para el momento, no para la posteridad.',
  'manifesto.s3_title': 'un solo pensamiento',
  'manifesto.s3': 'no podés publicar dos cosas. una por día. esto obliga a elegir. la mayoría de los días no tenés nada que decir — y eso está bien. los días que sí tenés algo, la restricción te fuerza a saber qué es realmente lo que pensás.',
  'manifesto.s4_title': 'el espacio como metáfora',
  'manifesto.s4': 'los pensamientos no están en un feed. están en un lugar: un túnel curvo y oscuro que podés recorrer. te movés hacia ellos, ellos se acercan a vos. cuanto más cerca estás, más se revelan.',
  'manifesto.s5_title': 'anonimato blando',
  'manifesto.s5': 'tenés un apodo. lo elegís vos. podés cambiarlo mañana. no hay cuenta, no hay email, no hay historial. el pensamiento importa. quién lo escribió, menos.',
  'manifesto.close': 'cerrar',
  'menu.volume': 'volumen',
  'menu.frequency': 'frecuencia',
  'menu.online': 'online ahora',
  'menu.thoughts_today': 'pensamientos hoy',
  'touchpad.hint': 'deslizá para\nrecorrer',
};

const en: Record<string, string> = {
  'onboarding.title': 'pensaba',
  'onboarding.subtitle': 'a place to think in company.',
  'onboarding.body1': 'every thought exists for exactly one day. at 00:00 it disappears — no archive, no recovery.',
  'onboarding.body2': 'you can leave one thought per day. choose well.',
  'onboarding.enter': 'enter',
  'onboarding.nickname_title': 'your nickname',
  'onboarding.nickname_body': 'others will see your name floating through the tunnel. it doesn\'t have to be real.',
  'onboarding.nickname_placeholder': 'nickname',
  'onboarding.next': 'next',
  'onboarding.noise_title': 'white noise',
  'onboarding.noise_body': 'a soft murmur to accompany the journey.',
  'onboarding.sound': 'sound',
  'onboarding.start': 'begin',
  'onboarding.default_nick': 'wanderer',
  'onboarding.welcome_back': 'welcome back, {nick}',
  'composer.placeholder': 'a thought...',
  'composer.submit': 'think',
  'rate_limit.message': 'you already thought today. come back tomorrow.',
  'menu.manifesto': 'manifesto',
  'manifesto.title': 'pensaba',
  'manifesto.s1_title': 'a place, not a platform',
  'manifesto.s1': 'pensaba is not a social network. no profile, no followers, no metrics. it\'s a place you go to think, like walking to the park when you need to clear your head.',
  'manifesto.s2_title': 'impermanence as design',
  'manifesto.s2': 'every thought exists for exactly one day. at 00:00 it disappears — no warning, no archive, no recovery. when you know something will vanish, you do it differently. you write for the moment, not for posterity.',
  'manifesto.s3_title': 'one single thought',
  'manifesto.s3': 'you can\'t post twice. one per day. this forces you to choose. most days you have nothing to say — and that\'s fine. the days you do, the constraint forces you to know what you really think.',
  'manifesto.s4_title': 'space as metaphor',
  'manifesto.s4': 'thoughts are not in a feed. they\'re in a place: a dark curved tunnel you can travel through. you move toward them, they move toward you. the closer you get, the more they reveal.',
  'manifesto.s5_title': 'soft anonymity',
  'manifesto.s5': 'you have a nickname. you choose it. you can change it tomorrow. no account, no email, no history. the thought matters. who wrote it, less so.',
  'manifesto.close': 'close',
  'menu.volume': 'volume',
  'menu.frequency': 'frequency',
  'menu.online': 'online now',
  'menu.thoughts_today': 'thoughts today',
  'touchpad.hint': 'swipe to\nexplore',
};

const dicts: Record<Lang, Record<string, string>> = { es, en };

export function getLang(): Lang {
  const stored = localStorage.getItem(LS_LANG);
  if (stored === 'en') return 'en';
  return 'es';
}

export function setLang(lang: Lang): void {
  localStorage.setItem(LS_LANG, lang);
}

export function t(key: string, params?: Record<string, string>): string {
  const lang = getLang();
  let str = dicts[lang][key] ?? dicts['es'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}
