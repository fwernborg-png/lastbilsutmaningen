import Confetti from "react-confetti";
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const categories = {
  roda_bilar: { label: "röda bilar", icon: "🚗" },
  lastbilar: { label: "lastbilar", icon: "🚚" },
  djur: { label: "djur", icon: "�" },
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
  const [showRules, setShowRules] = useState(
  localStorage.getItem("bilsemester-hide-rules") !== "yes"
);

const [dontShowRulesAgain, setDontShowRulesAgain] = useState(false);
  const [accessCode, setAccessCode] = useState("");
const [hasAccess, setHasAccess] = useState(
  localStorage.getItem("bilsemester-access") === "yes"
);
  const [countdown, setCountdown] = useState(null);

  const [category, setCategory] = useState("roda_bilar");
  const [customCategory, setCustomCategory] = useState("");
  const [count, setCount] = useState(0);
const [gamesPlayed, setGamesPlayed] = useState(
  Number(localStorage.getItem("bilsemester-games") || 0)
);
const [floatingPoints, setFloatingPoints] = useState([]);
const isLocked =
  gamesPlayed >= 5 &&
  localStorage.getItem("bilsemester-premium") !== "yes";
  const [playMode, setPlayMode] = useState("time");

  const [timeChoice, setTimeChoice] = useState(180);
  const [customMinutes, setCustomMinutes] = useState(4);
  const [timeLeft, setTimeLeft] = useState(180);
  const [isPaused, setIsPaused] = useState(false);

  const [distanceChoice, setDistanceChoice] = useState(2);
  const [customKm, setCustomKm] = useState(3);
  const [distance, setDistance] = useState(0);
  const [gpsStatus, setGpsStatus] = useState("Avstånd ej startad");
  const [gpsCountdown, setGpsCountdown] = useState(null);
  const [gpsStarted, setGpsStarted] = useState(false);

  const nextPlayerIdRef = useRef(3);
  const [players, setPlayers] = useState([
    { id: 1, name: "", guess: "", locked: false },
    { id: 2, name: "", guess: "", locked: false },
  ]);
useEffect(() => {
  const savedGame = localStorage.getItem("bilsemester-save");

  if (savedGame) {
    const data = JSON.parse(savedGame);

    setCount(data.count || 0);
    setDistance(data.distance || 0);
    setScreen(data.screen || "start");
    setIsPaused(data.isPaused || false);
  }
}, []);
useEffect(() => {
  localStorage.setItem(
    "bilsemester-save",
    JSON.stringify({
      count,
      distance,
      screen,
      isPaused,
    })
  );
}, [count, distance, screen, isPaused]);
  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);
  const finishingRef = useRef(false);
  const wakeLockRef = useRef(null);

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
      .map((player, index) => ({
        ...player,
        name: player.name || `Spelare ${index + 1}`,
        diff: Math.abs(Number(player.guess || 0) - count),
      }))
      .sort((a, b) => a.diff - b.diff);
  }, [players, count]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  };

  const playClickEffect = () => {
    try {
      if (navigator.vibrate) navigator.vibrate(40);

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

      gain.gain.setValueAtTime(0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
    } catch {
      // Ljud stöds inte alltid i alla webbläsare
    }
  };

const playWinEffect = () => {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([120, 80, 180]);
    }

    const audio = new Audio(`${import.meta.env.BASE_URL}win.mp3`);
    audio.volume = 0.9;
    audio.play();

  } catch {
    // Vinstljud stöds inte i alla webbläsare
  }
};

  const enableWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Wake lock stöds inte alltid
    }
  };

  const disableWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // Ignorera
    }
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
    setGpsStarted(false);
  };

  const finishRound = () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    stopGps();
    disableWakeLock();
    setIsPaused(false);
    setGpsCountdown(null);

    playWinEffect();
    setScreen("result");
    const nextGames = gamesPlayed + 1;

setGamesPlayed(nextGames);

localStorage.setItem(
  "bilsemester-games",
  String(nextGames)
);

    window.setTimeout(() => {
      finishingRef.current = false;
    }, 500);
  };

  const startGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus("Avståndsmätning stöds inte på denna enhet");
      return;
    }

    stopGps();
    lastPositionRef.current = null;
    setGpsStatus("Startar avståndsmätning...");
    setGpsStarted(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        if (accuracy > 100) {
          setGpsStatus("Väntar på bättre signal...");
          return;
        }

        if (!lastPositionRef.current) {
          lastPositionRef.current = { latitude, longitude };
          setGpsStatus("Räknar avstånd – kör!");
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
        setGpsStatus("Räknar avstånd – kör!");
      },
      (error) => {
        if (error.code === 1) setGpsStatus("Platsåtkomst nekad");
        else if (error.code === 2) setGpsStatus("Position saknas");
        else if (error.code === 3) setGpsStatus("Tog för lång tid");
        else setGpsStatus("Mätfel – försök igen");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  const startGpsCountdown = () => {
    stopGps();
    setDistance(0);
    setGpsStarted(false);
    setGpsStatus("Gör er redo...");
    setGpsCountdown(3);

    let number = 3;

    const gpsInterval = window.setInterval(() => {
      number -= 1;

      if (number > 0) {
        setGpsCountdown(number);
      } else {
        window.clearInterval(gpsInterval);
        setGpsCountdown(null);
        startGps();
      }
    }, 1000);
  };

  const startCountdownThenGame = () => {
    setCountdown(3);

    let number = 3;

    const startInterval = window.setInterval(() => {
      number -= 1;

      if (number > 0) {
        setCountdown(number);
      } else {
        window.clearInterval(startInterval);
        setCountdown("KÖR!");

        window.setTimeout(() => {
          setCountdown(null);
          setScreen("game");
          enableWakeLock();

          if (playMode === "gps") {
            startGpsCountdown();
          }
        }, 800);
      }
    }, 1000);
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
    const newId = nextPlayerIdRef.current++;
    setPlayers((current) => [
      ...current,
      { id: newId, name: "", guess: "", locked: false },
    ]);
  };

  const removeLastPlayer = () => {
    if (players.length <= 2) return;
    setPlayers((current) => current.slice(0, -1));
  };

  const startRound = () => {
    const ready = players.every(
      (player) =>
        player.name.trim() &&
        String(player.guess).trim() !== "" &&
        player.locked
    );

    if (!ready) {
      alert("Alla spelare måste fylla i och trycka Klar.");
      return;
    }

    finishingRef.current = false;
    stopGps();
    setCount(0);
    setDistance(0);
    setTimeLeft(totalSeconds);
    setIsPaused(false);
    setGpsStatus("Avstånd ej startad");
    setGpsCountdown(null);

    startCountdownThenGame();
  };

  const newGame = () => {
    disableWakeLock();
    stopGps();
    setCount(0);
    setDistance(0);
    setTimeLeft(totalSeconds);
    setIsPaused(false);
    setGpsStatus("Avstånd ej startad");
    setGpsCountdown(null);
    setCountdown(null);

    setPlayers((current) =>
      current.map((p) => ({
        id: p.id,
        name: "",
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
      else startGpsCountdown();
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
if (!hasAccess) {
  return (
    <div className="app-shell">
      <main className="screen-card panel">
        <h1>🔒 Bilsemester</h1>
        <p>Skriv koden för att starta appen.</p>

        <input
          type="text"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
          placeholder="Kod"
        />

        <button
          className="primary-button"
          onClick={() => {
            if (accessCode.trim().toUpperCase() === "WERNA") {
              localStorage.setItem("bilsemester-access", "yes");
              setHasAccess(true);
            } else {
              alert("Fel kod.");
            }
          }}
        >
          Lås upp
        </button>
      </main>
    </div>
  );
}
if (isLocked) {
  return (
    <div className="app-shell">
      <main className="screen-card panel">
        <h1>🔒 Bilsemester Premium</h1>

        <p>Ni har spelat era 5 gratisrundor 🎉</p>

        <div className="mega-winner">
          29 kr / år
        </div>

        <p>
          🚗 Obegränsat spel
          <br />
          🏆 Alla framtida uppdateringar
          <br />
          🍦 Billigare än en glass
        </p>

        <button
          className="primary-button"
          onClick={() => {
            const code = prompt("Skriv premiumkod");

            if (code === "Stenhuggaren") {
              localStorage.setItem("bilsemester-premium", "yes");
              localStorage.setItem("bilsemester-games", "0");
              window.location.reload();
            }
          }}
        >
          🔓 Lås upp Premium
        </button>
      </main>
    </div>
  );
}
  return (
    <div className="app-shell">
      {countdown !== null && (
        <div className="countdown-overlay">
          <div className="countdown-number">{countdown}</div>
        </div>
      )}
{showRules && (
  <div className="rules-overlay">
    <div className="rules-card">
      <h2>🚗 Så spelar ni</h2>

     <div className="rules-list">
  <p>🎯 Alla gissar hur många fordon ni kommer se.</p>

  <p>🚙 Räkna bara fordon ni möter på vägen.</p>

  <p>🚘 Fordon ni kör om räknas inte — då blir spelet enklare.</p>

  <p>🦌 Djur, vindkraftverk och annat: titta på båda sidor av vägen.</p>

  <p>🏆 Den som gissar närmast vinner!</p>
</div>

      <label className="rules-checkbox">
        <input
          type="checkbox"
          checked={dontShowRulesAgain}
          onChange={(event) =>
            setDontShowRulesAgain(event.target.checked)
          }
        />
        Visa inte igen
      </label>

      <button
        className="primary-button"
        onClick={() => {
          if (dontShowRulesAgain) {
            localStorage.setItem("bilsemester-hide-rules", "yes");
          }

          setShowRules(false);
        }}
      >
        🚀 Nu kör vi!
      </button>
    </div>
  </div>
)}
      {screen === "start" && (
        <main className="pro-home">
          <section className="pro-hero-card">
            <img
              className="pro-hero-img"
              src={`${import.meta.env.BASE_URL}hero.png`}
              alt="Familj på bilresa"
            />
          </section>

          <section className="pro-home-panel">
            <div className="pro-feature-grid">
              <div className="pro-feature-card">
                <span>🎯</span>
                <strong>Gissa först!</strong>
                <small>Vad tror du?</small>
              </div>

              <div className="pro-feature-card">
                <span>🚗</span>
                <strong>Räkna sen!</strong>
                <small>Tryck när ni ser</small>
              </div>

              <div className="pro-feature-card">
                <span>😄</span>
                <strong>Ha kul!</strong>
                <small>Gör resan roligare</small>
              </div>
            </div>

            <button
              className="pro-start-button"
              onClick={() => setScreen("setup")}
            >
              <span className="play-icon">▶</span>
              <span>
                STARTA SPEL
                <small>🏆 Närmast vinner</small>
              </span>
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
            Ni räknar:{" "}
            <strong>
              {objectIcon} {objectName}
            </strong>
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
              📍 Avstånd
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
                onChange={(event) =>
                  setDistanceChoice(Number(event.target.value))
                }
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
                Avstånd: <strong>{targetKm} km</strong>
              </p>
            </>
          )}

          <h2>Spelare</h2>

          {players.map((player, index) => (
            <section className="player-box" key={player.id}>
              <input
                type="text"
                value={player.name}
                onChange={(event) =>
                  updatePlayer(index, "name", event.target.value)
                }
                placeholder={`Namn spelare ${index + 1}`}
                disabled={player.locked}
              />

              {!player.locked ? (
                <>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={player.guess}
                    onChange={(event) =>
                      updatePlayer(index, "guess", event.target.value)
                    }
                    placeholder={`Gissning på ${objectName}`}
                  />

                  <button
                    className="secondary-button"
                    onClick={() => lockGuess(index)}
                  >
                    Klar
                  </button>
                </>
              ) : (
                <div className="locked-box">
                  <strong>✔️ Gissning sparad</strong>
                  <span>••••</span>

                  <button
                    className="secondary-button"
                    onClick={() => unlockGuess(index)}
                  >
                    Ändra
                  </button>
                </div>
              )}
            </section>
          ))}

          <button className="secondary-button" onClick={addPlayer}>
            + Lägg till spelare
          </button>

          {players.length > 2 && (
            <button className="secondary-button" onClick={removeLastPlayer}>
              − Ta bort sista spelare
            </button>
          )}

          <button className="primary-button" onClick={startRound}>
            🚀 Starta rundan
          </button>

          <button className="ghost-button" onClick={() => setScreen("start")}>
            Tillbaka
          </button>
        </main>
      )}

      {screen === "game" && (
        <main className="screen-card panel game-screen">
          <h1>{objectIcon} Räkna!</h1>

          <p>Tryck varje gång ni ser {objectName}.</p>

          {playMode === "time" ? (
            <div className="timer-box">⏱️ {formatTime(timeLeft)}</div>
          ) : (
            <div className="timer-box">
              {gpsCountdown
                ? `🚦 Startar om ${gpsCountdown}...`
                : `📍 ${distance.toFixed(2)} / ${targetKm} km`}
            </div>
          )}

          {playMode === "gps" && <p className="gps-status">{gpsStatus}</p>}

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className={`count-number ${count > 0 ? "count-bounce" : ""}`}>
  {count}
</div>
<div className="floating-points-container">
  {floatingPoints.map((item) => (
    <div key={item.id} className="floating-point">
      +1 {objectIcon}
    </div>
  ))}
</div>
          <button
            className="count-button"
            disabled={playMode === "gps" && !gpsStarted}
            onClick={(event) => {
  event.currentTarget.classList.remove("pop");

  void event.currentTarget.offsetWidth;

  event.currentTarget.classList.add("pop");

  playClickEffect();
  setCount((value) => value + 1);
  const id = Date.now();

setFloatingPoints((current) => [
  ...current,
  { id }
]);

setTimeout(() => {
  setFloatingPoints((current) =>
    current.filter((item) => item.id !== id)
  );
}, 900);
}}
          >
            +1
          </button>

          <button
            className="secondary-button"
            onClick={() => setCount((value) => Math.max(0, value - 1))}
          >
            Ångra -1
          </button>

          <button className="secondary-button" onClick={togglePause}>
            {isPaused ? "▶ Fortsätt" : "⏸ Pausa"}
          </button>

          <button className="secondary-button result-button" onClick={finishRound}>
            🏁 Visa resultat
          </button>
          <div className="road-status">
  🚗 Familjen är ute på äventyr!
</div>
        </main>
      )}

      {screen === "result" && (
        <>
          <Confetti numberOfPieces={700} recycle={false} gravity={0.25} />

          <main className="screen-card panel">
            <h1>🏆 Resultat</h1>

            <p>
              Ni såg <strong>{count}</strong> {objectName}
            </p>

            <div className="winner-box mega-winner">
              <div className="winner-title">
  <span>👑</span>

  {results.filter((player) => player.diff === results[0]?.diff).length > 1
    ? "DELAD VINST"
    : "VINNARE"}

  <span>👑</span>
</div>
              <br />
              {results.filter((player) => player.diff === results[0]?.diff).map((player) => player.name).join(" & ")}
            </div>

            {results.map((player, index) => (
              <div className="result-row" key={index}>
                <strong>
                  {index + 1}. {player.name}
                </strong>

                <span>
                  Gissade {player.guess} · Skillnad {player.diff}
                </span>
              </div>
            ))}

            <button className="primary-button" onClick={newGame}>
              Nytt spel
            </button>
          </main>
        </>
      )}
    </div>
  );
}