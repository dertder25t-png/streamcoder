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
  const [currentRegion, setCurrentRegion] = useState<string | null>(null);

  useEffect(() => {
    if (!region) {
      setCity("");
      return;
    }
    setLoading(true);
    setError(false);
    setCurrentRegion(region);
    fetchCities(region)
      .then((list) => {
        if (currentRegion === region) {
          setCities(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (currentRegion === region) {
          setError(true);
          setLoading(false);
        }
      });
  }, [region, attempt]);

  useEffect(() => {
    if (currentRegion !== null && !city) {
      setCity("");
    }
  }, [currentRegion, city]);

  return (
    <div>
      <label>
        Region
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
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
          onChange={(e) => {
            setCity(e.target.value);
            onChange({ region, city: e.target.value });
          }}
          disabled={loading}
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
