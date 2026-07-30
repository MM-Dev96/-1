import { useEffect, useState, useRef } from 'react';
import { getSocket } from '../services/socket.ts';
import { useAppStore } from '../store.ts';

export const useSocket = () => {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const hasConnectedOnce = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    
    if (!socket.connected) {
      setStatus('connecting');
      socket.connect();
    } else {
      setStatus('connected');
    }

    const onConnect = () => {
      setStatus('connected');
      if (!hasConnectedOnce.current) {
         hasConnectedOnce.current = true;
         // Notification handled by UI component that calls useSocket
      }
    };

    const onDisconnect = () => {
      setStatus('disconnected');
    };
    
    const onConnectError = () => {
      setStatus('reconnecting');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  return { socket: getSocket(), status, hasConnectedOnce: hasConnectedOnce.current };
};
