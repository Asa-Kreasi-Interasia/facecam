import { useEffect, useRef, useState, useCallback } from "react"
import { FaceMesh } from "@mediapipe/face_mesh"
import { Camera } from "@mediapipe/camera_utils"

export function useFaceMesh(webcamRef, canvasRef, options = {}) {
	const [isLoading, setIsLoading] = useState(true)
	const [faceData, setFaceData] = useState(null)
	const [faceCount, setFaceCount] = useState(0)
	const faceMeshRef = useRef(null)
	const cameraRef = useRef(null)
	const showMeshRef = useRef(options.showMesh ?? true)
	const maxFacesRef = useRef(options.maxFaces ?? 2)

	// Update refs ketika options berubah
	useEffect(() => {
		showMeshRef.current = options.showMesh ?? true
	}, [options.showMesh])

	useEffect(() => {
		maxFacesRef.current = options.maxFaces ?? 2
	}, [options.maxFaces])

	const calculateHeadPose = useCallback((landmarks) => {
		const noseTip = landmarks[1]
		const chin = landmarks[152]
		const leftEyeOuter = landmarks[33]
		const rightEyeOuter = landmarks[263]

		const faceWidth = Math.abs(rightEyeOuter.x - leftEyeOuter.x)
		const noseCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2
		const yaw = ((noseTip.x - noseCenterX) / faceWidth) * 100

		const faceHeight = Math.abs(chin.y - ((leftEyeOuter.y + rightEyeOuter.y) / 2))
		const expectedNoseY = (leftEyeOuter.y + rightEyeOuter.y) / 2 + faceHeight * 0.3
		const pitch = ((noseTip.y - expectedNoseY) / faceHeight) * 100

		const eyeDeltaY = rightEyeOuter.y - leftEyeOuter.y
		const eyeDeltaX = rightEyeOuter.x - leftEyeOuter.x
		const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI)

		let direction = "CENTER"
		if (yaw < -15) direction = "LEFT"
		else if (yaw > 15) direction = "RIGHT"
		else if (pitch < -15) direction = "UP"
		else if (pitch > 15) direction = "DOWN"

		return { yaw, pitch, roll, direction }
	}, [])

	const calculateGaze = useCallback((landmarks) => {
		const leftEyeLeft = landmarks[33]
		const leftEyeRight = landmarks[133]
		const leftIris = landmarks[468]

		const rightEyeLeft = landmarks[362]
		const rightEyeRight = landmarks[263]
		const rightIris = landmarks[473]

		const leftEyeWidth = leftEyeRight.x - leftEyeLeft.x
		const leftIrisPos = (leftIris.x - leftEyeLeft.x) / leftEyeWidth

		const rightEyeWidth = rightEyeRight.x - rightEyeLeft.x
		const rightIrisPos = (rightIris.x - rightEyeLeft.x) / rightEyeWidth

		const avgIrisPos = (leftIrisPos + rightIrisPos) / 2

		// Raw gaze coordinates (normalized 0-1)
		const gazeX = (leftIris.x + rightIris.x) / 2
		const gazeY = (leftIris.y + rightIris.y) / 2

		let gazeDirection = "CENTER"
		if (avgIrisPos < 0.4) gazeDirection = "LEFT"
		else if (avgIrisPos > 0.6) gazeDirection = "RIGHT"

		return { leftIrisPos, rightIrisPos, gazeDirection, gazeX, gazeY }
	}, [])

	useEffect(() => {
		if (!webcamRef.current?.video || !canvasRef.current) return

		const video = webcamRef.current.video
		const canvas = canvasRef.current
		const ctx = canvas.getContext("2d")

		const drawMesh = (landmarks, width, height) => {
			ctx.clearRect(0, 0, width, height)

			if (!showMeshRef.current) return

			ctx.fillStyle = "#00FF00"
			for (let i = 0; i < landmarks.length; i++) {
				const point = landmarks[i]
				ctx.beginPath()
				ctx.arc(point.x * width, point.y * height, 1, 0, 2 * Math.PI)
				ctx.fill()
			}

			// Iris points
			ctx.fillStyle = "#FF0000"
			const irisIndices = [468, 473]
			for (const idx of irisIndices) {
				const point = landmarks[idx]
				ctx.beginPath()
				ctx.arc(point.x * width, point.y * height, 3, 0, 2 * Math.PI)
				ctx.fill()
			}
		}

		faceMeshRef.current = new FaceMesh({
			locateFile: (file) =>
				`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
		})

		faceMeshRef.current.setOptions({
			maxNumFaces: maxFacesRef.current,
			refineLandmarks: true,
			minDetectionConfidence: 0.5,
			minTrackingConfidence: 0.5,
		})

		faceMeshRef.current.onResults((results) => {
			const detectedFaces = results.multiFaceLandmarks?.length || 0
			setFaceCount(detectedFaces)

			if (detectedFaces > 0) {
				const landmarks = results.multiFaceLandmarks[0]
				const headPose = calculateHeadPose(landmarks)
				const gaze = calculateGaze(landmarks)
				setFaceData({ headPose, gaze, landmarks })
				drawMesh(landmarks, canvas.width, canvas.height)
			} else {
				setFaceData(null)
				ctx.clearRect(0, 0, canvas.width, canvas.height)
			}
		})

		cameraRef.current = new Camera(video, {
			onFrame: async () => {
				if (faceMeshRef.current) {
					await faceMeshRef.current.send({ image: video })
				}
			},
			width: 640,
			height: 480,
		})

		cameraRef.current.start().then(() => {
			setIsLoading(false)
		})

		return () => {
			if (cameraRef.current) {
				cameraRef.current.stop()
			}
			if (faceMeshRef.current) {
				faceMeshRef.current.close()
			}
		}
	}, [webcamRef, canvasRef, calculateHeadPose, calculateGaze])

	return { isLoading, faceData, faceCount }
}