import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  showLabel?: boolean;
  existingAudioUrl?: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onRecordingComplete,
  showLabel = true,
  existingAudioUrl = null
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudioUrl);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setAudioUrl(existingAudioUrl);
  }, [existingAudioUrl]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl && !existingAudioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, existingAudioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onRecordingComplete(blob);
        
        // Detener los tracks después de procesar el audio
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error al iniciar la grabación:', error);
      toast.error('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
  };

  return (
    <div className="mb-4">
      {showLabel && (
        <label className="block text-sm font-medium mb-1">Nota de Audio</label>
      )}
      <div className="flex items-center gap-4">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="w-full flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 transition-colors"
            disabled={!!audioUrl}
          >
            <MicrophoneIcon className="h-5 w-5 mr-2" />
            Grabar Audio
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="w-full flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium bg-red-100 text-red-700 border-red-300 hover:bg-red-200 transition-colors"
          >
            <StopIcon className="h-5 w-5 mr-2" />
            Detener Grabación
          </button>
        )}
        {audioUrl && (
          <div className="flex items-center gap-2 flex-1">
            <audio controls src={audioUrl} className="flex-1" />
            <button
              type="button"
              onClick={deleteRecording}
              className="p-2 text-red-500 hover:text-red-600 transition-colors"
              title="Eliminar grabación"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder; 