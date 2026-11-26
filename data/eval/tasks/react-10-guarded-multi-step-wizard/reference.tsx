import { useState, type ReactNode } from "react";

export function StepWizard({
  steps,
  onComplete,
}: {
  steps: { id: string; title: string; content: ReactNode; isValid?: boolean }[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const canProceed = step.isValid !== false;

  return (
    <div>
      <ol>
        {steps.map((s, i) => (
          <li key={s.id} aria-current={i === index ? "step" : undefined}>
            {s.title}
          </li>
        ))}
      </ol>
      <div>{step.content}</div>
      <button type="button" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
        Back
      </button>
      {isLast ? (
        <button type="button" disabled={!canProceed} onClick={() => canProceed && onComplete()}>
          Finish
        </button>
      ) : (
        <button
          type="button"
          disabled={!canProceed}
          onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
        >
          Next
        </button>
      )}
    </div>
  );
}
