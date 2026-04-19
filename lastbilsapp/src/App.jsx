import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function App() {
  const [screen, setScreen] = useState('start')
  const [objectType, setObjectType] = useState('lastbilar')
  const [customObject, setCustomObject] = useState('')
  const [distanceMode, setDistanceMode] = useState('preset')
  const [targetDistance, setTargetDistance] = useState(20)
  const [customDistance, setCustomDistance] = useState('')
  const [travelMode, setTravelMode] = useState('manual')
  const [gpsStatus, setGpsStatus] = useState('GPS ej startad')
  const [players, setPlayers] = useState([
    { name: 'Spelare 1', guess: '', locked: false },
    { name: 'Spelare 2', guess: '', locked: false }
  ])
  const [count, setCount] = useState(0)
  const [distance, setDistance] = useState(0)

  const watchIdRef = useRef(null)
  const lastPositionRef = useRef(null)

  const selectedObject = useMemo(() => {
    if (objectType === 'eget') return customObject.trim() || 'objekt'
    return objectType
  }, [objectType, customObject])

  const activeTargetDistance = useMemo(() => {
    if (distanceMode === 'custom') {
      const parsed = Number(customDistance)
      return parsed > 0 ? parsed : 0
    }
    return targetDistance
  }, [distanceMode, customDistance, targetDistance])

  const progress =
    activeTargetDistance > 0
      ? Math.min((distance / activeTargetDistance) * 100, 100)
      : 0

  const updatePlayer = (index, field, value) => {
    const updated = [...players]
    updated[index][field] = value
    setPlayers(updated)
  }

  const addPlayer = () => {
    setPlayers([
      ...players,
      {
        name: `Spelare ${players.length + 1}`,
        guess: '',
        locked: false
      }
    ])
  }

  const lockGuess = (index) => {
    const updated = [...players]
    const player = updated[index]

    if (player.name.trim() === '' || player.guess === '') {
      alert('Fyll i namn och gissning innan du trycker Klar.')
      return
    }

    player.locked = true
    setPlayers(updated)
  }

  const unlockAllGuesses = () => {
    setPlayers(players.map((player) => ({ ...player, locked: false })))
  }

  const allPlayersReady =
    players.length > 0 &&
    players.every(
      (player) => player.name.trim() !== '' && player.guess !== '' && player.locked
    )

  const toRadians = (value) => (value * Math.PI) / 180

  const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
    const earthRadius = 6371
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return earthRadius * c
  }

  const stopGpsTracking = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    lastPositionRef.current = null
    setGpsStatus('GPS stoppad')
  }

  const finishGame = () => {
    stopGpsTracking()
    setScreen('result')
  }

  const startGpsTracking = () => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS stöds inte i denna webbläsare')
      return
    }

    setGpsStatus('Startar GPS...')

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords

        if (accuracy > 80) {
          setGpsStatus('Väntar på bättre GPS-signal...')
          return
        }

        if (!lastPositionRef.current) {
          lastPositionRef.current = { latitude, longitude }
          setGpsStatus('GPS aktiv')
          return
        }

        const kmMoved = getDistanceInKm(
          lastPositionRef.current.latitude,
          lastPositionRef.current.longitude,
          latitude,
          longitude
        )

        if (kmMoved < 0.01) return

        setDistance((prev) => {
          const updated = Number((prev + kmMoved).toFixed(2))
          if (updated >= activeTargetDistance) {
            setTimeout(() => finishGame(), 0)
          }
          return updated
        })

        lastPositionRef.current = { latitude, longitude }
        setGpsStatus('GPS aktiv')
      },
      (error) => {
        if (error.code === 1) setGpsStatus('Platsåtkomst nekad')
        else if (error.code === 2) setGpsStatus('Position ej tillgänglig')
        else if (error.code === 3) setGpsStatus('GPS tog för lång tid')
        else setGpsStatus('GPS-fel')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    )
  }

  const startGame = () => {
    if (!allPlayersReady) {
      alert('Alla spelare måste fylla i och låsa sina gissningar först.')
      return
    }

    if (activeTargetDistance <= 0) {
      alert('Skriv ett giltigt avstånd större än 0 km.')
      return
    }

    setCount(0)
    setDistance(0)
    lastPositionRef.current = null
    setGpsStatus('GPS ej startad')
    setScreen('game')
  }

  useEffect(() => {
    if (screen === 'game' && travelMode === 'gps') {
      startGpsTracking()
    }

    return () => {
      stopGpsTracking()
    }
  }, [screen, travelMode])

  const handleObjectClick = () => {
    setCount((prev) => prev + 1)
  }

  const handleDistanceClick = () => {
    const newDistance = distance + 1
    setDistance(newDistance)

    if (newDistance >= activeTargetDistance) {
      finishGame()
    }
  }

  const resetRound = () => {
    stopGpsTracking()
    setCount(0)
    setDistance(0)
    setGpsStatus('GPS ej startad')
    setScreen('setup')
  }

  const resetAll = () => {
    stopGpsTracking()
    setScreen('start')
    setObjectType('lastbilar')
    setCustomObject('')
    setDistanceMode('preset')
    setTargetDistance(20)
    setCustomDistance('')
    setTravelMode('manual')
    setGpsStatus('GPS ej startad')
    setPlayers([
      { name: 'Spelare 1', guess: '', locked: false },
      { name: 'Spelare 2', guess: '', locked: false }
    ])
    setCount(0)
    setDistance(0)
  }

  const sortedResults = [...players]
    .map((player) => ({
      ...player,
      diff: Math.abs(Number(player.guess) - count)
    }))
    .sort((a, b) => a.diff - b.diff)

  const lowestDiff =
    sortedResults.length > 0 ? Math.min(...sortedResults.map((player) => player.diff)) : 0

  const winners = sortedResults.filter((player) => player.diff === lowestDiff)

  const getMedal = (index) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return '⭐'
  }

  return (
    <div className="app-shell">
      <div className="background-stars">
        <span>⭐</span>
        <span>✨</span>
        <span>🌟</span>
        <span>⭐</span>
        <span>✨</span>
        <span>🌟</span>
      </div>

      {screen === 'start' && (
        <div className="card pop-in">
          <div className="fun-badge bounce">🚗🎉 Kul i bilen!</div>
          <h1>Bilbingo-utmaningen</h1>
          <p className="subtitle">Gissa, räkna och vinn över familjen på bilresan!</p>

          <div className="hero-icons">
            <span>🚚</span>
            <span>🚙</span>
            <span>🚌</span>
            <span>🐄</span>
            <span>⭐</span>
          </div>

          <button className="primary-button pulse" onClick={() => setScreen('setup')}>
            Starta spel
          </button>
        </div>
      )}

      {screen === 'setup' && (
        <div className="card pop-in">
          <div className="fun-badge bounce">🛠️ Bygg er runda</div>
          <h1>Ställ in spelet</h1>

          <div className="section">
            <label className="label">Välj objekt att räkna</label>
            <select value={objectType} onChange={(e) => setObjectType(e.target.value)}>
              <option value="lastbilar">Lastbilar</option>
              <option value="bilar">Bilar</option>
              <option value="röda bilar">Röda bilar</option>
              <option value="husbilar">Husbilar</option>
              <option value="skyltar">Skyltar</option>
              <option value="eget">Eget objekt</option>
            </select>

            {objectType === 'eget' && (
              <input
                type="text"
                placeholder="Skriv eget objekt, t.ex. kor"
                value={customObject}
                onChange={(e) => setCustomObject(e.target.value)}
              />
            )}
          </div>

          <div className="section">
            <label className="label">Välj avstånd</label>

            <div className="distance-mode-row">
              <button
                type="button"
                className={distanceMode === 'preset' ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setDistanceMode('preset')}
              >
                Fasta val
              </button>
              <button
                type="button"
                className={distanceMode === 'custom' ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setDistanceMode('custom')}
              >
                Eget avstånd
              </button>
            </div>

            {distanceMode === 'preset' ? (
              <select value={targetDistance} onChange={(e) => setTargetDistance(Number(e.target.value))}>
                <option value={1}>1 km</option>
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
              </select>
            ) : (
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Skriv eget avstånd i km"
                value={customDistance}
                onChange={(e) => setCustomDistance(e.target.value)}
              />
            )}
          </div>

          <div className="section">
            <label className="label">Välj km-läge</label>
            <div className="distance-mode-row">
              <button
                type="button"
                className={travelMode === 'manual' ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setTravelMode('manual')}
              >
                Manuellt läge
              </button>
              <button
                type="button"
                className={travelMode === 'gps' ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setTravelMode('gps')}
              >
                GPS-läge
              </button>
            </div>
            <p className="ready-text">
              {travelMode === 'gps'
                ? 'GPS mäter sträckan automatiskt när ni rör er.'
                : 'I manuellt läge ökar ni km själva med knappen +1 km.'}
            </p>
          </div>

          <div className="players">
            {players.map((player, index) => (
              <div key={index} className="player-card">
                <div className="player-title">👤 Spelare {index + 1}</div>

                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                  placeholder="Namn"
                  disabled={player.locked}
                />

                {!player.locked ? (
                  <div className="guess-row">
                    <input
                      type="number"
                      value={player.guess}
                      onChange={(e) => updatePlayer(index, 'guess', e.target.value)}
                      placeholder={`Gissning på antal ${selectedObject}`}
                    />
                    <button onClick={() => lockGuess(index)}>Klar</button>
                  </div>
                ) : (
                  <div className="locked-box">
                    <span>✔ Gissning sparad</span>
                    <span className="masked">***</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="button-row">
            <button onClick={addPlayer}>+ Lägg till spelare</button>
            <button onClick={unlockAllGuesses}>Lås upp alla</button>
          </div>

          <p className="ready-text">
            {allPlayersReady
              ? `Alla spelare är klara. Sträckan är ${activeTargetDistance || 0} km.`
              : 'Varje spelare skriver sin gissning och trycker Klar.'}
          </p>

          <div className="button-row">
            <button onClick={() => setScreen('start')}>Tillbaka</button>
            <button className="primary-button pulse" onClick={startGame}>
              Starta rundan
            </button>
          </div>
        </div>
      )}

      {screen === 'game' && (
        <div className="card pop-in">
          <div className="fun-badge bounce">
            {travelMode === 'gps' ? '📍 GPS-läge aktivt' : '🚀 Spelet är igång!'}
          </div>
          <h1>🚀 {selectedObject}-utmaningen</h1>

          <div className="count">{count}</div>

          <button className="big-button pulse" onClick={handleObjectClick}>
            +1 {selectedObject.toUpperCase()}
          </button>

          {travelMode === 'manual' ? (
            <button className="distance-button" onClick={handleDistanceClick}>
              +1 km
            </button>
          ) : (
            <div className="gps-panel">
              <div className="gps-status-line">{gpsStatus}</div>
            </div>
          )}

          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <p className="distance-text">
            {distance.toFixed(2)} / {activeTargetDistance} km
          </p>

          <div className="guess-box">
            <h3>🎯 Spelare i rundan</h3>
            {players.map((player, index) => (
              <p key={index}>
                {player.name}: gissning låst
              </p>
            ))}
          </div>

          <button className="danger-button" onClick={finishGame}>
            Avsluta nu
          </button>
        </div>
      )}

      {screen === 'result' && (
        <div className="card pop-in result-card">
          <div className="confetti-row">
            <span>🎉</span>
            <span>✨</span>
            <span>🎊</span>
            <span>⭐</span>
            <span>🎉</span>
          </div>

          <div className="fun-badge bounce">🏆 Rundan är klar!</div>
          <h1>🏆 Resultat</h1>

          <p className="result-main">
            Faktiskt antal {selectedObject}: {count}
          </p>
          <p className="result-subtext">
            Spelad sträcka: {activeTargetDistance} km
          </p>

          <div className="winner-banner glow">
            {winners.length > 1
              ? `🤝 Oavgjort mellan: ${winners.map((w) => w.name).join(', ')}`
              : `👑 Vinnare: ${winners[0]?.name || ''}`}
          </div>

          <div className="podium-list">
            {sortedResults.map((player, index) => (
              <div key={index} className={`podium-item ${index === 0 ? 'winner-item' : ''}`}>
                <div className="podium-medal">{getMedal(index)}</div>
                <div className="podium-info">
                  <div className="podium-name">{player.name}</div>
                  <div className="podium-score">
                    Gissade {player.guess} • Skillnad {player.diff}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="button-row">
            <button onClick={resetRound}>Ny runda</button>
            <button className="primary-button" onClick={resetAll}>
              Till startskärmen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App