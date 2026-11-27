import { useState } from 'react';

export function useWizard(totalSteps: number): { step: number; next: () => void; prev: () => void; goTo: (s: number) => void } {
  const [step, setStep] = useState<number>(0);

  const next = () => {
    setStep((prevStep) => Math.min(prevStep + 1, totalSteps - 1));
  };

  const prev = () => {
    setStep((prevStep) => Math.max(prevStep - 1, 0));
  };

  const goTo = (index: number) => {
    setStep(Math.min(Math.max(index, 0), totalSteps - 1));
  };

  return { step, next, prev, goTo };
}
