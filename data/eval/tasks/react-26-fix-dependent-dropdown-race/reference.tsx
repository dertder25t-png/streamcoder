import { useEffect, useState } from "react";

export function RegionCityPicker({
  regions,
  fetchCities,
  onChange,
}: {
  regions: string[];
  fetchCities: (region: string) => Promise<string[]>;
  onChange: (value: { region: string; city: string }) => void;
}) {
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!region) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchCities(region)
      .then((list) => {
        if (cancelled) return;
        setCities(list);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, attempt]);

  return (
    <div>
      <label>
        Region
        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setCity("");
            setCities([]);
          }}
        >
          <option value="">Select a region</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label>
        City
        <select
          value={city}
          disabled={loading || !region}
          onChange={(e) => {
            setCity(e.target.value);
            onChange({ region, city: e.target.value });
          }}
        >
          <option value="">Select a city</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <div role="alert">
          Could not load cities.
          <button type="button" onClick={() => setAttempt((a) => a + 1)}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
