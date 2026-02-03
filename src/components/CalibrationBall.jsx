import { useState, useEffect, useRef } from "react"

const CORNER_POSITIONS = [
    { id: "center", x: 50, y: 50, label: "Center" },
    { id: "top-left", x: 10, y: 10, label: "Top Left" },
    { id: "top-right", x: 90, y: 10, label: "Top Right" },
    { id: "bottom-right", x: 90, y: 90, label: "Bottom Right" },
    { id: "bottom-left", x: 10, y: 90, label: "Bottom Left" },
]

const DELAY_MS = 5000

export function CalibrationBall({ onComplete, gazeX, gazeY }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [countdown, setCountdown] = useState(5)
    const gazeSamplesRef = useRef({})
    const onCompleteRef = useRef(onComplete)

    // Keep onComplete ref updated
    useEffect(() => {
        onCompleteRef.current = onComplete
    }, [onComplete])

    const currentPosition = CORNER_POSITIONS[currentIndex]

    // Collect gaze samples (using ref to avoid triggering re-renders)
    useEffect(() => {
        if (gazeX !== undefined && gazeY !== undefined) {
            const samples = gazeSamplesRef.current[currentPosition.id] || []
            gazeSamplesRef.current = {
                ...gazeSamplesRef.current,
                [currentPosition.id]: [...samples, { x: gazeX, y: gazeY }],
            }
        }
    }, [gazeX, gazeY, currentPosition.id])

    // Move to next position after delay
    useEffect(() => {
        setCountdown(5)

        const countdownInterval = setInterval(() => {
            setCountdown((prev) => Math.max(0, prev - 1))
        }, 1000)

        const timer = setTimeout(() => {
            if (currentIndex < CORNER_POSITIONS.length - 1) {
                setCurrentIndex((prev) => prev + 1)
            } else {
                // Calculate bounds from samples
                const allSamples = Object.values(gazeSamplesRef.current).flat()
                if (allSamples.length > 0) {
                    const xValues = allSamples.map((s) => s.x)
                    const yValues = allSamples.map((s) => s.y)
                    const bounds = {
                        minX: Math.min(...xValues),
                        maxX: Math.max(...xValues),
                        minY: Math.min(...yValues),
                        maxY: Math.max(...yValues),
                    }
                    onCompleteRef.current(bounds)
                } else {
                    onCompleteRef.current(null)
                }
            }
        }, DELAY_MS)

        return () => {
            clearTimeout(timer)
            clearInterval(countdownInterval)
        }
    }, [currentIndex])

    return (
        <div className="fixed inset-0 pointer-events-none z-50">
            {/* Ball */}
            <div
                className="absolute w-8 h-8 bg-red-500 rounded-full shadow-lg shadow-red-500/50 transition-all duration-500 ease-out flex items-center justify-center"
                style={{
                    left: `${currentPosition.x}%`,
                    top: `${currentPosition.y}%`,
                    transform: "translate(-50%, -50%)",
                }}
            >
                <div className="w-3 h-3 bg-white rounded-full opacity-60" />
            </div>

            {/* Instructions */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-6 py-3 rounded-lg text-center pointer-events-none">
                <div className="text-lg font-semibold">Follow the red ball with your eyes</div>
                <div className="text-sm text-gray-300 mt-1">
                    Position: {currentPosition.label} ({currentIndex + 1}/{CORNER_POSITIONS.length})
                </div>
                <div className="text-2xl font-bold text-red-400 mt-2">{countdown}s</div>
            </div>
        </div>
    )
}
