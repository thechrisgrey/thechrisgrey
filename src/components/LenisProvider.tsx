import { type ReactNode } from 'react';
import { LenisContext, useLenisInstance } from '../hooks/useLenis';

export default function LenisProvider({ children }: { children: ReactNode }) {
  const value = useLenisInstance();
  return <LenisContext.Provider value={value}>{children}</LenisContext.Provider>;
}
