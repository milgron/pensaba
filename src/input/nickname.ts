const LS_NICK = 'pensaba:nickname';

export function getNickname(): string | null {
  return localStorage.getItem(LS_NICK);
}

export function setNickname(nick: string): void {
  localStorage.setItem(LS_NICK, nick.trim().slice(0, 20));
}

export function hasNickname(): boolean {
  const n = getNickname();
  return n !== null && n.length >= 2;
}
