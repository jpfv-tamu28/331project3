import { Api } from '../api';
import { Modal } from '../components/Modal';
import { Segmented } from '../components/Segmented';
import { useResource } from '../components/useResource';
import { THEMES, TEXT_SIZES } from './useKioskSettings';
import WeatherIcon from './WeatherIcon';

export default function SettingsDialog({ settings, onChange, onClose }) {
  const weather = useResource(() => Api.weather(), []);
  const w = weather.data;

  return (
    <Modal title="Settings" submitLabel="Done" onClose={onClose} className="kiosk-modal kiosk-settings" width={560}>
      <div className="customize">
        <fieldset>
          <legend>Display</legend>
          <Segmented label="Display theme" options={THEMES} value={settings.theme} onChange={(theme) => onChange({ theme })} />
        </fieldset>

        <fieldset>
          <legend>Text Size</legend>
          <Segmented
            label="Text size"
            options={TEXT_SIZES}
            value={settings.textSize}
            onChange={(textSize) => onChange({ textSize })}
          />
        </fieldset>

        <section className="kiosk-weather" aria-labelledby="kiosk-weather-title" aria-live="polite">
          <h3 id="kiosk-weather-title">Weather</h3>
          {w ? (
            <div className="kiosk-weather-now">
              <WeatherIcon icon={w.icon} isDay={w.isDay} className="kiosk-weather-icon" />
              <div>
                <p className="kiosk-weather-temp">{w.temperatureF}°F</p>
                <p className="kiosk-weather-desc">{w.condition} · {w.place} {w.zip}</p>
              </div>
            </div>
          ) : (
            <div className="kiosk-weather-status">
              <p>{weather.loading ? 'Checking the weather…' : weather.error}</p>
              {weather.error && (
                <button type="button" className="kiosk-link-btn" onClick={weather.reload}>Try again</button>
              )}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
