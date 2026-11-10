'use client';

import { AppGate } from '@/components/layout/AppGate';

/** `/` only routes: the gate sends everyone to their home (App Flow §1). */
export default function Home() {
  return <AppGate require="route">{null}</AppGate>;
}
