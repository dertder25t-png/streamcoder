import React, { useState, useCallback, useRef } from 'react';

type FeatureFlag = {
  id: string;
  label: string;
  enabled: boolean;
};

type OptimisticFeatureFlagsProps = {
  flags: FeatureFlag[];
  onToggle: (id: string, nextEnabled: boolean) => Promise<void>;
};

const OptimisticFeatureFlags: React.FC<OptimisticFeatureFlagsProps> = ({ flags, onToggle }) => {
  const [confirmedFlags, setConfirmedFlags] = useState<FeatureFlag[]>(flags);
  const [pendingFlags, setPendingFlags] = useState<Set<string>>(new Set());
  const [errorMessages, setErrorMessages] = useState<{ [id: string]: string }>({});

  const toggleFlag = useCallback(
    async (id: string, nextEnabled: boolean) => {
      if (pendingFlags.has(id)) return;

      setPendingFlags((prev) => new Set(prev).add(id));
      setErrorMessages((prev) => ({ ...prev, [id]: '' }));

      try {
        await onToggle(id, nextEnabled);
        setConfirmedFlags((prev) =>
          prev.map((flag) => (flag.id === id ? { ...flag, enabled: nextEnabled } : flag))
        );
      } catch (error) {
        setErrorMessages((prev) => ({ ...prev, [id]: 'Failed to update' }));
        setConfirmedFlags((prev) =>
          prev.map((flag) => (flag.id === id ? { ...flag, enabled: !nextEnabled } : flag))
        );
      } finally {
        setPendingFlags((prev) => new Set(prev).delete(id));
      }
    },
    [onToggle, pendingFlags]
  );

  return (
    <div>
      {confirmedFlags.map((flag) => (
        <div key={flag.id}>
          <label>
            <input
              type="checkbox"
              checked={flag.enabled}
              onChange={() => toggleFlag(flag.id, !flag.enabled)}
              disabled={pendingFlags.has(flag.id)}
              aria-checked={flag.enabled}
            />
            {flag.label}
          </label>
          {errorMessages[flag.id] && (
            <div role="alert" style={{ color: 'red' }}>
              {errorMessages[flag.id]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export { OptimisticFeatureFlags };
