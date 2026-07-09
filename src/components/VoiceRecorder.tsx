import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RefreshCw, Trash2 } from 'lucide-react';
import { useUI } from '../contexts/UIContext';

interface VoiceRecorderProps {
  onSave: (audioUrl: string, duration: number, waveform: number[]) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSave, onCancel }) => {
  const { showToast } = useUI();
  const [isRecording, setIsRecording]   = useState(false);
  const [audioUrl, setAudioUrl]         = useState<string | null>(null);
  const [duration, setDuration]         = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [waveform, setWaveform]         = useState<number[]>([]);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const canvasRef         = useRef<HTMLCanvasElement | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef            = useRef<number | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const playAudioRef      = useRef<HTMLAudioElement | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const isRecordingRef    = useRef(false);
  const waveformRef       = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      stopResources();
      playAudioRef.current?.pause();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Start waveform draw AFTER canvas mounts (isRecording becomes true → canvas renders → effect runs)
  useEffect(() => {
    if (isRecording) drawWaveform();
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopResources = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const W = canvas.width;
    const H = canvas.height;
    const BAR_COUNT = 40;
    const barW = (W / BAR_COUNT) - 2;

    // live bars sliding from right
    const liveBars: number[] = Array(BAR_COUNT).fill(0);
    let frame = 0;

    const draw = () => {
      if (!isRecordingRef.current) return;
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(buf);

      // average amplitude → height %
      const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
      const pct = Math.max(8, Math.min(95, (avg / 255) * 130));

      // push every ~2 frames for smooth scroll
      if (frame++ % 2 === 0) {
        liveBars.push(pct);
        if (liveBars.length > BAR_COUNT) liveBars.shift();
        waveformRef.current.push(pct);
      }

      ctx.clearRect(0, 0, W, H);
      liveBars.forEach((h, i) => {
        const barH = (h / 100) * H;
        const x    = i * (barW + 2);
        const y    = (H - barH) / 2;
        // gradient bar
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, '#7C3AED');
        grad.addColorStop(1, '#111827');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, barW / 2);
        ctx.fill();
      });
    };
    draw();
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    waveformRef.current    = [];
    setWaveform([]);
    setDuration(0);
    setAudioUrl(null);
    setIsPlaying(false);
    playAudioRef.current?.pause();
    playAudioRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Microphone not supported on this browser.', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source  = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const url  = URL.createObjectURL(blob);
        setAudioUrl(url);
        const final = waveformRef.current.slice(-40);
        while (final.length < 40) final.push(10 + Math.random() * 15);
        setWaveform(final);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      mr.start();
      isRecordingRef.current = true;
      setIsRecording(true); // ← canvas mounts after this, useEffect triggers drawWaveform

      timerRef.current = setInterval(() => setDuration(p => p + 1), 1000);
    } catch {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      showToast('Could not access microphone. Please enable permissions.', 'error');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    stopResources();
  };

  const handleDiscard = () => {
    playAudioRef.current?.pause();
    playAudioRef.current = null;
    setAudioUrl(null);
    setDuration(0);
    setIsPlaying(false);
    setWaveform([]);
    waveformRef.current    = [];
    audioChunksRef.current = [];
  };

  const handlePlayToggle = () => {
    if (!audioUrl) return;
    if (isPlaying) {
      playAudioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!playAudioRef.current) {
        const audio = new Audio(audioUrl);
        audio.onended = () => setIsPlaying(false);
        playAudioRef.current = audio;
      }
      playAudioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Waveform / visualizer box */}
      <div className="relative w-full h-20 bg-[#F5F7FB] border border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden">
        {isRecording ? (
          <canvas
            ref={canvasRef}
            width={320}
            height={80}
            className="w-full h-full"
          />
        ) : waveform.length > 0 ? (
          <div className="flex items-center justify-center gap-[3px] h-12 px-4 w-full">
            {waveform.map((h, i) => (
              <div
                key={i}
                className="rounded-full shrink-0 transition-all duration-150"
                style={{
                  width: 3,
                  height: `${h}%`,
                  background: isPlaying
                    ? `hsl(${265 - (i / waveform.length) * 40}, 80%, ${40 + (i % 3) * 8}%)`
                    : '#CBD5E1',
                  opacity: isPlaying ? 1 : 0.7,
                  transform: isPlaying ? `scaleY(${0.6 + Math.sin(i * 0.4) * 0.4})` : 'none',
                  transition: isPlaying ? `transform ${0.3 + (i % 5) * 0.06}s ease-in-out alternate infinite` : 'none',
                }}
              />
            ))}
          </div>
        ) : (
          <Mic className="w-7 h-7 text-gray-300" />
        )}

        {/* Timer */}
        {(isRecording || duration > 0) && (
          <span className="absolute bottom-1.5 right-3 text-[11px] font-bold text-gray-500 tabular-nums">
            {fmt(duration)}
          </span>
        )}

        {/* Recording pulse dot */}
        {isRecording && (
          <span className="absolute top-2 left-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-red-500">REC</span>
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {isRecording ? (
          <button
            onClick={stopRecording}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-md active:scale-95 transition-transform"
            aria-label="Stop recording"
          >
            <Square className="w-5 h-5 fill-white text-white" />
          </button>
        ) : audioUrl ? (
          <>
            <button onClick={handleDiscard}
              className="w-10 h-10 rounded-full border border-red-100 bg-white flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"
              aria-label="Discard">
              <Trash2 className="w-4 h-4" />
            </button>

            <button onClick={startRecording}
              className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
              aria-label="Record again">
              <RefreshCw className="w-4 h-4" />
            </button>

            <button onClick={handlePlayToggle}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-md active:scale-95 transition-transform"
              aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying
                ? <Pause className="w-5 h-5 fill-white text-white" />
                : <Play  className="w-5 h-5 fill-white text-white translate-x-0.5" />}
            </button>

            <button
              onClick={() => onSave(audioUrl, duration || 1, waveform)}
              className="px-5 h-10 rounded-full bg-white border border-gray-200 text-sm font-semibold text-[#111827] hover:bg-gray-50 transition-colors"
            >
              Save
            </button>
          </>
        ) : (
          <button
            onClick={startRecording}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[#111827] to-[#7C3AED] flex items-center justify-center shadow-md active:scale-95 transition-transform"
            aria-label="Start recording"
          >
            <Mic className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {!isRecording && !audioUrl && (
        <button onClick={onCancel}
          className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors text-center">
          Cancel
        </button>
      )}
    </div>
  );
};

export default VoiceRecorder;
