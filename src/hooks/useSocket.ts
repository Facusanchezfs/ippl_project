import { useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

let socket: Socket | null = null;

export const useSocket = (role: string) => {
  const connectSocket = useCallback(() => {
    if (!socket) {
      socket = io(API_URL);

      socket.on('connect', () => {
        socket?.emit('joinRoom', role);
      });

      socket.on('disconnect', () => {
        console.debug('Desconectado del servidor de WebSocket');
      });
    }
    return socket;
  }, [role]);

  const emitUpdate = useCallback((data: any) => {
    socket?.emit('dataUpdate', data);
  }, []);

  const subscribeToUpdates = useCallback((callback: (data: any) => void) => {
    socket?.on('dataUpdated', callback);
    return () => {
      socket?.off('dataUpdated', callback);
    };
  }, []);

  useEffect(() => {
    const currentSocket = connectSocket();

    return () => {
      if (currentSocket) {
        currentSocket.disconnect();
        socket = null;
      }
    };
  }, [connectSocket]);

  return {
    socket: socket,
    emitUpdate,
    subscribeToUpdates
  };
}; 