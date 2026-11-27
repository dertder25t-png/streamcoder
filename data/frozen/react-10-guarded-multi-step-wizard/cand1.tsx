import React, { useState, useCallback } from 'react';

export interface Step {
  id: string;
  title: string;
  content: React.ReactNode;
  isValid?: boolean;
}

export interface StepWizardProps {
  steps: Step[];
  onComplete: () => void;
}

export const StepWizard: React.FC<StepWizardProps> = ({ steps, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1 && (steps[currentStep].isValid === undefined || steps[currentStep].isValid)) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, steps]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleFinish = useCallback(() => {
    if (steps[currentStep].isValid !== false) {
      onComplete();
    }
  }, [currentStep, steps, onComplete]);

  return (
    <div>
      <div>
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(index)}
            disabled={index !== currentStep}
          >
            {step.title}
          </button>
        ))}
      </div>
      <div>{steps[currentStep].content}</div>
      <div>
        <button onClick={handleBack} disabled={currentStep === 0}>
          Back
        </button>
        <button onClick={handleNext}>
          {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
};
