import React, { useState, useEffect } from 'react';

interface Flag {
  id: string;
  label: string;
  enabled: boolean;
}

interface OptimisticFeatureFlagsProps {
  flags: Flag[];
  onToggle: (id: string, nextEnabled: boolean) => Promise<void>;
}

const OptimisticFeatureFlags: React.FC<OptimisticFeatureFlagsProps> = ({ flags, onToggle }) => {
  const [state, setState] = useState<Flag[]>(flags);
  const [pendingToggles, setPendingToggles] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    setState(flags);
  }, [flags]);

  const handleToggle = async (id: string) => {
    if (pendingToggles[id]) return; // Prevent overlapping requests
    setPendingToggles({ ...pendingToggles, [id]: true });

    try {
      const nextEnabled = !state.find(f => f.id === id)?.enabled;
      const newState = state.map(f => (f.id === id ? { ...f, enabled: nextEnabled } : f));
      setState(newState);

      await onToggle(id, nextEnabled);
    } catch (error) {
      const newState = state.map(f => (f.id === id ? { ...f, enabled: !f.enabled } : f));
      setState(newState);
      alert(`Failed to update ${id}`);
    } finally {
      setPendingToggles({ ...pendingToggles, [id]: false });
    }
  };

  return (
    <div>
      {state.map(flag => (
        <div key={flag.id} role="switch" aria-checked={flag.enabled} style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={flag.enabled}
            onChange={() => handleToggle(flag.id)}
            style={{ marginRight: '8px' }}
          />
          {flag.label}
          {pendingToggles[flag.id] && <span style={{ marginLeft: '8px', color: 'red' }}>Updating...</span>}
          {flag.enabled !== state.find(f => f.id === flag.id)?.enabled && (
            <span role="alert" style={{ marginLeft: '8px', color: 'red' }}>Failed to update</span>
          )}
        </div>
      ))}
    </div>
  );
};

export { OptimisticFeatureFlags };
