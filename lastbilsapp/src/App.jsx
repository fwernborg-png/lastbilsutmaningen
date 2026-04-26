import { useMemo, useState } from "react";
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

export default function App() {
  const [screen, setScreen] = useState("start");
  const [category, setCategory] = useState("roda_bilar");
  const [customCategory, setCustomCategory] = useState("");
  const [count, setCount] = useState(0);

  const [players, setPlayers] = useState([
    { name: "Spelare 1", guess: "", locked: false },
    { name: "Spelare 2", guess: "", locked: false },
  ]);

  const objectName =
    category === "custom"
      ? customCategory.trim() || "egna saker"
      : categories[category].label;

  const objectIcon = category === "custom" ? "✏️" : categories[category].icon;

  const results = useMemo(() => {
    return [...players]
      .map((player) => ({
        ...player,
        diff: Math.abs(Number(player.guess || 0) - count),
      }))
      .sort((a, b) => a.diff - b.diff);
  }, [players, count]);

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

    setCount(0);
    setScreen("game");
  };

  const newGame = () => {
    setCount(0);
    setPlayers((current) =>
      current.map((player, index) => ({
        name: player.name || `Spelare ${index + 1}`,
        guess: "",
        locked: false,
      }))
    );
    setScreen("start");
  };

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
            <p className="tagline">Gissa, räkna och vinn över familjen på bilresan!</p>

            <button className="primary-button" onClick={() => setScreen("setup")}> 
              ▶ STARTA SPEL
              <span>Den närmaste gissningen vinner 🏆</span>
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

          <div className="count-number">{count}</div>

          <button className="count-button" onClick={() => setCount((value) => value + 1)}>
            +1
          </button>

          <button className="secondary-button" onClick={() => setCount((value) => Math.max(0, value - 1))}>
            Ångra -1
          </button>

          <button className="primary-button" onClick={() => setScreen("result")}>Avsluta runda</button>
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
