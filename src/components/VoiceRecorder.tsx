import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Mic, Square, Play, Pause, RefreshCw, Trash2 } from 'lucide-react';
import { useUI } from '../contexts/UIContext';

interface VoiceRecorderProps {
  onSave: (audioUrl: string, duration: number, waveform: number[]) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSave,
  onCancel
}) => {
  const { showToast } = useUI();
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  // Keep track of waveform values during recording
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);
  const waveformRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      stopRecordingResources();
      playAudioRef.current?.pause();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const stopRecordingResources = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    waveformRef.current = [];
    setRecordedWaveform([]);
    setDuration(0);
    setAudioUrl(null);
    setIsPlaying(false);
    playAudioRef.current?.pause();
    playAudioRef.current = null;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Audio Nodes for Waveform Visualization
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Finalize waveform: cap to 30 bars
        const finalWaveform = waveformRef.current.slice(-30);
        while (finalWaveform.length < 30) {
          finalWaveform.push(10 + Math.random() * 20); // Pad with minor values
        }
        setRecordedWaveform(finalWaveform);

        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      isRecordingRef.current = true;
      setIsRecording(true);

      // Duration counter
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Render Waveform Canvas
      visualizeWaveform();

    } catch {
      stream?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      showToast('Could not access microphone. Please enable permissions.', 'error');
    }
  };

  const handleDiscard = () => {
    playAudioRef.current?.pause();
    playAudioRef.current = null;
    setAudioUrl(null);
    setDuration(0);
    setIsPlaying(false);
    setRecordedWaveform([]);
    waveformRef.current = [];
    audioChunksRef.current = [];
  };

  const formatTime = (secs: number) =>
    `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    stopRecordingResources();
  };

  const visualizeWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecordingRef.current) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyserRef.current!.getByteFrequencyData(dataArray);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      // Calculate single average volume amplitude for the current frame
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength;
      // Convert to a percentage height and push
      const heightPercent = Math.max(10, Math.min(95, (averageVolume / 255) * 120));
      
      // Update list of bars
      if (Math.random() > 0.4) {
        waveformRef.current.push(heightPercent);
      }

      // Draw standard audio visualizer bars on canvas
      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        // Soft pink gradient look
        canvasCtx.fillStyle = '#111827';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };

    draw();
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
      playAudioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSave = () => {
    if (!audioUrl) return;
    onSave(audioUrl, duration || 1, recordedWaveform);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="text-center">
        <h4 className="text-sm font-bold text-clipo-text-primary">Voice Note</h4>
        <p className="text-xs text-clipo-text-secondary mt-1">
          {isRecording ? 'Recording…' : audioUrl ? 'Preview your recording' : 'Tap the mic to start'}
        </p>
      </div>

      {/* Waveform / Visualizer */}
      <div className="w-full h-24 bg-[#F5F7FB] border border-clipo-border rounded-2xl flex items-center justify-center overflow-hidden relative">
        {isRecording ? (
          <canvas
            ref={canvasRef}
            width={320}
            height={96}
            className="w-full h-full waveform-canvas"
            aria-label="Live audio waveform"
          />
        ) : audioUrl ? (
          <div className="flex items-end justify-center gap-[3px] h-12 px-8 w-full" aria-label="Recorded waveform">
            {recordedWaveform.map((height, i) => (
              <div
                key={i}
                className={`w-1.5 bg-[#111827] rounded-full transition-all duration-300 ${isPlaying ? 'animate-equalizer' : ''}`}
                style={{ height: `${height}%`, opacity: isPlaying ? 0.9 : 0.45, animationDelay: isPlaying ? `${(i % 5) * 0.12}s` : undefined }}
              />
            ))}
          </div>
        ) : (
          <Mic className="w-8 h-8 text-[#9CA3AF] animate-pulse" aria-hidden="true" />
        )}

        {(isRecording || duration > 0) && (
          <span className="absolute bottom-2 right-3 text-xs font-bold text-clipo-text-secondary bg-white/80 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-clipo-border" aria-live="polite">
            {formatTime(duration)}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {isRecording ? (
          <Button
            variant="danger"
            onClick={stopRecording}
            aria-label="Stop recording"
            className="w-14 h-14 rounded-full p-0 flex items-center justify-center shadow-soft"
          >
            <Square className="w-5 h-5 fill-white" aria-hidden="true" />
          </Button>
        ) : audioUrl ? (
          <>
            <button
              onClick={handleDiscard}
              aria-label="Discard recording"
              title="Discard"
              className="w-10 h-10 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>

            <Button
              variant="secondary"
              onClick={startRecording}
              aria-label="Record again"
              title="Record again"
              className="w-10 h-10 rounded-full p-0 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </Button>

            <Button
              variant="primary"
              onClick={handlePlayToggle}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              className="w-14 h-14 rounded-full p-0 flex items-center justify-center shadow-soft"
            >
              {isPlaying
                ? <Pause className="w-5 h-5 fill-white" aria-hidden="true" />
                : <Play className="w-5 h-5 fill-white translate-x-0.5" aria-hidden="true" />}
            </Button>

            <Button
              variant="pastel"
              onClick={handleSave}
              aria-label="Save voice recording"
              className="font-bold text-xs"
            >
              Save
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            onClick={startRecording}
            aria-label="Start recording"
            className="w-14 h-14 rounded-full p-0 flex items-center justify-center shadow-soft"
          >
            <Mic className="w-6 h-6" aria-hidden="true" />
          </Button>
        )}
      </div>

      {!isRecording && !audioUrl && (
        <button
          onClick={onCancel}
          aria-label="Cancel voice recorder"
          className="text-xs font-semibold text-clipo-text-secondary hover:text-clipo-text-primary mt-1 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
};
export default VoiceRecorder;
