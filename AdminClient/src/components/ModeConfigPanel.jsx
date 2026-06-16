import { useEffect, useState } from "react";
import { adminApiUrl } from "../config";
import { DataTable } from "./DashboardWidgets";
import {
  audioEffectOptions,
  cloneModeForm,
  deviationTypeOptions,
  emptyHeatSurgeConfig,
  emptyModeForm,
  falseTwinTypeOptions,
  normalizeModeForm,
  normalizeOrientationLock,
  normalizeProductKey,
  updateListItem,
  visualEffectOptions
} from "../data/modeConfig";

function ModeConfigPanel({ adminKey }) {
  const [modes, setModes] = useState([]);
  const [modeForm, setModeForm] = useState(emptyModeForm);
  const [configStatus, setConfigStatus] = useState("Loading database-backed game configuration...");
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    loadModes();
  }, []);

  async function loadModes() {
    setIsConfigLoading(true);
    setConfigStatus("Loading modes from database...");

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/game-modes`, {
        headers: adminKey ? { "X-Admin-Token": adminKey } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load modes");
      }

      const loadedModes = payload.modes || [];
      setModes(loadedModes);
      const selectedMode = loadedModes.find((mode) => mode.modeKey === modeForm.modeKey) || loadedModes[0] || emptyModeForm;
      selectMode(selectedMode, false);
      setConfigStatus(`Loaded ${loadedModes.length} modes from the database. Click to select; double click or use Edit config to open advanced tables.`);
    } catch (error) {
      setConfigStatus(error.message || "Unable to load modes");
    } finally {
      setIsConfigLoading(false);
    }
  }

  async function saveMode(event) {
    event.preventDefault();
    const modeKey = modeForm.modeKey.trim().toLowerCase();
    if (!modeKey) {
      setConfigStatus("Mode key is required before saving.");
      return;
    }

    setIsConfigLoading(true);
    setConfigStatus(`Saving ${modeKey} to the database...`);

    try {
      const response = await fetch(`${adminApiUrl}/api/admin/game-modes/${encodeURIComponent(modeKey)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "X-Admin-Token": adminKey } : {})
        },
        body: JSON.stringify({ ...modeForm, modeKey })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save mode");
      }

      const loadedModes = payload.modes || [];
      setModes(loadedModes);
      const savedMode = loadedModes.find((mode) => mode.modeKey === modeKey);
      selectMode(savedMode || { ...modeForm, modeKey }, true);
      setConfigStatus(`Saved ${modeKey}. Restart or refresh game workers if they cache mode config.`);
    } catch (error) {
      setConfigStatus(error.message || "Unable to save mode");
    } finally {
      setIsConfigLoading(false);
    }
  }

  function selectMode(mode, openEditor = false) {
    const normalized = normalizeModeForm(mode);
    setModeForm(cloneModeForm(normalized));
    setIsEditorOpen(openEditor);
  }

  function createNewMode() {
    selectMode({ ...emptyModeForm, heatSurgeConfig: { ...emptyHeatSurgeConfig } }, true);
    setConfigStatus("New mode draft ready. Fill out the fields and save to create it.");
  }

  function updateField(field, value) {
    setModeForm((current) => ({ ...current, [field]: value }));
  }

  function updateDifficultyBand(index, field, value) {
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({ ...band, [field]: value }))
    }));
  }

  function updateDifficultyMix(index, mixName, mixIndex, field, value) {
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({
        ...band,
        [mixName]: updateListItem(band[mixName] || [], mixIndex, (mix) => ({ ...mix, [field]: value }))
      }))
    }));
  }

  function addDifficultyMix(index, mixName) {
    const defaults = mixName === "deviationMix"
      ? { deviationType: "shape_swap", weightPercent: 0 }
      : { falseTwinType: "readable_twin", weightPercent: 0 };
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({
        ...band,
        [mixName]: [...(band[mixName] || []), defaults]
      }))
    }));
  }

  function removeDifficultyMix(index, mixName, mixIndex) {
    setModeForm((current) => ({
      ...current,
      difficultyBands: updateListItem(current.difficultyBands, index, (band) => ({
        ...band,
        [mixName]: (band[mixName] || []).filter((_, itemIndex) => itemIndex !== mixIndex)
      }))
    }));
  }

  function addDifficultyBand() {
    setModeForm((current) => ({
      ...current,
      difficultyBands: [
        ...current.difficultyBands,
        {
          comboMin: 0,
          decisionTimeMs: 5000,
          glitchChancePercent: 0,
          sortOrder: current.difficultyBands.length,
          deviationMix: [
            { deviationType: "shape_swap", weightPercent: 100 },
            { deviationType: "false_twin", weightPercent: 0 },
            { deviationType: "partial_break", weightPercent: 0 }
          ],
          falseTwinMix: [
            { falseTwinType: "readable_twin", weightPercent: 100 },
            { falseTwinType: "doubt_twin", weightPercent: 0 }
          ]
        }
      ]
    }));
    setIsEditorOpen(true);
  }

  function removeDifficultyBand(index) {
    setModeForm((current) => ({ ...current, difficultyBands: current.difficultyBands.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function updateHeatSurgeField(field, value) {
    setModeForm((current) => ({
      ...current,
      heatSurgeConfig: { ...(current.heatSurgeConfig || emptyHeatSurgeConfig), [field]: value }
    }));
  }

  function updateCorruptionBand(index, field, value) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({ ...band, [field]: value }))
    }));
  }

  function updateCorruptionEffect(index, field, effectIndex, value) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({
        ...band,
        [field]: updateListItem(band[field] || [], effectIndex, () => value)
      }))
    }));
  }

  function addCorruptionEffect(index, field, options) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({
        ...band,
        [field]: [...(band[field] || []), options[0]?.value || ""]
      }))
    }));
  }

  function removeCorruptionEffect(index, field, effectIndex) {
    setModeForm((current) => ({
      ...current,
      corruptionBands: updateListItem(current.corruptionBands, index, (band) => ({
        ...band,
        [field]: (band[field] || []).filter((_, itemIndex) => itemIndex !== effectIndex)
      }))
    }));
  }

  function addCorruptionBand() {
    setModeForm((current) => ({
      ...current,
      corruptionBands: [
        ...current.corruptionBands,
        { comboMin: 0, visualEffects: [], audioEffects: [], intensityLevel: 1 }
      ]
    }));
    setIsEditorOpen(true);
  }

  function removeCorruptionBand(index) {
    setModeForm((current) => ({ ...current, corruptionBands: current.corruptionBands.filter((_, itemIndex) => itemIndex !== index) }));
  }

  return (
    <section className="mode-config-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Database controls</p>
          <h2>Configured modes</h2>
        </div>
        <div className="mode-panel-actions">
          <button type="button" className="secondary-button" onClick={loadModes} disabled={isConfigLoading}>
            {isConfigLoading ? "Working..." : "Reload modes"}
          </button>
          <button type="button" onClick={createNewMode} disabled={isConfigLoading}>
            + New mode
          </button>
        </div>
      </div>

      <div className="mode-config-layout">
        <div className="mode-list" aria-label="Database modes">
          {modes.length === 0 ? (
            <p>No modes loaded yet.</p>
          ) : modes.map((mode) => (
            <article className={mode.modeKey === modeForm.modeKey ? "mode-list-card active" : "mode-list-card"} key={mode.modeKey}>
              <button
                type="button"
                className="mode-list-item"
                onClick={() => selectMode(mode)}
                onDoubleClick={() => selectMode(mode, true)}
              >
                <strong>{mode.displayName}</strong>
                <span>{mode.modeKey} · {mode.isEnabled ? "Enabled" : "Disabled"} · Orientation: {mode.orientationLock}</span>
              </button>
              <button type="button" className="secondary-button compact-button" onClick={() => selectMode(mode, true)}>
                Edit config
              </button>
            </article>
          ))}
        </div>

        <form className="mode-config-form" onSubmit={saveMode}>
          <label>
            <span>Mode key</span>
            <input value={modeForm.modeKey} onChange={(event) => updateField("modeKey", event.target.value)} placeholder="standard" />
          </label>
          <label>
            <span>Display name</span>
            <input value={modeForm.displayName} onChange={(event) => updateField("displayName", event.target.value)} placeholder="GLiTCH!" />
          </label>
          <label>
            <span>Orientation lock</span>
            <select value={modeForm.orientationLock} onChange={(event) => updateField("orientationLock", normalizeOrientationLock(event.target.value))}>
              <option value="both">Both</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>
            <span>Result lock ms</span>
            <input type="number" min="0" value={modeForm.resultLockMs} onChange={(event) => updateField("resultLockMs", event.target.value)} />
          </label>
          <label>
            <span>Transition beat ms</span>
            <input type="number" min="0" value={modeForm.transitionBeatMs} onChange={(event) => updateField("transitionBeatMs", event.target.value)} />
          </label>
          <label>
            <span>Good run round</span>
            <input type="number" min="1" value={modeForm.goodRunRound} onChange={(event) => updateField("goodRunRound", event.target.value)} />
          </label>
          <label className="checkbox-field">
            <span>Enabled for players</span>
            <input type="checkbox" checked={modeForm.isEnabled} onChange={(event) => updateField("isEnabled", event.target.checked)} />
          </label>
          <label className="checkbox-field">
            <span>Has last chance</span>
            <input type="checkbox" checked={modeForm.hasLastChance} onChange={(event) => updateField("hasLastChance", event.target.checked)} />
          </label>

          <div className="advanced-config-panel">
            <div className="advanced-config-header">
              <div>
                <h3>Advanced mode tables</h3>
                <p>Edit difficulty_bands with nested deviation_mix and false_twin_mix, plus heat_surge_configs and corruption_bands.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsEditorOpen((open) => !open)}>
                {isEditorOpen ? "Hide editor" : "Edit config"}
              </button>
            </div>

            {isEditorOpen && (
              <div className="advanced-config-grid">
                <section className="config-table-card">
                  <div className="config-table-heading">
                    <div>
                      <h4>Difficulty bands</h4>
                      <p>Add combo thresholds, tune timing, then choose weighted deviation and false-twin behavior from dropdowns.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={addDifficultyBand}>+ Difficulty band</button>
                  </div>

                  {modeForm.difficultyBands.length === 0 ? <p className="empty-config-copy">No difficulty bands yet.</p> : null}
                  {modeForm.difficultyBands.map((band, bandIndex) => (
                    <article className="config-row-card" key={`difficulty-${bandIndex}`}>
                      <div className="config-row-header">
                        <strong>Difficulty band #{bandIndex + 1}</strong>
                        <button type="button" className="secondary-button compact-button" onClick={() => removeDifficultyBand(bandIndex)}>Remove</button>
                      </div>
                      <div className="config-field-grid">
                        <label><span>Combo min</span><input type="number" min="0" value={band.comboMin ?? 0} onChange={(event) => updateDifficultyBand(bandIndex, "comboMin", event.target.value)} /></label>
                        <label><span>Decision time ms</span><input type="number" min="0" value={band.decisionTimeMs ?? 0} onChange={(event) => updateDifficultyBand(bandIndex, "decisionTimeMs", event.target.value)} /></label>
                        <label><span>Glitch chance %</span><input type="number" min="0" max="100" step="0.1" value={band.glitchChancePercent ?? 0} onChange={(event) => updateDifficultyBand(bandIndex, "glitchChancePercent", event.target.value)} /></label>
                        <label><span>Sort order</span><input type="number" min="0" value={band.sortOrder ?? bandIndex} onChange={(event) => updateDifficultyBand(bandIndex, "sortOrder", event.target.value)} /></label>
                      </div>

                      <div className="nested-config-grid">
                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>Deviation mix</strong><button type="button" className="secondary-button compact-button" onClick={() => addDifficultyMix(bandIndex, "deviationMix")}>+ Mix row</button></div>
                          {(band.deviationMix || []).map((mix, mixIndex) => (
                            <div className="mix-row" key={`deviation-${bandIndex}-${mixIndex}`}>
                              <select value={mix.deviationType || "shape_swap"} onChange={(event) => updateDifficultyMix(bandIndex, "deviationMix", mixIndex, "deviationType", event.target.value)}>
                                {deviationTypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <input type="number" min="0" max="100" step="0.1" value={mix.weightPercent ?? 0} onChange={(event) => updateDifficultyMix(bandIndex, "deviationMix", mixIndex, "weightPercent", event.target.value)} aria-label="Deviation weight percent" />
                              <button type="button" className="secondary-button compact-button" onClick={() => removeDifficultyMix(bandIndex, "deviationMix", mixIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>

                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>False twin mix</strong><button type="button" className="secondary-button compact-button" onClick={() => addDifficultyMix(bandIndex, "falseTwinMix")}>+ Mix row</button></div>
                          {(band.falseTwinMix || []).map((mix, mixIndex) => (
                            <div className="mix-row" key={`false-twin-${bandIndex}-${mixIndex}`}>
                              <select value={mix.falseTwinType || "readable_twin"} onChange={(event) => updateDifficultyMix(bandIndex, "falseTwinMix", mixIndex, "falseTwinType", event.target.value)}>
                                {falseTwinTypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <input type="number" min="0" max="100" step="0.1" value={mix.weightPercent ?? 0} onChange={(event) => updateDifficultyMix(bandIndex, "falseTwinMix", mixIndex, "weightPercent", event.target.value)} aria-label="False twin weight percent" />
                              <button type="button" className="secondary-button compact-button" onClick={() => removeDifficultyMix(bandIndex, "falseTwinMix", mixIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </section>

                <section className="config-table-card">
                  <div className="config-table-heading">
                    <div>
                      <h4>Heat Surge</h4>
                      <p>Use dropdowns and number fields to configure if and when the heat surge modifier activates.</p>
                    </div>
                  </div>
                  <div className="config-field-grid">
                    <label><span>Status</span><select value={modeForm.heatSurgeConfig?.isEnabled ? "true" : "false"} onChange={(event) => updateHeatSurgeField("isEnabled", event.target.value === "true")}><option value="false">Disabled</option><option value="true">Enabled</option></select></label>
                    <label><span>Minimum correct rounds</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.minimumCorrectRounds ?? 0} onChange={(event) => updateHeatSurgeField("minimumCorrectRounds", event.target.value)} /></label>
                    <label><span>Activation chance %</span><input type="number" min="0" max="100" step="0.1" value={modeForm.heatSurgeConfig?.activationChancePercent ?? 0} onChange={(event) => updateHeatSurgeField("activationChancePercent", event.target.value)} /></label>
                    <label><span>Duration rounds</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.durationRounds ?? 0} onChange={(event) => updateHeatSurgeField("durationRounds", event.target.value)} /></label>
                    <label><span>Cooldown rounds</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.cooldownRounds ?? 0} onChange={(event) => updateHeatSurgeField("cooldownRounds", event.target.value)} /></label>
                    <label><span>Timer reduction ms</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.timerReductionMs ?? 0} onChange={(event) => updateHeatSurgeField("timerReductionMs", event.target.value)} /></label>
                    <label><span>Intensity bonus levels</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.intensityBonusLevels ?? 0} onChange={(event) => updateHeatSurgeField("intensityBonusLevels", event.target.value)} /></label>
                    <label><span>Transition warning ms</span><input type="number" min="0" value={modeForm.heatSurgeConfig?.transitionWarningMs ?? 0} onChange={(event) => updateHeatSurgeField("transitionWarningMs", event.target.value)} /></label>
                  </div>
                </section>

                <section className="config-table-card">
                  <div className="config-table-heading">
                    <div>
                      <h4>Corruption bands</h4>
                      <p>Add combo thresholds and pick visual/audio effects from dropdown rows for each band.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={addCorruptionBand}>+ Corruption band</button>
                  </div>

                  {modeForm.corruptionBands.length === 0 ? <p className="empty-config-copy">No corruption bands yet.</p> : null}
                  {modeForm.corruptionBands.map((band, bandIndex) => (
                    <article className="config-row-card" key={`corruption-${bandIndex}`}>
                      <div className="config-row-header">
                        <strong>Corruption band #{bandIndex + 1}</strong>
                        <button type="button" className="secondary-button compact-button" onClick={() => removeCorruptionBand(bandIndex)}>Remove</button>
                      </div>
                      <div className="config-field-grid">
                        <label><span>Combo min</span><input type="number" min="0" value={band.comboMin ?? 0} onChange={(event) => updateCorruptionBand(bandIndex, "comboMin", event.target.value)} /></label>
                        <label><span>Intensity level</span><input type="number" min="1" value={band.intensityLevel ?? 1} onChange={(event) => updateCorruptionBand(bandIndex, "intensityLevel", event.target.value)} /></label>
                      </div>
                      <div className="nested-config-grid">
                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>Visual effects</strong><button type="button" className="secondary-button compact-button" onClick={() => addCorruptionEffect(bandIndex, "visualEffects", visualEffectOptions)}>+ Effect</button></div>
                          {(band.visualEffects || []).map((effect, effectIndex) => (
                            <div className="effect-row" key={`visual-${bandIndex}-${effectIndex}`}>
                              <select value={effect} onChange={(event) => updateCorruptionEffect(bandIndex, "visualEffects", effectIndex, event.target.value)}>
                                {visualEffectOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <button type="button" className="secondary-button compact-button" onClick={() => removeCorruptionEffect(bandIndex, "visualEffects", effectIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>
                        <div className="nested-config-card">
                          <div className="nested-config-heading"><strong>Audio effects</strong><button type="button" className="secondary-button compact-button" onClick={() => addCorruptionEffect(bandIndex, "audioEffects", audioEffectOptions)}>+ Effect</button></div>
                          {(band.audioEffects || []).map((effect, effectIndex) => (
                            <div className="effect-row" key={`audio-${bandIndex}-${effectIndex}`}>
                              <select value={effect} onChange={(event) => updateCorruptionEffect(bandIndex, "audioEffects", effectIndex, event.target.value)}>
                                {audioEffectOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                              </select>
                              <button type="button" className="secondary-button compact-button" onClick={() => removeCorruptionEffect(bandIndex, "audioEffects", effectIndex)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
            )}
          </div>

          <button type="submit" disabled={isConfigLoading}>{isConfigLoading ? "Saving..." : "Save mode config"}</button>
        </form>
      </div>

      <p className="mode-config-status" aria-live="polite">{configStatus}</p>
    </section>
  );
}

export { ModeConfigPanel };
