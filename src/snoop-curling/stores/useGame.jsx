import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export default create(subscribeWithSelector((set) =>
{
    return {
        targetPosition: [0, 0, -54],
        distanceFromButton: Infinity,
        isSweeping: false,
        stonesThrown: 0,
        maxStones: 8,
        startTime: Date.now(),
        endTime: 0,
        phase: 'playing', // Start immediately

        start: () => {
            set((state) => {
                if(state.phase === 'ready')
                    return { phase: 'playing', startTime: Date.now(), stonesThrown: state.stonesThrown + 1 }
                return {}
            })
        },

        setDistance: (distance) => set(() => ({ distanceFromButton: distance })),
        setSweeping: (sweeping) => set(() => ({ isSweeping: sweeping })),

        restart: () => {
            set((state) => ({
                phase: 'playing',
                startTime: Date.now(),
                distanceFromButton: Infinity,
                isSweeping: false 
            }))
        },

        end: () => {
            set((state) => {
                if(state.phase === 'playing')
                    return { phase: 'ended', endTime: Date.now() }
                return {}
            })
        }
    }
}))