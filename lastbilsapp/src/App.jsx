import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const categories = {
  roda_bilar: { label: "röda bilar", icon: "🚗" },
  lastbilar: { label: "lastbilar", icon: "🚚" },
  djur: { label: "djur", icon: "🐄" },
  gula_bilar: { label: "gula bilar", icon: "🚕" },
  taxibilar: { label: "taxibilar", icon: "🚖" },
  motorcyklar: { label: "motorcyklar", icon: "🏍️" },
  takboxar: { label: "takboxar", icon: "🎒" },
  kor: { label: "kor", icon: "🐄" },
  radjur: { label: "rådjur", icon: "🦌" },
  hastar: { label: "hästar", icon: "🐎" },
  vindkraftverk: { label: "vindkraftverk", icon: "🌬️" },
};

const timeOptions = [
  { label: "1 minut", seconds: 60 },
  { label: "3 minuter", seconds: 180 },
  { label: "5 minuter", seconds: 300 },
  { label: "10 minuter", seconds: 600 },
  { label: "Egen tid", seconds: -1 },
];

const distanceOptions = [
  { label: "1 km", km: 1 },
  { label: "2 km", km: 2 },
  { label: "5 km", km: 5 },
  { label: "10 km", km: 10 },
  { label: "Eget avstånd", km: -1 },
];

export default function App() {
  const [screen, setScreen] = useState("start");
  const [category, setCategory] = useState("roda_bilar");
  const [customCategory, setCustomCategory] = useState("");
  const [count, setCount] = useState(0);

  const [playMode, setPlayMode] = useState("time");

  const [timeChoice, setTimeChoice] = useState(180);
  const [customMinutes, setCustomMinutes] = useState(4);
  const [timeLeft, setTimeLeft] = useState(180);
  const [isPaused, setIsPaused] = useState(false);

  const [distanceChoice, setDistanceChoice] = useState(2);
  const [customKm, setCustomKm] = useState(3);
  const [distance, setDistance] = useState(0);
  const [gpsStatus, setGpsStatus] = useState("GPS ej startad");

  const [players, setPlayers] = useState([
    { name: "Spelare 1", guess: "", locked: false },
    { name: "Spelare 2", guess: "", locked: false },
  ]);

  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);
  const finishingRef = useRef(false);

  const objectName =
    category === "custom"
      ? customCategory.trim() || "egna saker"
      : categories[category].label;

  const objectIcon = category === "custom" ? "✏️" : categories[category].icon;

  const totalSeconds = useMemo(() => {
    if (timeChoice === -1) {
      return Math.max(1, Number(customMinutes || 1)) * 60;
    }
    return Number(timeChoice);
  }, [timeChoice, customMinutes]);

  const targetKm = useMemo(() => {
    if (distanceChoice === -1) {
      return Math.max(0.1, Number(customKm || 0.1));
    }
    return Number(distanceChoice);
  }, [distanceChoice, customKm]);

  const progressPercent = useMemo(() => {
    if (screen !== "game") return 0;

    if (playMode === "time") {
      return Math.min(((totalSeconds - timeLeft) / totalSeconds) * 100, 100);
    }

    return Math.min((distance / targetKm) * 100, 100);
  }, [screen, playMode, totalSeconds, timeLeft, distance, targetKm]);

  const results = useMemo(() => {
    return [...players]
      .map((player) => ({
        ...player,
        diff: Math.abs(Number(player.guess || 0) - count),
      }))
      .sort((a, b) => a.diff - b.diff);
  }, [players, count]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  };

  const toRadians = (value) => (value * Math.PI) / 180;

  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const earthRadius = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const stopGps = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
    lastPositionRef.current = null;
  };

  const finishRound = () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    stopGps();
    setIsPaused(false);
    setScreen("result");

    window.setTimeout(() => {
      finishingRef.current = false;
    }, 500);
  };

  const startGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus("GPS stöds inte på denna enhet");
      return;
    }

    stopGps();
    lastPositionRef.current = null;
    setGpsStatus("Startar GPS...");

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;

          if (accuracy > 100) {
            setGpsStatus("Väntar på bättre GPS-signal...");
            return;
          }

          if (!lastPositionRef.current) {
            lastPositionRef.current = { latitude, longitude };
            setGpsStatus("GPS aktiv");
            return;
          }

          const kmMoved = getDistanceKm(
            lastPositionRef.current.latitude,
            lastPositionRef.current.longitude,
            latitude,
            longitude
          );

          if (kmMoved < 0.01) return;

          setDistance((currentDistance) => {
            const nextDistance = Number((currentDistance + kmMoved).toFixed(2));

            if (nextDistance >= targetKm) {
              window.setTimeout(() => finishRound(), 0);
            }

            return nextDistance;
          });

          lastPositionRef.current = { latitude, longitude };
          setGpsStatus("GPS aktiv");
        },
        (error) => {
          if (error.code === 1) setGpsStatus("Platsåtkomst nekad");
          else if (error.code === 2) setGpsStatus("Position saknas");
          else if (error.code === 3) setGpsStatus("GPS tog för lång tid");
          else setGpsStatus("GPS-fel");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        }
      );
    } catch {
      setGpsStatus("GPS kunde inte startas");
    }
  };

  const updatePlayer = (index, field, value) => {
    setPlayers((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const lockGuess = (index) => {
    const player = players[index];

    if (!player.name.trim() || String(player.guess).trim() === "") {
      alert("Fyll i namn och gissning först.");
      return;
    }

    setPlayers((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], locked: true };
      return copy;
    });
  };

  const unlockGuess = (index) => {
    setPlayers((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], locked: false };
      return copy;
    });
  };

  const addPlayer = () => {
    setPlayers((current) => [
      ...current,
      { name: `Spelare ${current.length + 1}`, guess: "", locked: false },
    ]);
  };

  const removeLastPlayer = () => {
    if (players.length <= 2) return;
    setPlayers((current) => current.slice(0, -1));
  };

  const startRound = () => {
    const ready = players.every(
      (player) => player.name.trim() && String(player.guess).trim() !== "" && player.locked
    );

    if (!ready) {
      alert("Alla spelare måste fylla i och trycka Klar.");
      return;
    }

    finishingRef.current = false;
    setCount(0);
    setDistance(0);
    setTimeLeft(totalSeconds);
    setIsPaused(false);
    setGpsStatus("GPS ej startad");
    setScreen("game");

    if (playMode === "gps") {
      window.setTimeout(() => startGps(), 300);
    } else {
      stopGps();
    }
  };

  const newGame = () => {
    stopGps();
    setCount(0);
    setDistance(0);
    setTimeLeft(totalSeconds);
    setIsPaused(false);
    setGpsStatus("GPS ej startad");
    setPlayers((current) =>
      current.map((player, index) => ({
        name: player.name || `Spelare ${index + 1}`,
        guess: "",
        locked: false,
      }))
    );
    setScreen("start");
  };

  const togglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);

    if (playMode === "gps") {
      if (nextPaused) stopGps();
      else startGps();
    }
  };

  useEffect(() => {
    if (screen !== "game") return;
    if (playMode !== "time") return;
    if (isPaused) return;

    if (timeLeft <= 0) {
      finishRound();
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [screen, playMode, isPaused, timeLeft]);

  useEffect(() => {
    return () => stopGps();
  }, []);

  return (
    <div className="app-shell">
      {screen === "start" && (
        <main className="screen-card">
          <img
            className="hero-img"
            src={`${import.meta.env.BASE_URL}hero.png`}
            alt="Familj på bilresa"
          />

          <section className="panel">
            <p className="tagline">🚗 Perfekt spel i bilen</p>

            <button className="primary-button" onClick={() => setScreen("setup")}>
              ▶ STARTA SPEL
              <span>🏆 Närmast vinner</span>
            </button>
          </section>
        </main>
      )}

      {screen === "setup" && (
        <main className="screen-card panel">
          <h1>Bygg rundan</h1>

          <label htmlFor="category">Vad ska ni räkna?</label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {Object.entries(categories).map(([key, value]) => (
              <option key={key} value={key}>
                {value.icon} {value.label}
              </option>
            ))}
            <option value="custom">✏️ Eget val</option>
          </select>

          {category === "custom" && (
            <input
              type="text"
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              placeholder="Skriv vad ni vill räkna"
            />
          )}

          <p className="chosen">
            Ni räknar: <strong>{objectIcon} {objectName}</strong>
          </p>

          <label>Hur vill ni spela?</label>
          <div className="mode-row">
            <button
              type="button"
              className={playMode === "time" ? "active" : ""}
              onClick={() => setPlayMode("time")}
            >
              ⏱️ Tid
            </button>
            <button
              type="button"
              className={playMode === "gps" ? "active" : ""}
              onClick={() => setPlayMode("gps")}
            >
              📍 GPS
            </button>
          </div>

          {playMode === "time" && (
            <>
              <label htmlFor="timeChoice">Hur länge?</label>
              <select
                id="timeChoice"
                value={timeChoice}
                onChange={(event) => setTimeChoice(Number(event.target.value))}
              >
                {timeOptions.map((option) => (
                  <option key={option.seconds} value={option.seconds}>
                    {option.label}
                  </option>
                ))}
              </select>

              {timeChoice === -1 && (
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  placeholder="Egen tid i minuter"
                />
              )}

              <p className="chosen">
                Speltid: <strong>{formatTime(totalSeconds)}</strong>
              </p>
            </>
          )}

          {playMode === "gps" && (
            <>
              <label htmlFor="distanceChoice">Hur långt?</label>
              <select
                id="distanceChoice"
                value={distanceChoice}
                onChange={(event) => setDistanceChoice(Number(event.target.value))}
              >
                {distanceOptions.map((option) => (
                  <option key={option.km} value={option.km}>
                    {option.label}
                  </option>
                ))}
              </select>

              {distanceChoice === -1 && (
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  inputMode="decimal"
                  value={customKm}
                  onChange={(event) => setCustomKm(event.target.value)}
                  placeholder="Eget avstånd i km"
                />
              )}

              <p className="chosen">
                GPS-runda: <strong>{targetKm} km</strong>
              </p>
            </>
          )}

          <h2>Spelare</h2>

          {players.map((player, index) => (
            <section className="player-box" key={index}>
              <input
                type="text"
                value={player.name}
                onChange={(event) => updatePlayer(index, "name", event.target.value)}
                placeholder="Namn"
                disabled={player.locked}
              />

              {!player.locked ? (
                <>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={player.guess}
                    onChange={(event) => updatePlayer(index, "guess", event.target.value)}
                    placeholder={`Gissning på ${objectName}`}
                  />
                  <button className="secondary-button" onClick={() => lockGuess(index)}>
                    Klar
                  </button>
                </>
              ) : (
                <div className="locked-box">
                  <strong>✔️ Gissning sparad</strong>
                  <span>••••</span>
                  <button className="secondary-button" onClick={() => unlockGuess(index)}>
                    Ändra
                  </button>
                </div>
              )}
            </section>
          ))}

          <button className="secondary-button" onClick={addPlayer}>+ Lägg till spelare</button>
          {players.length > 2 && (
            <button className="secondary-button" onClick={removeLastPlayer}>− Ta bort sista spelare</button>
          )}

          <button className="primary-button" onClick={startRound}>🚀 Starta rundan</button>
          <button className="ghost-button" onClick={() => setScreen("start")}>Tillbaka</button>
        </main>
      )}

      {screen === "game" && (
        <main className="screen-card panel game-screen">
          <h1>{objectIcon} Räkna!</h1>
          <p>Tryck varje gång ni ser {objectName}.</p>

          {playMode === "time" ? (
            <div className="timer-box">⏱️ {formatTime(timeLeft)}</div>
          ) : (
            <div className="timer-box">📍 {distance.toFixed(2)} / {targetKm} km</div>
          )}

          {playMode === "gps" && <p className="gps-status">{gpsStatus}</p>}

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="count-number">{count}</div>

          <button className="count-button" onClick={() => setCount((value) => value + 1)}>
            +1
          </button>

          <button className="secondary-button" onClick={() => setCount((value) => Math.max(0, value - 1))}>
            Ångra -1
          </button>

          <button className="secondary-button" onClick={togglePause}>
            {isPaused ? "Fortsätt" : "Pausa"}
          </button>

          <button className="primary-button" onClick={finishRound}>Avsluta runda</button>
          <button className="ghost-button" onClick={newGame}>Avbryt</button>
        </main>
      )}

      {screen === "result" && (
        <main className="screen-card panel">
          <h1>🏆 Resultat</h1>
          <p>Ni såg <strong>{count}</strong> {objectName}</p>

          <div className="winner-box">👑 Vinnare: {results[0]?.name}</div>

          {results.map((player, index) => (
            <div className="result-row" key={index}>
              <strong>{index + 1}. {player.name}</strong>
              <span>Gissade {player.guess} · Skillnad {player.diff}</span>
            </div>
          ))}

          <button className="primary-button" onClick={newGame}>Nytt spel</button>
        </main>
      )}
    </div>
  );
}
