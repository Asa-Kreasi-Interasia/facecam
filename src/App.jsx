import Webcam from "react-webcam";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, Eye, EyeOff, Loader2, Maximize } from "lucide-react";
import { useFaceMesh } from "./hooks/useFaceMesh";
import { CalibrationBall } from "./components/CalibrationBall";

// Calibration steps config
const CALIBRATION_STEPS = [
    { id: 1, label: "Check Lighting", description: "Detecting face..." },
    { id: 2, label: "Person Count", description: "Checking single person..." },
    { id: 3, label: "Head Direction", description: "Look in all directions" },
    { id: 4, label: "Gaze Calibration", description: "Follow the red ball" },
];

const DIRECTIONS = ["LEFT", "RIGHT", "UP", "DOWN"];

function App() {
    const [isWebcamLoading, setIsWebcamLoading] = useState(true);
    const [showMesh, setShowMesh] = useState(true);
    const [calibrationStep, setCalibrationStep] = useState(0);
    const [stepStatus, setStepStatus] = useState({
        1: { status: "pending", error: null },
        2: { status: "pending", error: null },
        3: { status: "pending", directions: { LEFT: false, RIGHT: false, UP: false, DOWN: false } },
        4: { status: "pending", error: null },
    });
    const [gazeBounds, setGazeBounds] = useState(null);
    const [isOutOfBounds, setIsOutOfBounds] = useState(false);
    const [calibrationComplete, setCalibrationComplete] = useState(false);

    // Fullscreen states
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenViolation, setFullscreenViolation] = useState(false);
    const [violationCount, setViolationCount] = useState(0);

    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const checkTimeoutRef = useRef(null);
    const containerRef = useRef(null);

    const { faceData, faceCount, isLoading: isFaceMeshLoading } = useFaceMesh(
        webcamRef,
        canvasRef,
        { showMesh, maxFaces: 2 }
    );

    // Fullscreen API functions
    const enterFullscreen = useCallback(async () => {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                await document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                await document.documentElement.msRequestFullscreen();
            }
        } catch (err) {
            console.error("Fullscreen request failed:", err);
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
        } catch (err) {
            console.error("Exit fullscreen failed:", err);
        }
    }, []);

    // Monitor fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.msFullscreenElement
            );

            setIsFullscreen(isCurrentlyFullscreen);

            // If calibration started and user exits fullscreen = violation
            if (!isCurrentlyFullscreen && calibrationStep > 0 && !calibrationComplete) {
                setFullscreenViolation(true);
                setViolationCount(prev => prev + 1);
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.addEventListener("msfullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.removeEventListener("msfullscreenchange", handleFullscreenChange);
        };
    }, [calibrationStep, calibrationComplete]);

    // Handle return to fullscreen
    const handleReturnToFullscreen = async () => {
        await enterFullscreen();
        setFullscreenViolation(false);
    };

    // Get header text based on current step
    const getHeaderText = () => {
        if (fullscreenViolation) return "⚠️ Fullscreen Required!";
        if (calibrationComplete) return "Calibration Complete!";
        if (calibrationStep === 0) return "Press Start to Begin Calibration";

        const step = CALIBRATION_STEPS[calibrationStep - 1];
        if (!step) return "";

        switch (calibrationStep) {
            case 1:
                if (stepStatus[1].status === "checking") return "Checking lighting...";
                if (stepStatus[1].status === "failed") return "Face not detected. Please ensure good lighting.";
                if (stepStatus[1].status === "passed") return "Lighting OK!";
                return step.description;
            case 2:
                if (stepStatus[2].status === "checking") return "Checking for single person...";
                if (stepStatus[2].status === "failed") return `Detected ${faceCount} faces. Only 1 person allowed.`;
                if (stepStatus[2].status === "passed") return "Single person confirmed!";
                return step.description;
            case 3:
                const remaining = DIRECTIONS.filter(d => !stepStatus[3].directions[d]);
                if (remaining.length === 0) return "All directions checked!";
                return `Look: ${remaining.join(", ")}`;
            case 4:
                return "Follow the red ball with your eyes";
            default:
                return "";
        }
    };

    // Step 1: Check lighting (face detected)
    const runStep1 = useCallback(() => {
        setStepStatus(prev => ({ ...prev, 1: { ...prev[1], status: "checking" } }));

        checkTimeoutRef.current = setTimeout(() => {
            if (faceData) {
                setStepStatus(prev => ({ ...prev, 1: { ...prev[1], status: "passed" } }));
            } else {
                setStepStatus(prev => ({ ...prev, 1: { ...prev[1], status: "failed", error: "No face detected" } }));
            }
        }, 2000);
    }, [faceData]);

    // Step 2: Check single person
    const runStep2 = useCallback(() => {
        setStepStatus(prev => ({ ...prev, 2: { ...prev[2], status: "checking" } }));

        checkTimeoutRef.current = setTimeout(() => {
            if (faceCount === 1) {
                setStepStatus(prev => ({ ...prev, 2: { ...prev[2], status: "passed" } }));
            } else {
                setStepStatus(prev => ({
                    ...prev,
                    2: { ...prev[2], status: "failed", error: `Detected ${faceCount} faces` }
                }));
            }
        }, 2000);
    }, [faceCount]);

    // Step 3: Monitor head directions
    useEffect(() => {
        if (calibrationStep === 3 && faceData?.headPose?.direction) {
            const dir = faceData.headPose.direction;
            if (DIRECTIONS.includes(dir) && !stepStatus[3].directions[dir]) {
                setStepStatus(prev => ({
                    ...prev,
                    3: {
                        ...prev[3],
                        directions: { ...prev[3].directions, [dir]: true }
                    }
                }));
            }
        }
    }, [calibrationStep, faceData?.headPose?.direction, stepStatus]);

    // Check if step 3 is complete
    useEffect(() => {
        if (calibrationStep === 3) {
            const allDone = DIRECTIONS.every(d => stepStatus[3].directions[d]);
            if (allDone && stepStatus[3].status !== "passed") {
                setStepStatus(prev => ({ ...prev, 3: { ...prev[3], status: "passed" } }));
            }
        }
    }, [calibrationStep, stepStatus]);

    // Step 4: Gaze calibration complete handler
    const handleGazeCalibrationComplete = useCallback((bounds) => {
        if (bounds) {
            setGazeBounds(bounds);
            setStepStatus(prev => ({ ...prev, 4: { ...prev[4], status: "passed" } }));
        } else {
            setStepStatus(prev => ({ ...prev, 4: { ...prev[4], status: "failed", error: "No gaze data" } }));
        }
    }, []);

    // Monitor gaze bounds after calibration
    useEffect(() => {
        if (calibrationComplete && gazeBounds && faceData?.gaze) {
            const { gazeX, gazeY } = faceData.gaze;
            const margin = 0.05;
            const outOfBounds =
                gazeX < gazeBounds.minX - margin ||
                gazeX > gazeBounds.maxX + margin ||
                gazeY < gazeBounds.minY - margin ||
                gazeY > gazeBounds.maxY + margin;

            setIsOutOfBounds(outOfBounds);
        }
    }, [calibrationComplete, gazeBounds, faceData?.gaze]);

    // Handle button click
    const handleButtonClick = async () => {
        if (calibrationStep === 0) {
            // Enter fullscreen when starting calibration
            await enterFullscreen();
            setCalibrationStep(1);
            runStep1();
        } else if (stepStatus[calibrationStep]?.status === "passed") {
            if (calibrationStep < 4) {
                const nextStep = calibrationStep + 1;
                setCalibrationStep(nextStep);
                if (nextStep === 2) runStep2();
                if (nextStep === 4) {
                    setStepStatus(prev => ({ ...prev, 4: { ...prev[4], status: "checking" } }));
                }
            } else {
                setCalibrationComplete(true);
            }
        }
    };

    // Retry handler
    const handleRetry = () => {
        if (calibrationStep === 1) runStep1();
        if (calibrationStep === 2) runStep2();
    };

    // Get button config
    const getButtonConfig = () => {
        if (fullscreenViolation) {
            return { text: "Return to Fullscreen", color: "bg-red-500 hover:bg-red-600", disabled: false, isFullscreenReturn: true };
        }
        if (calibrationComplete) {
            return { text: "Complete", color: "bg-green-500", disabled: true };
        }
        if (calibrationStep === 0) {
            return { text: "Start", color: "bg-blue-500 hover:bg-blue-600", disabled: isFaceMeshLoading || isWebcamLoading };
        }

        const currentStatus = stepStatus[calibrationStep]?.status;

        if (currentStatus === "checking") {
            return { text: "Checking...", color: "bg-gray-400", disabled: true };
        }
        if (currentStatus === "failed") {
            return { text: "Retry", color: "bg-red-500 hover:bg-red-600", disabled: false, isRetry: true };
        }
        if (currentStatus === "passed") {
            if (calibrationStep === 4) {
                return { text: "Finish", color: "bg-green-500 hover:bg-green-600", disabled: false };
            }
            return { text: "Next", color: "bg-green-500 hover:bg-green-600", disabled: false };
        }

        return { text: "Waiting...", color: "bg-gray-400", disabled: true };
    };

    const buttonConfig = getButtonConfig();

    // Determine if background should be red
    const showRedBackground = isOutOfBounds || fullscreenViolation;

    return (
        <div
            ref={containerRef}
            className={`container flex min-h-screen min-w-screen justify-center items-center transition-colors duration-300 ${showRedBackground ? "bg-red-500/30" : ""}`}
        >
            {/* Fullscreen violation overlay */}
            {fullscreenViolation && (
                <div className="fixed inset-0 bg-red-900/80 z-40 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-red-600 mb-2">Violation Detected!</h2>
                        <p className="text-gray-600 mb-4">
                            You exited fullscreen mode during calibration. This is not allowed.
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            Violations: <span className="font-bold text-red-600">{violationCount}</span>
                        </p>
                        <button
                            onClick={handleReturnToFullscreen}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 mx-auto"
                        >
                            <Maximize size={20} />
                            Return to Fullscreen
                        </button>
                    </div>
                </div>
            )}

            <div className="flex gap-8">
                {/* Webcam Container */}
                <div className="relative w-[640px] h-[480px]">
                    {isWebcamLoading && (
                        <div className="absolute inset-0 bg-gray-300 rounded-lg animate-pulse flex items-center justify-center z-10">
                            <div className="text-gray-500 text-lg">Loading camera...</div>
                        </div>
                    )}
                    <Webcam
                        ref={webcamRef}
                        onUserMedia={() => setIsWebcamLoading(false)}
                        width={640}
                        height={480}
                        className={
                            isWebcamLoading
                                ? "opacity-0 rounded-lg"
                                : "opacity-100 transition-opacity duration-300 rounded-[30px]"
                        }
                    />
                    <canvas
                        ref={canvasRef}
                        width={640}
                        height={480}
                        className="absolute top-0 left-0 rounded-[30px] pointer-events-none"
                    />

                    {/* Toggle mesh button */}
                    <button
                        onClick={() => setShowMesh(!showMesh)}
                        className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                        title={showMesh ? "Hide mesh" : "Show mesh"}
                    >
                        {showMesh ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>

                    {/* Face data overlay */}
                    {faceData && !calibrationComplete && !fullscreenViolation && (
                        <div className="absolute bottom-4 left-4 bg-black/70 text-white p-3 rounded-lg text-sm font-mono">
                            <div>Head: <span className="text-yellow-400">{faceData.headPose.direction}</span></div>
                            <div>Gaze: <span className="text-cyan-400">{faceData.gaze.gazeDirection}</span></div>
                            <div className="text-xs text-gray-400 mt-1">
                                Faces: {faceCount}
                            </div>
                        </div>
                    )}

                    {/* Out of bounds warning */}
                    {isOutOfBounds && !fullscreenViolation && (
                        <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 rounded-lg font-bold animate-pulse">
                            ⚠️ Looking Away!
                        </div>
                    )}
                </div>

                {/* Right panel */}
                <div className="flex flex-col justify-between w-[300px]">
                    <div>
                        <h1 className="text-center text-2xl font-bold mb-6">
                            {getHeaderText()}
                        </h1>

                        {/* Violation counter */}
                        {violationCount > 0 && (
                            <div className="bg-red-100 text-red-700 text-center py-2 px-4 rounded-lg mb-4 text-sm">
                                ⚠️ Fullscreen violations: {violationCount}
                            </div>
                        )}

                        {/* Calibration steps list */}
                        <ul className="space-y-3">
                            {CALIBRATION_STEPS.map((step) => {
                                const status = stepStatus[step.id];
                                const isActive = calibrationStep === step.id;
                                const isPassed = status.status === "passed";
                                const isFailed = status.status === "failed";
                                const isChecking = status.status === "checking";

                                return (
                                    <li key={step.id} className={`transition-all ${isActive ? "scale-105" : ""}`}>
                                        <div className={`flex items-center gap-3 p-2 rounded-lg ${isActive ? "bg-blue-100" : ""}`}>
                                            {isPassed ? (
                                                <Check className="text-green-600 flex-shrink-0" size={20} />
                                            ) : isFailed ? (
                                                <X className="text-red-600 flex-shrink-0" size={20} />
                                            ) : isChecking ? (
                                                <Loader2 className="text-blue-600 flex-shrink-0 animate-spin" size={20} />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                                            )}
                                            <span className={isPassed ? "text-green-700" : isFailed ? "text-red-700" : ""}>
                                                {step.label}
                                            </span>
                                        </div>

                                        {/* Sub-list for Step 3 (directions) */}
                                        {step.id === 3 && isActive && (
                                            <ul className="ml-8 mt-2 space-y-1">
                                                {DIRECTIONS.map((dir) => (
                                                    <li key={dir} className="flex items-center gap-2 text-sm">
                                                        {status.directions[dir] ? (
                                                            <Check className="text-green-600" size={16} />
                                                        ) : (
                                                            <Loader2 className="text-gray-400 animate-spin" size={16} />
                                                        )}
                                                        <span className={status.directions[dir] ? "text-green-600" : "text-gray-500"}>
                                                            Look {dir}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <button
                        onClick={
                            buttonConfig.isFullscreenReturn
                                ? handleReturnToFullscreen
                                : buttonConfig.isRetry
                                    ? handleRetry
                                    : handleButtonClick
                        }
                        disabled={buttonConfig.disabled}
                        className={`${buttonConfig.color} text-white px-6 py-3 rounded-[24px] disabled:cursor-not-allowed transition-colors font-semibold`}
                    >
                        {buttonConfig.text}
                    </button>
                </div>
            </div>

            {/* Calibration Ball for Step 4 */}
            {calibrationStep === 4 && stepStatus[4].status === "checking" && !fullscreenViolation && (
                <CalibrationBall
                    onComplete={handleGazeCalibrationComplete}
                    gazeX={faceData?.gaze?.gazeX}
                    gazeY={faceData?.gaze?.gazeY}
                />
            )}
        </div>
    );
}

export default App;