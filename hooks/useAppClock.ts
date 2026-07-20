import { useEffect, useState } from 'react';
import { formatDateTime } from '@/utils/format';

export function useAppClock(): string {
  const [now, setNow] = useState(() => formatDateTime());

  useEffect(() => {
    const tick = () => setNow(formatDateTime());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return now;
}
