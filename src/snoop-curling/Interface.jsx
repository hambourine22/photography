import { useKeyboardControls } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { addEffect } from '@react-three/fiber'
import useGame from './stores/useGame.jsx'

export default function Interface() {
    const time = useRef()
    const restart = useGame((state) => state.restart)
    const phase = useGame((state) => state.phase)
    const distance = useGame((state) => state.distanceFromButton)
    const { forward, backward, leftward, rightward, jump } = useKeyboardControls()

    useEffect(() => {
        const unsubscribeEffect = addEffect(() => {
            const state = useGame.getState()
            let elapsedTime = 0
            if (state.phase === 'playing') elapsedTime = Date.now() - state.startTime
            else if (state.phase === 'ended') elapsedTime = state.endTime - state.startTime
            elapsedTime /= 1000
            if (time.current) time.current.textContent = elapsedTime.toFixed(2)
        })
        return () => unsubscribeEffect()
    }, [])

    return (
        <div className="interface">
            {/* Loading screen temporarily disabled for debugging */}
            
            <div className="stats">
                <div ref={time} className="time">0.00</div>
                <div className="distance">
                    {distance === Infinity ? "READY" : `${distance.toFixed(2)}m TO BUTTON`}
                </div>
            </div>

            {/* Always show controls for testing */}
            <div className="controls">
                <div className="raw">
                    <div className={`key ${forward ? 'active' : ''}`}>W</div>
                </div>
                <div className="raw">
                    <div className={`key ${leftward ? 'active' : ''}`}>A</div>
                    <div className={`key ${backward ? 'active' : ''}`}>S</div>
                    <div className={`key ${rightward ? 'active' : ''}`}>D</div>
                </div>
                <div className="raw">
                    <div className={`key large ${jump ? 'active' : ''}`}>
                        {jump ? 'SWEEPING!' : 'SPACE'}
                    </div>
                </div>
                {phase === 'ended' && (
                    <div className="raw">
                        <div className="key large active" onClick={restart} style={{cursor: 'pointer', marginTop: '10px'}}>RESTART</div>
                    </div>
                )}
            </div>
        </div>
    )
}