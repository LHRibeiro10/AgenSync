import { useState } from "react";
import { inputClass } from "./Field.jsx";
import { durationLabel } from "../services/durationService.js";

export const DURATION_PRESET_MINUTES = [15, 30, 60, 90, 120, 150, 180];
const CUSTOM_OPTION = "custom";

export default function DurationPicker({ value, onChange, className = "" }) {
  const numericValue = value === "" || value === null || value === undefined ? "" : Number(value);
  const isKnownPreset = DURATION_PRESET_MINUTES.includes(numericValue);
  const [explicitCustom, setExplicitCustom] = useState(numericValue !== "" && !isKnownPreset);
  const showCustomInput = explicitCustom || (numericValue !== "" && !isKnownPreset);

  function handleSelectChange(event) {
    const nextValue = event.target.value;
    if (nextValue === CUSTOM_OPTION) {
      setExplicitCustom(true);
      return;
    }
    setExplicitCustom(false);
    onChange(Number(nextValue));
  }

  return (
    <div className={className}>
      <select
        required
        className={inputClass}
        value={showCustomInput ? CUSTOM_OPTION : numericValue === "" ? "" : numericValue}
        onChange={handleSelectChange}
      >
        {numericValue === "" && !showCustomInput ? (
          <option value="" disabled>
            Selecione
          </option>
        ) : null}
        {DURATION_PRESET_MINUTES.map((minutes) => (
          <option key={minutes} value={minutes}>
            {durationLabel(minutes)}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>Horario personalizado</option>
      </select>
      {showCustomInput ? (
        <input
          required
          min="1"
          type="number"
          value={numericValue === "" ? "" : numericValue}
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
          placeholder="Duracao em minutos"
          className={`${inputClass} mt-2`}
        />
      ) : null}
    </div>
  );
}
