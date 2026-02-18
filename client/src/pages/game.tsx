import { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Shield, Crown, RotateCcw, ArrowLeft, Users, Loader2, Upload, Home, Camera } from "lucide-react";
import logoPng from "@assets/photos_1771385357298.png";

function trackEvent(eventType: string, facesDetected?: number) {
  fetch("/api/stats/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, facesDetected }),
  }).catch(() => {});
}


type GamePhase = "landing" | "camera" | "detecting" | "spinning" | "winner";

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function GamePage() {
  const [phase, setPhase] = useState<GamePhase>("landing");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [faces, setFaces] = useState<FaceBox[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [winnerIndex, setWinnerIndex] = useState(-1);
  const [errorMessage, setErrorMessage] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [canvasUrl, setCanvasUrl] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const capturingRef = useRef(false);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoSourceRef = useRef<"photo_taken" | "photo_uploaded">("photo_taken");

  useEffect(() => {
    loadModels();
    return () => {
      stopCamera();
      cancelPendingAnimation();
    };
  }, []);

  useEffect(() => {
    if (phase === "camera" && pendingStreamRef.current && videoRef.current) {
      const video = videoRef.current;
      const stream = pendingStreamRef.current;
      pendingStreamRef.current = null;
      video.srcObject = stream;
      video.play().catch(console.error);
    }
  }, [phase]);

  async function loadModels() {
    try {
      setModelLoadProgress(30);
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      setModelLoadProgress(100);
      setModelsLoaded(true);
    } catch (err) {
      console.error("Failed to load face detection models:", err);
      setModelLoadProgress(0);
    }
  }

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      pendingStreamRef.current = stream;
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError") {
        setCameraError("Camera access was denied. You can still upload a photo.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No camera found. You can still upload a photo.");
      } else {
        setCameraError("Could not access camera. You can still upload a photo.");
      }
    }
    setPhase("camera");
  }

  async function reconnectCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function cancelPendingAnimation() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }

  async function runDetection() {
    const canvas = canvasRef.current!;
    setCanvasUrl(canvas.toDataURL());

    try {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 608,
        scoreThreshold: 0.35,
      });
      const detections = await faceapi.detectAllFaces(canvas, options);

      if (detections.length === 0) {
        setErrorMessage("No faces found! Try a different photo or get closer together.");
        capturingRef.current = false;
        setCanvasUrl("");
        setPhase("camera");
        await reconnectCamera();
        return;
      }

      const faceBoxes: FaceBox[] = detections.map((d) => ({
        x: d.box.x,
        y: d.box.y,
        width: d.box.width,
        height: d.box.height,
      }));

      setFaces(faceBoxes);
      trackEvent(photoSourceRef.current, faceBoxes.length);
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const winner = arr[0] % faceBoxes.length;
      setWinnerIndex(winner);
      capturingRef.current = false;
      setPhase("spinning");
      runSpinAnimation(faceBoxes, winner);
    } catch (err) {
      console.error("Detection error:", err);
      setErrorMessage("Face detection failed. Please try again.");
      capturingRef.current = false;
      setCanvasUrl("");
      setPhase("camera");
      await reconnectCamera();
    }
  }

  async function captureAndDetect() {
    if (!videoRef.current || !canvasRef.current) return;
    if (capturingRef.current) return;
    capturingRef.current = true;

    setPhase("detecting");
    setErrorMessage("");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0);
    ctx.restore();

    stopCamera();
    photoSourceRef.current = "photo_taken";
    await runDetection();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;
    if (capturingRef.current) return;
    capturingRef.current = true;

    setPhase("detecting");
    setErrorMessage("");
    stopCamera();

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
      photoSourceRef.current = "photo_uploaded";
      await runDetection();
    };
    img.onerror = () => {
      setErrorMessage("Could not load that image. Try a different one.");
      capturingRef.current = false;
      setCanvasUrl("");
      setPhase("camera");
      reconnectCamera();
    };
    img.src = URL.createObjectURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function runSpinAnimation(faceBoxes: FaceBox[], winner: number) {
    cancelPendingAnimation();

    const schedule = buildSpinSchedule(faceBoxes.length, winner);
    const startTime = performance.now();
    let stepIndex = 0;

    function tick(now: number) {
      const elapsed = now - startTime;

      while (stepIndex < schedule.length && elapsed >= schedule[stepIndex].time) {
        setHighlightIndex(schedule[stepIndex].faceIndex);
        stepIndex++;
      }

      if (stepIndex >= schedule.length) {
        setHighlightIndex(winner);
        setPhase("winner");
        fireConfetti();
        return;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }

  function buildSpinSchedule(faceCount: number, winner: number) {
    const totalDuration = 5000;
    const minInterval = 180;
    const maxInterval = 900;

    const fullCycles = 3;
    const baseSteps = fullCycles * faceCount;
    const lastFaceOfBase = (baseSteps - 1) % faceCount;
    const extraToWinner = ((winner - lastFaceOfBase + faceCount) % faceCount);
    const totalSteps = baseSteps + (extraToWinner === 0 ? faceCount : extraToWinner);

    const steps: { time: number; faceIndex: number }[] = [];
    let t = 0;

    for (let i = 0; i < totalSteps; i++) {
      const progress = i / (totalSteps - 1);
      const eased = progress * progress;
      const interval = minInterval + (maxInterval - minInterval) * eased;

      steps.push({ time: t, faceIndex: i % faceCount });
      t += interval;
    }

    const rawDuration = t - (minInterval + (maxInterval - minInterval) * 1);
    const scale = totalDuration / rawDuration;

    for (let i = 0; i < steps.length; i++) {
      steps[i].time *= scale;
    }

    return steps;
  }

  function triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 200]);
    }
  }

  function fireConfetti() {
    triggerHaptic();
    const duration = 2000;
    const end = Date.now() + duration;
    const colors = ["#fbbf24", "#f59e0b", "#22d3ee", "#ffffff"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }

  function resetGame() {
    cancelPendingAnimation();
    stopCamera();
    setPhase("landing");
    setFaces([]);
    setHighlightIndex(-1);
    setWinnerIndex(-1);
    setErrorMessage("");
    setCameraError("");
    setCanvasUrl("");
  }

  function retakePhoto() {
    cancelPendingAnimation();
    setFaces([]);
    setHighlightIndex(-1);
    setWinnerIndex(-1);
    setErrorMessage("");
    setCanvasUrl("");
    startCamera();
  }

  function respin() {
    cancelPendingAnimation();
    trackEvent("respin", faces.length);
    const previousWinner = winnerIndex;
    setHighlightIndex(-1);
    setWinnerIndex(-1);
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    let winner: number;
    if (faces.length > 1) {
      winner = arr[0] % (faces.length - 1);
      if (winner >= previousWinner) winner++;
    } else {
      winner = 0;
    }
    setWinnerIndex(winner);
    setPhase("spinning");
    runSpinAnimation(faces, winner);
  }

  if (phase === "landing") {
    return (
      <LandingScreen
        modelsLoaded={modelsLoaded}
        progress={modelLoadProgress}
        cameraError={cameraError}
        onStart={startCamera}
      />
    );
  }

  const showCamera = phase === "camera";
  const showDetecting = phase === "detecting";
  const showOverlay = phase === "spinning" || phase === "winner";

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {showCamera && (
        <CameraPhase
          videoRef={videoRef}
          fileInputRef={fileInputRef}
          phase={phase}
          errorMessage={errorMessage}
          cameraError={cameraError}
          onCapture={captureAndDetect}
          onUpload={handleFileUpload}
          onBack={resetGame}
        />
      )}

      {showDetecting && (
        <DetectingPhase canvasUrl={canvasUrl} onBack={resetGame} />
      )}

      {showOverlay && (
        <OverlayPhase
          canvasUrl={canvasUrl}
          canvasRef={canvasRef}
          faces={faces}
          highlightIndex={highlightIndex}
          winnerIndex={winnerIndex}
          isWinner={phase === "winner"}
          onRespin={respin}
          onRetake={retakePhoto}
          onReset={resetGame}
        />
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function LandingScreen({
  modelsLoaded,
  progress,
  cameraError,
  onStart,
}: {
  modelsLoaded: boolean;
  progress: number;
  cameraError: string;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#0f0f2e] to-[#0a0a1a] flex flex-col items-center overflow-y-auto">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 sm:gap-8 max-w-md text-center px-6 py-8 sm:py-0 sm:justify-center sm:min-h-screen">
        <img
          src={logoPng}
          alt="Who Goes First Logo"
          className="w-[120%] sm:w-[150%] max-w-none h-auto opacity-90 drop-shadow-2xl px-4"
        />
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Who Goes First?
          </h1>
          <p className="text-base sm:text-lg text-white/50 font-light leading-relaxed">
            Take a photo of your game group and let AI randomly select who goes first. 
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 rounded-md bg-white/5 border border-white/10">
          <Shield className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-sm text-white/60">
            100% private — your picture never leaves your device
          </span>
        </div>

        {cameraError && (
          <div className="px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {cameraError}
          </div>
        )}

        <Button
          data-testid="button-start-game"
          onClick={onStart}
          disabled={!modelsLoaded}
          className="relative bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold text-lg px-8 border-0 no-default-hover-elevate no-default-active-elevate transition-all duration-200 hover:from-amber-400 hover:to-amber-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
          size="lg"
        >
          {modelsLoaded ? (
            <>
              <Crown className="w-5 h-5 mr-2" />
              Get Started
            </>
          ) : (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading AI ({progress}%)
            </>
          )}
        </Button>

        <div className="flex items-center gap-6 text-xs text-white/30">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>1-10 players</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            <span>~10 seconds</span>
          </div>
        </div>

      </div>
    </div>
  );
}

function CameraPhase({
  videoRef,
  fileInputRef,
  phase,
  errorMessage,
  cameraError,
  onCapture,
  onUpload,
  onBack,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  phase: GamePhase;
  errorMessage: string;
  cameraError: string;
  onCapture: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
}) {
  const hasCamera = !cameraError;

  return (
    <div className="absolute inset-0">
      {hasCamera ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          muted
          autoPlay
          style={{ transform: "scaleX(-1)" }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-white/40" />
          </div>
          <p className="text-white/40 text-sm max-w-xs">{cameraError}</p>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
        <Button
          data-testid="button-back"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-white/70 bg-black/30 backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="text-white/90 text-sm font-medium bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-md">
          {hasCamera ? "Get your group in the photo!" : "Upload a group photo"}
        </span>
        <div className="w-9" />
      </div>

      {hasCamera && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-amber-400/50 rounded-tl-lg m-4" />
          <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-amber-400/50 rounded-tr-lg m-4" />
          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-amber-400/50 rounded-bl-lg m-4" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-amber-400/50 rounded-br-lg m-4" />
        </div>
      )}

      {errorMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-md text-sm font-medium shadow-lg max-w-xs text-center z-30">
          {errorMessage}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-8 flex items-end justify-center gap-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUpload}
          className="hidden"
          data-testid="input-file-upload"
        />

        {hasCamera ? (
          <>
            <button
              data-testid="button-upload-photo"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 text-white/50 transition-colors hover:text-white/80"
            >
              <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-colors hover:bg-black/60">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">Upload</span>
            </button>

            <div className="flex flex-col items-center">
              <button
                data-testid="button-capture"
                onClick={onCapture}
                disabled={phase === "detecting"}
                className="group relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <div className="absolute inset-1 rounded-full border-2 border-black/20" />
                <Crown className="w-8 h-8 text-black" />
              </button>
              <span className="mt-2 text-xs text-white/50 font-medium">Take Photo</span>
            </div>

            <div className="w-12" />
          </>
        ) : (
          <button
            data-testid="button-upload-photo"
            onClick={() => fileInputRef.current?.click()}
            className="group relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-1 rounded-full border-2 border-black/20" />
            <Upload className="w-8 h-8 text-black" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/50 whitespace-nowrap font-medium">
              Upload Photo
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function DetectingPhase({
  canvasUrl,
  onBack,
}: {
  canvasUrl: string;
  onBack: () => void;
}) {
  return (
    <div className="absolute inset-0">
      {canvasUrl && (
        <img
          src={canvasUrl}
          alt="Captured photo"
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}

      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
        <Button
          data-testid="button-back-detecting"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-white/70 bg-black/30 backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="text-white/90 text-sm font-medium bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-md">
          Scanning faces...
        </span>
        <div className="w-9" />
      </div>

      <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none z-10">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-cyan-400/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20 animate-ping" />
          </div>
          <span className="text-cyan-400 text-sm font-semibold tracking-wide">
            Detecting faces...
          </span>
        </div>
      </div>
    </div>
  );
}

function OverlayPhase({
  canvasUrl,
  canvasRef,
  faces,
  highlightIndex,
  winnerIndex,
  isWinner,
  onRespin,
  onRetake,
  onReset,
}: {
  canvasUrl: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  faces: FaceBox[];
  highlightIndex: number;
  winnerIndex: number;
  isWinner: boolean;
  onRespin: () => void;
  onRetake: () => void;
  onReset: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    function updateSize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      const canvasW = canvas.width;
      const canvasH = canvas.height;

      if (canvasW === 0 || canvasH === 0) return;

      const scale = Math.min(containerW / canvasW, containerH / canvasH);
      const displayW = canvasW * scale;
      const displayH = canvasH * scale;
      const offsetX = (containerW - displayW) / 2;
      const offsetY = (containerH - displayH) / 2;

      setDisplaySize({ width: displayW, height: displayH, offsetX, offsetY });
    }

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [canvasRef]);

  function scaleBox(face: FaceBox) {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return { left: 0, top: 0, width: 0, height: 0 };

    const scaleX = displaySize.width / canvas.width;
    const scaleY = displaySize.height / canvas.height;

    return {
      left: displaySize.offsetX + face.x * scaleX,
      top: displaySize.offsetY + face.y * scaleY,
      width: face.width * scaleX,
      height: face.height * scaleY,
    };
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        {canvasUrl && (
          <img
            src={canvasUrl}
            alt="Captured frame"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {isWinner && (
          <div className="absolute inset-0 bg-black/40 z-10 pointer-events-none" />
        )}

        {faces.map((face, i) => {
          const box = scaleBox(face);
          const isHighlighted = i === highlightIndex;
          const isTheWinner = isWinner && i === winnerIndex;

          const size = Math.max(box.width, box.height) * 1.2;
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;

          return (
            <div
              key={i}
              data-testid={`face-box-${i}`}
              className="absolute z-20 transition-all duration-150"
              style={{
                left: cx - size / 2,
                top: cy - size / 2,
                width: size,
                height: size,
              }}
            >
              <div
                className={`absolute inset-0 rounded-full border-[3px] transition-all duration-150 ${
                  isTheWinner
                    ? "border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.6),0_0_60px_rgba(251,191,36,0.3)] animate-winner-glow"
                    : isHighlighted
                    ? "border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                    : "border-white/20"
                }`}
              />

              {isTheWinner && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 animate-crown-drop"
                  style={{ width: size * 0.45, top: -(size * 0.3) }}
                >
                  <CrownSVG />
                </div>
              )}

              <div
                data-testid={`player-label-${i}`}
                className={`absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-semibold ${
                  isTheWinner
                    ? "bg-amber-500/90 text-black"
                    : isHighlighted
                    ? "bg-cyan-500/90 text-black"
                    : "bg-black/60 text-white/80"
                }`}
                style={{ top: size + 6 }}
              >
                Player {i + 1}
              </div>
            </div>
          );
        })}
      </div>

      {isWinner && (
        <div className="absolute bottom-0 left-0 right-0 z-30 p-6 pb-8 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="flex flex-col items-center gap-5">
            <div className="text-center">
              <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-1 animate-fade-in">
                Player {winnerIndex + 1} Goes First!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                data-testid="button-reset"
                size="icon"
                onClick={onReset}
                className="bg-black/80 text-white/80 border border-white/10 backdrop-blur-sm no-default-hover-elevate no-default-active-elevate hover:bg-black/90 hover:text-white transition-colors"
              >
                <Home className="w-5 h-5" />
              </Button>
              <Button
                data-testid="button-respin"
                onClick={onRespin}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold border-0 no-default-hover-elevate no-default-active-elevate hover:from-amber-400 hover:to-amber-500 transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Respin
              </Button>
              <Button
                data-testid="button-retake"
                size="icon"
                onClick={onRetake}
                className="bg-black/80 text-white/80 border border-white/10 backdrop-blur-sm no-default-hover-elevate no-default-active-elevate hover:bg-black/90 hover:text-white transition-colors"
              >
                <Camera className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isWinner && (
        <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center">
          <div className="px-5 py-2.5 rounded-md bg-black/70 backdrop-blur-sm border border-cyan-400/30">
            <span className="text-cyan-400 text-sm font-semibold tracking-wide animate-pulse">
              Selecting...
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function CrownSVG() {
  return (
    <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]">
      <path
        d="M10 65 L20 25 L35 45 L50 10 L65 45 L80 25 L90 65Z"
        fill="url(#crownGrad)"
        stroke="#fbbf24"
        strokeWidth="2"
      />
      <circle cx="20" cy="25" r="4" fill="#fbbf24" />
      <circle cx="50" cy="10" r="5" fill="#fbbf24" />
      <circle cx="80" cy="25" r="4" fill="#fbbf24" />
      <rect x="10" y="62" width="80" height="8" rx="2" fill="url(#crownGrad)" stroke="#fbbf24" strokeWidth="1.5" />
      <defs>
        <linearGradient id="crownGrad" x1="10" y1="10" x2="90" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </svg>
  );
}
