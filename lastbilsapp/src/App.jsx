import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function App() {
  const GAME_STORAGE_KEY = 'bilbingo-game-state-v4'
  const SETTINGS_STORAGE_KEY = 'bilbingo-last-settings-v2'

  const [screen, setScreen] = useState('start')
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [savedGame, setSavedGame] = useState(null)

  const [objectType, setObjectType] = useState('bilar')
  const [customObject, setCustomObject] = useState('')

  const [playMode, setPlayMode] = useState('time') // time | gps

  const [distanceMode, setDistanceMode] = useState('preset')
  const [targetDistance, setTargetDistance] = useState(5)
  const [customDistance, setCustomDistance] = useState('')

  const [timeMode, setTimeMode] = useState('preset')
  const [targetMinutes, setTargetMinutes] = useState(3)
  const [customMinutes, setCustomMinutes] = useState('')

  const [childMode, setChildMode] = useState(true)
  const [gpsStatus, setGpsStatus] = useState('GPS ej startad')
  const [isPaused, setIsPaused] = useState(false)

  const [players, setPlayers] = useState([
    { name: 'Spelare 1', guess: '', locked: false },
    { name: 'Spelare 2', guess: '', locked: false },
  ])

  const [count, setCount] = useState(0)
  const [distance, setDistance] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)

  const watchIdRef = useRef(null)
  const lastPositionRef = useRef(null)
  const timerRef = useRef(null)
  const wakeLockRef = useRef(null)
  const audioContextRef = useRef(null)
  const hasLoadedStateRef = useRef(false)

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

  const activeTargetMinutes = useMemo(() => {
    if (timeMode === 'custom') {
      const parsed = Number(customMinutes)
      return parsed > 0 ? parsed : 0
    }
    return targetMinutes
  }, [timeMode, customMinutes, targetMinutes])

  const activeTargetSeconds = activeTargetMinutes * 60

  const progress = useMemo(() => {
    if (playMode === 'gps') {
      return activeTargetDistance > 0
        ? Math.min((distance / activeTargetDistance) * 100, 100)
        : 0
    }

    return activeTargetSeconds > 0
      ? Math.min(((activeTargetSeconds - timeLeft) / activeTargetSeconds) * 100, 100)
      : 0
  }, [playMode, distance, activeTargetDistance, timeLeft, activeTargetSeconds])

  const allPlayersReady =
    players.length > 0 &&
    players.every(
      (player) => player.name.trim() !== '' && player.guess !== '' && player.locked
    )

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const playClickSound = () => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (!AudioCtx) return
        audioContextRef.current = new AudioCtx()
      }

      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = 660
      gain.gain.value = 0.02

      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.05)
    } catch {
      // ignore
    }
  }

  const buzz = (duration = 35) => {
    if (navigator.vibrate) {
      navigator.vibrate(duration)
    }
  }

  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {
      // ignore
    }
  }

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    } catch {
      // ignore
    }
  }

  const saveLatestSettings = () => {
    const settings = {
      objectType,
      customObject,
      playMode,
      distanceMode,
      targetDistance,
      customDistance,
      timeMode,
      targetMinutes,
      customMinutes,
      childMode,
      players: players.map((p, index) => ({
        name: p.name || `Spelare ${index + 1}`,
      })),
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }

  const applyLatestSettings = () => {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      alert('Ingen snabbstart hittades ännu.')
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (parsed.objectType) setObjectType(parsed.objectType)
      if (parsed.customObject !== undefined) setCustomObject(parsed.customObject)
      if (parsed.playMode) setPlayMode(parsed.playMode)
      if (parsed.distanceMode) setDistanceMode(parsed.distanceMode)
      if (parsed.targetDistance !== undefined) setTargetDistance(parsed.targetDistance)
      if (parsed.customDistance !== undefined) setCustomDistance(parsed.customDistance)
      if (parsed.timeMode) setTimeMode(parsed.timeMode)
      if (parsed.targetMinutes !== undefined) setTargetMinutes(parsed.targetMinutes)
      if (parsed.customMinutes !== undefined) setCustomMinutes(parsed.customMinutes)
      if (parsed.childMode !== undefined) setChildMode(parsed.childMode)
      if (parsed.players) {
        setPlayers(
          parsed.players.map((p, index) => ({
            name: p.name || `Spelare ${index + 1}`,
            guess: '',
            locked: false,
          }))
        )
      }
      setScreen('setup')
    } catch {
      alert('Kunde inte läsa snabbstart.')
    }
  }

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
    releaseWakeLock()
    setIsPaused(false)
    setScreen('result')
  }

  const clearSavedGame = () => {
    localStorage.removeItem(GAME_STORAGE_KEY)
    setSavedGame(null)
    setShowResumePrompt(false)
  }

  const startFreshGame = () => {
    clearSavedGame()
    stopGpsTracking()
    stopTimer()
    releaseWakeLock()

    setScreen('start')
    setObjectType('bilar')
    setCustomObject('')
    setPlayMode('time')
    setDistanceMode('preset')
    setTargetDistance(5)
    setCustomDistance('')
    setTimeMode('preset')
    setTargetMinutes(3)
    setCustomMinutes('')
    setChildMode(true)
    setGpsStatus('GPS ej startad')
    setIsPaused(false)
    setPlayers([
      { name: 'Spelare 1', guess: '', locked: false },
      { name: 'Spelare 2', guess: '', locked: false },
    ])
    setCount(0)
    setDistance(0)
    setTimeLeft(0)
  }

  const applySavedGame = (parsed) => {
    if (parsed.screen) setScreen(parsed.screen)
    if (parsed.objectType) setObjectType(parsed.objectType)
    if (parsed.customObject !== undefined) setCustomObject(parsed.customObject)
    if (parsed.playMode) setPlayMode(parsed.playMode)
    if (parsed.distanceMode) setDistanceMode(parsed.distanceMode)
    if (parsed.targetDistance !== undefined) setTargetDistance(parsed.targetDistance)
    if (parsed.customDistance !== undefined) setCustomDistance(parsed.customDistance)
    if (parsed.timeMode) setTimeMode(parsed.timeMode)
    if (parsed.targetMinutes !== undefined) setTargetMinutes(parsed.targetMinutes)
    if (parsed.customMinutes !== undefined) setCustomMinutes(parsed.customMinutes)
    if (parsed.childMode !== undefined) setChildMode(parsed.childMode)
    if (parsed.gpsStatus) setGpsStatus(parsed.gpsStatus)
    if (parsed.players) setPlayers(parsed.players)
    if (parsed.count !== undefined) setCount(parsed.count)
    if (parsed.distance !== undefined) setDistance(parsed.distance)
    if (parsed.timeLeft !== undefined) setTimeLeft(parsed.timeLeft)
    if (parsed.isPaused !== undefined) setIsPaused(parsed.isPaused)
  }

  const continueSavedGame = () => {
    if (!savedGame) return
    applySavedGame(savedGame)
    setShowResumePrompt(false)
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
        timeout: 10000,
      }
    )
  }

  const startCountdown = () => {
    stopTimer()

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

  const startGame = async () => {
    if (!allPlayersReady) {
      alert('Alla spelare måste fylla i och låsa sina gissningar först.')
      return
    }

    if (playMode === 'gps' && activeTargetDistance <= 0) {
      alert('Skriv ett giltigt avstånd större än 0 km.')
      return
    }

    if (playMode === 'time' && activeTargetMinutes <= 0) {
      alert('Skriv en giltig tid större än 0 minuter.')
      return
    }

    saveLatestSettings()
    setCount(0)
    setDistance(0)
    setTimeLeft(activeTargetSeconds)
    setGpsStatus('GPS ej startad')
    setIsPaused(false)
    lastPositionRef.current = null
    setScreen('game')
    await acquireWakeLock()
  }

  const handleCountUp = () => {
    if (isPaused) return
    setCount((prev) => prev + 1)
    buzz()
    playClickSound()
  }

  const handleUndo = () => {
    if (isPaused) return
    setCount((prev) => Math.max(0, prev - 1))
    buzz(20)
  }

  const togglePause = async () => {
    const nextPaused = !isPaused
    setIsPaused(nextPaused)

    if (nextPaused) {
      stopTimer()
      stopGpsTracking()
      await releaseWakeLock()
    } else {
      await acquireWakeLock()

      if (playMode === 'time') {
        startCountdown()
      }

      if (playMode === 'gps') {
        startGpsTracking()
      }
    }
  }

  const resetRound = async () => {
    stopGpsTracking()
    stopTimer()
    await releaseWakeLock()
    setCount(0)
    setDistance(0)
    setTimeLeft(0)
    setGpsStatus('GPS ej startad')
    setIsPaused(false)
    setScreen('setup')
  }

  useEffect(() => {
    const saved = localStorage.getItem(GAME_STORAGE_KEY)

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
    } catch {
      // ignore
    } finally {
      hasLoadedStateRef.current = true
    }
  }, [])

  useEffect(() => {
    if (screen !== 'game') return

    if (isPaused) {
      stopTimer()
      stopGpsTracking()
      return
    }

    acquireWakeLock()

    if (playMode === 'gps') {
      startGpsTracking()
    }

    if (playMode === 'time' && timeLeft > 0) {
      startCountdown()
    }

    return () => {
      stopTimer()
      stopGpsTracking()
    }
  }, [screen, playMode, isPaused])

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && screen === 'game' && !isPaused) {
        await acquireWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [screen, isPaused])

  useEffect(() => {
    if (!hasLoadedStateRef.current) return
    if (showResumePrompt) return

    const state = {
      screen,
      objectType,
      customObject,
      playMode,
      distanceMode,
      targetDistance,
      customDistance,
      timeMode,
      targetMinutes,
      customMinutes,
      childMode,
      gpsStatus,
      players,
      count,
      distance,
      timeLeft,
      isPaused,
    }

    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state))
  }, [
    screen,
    objectType,
    customObject,
    playMode,
    distanceMode,
    targetDistance,
    customDistance,
    timeMode,
    targetMinutes,
    customMinutes,
    childMode,
    gpsStatus,
    players,
    count,
    distance,
    timeLeft,
    isPaused,
    showResumePrompt,
  ])

  const latestSettingsExists = !!localStorage.getItem(SETTINGS_STORAGE_KEY)

  const sortedResults = [...players]
    .map((player) => ({
      ...player,
      diff: Math.abs(Number(player.guess) - count),
    }))
    .sort((a, b) => a.diff - b.diff)

  const winners = sortedResults.length
    ? sortedResults.filter((p) => p.diff === sortedResults[0].diff)
    : []

  const getMedal = (index) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return '⭐'
  }

  return (
    <div className={`app-shell ${childMode ? 'child-mode' : ''}`}>
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
            <span>🚗</span>
            <span>🚚</span>
            <span>🚌</span>
            <span>⭐</span>
          </div>

          <div className="button-row">
            <button className="primary-button pulse" onClick={() => setScreen('setup')}>
              Starta spel
            </button>
            {latestSettingsExists && (
              <button onClick={applyLatestSettings}>Snabbstart</button>
            )}
          </div>
        </div>
      )}

      {!showResumePrompt && screen === 'setup' && (
        <div className="card pop-in">
          <div className="fun-badge bounce">🛠️ Bygg er runda</div>
          <h1>Ställ in spelet</h1>

          <div className="section">
            <label className="label">Läge</label>
            <div className="distance-mode-row">
              <button
                type="button"
                className={childMode ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setChildMode(true)}
              >
                Barnläge
              </button>
              <button
                type="button"
                className={!childMode ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setChildMode(false)}
              >
                Fullt läge
              </button>
            </div>
          </div>

          <div className="section">
            <label className="label">Vad ska ni räkna?</label>
            <select value={objectType} onChange={(e) => setObjectType(e.target.value)}>
              <option value="bilar">Bilar</option>
              <option value="lastbilar">Lastbilar</option>
              <option value="röda bilar">Röda bilar</option>
              <option value="husbilar">Husbilar</option>
              <option value="skyltar">Skyltar</option>
              <option value="eget">Eget objekt</option>
            </select>

            {objectType === 'eget' && (
              <input
                type="text"
                placeholder="Skriv eget objekt"
                value={customObject}
                onChange={(e) => setCustomObject(e.target.value)}
              />
            )}
          </div>

          <div className="section">
            <label className="label">Hur vill ni spela?</label>
            <div className="distance-mode-row">
              <button
                type="button"
                className={playMode === 'time' ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setPlayMode('time')}
              >
                Tid
              </button>
              <button
                type="button"
                className={playMode === 'gps' ? 'primary-button small-mode-button' : 'small-mode-button'}
                onClick={() => setPlayMode('gps')}
              >
                GPS
              </button>
            </div>
          </div>

          {playMode === 'time' && (
            <div className="section">
              <label className="label">Hur länge?</label>

              <div className="distance-mode-row">
                <button
                  type="button"
                  className={timeMode === 'preset' ? 'primary-button small-mode-button' : 'small-mode-button'}
                  onClick={() => setTimeMode('preset')}
                >
                  Fasta val
                </button>
                <button
                  type="button"
                  className={timeMode === 'custom' ? 'primary-button small-mode-button' : 'small-mode-button'}
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
                  placeholder="Skriv tid i minuter"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                />
              )}
            </div>
          )}

          {playMode === 'gps' && (
            <div className="section">
              <label className="label">Hur långt?</label>

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
                <select
                  value={targetDistance}
                  onChange={(e) => setTargetDistance(Number(e.target.value))}
                >
                  <option value={1}>1 km</option>
                  <option value={2}>2 km</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                </select>
              ) : (
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Skriv avstånd i km"
                  value={customDistance}
                  onChange={(e) => setCustomDistance(e.target.value)}
                />
              )}
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
                  childMode ? (
                    <>
                      <input
                        type="number"
                        value={player.guess}
                        onChange={(e) => updatePlayer(index, 'guess', e.target.value)}
                        placeholder="Gissning"
                      />
                      <button onClick={() => lockGuess(index)}>Klar</button>
                    </>
                  ) : (
                    <div className="guess-row">
                      <input
                        type="number"
                        value={player.guess}
                        onChange={(e) => updatePlayer(index, 'guess', e.target.value)}
                        placeholder={`Gissning på antal ${selectedObject}`}
                      />
                      <button onClick={() => lockGuess(index)}>Klar</button>
                    </div>
                  )
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

          <div className="button-row">
            <button onClick={() => setScreen('start')}>Tillbaka</button>
            <button className="primary-button pulse" onClick={startGame}>
              Starta rundan
            </button>
          </div>
        </div>
      )}

      {!showResumePrompt && screen === 'game' && (
        <div className="card pop-in game-card-minimal">
          <div className="game-top">
            <div className="fun-badge bounce">
              {playMode === 'time' ? '⏱️ Timer-läge aktivt' : '📍 GPS-läge aktivt'}
            </div>

            <div className="top-status-text">
              {playMode === 'time'
                ? `Tid kvar: ${formatTime(timeLeft)}`
                : gpsStatus}
            </div>
          </div>

          <div className="game-center">
            {!childMode && <div className="game-title">{selectedObject}-utmaningen</div>}
            <div className="count count-big-center">{count}</div>
          </div>

          <div className="game-bottom">
            <div className="progress-container progress-lower">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>

            {playMode === 'gps' && (
              <div className="top-status-text small-status">
                {distance.toFixed(2)} / {activeTargetDistance} km
              </div>
            )}

            <div className="tap-zone-wrap">
              <button className="tap-zone-button" onClick={handleCountUp}>
                +1 {selectedObject.toUpperCase()}
              </button>
            </div>

            <div className="button-row bottom-actions compact-actions">
              <button onClick={handleUndo}>Ångra -1</button>
              <button onClick={togglePause}>
                {isPaused ? 'Fortsätt' : 'Pausa'}
              </button>
            </div>

            <div className="button-row bottom-actions">
              <button onClick={startFreshGame}>Avbryt och börja om</button>
              <button className="danger-button" onClick={finishGame}>
                Avsluta nu
              </button>
            </div>
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

          <div className="winner-hero">
            {winners.length > 1
              ? `🤝 Oavgjort: ${winners.map((w) => w.name).join(', ')}`
              : `👑 Vinnare: ${winners[0]?.name || ''}`}
          </div>

          <p className="result-main">
            Faktiskt antal {selectedObject}: {count}
          </p>

          <p className="result-subtext">
            {playMode === 'time'
              ? `Spelad tid: ${activeTargetMinutes} min`
              : `GPS-runda: ${activeTargetDistance} km`}
          </p>

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
            <button className="primary-button" onClick={applyLatestSettings}>
              Snabbstart igen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App