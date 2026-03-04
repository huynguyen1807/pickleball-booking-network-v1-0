import { useRef, useState, useEffect, useCallback } from 'react'
import styles from '../styles/CameraModal.module.css'

interface CameraModalProps {
    onCapture: (base64: string) => void
    onClose: () => void
}

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [captured, setCaptured] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
    const [flash, setFlash] = useState(false)

    const startCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
            setError('')
        } catch {
            setError('Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera.')
        }
    }, [facingMode])

    useEffect(() => {
        startCamera()
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [])

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Mirror if front camera
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0)
            ctx.scale(-1, 1)
        }
        ctx.drawImage(video, 0, 0)

        setFlash(true)
        setTimeout(() => setFlash(false), 200)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        setCaptured(dataUrl)
        streamRef.current?.getTracks().forEach(t => t.stop())
    }

    const handleRetake = () => {
        setCaptured(null)
        startCamera()
    }

    const handleFlipCamera = () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user'
        setFacingMode(newMode)
        startCamera(newMode)
    }

    const handleConfirm = () => {
        if (captured) {
            onCapture(captured)
            onClose()
        }
    }

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>📸 Chụp ảnh</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.cameraWrap}>
                    {flash && <div className={styles.flashEffect} />}

                    {error ? (
                        <div className={styles.errorBox}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📷</div>
                            <p>{error}</p>
                        </div>
                    ) : captured ? (
                        <img src={captured} alt="Captured" className={styles.preview} />
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`${styles.video} ${facingMode === 'user' ? styles.mirrored : ''}`}
                        />
                    )}

                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* Viewfinder corners */}
                    {!captured && !error && (
                        <div className={styles.viewfinder}>
                            <span /><span /><span /><span />
                        </div>
                    )}
                </div>

                <div className={styles.controls}>
                    {captured ? (
                        <>
                            <button className={styles.retakeBtn} onClick={handleRetake}>
                                🔄 Chụp lại
                            </button>
                            <button className={styles.confirmBtn} onClick={handleConfirm}>
                                ✅ Dùng ảnh này
                            </button>
                        </>
                    ) : (
                        <>
                            <button className={styles.flipBtn} onClick={handleFlipCamera} title="Đổi camera">
                                🔁
                            </button>
                            <button className={styles.shutterBtn} onClick={handleCapture} disabled={!!error}>
                                <span className={styles.shutterInner} />
                            </button>
                            <div style={{ width: 52 }} />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
