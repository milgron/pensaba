const LS_DATE = 'pensaba:lastThought';

function todayGMT3(): string {
  const now = new Date();
  // GMT-3 offset: subtract 3 hours to get local midnight boundary
  const gmt3 = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return gmt3.toISOString().slice(0, 10);
}

export function canThinkToday(): boolean {
  return localStorage.getItem(LS_DATE) !== todayGMT3();
}

export function markThoughtPosted(): void {
  localStorage.setItem(LS_DATE, todayGMT3());
}
