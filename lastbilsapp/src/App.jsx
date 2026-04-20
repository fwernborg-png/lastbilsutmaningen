import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function App() {
  const [screen, setScreen] = useState('start')

  const [objectType, setObjectType] = useState('bilar')
  const [customObject, setCustomObject] = useState('')

  const [playMode, setPlayMode] = useState('time') // time | gps

  const [targetMinutes, setTargetMinutes] = useState(3)
  const [targetDistance, setTargetDistance] = useState(5)

  const [count, setCount] = useState(0)
  const [distance, setDistance] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)

  const [gpsStatus, setGpsStatus] = useState('Starta GPS')
  const [isPaused, setIsPaused] = useState(false)

  const timerRef = useRef(null)
  const watchRef = useRef(null)
  const lastPos = useRef(null)

  const selectedObject = useMemo(() => {
    return objectType === 'eget' ? customObject || 'objekt' : objectType
  }, [objectType, customObject])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const startGame = () => {
    setCount(0)
    setDistance(0)
    setTimeLeft(targetMinutes * 60)
    setScreen('game')
  }

  const finishGame = () => {
    stopAll()
    setScreen('result')
  }

  const stopAll = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
  }

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finishGame()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const startGPS = () => {
    watchRef.current = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude } = pos.coords

      if (!lastPos.current) {
        lastPos.current = { latitude, longitude }
        return
      }

      const d = Math.sqrt(
        Math.pow(latitude - lastPos.current.latitude, 2) +
        Math.pow(longitude - lastPos.current.longitude, 2)
      )

      setDistance((prev) => {
        const newDist = prev + d * 111
        if (newDist >= targetDistance) finishGame()
        return newDist
      })

      lastPos.current = { latitude, longitude }
      setGpsStatus('GPS aktiv')
    })
  }

  useEffect(() => {
    if (screen !== 'game') return

    if (playMode === 'time') startTimer()
    if (playMode === 'gps') startGPS()

    return stopAll
  }, [screen])

  return (
    <div className="app">

      {screen === 'start' && (
        <div className="card">
          <h1>🚗 Bilspel</h1>

          <select value={objectType} onChange={(e) => setObjectType(e.target.value)}>
            <option value="bilar">Bilar</option>
            <option value="lastbilar">Lastbilar</option>
            <option value="eget">Eget</option>
          </select>

          {objectType === 'eget' && (
            <input value={customObject} onChange={(e) => setCustomObject(e.target.value)} />
          )}

          <div className="row">
            <button onClick={() => setPlayMode('time')}>Tid</button>
            <button onClick={() => setPlayMode('gps')}>GPS</button>
          </div>

          {playMode === 'time' && (
            <input
              type="number"
              value={targetMinutes}
              onChange={(e) => setTargetMinutes(Number(e.target.value))}
            />
          )}

          {playMode === 'gps' && (
            <input
              type="number"
              value={targetDistance}
              onChange={(e) => setTargetDistance(Number(e.target.value))}
            />
          )}

          <button onClick={startGame}>Starta</button>
        </div>
      )}

      {screen === 'game' && (
        <div className="card game">

          <div className="top">
            {playMode === 'time'
              ? formatTime(timeLeft)
              : `${distance.toFixed(2)} km`}
          </div>

          <div className="center">
            <div className="big">{count}</div>
          </div>

          <div className="bottom">
            <button className="bigbtn" onClick={() => setCount(count + 1)}>
              +1 {selectedObject}
            </button>

            <button onClick={() => setCount(Math.max(0, count - 1))}>
              Ångra
            </button>

            <button onClick={finishGame}>Avsluta</button>
          </div>
        </div>
      )}

      {screen === 'result' && (
        <div className="card">
          <h1>Resultat</h1>
          <p>{count} {selectedObject}</p>

          <button onClick={() => setScreen('start')}>
            Ny runda
          </button>
        </div>
      )}

    </div>
  )
}

export default App