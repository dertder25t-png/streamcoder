import React, { useState } from 'react';

interface Step {
  id: string;
  title: string;
  content: React.ReactNode;
  isValid?: boolean;
}

interface StepWizardProps {
  steps: Step[];
  onComplete: () => void;
}

const StepWizard: React.FC<StepWizardProps> = ({ steps, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentStep = steps[currentIndex];

  const canGoBack = currentIndex > 0;
  const canGoNext = currentIndex < steps.length - 1 && currentStep.isValid !== false;

  const goBack = () => {
    if (canGoBack) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goNext = () => {
    if (canGoNext) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleFinish = () => {
    if (currentStep.isValid !== false) {
      onComplete();
    }
  };

  return (
    <div>
      <div>
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentIndex(index)}
            disabled={currentIndex !== index}
          >
            {step.title}
          </button>
        ))}
      </div>
      <div>{currentStep.content}</div>
      <div>
        {currentIndex > 0 && (
          <button onClick={goBack} disabled={!canGoBack}>
            Back
          </button>
        )}
        <button onClick={goNext} disabled={!canGoNext}>
          Next
        </button>
        {currentIndex === steps.length - 1 && (
          <button onClick={handleFinish} disabled={currentStep.isValid !== false}>
            Finish
          </button>
        )}
      </div>
    </div>
  );
};

export { StepWizard };
