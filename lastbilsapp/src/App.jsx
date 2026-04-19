import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function App() {
  const STORAGE_KEY = 'bilbingo-game-state-v2'

  const [screen, setScreen] = useState('start')
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [savedGame, setSavedGame] = useState(null)

  const [objectType, setObjectType] = useState('lastbilar')
  const [customObject, setCustomObject] = useState('')

  const [playMode, setPlayMode] = useState('distance')

  const [distanceMode, setDistanceMode] = useState('preset')
  const [targetDistance, setTargetDistance] = useState(20)
  const [customDistance, setCustomDistance] = useState('')

  const [travelMode, setTravelMode] = useState('manual')
  const [gpsStatus, setGpsStatus] = useState('GPS ej startad')

  const [timeMode, setTimeMode] = useState('preset')
  const [targetMinutes, setTargetMinutes] = useState(5)
  const [customMinutes, setCustomMinutes] = useState('')

  const [players, setPlayers] = useState([
    { name: 'Spelare 1', guess: '', locked: false },
    { name: 'Spelare 2', guess: '', locked: false },
  ])

  const [count, setCount] = useState(0)
  const [distance, setDistance] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)

  const watchIdRef = useRef(null)
  const lastPositionRef = useRef(null)
  const hasLoadedStateRef = useRef(false)
  const timerRef = useRef(null)

  const selectedObject = useMemo(() => {
    if (objectType === 'eget') {
      return customObject.trim() || 'objekt'
    }
    return objectType
  }, [objectType, customObject])

  const activeTargetDistance = useMemo(() => {
    if (distanceMode === 'custom') {
      const parsed = Number(customDistance)
      return parsed > 0 ? parsed : 0
    }
    return targetDistance
  }, [distanceMode, customDistance, targetDistance])

  const activeTargetMinutes = useMemo(() => {
    if (timeMode === 'custom') {
      const parsed = Number(customMinutes)
      return parsed > 0 ? parsed : 0
    }
    return targetMinutes
  }, [timeMode, customMinutes, targetMinutes])

  const activeTargetSeconds = activeTargetMinutes * 60

  const progress = useMemo(() => {
    if (playMode === 'distance') {
      return activeTargetDistance > 0
        ? Math.min((distance / activeTargetDistance) * 100, 100)
        : 0
    }

    return activeTargetSeconds > 0
      ? Math.min(((activeTargetSeconds - timeLeft) / activeTargetSeconds) * 100, 100)
      : 0
  }, [playMode, distance, activeTargetDistance, timeLeft, activeTargetSeconds])

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
        locked: false,
      },
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
    setGpsStatus((prev) => (prev === 'GPS ej startad' ? prev : 'GPS stoppad'))
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const finishGame = () => {
    stopGpsTracking()
    stopTimer()
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
        if (error.code === 1) {
          setGpsStatus('Platsåtkomst nekad')
        } else if (error.code === 2) {
          setGpsStatus('Position ej tillgänglig')
        } else if (error.code === 3) {
          setGpsStatus('GPS tog för lång tid')
        } else {
          setGpsStatus('GPS-fel')
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    )
  }

  const startCountdown = () => {
    stopTimer()
    setTimeLeft(activeTargetSeconds)

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          setTimeout(() => finishGame(), 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const applySavedGame = (parsed) => {
    if (parsed.screen) setScreen(parsed.screen)
    if (parsed.objectType) setObjectType(parsed.objectType)
    if (parsed.customObject !== undefined) setCustomObject(parsed.customObject)
    if (parsed.playMode) setPlayMode(parsed.playMode)
    if (parsed.distanceMode) setDistanceMode(parsed.distanceMode)
    if (parsed.targetDistance !== undefined) setTargetDistance(parsed.targetDistance)
    if (parsed.customDistance !== undefined) setCustomDistance(parsed.customDistance)
    if (parsed.travelMode) setTravelMode(parsed.travelMode)
    if (parsed.gpsStatus) setGpsStatus(parsed.gpsStatus)
    if (parsed.timeMode) setTimeMode(parsed.timeMode)
    if (parsed.targetMinutes !== undefined) setTargetMinutes(parsed.targetMinutes)
    if (parsed.customMinutes !== undefined) setCustomMinutes(parsed.customMinutes)
    if (parsed.players) setPlayers(parsed.players)
    if (parsed.count !== undefined) setCount(parsed.count)
    if (parsed.distance !== undefined) setDistance(parsed.distance)
    if (parsed.timeLeft !== undefined) setTimeLeft(parsed.timeLeft)
  }

  const clearSavedGame = () => {
    localStorage.removeItem(STORAGE_KEY)
    setSavedGame(null)
    setShowResumePrompt(false)
  }

  const startFreshGame = () => {
    clearSavedGame()
    stopGpsTracking()
    stopTimer()

    setScreen('start')
    setObjectType('lastbilar')
    setCustomObject('')
    setPlayMode('distance')
    setDistanceMode('preset')
    setTargetDistance(20)
    setCustomDistance('')
    setTravelMode('manual')
    setGpsStatus('GPS ej startad')
    setTimeMode('preset')
    setTargetMinutes(5)
    setCustomMinutes('')
    setPlayers([
      { name: 'Spelare 1', guess: '', locked: false },
      { name: 'Spelare 2', guess: '', locked: false },
    ])
    setCount(0)
    setDistance(0)
    setTimeLeft(0)
  }

  const continueSavedGame = () => {
    if (!savedGame) return
    applySavedGame(savedGame)
    setShowResumePrompt(false)
  }

  const startGame = () => {
    if (!allPlayersReady) {
      alert('Alla spelare måste fylla i och låsa sina gissningar först.')
      return
    }

    if (playMode === 'distance' && activeTargetDistance <= 0) {
      alert('Skriv ett giltigt avstånd större än 0 km.')
      return
    }

    if (playMode === 'time' && activeTargetMinutes <= 0) {
      alert('Skriv en giltig tid större än 0 minuter.')
      return
    }

    setCount(0)
    setDistance(0)
    setTimeLeft(activeTargetSeconds)
    lastPositionRef.current = null
    setGpsStatus('GPS ej startad')
    setScreen('game')
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      hasLoadedStateRef.current = true
      return
    }

    try {
      const parsed = JSON.parse(saved)
      const hasProgress =
        parsed &&
        (
          parsed.screen === 'setup' ||
          parsed.screen === 'game' ||
          parsed.screen === 'result' ||
          parsed.count > 0 ||
          parsed.distance > 0 ||
          parsed.timeLeft > 0
        )

      if (hasProgress) {
        setSavedGame(parsed)
        setShowResumePrompt(true)
      }
    } catch (error) {
      console.log('Kunde inte läsa sparad speldata', error)
    } finally {
      hasLoadedStateRef.current = true
    }
  }, [])

  useEffect(() => {
    if (screen === 'game') {
      if (playMode === 'distance' && travelMode === 'gps') {
        startGpsTracking()
      }

      if (playMode === 'time') {
        if (timeLeft <= 0) {
          setTimeLeft(activeTargetSeconds)
        }
        startCountdown()
      }
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      stopTimer()
    }
  }, [screen, playMode, travelMode, activeTargetDistance, activeTargetSeconds])

  useEffect(() => {
    if (!hasLoadedStateRef.current) return
    if (showResumePrompt) return

    const gameState = {
      screen,
      objectType,
      customObject,
      playMode,
      distanceMode,
      targetDistance,
      customDistance,
      travelMode,
      gpsStatus,
      timeMode,
      targetMinutes,
      customMinutes,
      players,
      count,
      distance,
      timeLeft,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState))
  }, [
    screen,
    objectType,
    customObject,
    playMode,
    distanceMode,
    targetDistance,
    customDistance,
    travelMode,
    gpsStatus,
    timeMode,
    targetMinutes,
    customMinutes,
    players,
    count,
    distance,
    timeLeft,
    showResumePrompt,
  ])

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
    stopTimer()
    setCount(0)
    setDistance(0)
    setTimeLeft(0)
    setGpsStatus('GPS ej startad')
    setScreen('setup')
  }

  const resetAll = () => {
    startFreshGame()
  }

  const sortedResults = [...players]
    .map((player) => ({
      ...player,
      diff: Math.abs(Number(player.guess) - count),
    }))
    .sort((a, b) => a.diff - b.diff)

  const lowestDiff =
    sortedResults.length > 0
      ? Math.min(...sortedResults.map((player) => player.diff))
      : 0

  const winners = sortedResults.filter((player) => player.diff === lowestDiff)

  const getMedal = (index) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return '⭐'
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
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

      {showResumePrompt && (
        <div className="card pop-in">
          <div className="fun-badge bounce">🧠 Sparat spel hittat</div>
          <h1>Fortsätta spelet?</h1>
          <p className="subtitle">Ett pågående spel hittades på den här mobilen.</p>

          <div className="guess-box">
            <p><strong>Skärm:</strong> {savedGame?.screen || 'okänd'}</p>
            <p><strong>Antal:</strong> {savedGame?.count ?? 0}</p>
            <p><strong>Sträcka:</strong> {savedGame?.distance ?? 0} km</p>
            <p><strong>Tid kvar:</strong> {formatTime(savedGame?.timeLeft ?? 0)}</p>
          </div>

          <div className="button-row">
            <button onClick={startFreshGame}>Börja om</button>
            <button className="primary-button pulse" onClick={continueSavedGame}>
              Fortsätt spel
            </button>
          </div>
        </div>
      )}

      {!showResumePrompt && screen === 'start' && (
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

      {!showResumePrompt && screen === 'setup' && (
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
            <label className="label">Välj spelläge</label>
            <div className="distance-mode-row">
              <button
                type="button"
                className={
                  playMode === 'distance'
                    ? 'primary-button small-mode-button'
                    : 'small-mode-button'
                }
                onClick={() => setPlayMode('distance')}
              >
                Sträcka
              </button>
              <button
                type="button"
                className={
                  playMode === 'time'
                    ? 'primary-button small-mode-button'
                    : 'small-mode-button'
                }
                onClick={() => setPlayMode('time')}
              >
                Tid
              </button>
            </div>
          </div>

          {playMode === 'distance' && (
            <>
              <div className="section">
                <label className="label">Välj avstånd</label>

                <div className="distance-mode-row">
                  <button
                    type="button"
                    className={
                      distanceMode === 'preset'
                        ? 'primary-button small-mode-button'
                        : 'small-mode-button'
                    }
                    onClick={() => setDistanceMode('preset')}
                  >
                    Fasta val
                  </button>
                  <button
                    type="button"
                    className={
                      distanceMode === 'custom'
                        ? 'primary-button small-mode-button'
                        : 'small-mode-button'
                    }
                    onClick={() => setDistanceMode('custom')}
                  >
                    Eget avstånd
                  </button>
                </div>

                {distanceMode === 'preset' ? (
                  <select
                    value={targetDistance}
                    onChange={(e) => setTargetDistance(Number(e.target.value))}
                  >
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
                    className={
                      travelMode === 'manual'
                        ? 'primary-button small-mode-button'
                        : 'small-mode-button'
                    }
                    onClick={() => setTravelMode('manual')}
                  >
                    Manuellt läge
                  </button>
                  <button
                    type="button"
                    className={
                      travelMode === 'gps'
                        ? 'primary-button small-mode-button'
                        : 'small-mode-button'
                    }
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
            </>
          )}

          {playMode === 'time' && (
            <div className="section">
              <label className="label">Välj tid</label>

              <div className="distance-mode-row">
                <button
                  type="button"
                  className={
                    timeMode === 'preset'
                      ? 'primary-button small-mode-button'
                      : 'small-mode-button'
                  }
                  onClick={() => setTimeMode('preset')}
                >
                  Fasta val
                </button>
                <button
                  type="button"
                  className={
                    timeMode === 'custom'
                      ? 'primary-button small-mode-button'
                      : 'small-mode-button'
                  }
                  onClick={() => setTimeMode('custom')}
                >
                  Egen tid
                </button>
              </div>

              {timeMode === 'preset' ? (
                <select
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                >
                  <option value={1}>1 minut</option>
                  <option value={3}>3 minuter</option>
                  <option value={5}>5 minuter</option>
                  <option value={10}>10 minuter</option>
                </select>
              ) : (
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Skriv egen tid i minuter"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                />
              )}

              <p className="ready-text">
                Timern räknar ner automatiskt och avslutar spelet när tiden är slut.
              </p>
            </div>
          )}

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
              ? 'Alla spelare är klara.'
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

      {!showResumePrompt && screen === 'game' && (
        <div className="card pop-in">
          <div className="fun-badge bounce">
            {playMode === 'time'
              ? '⏱️ Timer-läge aktivt'
              : travelMode === 'gps'
              ? '📍 GPS-läge aktivt'
              : '🚀 Spelet är igång!'}
          </div>

          <h1>
            {playMode === 'time' ? '⏱️ ' : '🚀 '}
            {selectedObject}-utmaningen
          </h1>

          <div className="count">{count}</div>

          <button className="big-button pulse" onClick={handleObjectClick}>
            +1 {selectedObject.toUpperCase()}
          </button>

          {playMode === 'distance' && (
            <>
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
            </>
          )}

          {playMode === 'time' && (
            <>
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>

              <p className="distance-text">
                Tid kvar: {formatTime(timeLeft)}
              </p>
            </>
          )}

          <div className="guess-box">
            <h3>🎯 Spelare i rundan</h3>
            {players.map((player, index) => (
              <p key={index}>
                {player.name}: gissning låst
              </p>
            ))}
          </div>

          <div className="button-row">
            <button onClick={resetAll}>Avbryt och börja om</button>
            <button className="danger-button" onClick={finishGame}>
              Avsluta nu
            </button>
          </div>
        </div>
      )}

      {!showResumePrompt && screen === 'result' && (
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
            {playMode === 'time'
              ? `Spelad tid: ${activeTargetMinutes} min`
              : `Spelad sträcka: ${activeTargetDistance} km`}
          </p>

          <div className="winner-banner glow">
            {winners.length > 1
              ? `🤝 Oavgjort mellan: ${winners.map((w) => w.name).join(', ')}`
              : `👑 Vinnare: ${winners[0]?.name || ''}`}
          </div>

          <div className="podium-list">
            {sortedResults.map((player, index) => (
              <div
                key={index}
                className={`podium-item ${index === 0 ? 'winner-item' : ''}`}
              >
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