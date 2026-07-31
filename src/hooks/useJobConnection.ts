import { useEffect, useRef } from 'react';
import type { JobEvent, JobSnapshot } from '../shared/contracts.ts';
import {
  JOB_EVENT_CHANNEL,
  JOB_SNAPSHOT_CHANNEL,
  JOB_SUBSCRIBE_CHANNEL,
} from '../shared/contracts.ts';
import { reduceJobEvent } from '../shared/jobReducer.ts';
import { api } from '../lib/api.ts';
import { getSocket } from '../lib/socket.ts';
import { useAppStore } from '../store.ts';

export function useJobConnection(): void {
  const activeJobId = useAppStore((state) => state.activeJobId);
  const setSnapshot = useAppStore((state) => state.setJobSnapshot);
  const setConnection = useAppStore((state) => state.setConnection);
  const pushToast = useAppStore((state) => state.pushToast);
  const seenEvents = useRef(new Set<string>());

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => {
      setConnection('connected');
      if (activeJobId) socket.emit(JOB_SUBSCRIBE_CHANNEL, activeJobId);
    };
    const onDisconnect = () => setConnection('offline');
    const onSnapshot = (snapshot: JobSnapshot) => setSnapshot(snapshot);
    const onEvent = (event: JobEvent) => {
      if (seenEvents.current.has(event.id)) return;
      seenEvents.current.add(event.id);
      if (seenEvents.current.size > 600) {
        seenEvents.current = new Set([...seenEvents.current].slice(-300));
      }
      setSnapshot(
        reduceJobEvent(useAppStore.getState().jobSnapshot, event),
      );
      if (event.event === 'job:completed') {
        pushToast(`complete:${event.jobId}`, 'اكتملت المهمة بنجاح.', 'success');
      } else if (event.event === 'job:failed') {
        pushToast(`failed:${event.jobId}`, 'توقفت المهمة بسبب خطأ.', 'error');
      } else if (event.event === 'job:canceled') {
        pushToast(`canceled:${event.jobId}`, 'أُلغيت المهمة.', 'info');
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(JOB_SNAPSHOT_CHANNEL, onSnapshot);
    socket.on(JOB_EVENT_CHANNEL, onEvent);
    if (!socket.connected) {
      setConnection('connecting');
      socket.connect();
    } else {
      onConnect();
    }
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(JOB_SNAPSHOT_CHANNEL, onSnapshot);
      socket.off(JOB_EVENT_CHANNEL, onEvent);
    };
  }, [activeJobId, pushToast, setConnection, setSnapshot]);

  useEffect(() => {
    if (!activeJobId) return;
    const socket = getSocket();
    socket.emit(JOB_SUBSCRIBE_CHANNEL, activeJobId);
    let stopped = false;
    const recover = async () => {
      try {
        const snapshot = await api.getJob(activeJobId);
        if (!stopped) setSnapshot(snapshot);
      } catch {
        // The next polling tick or socket reconnect can recover the state.
      }
    };
    void recover();
    const interval = window.setInterval(() => {
      const current = useAppStore.getState().jobSnapshot;
      if (
        !socket.connected ||
        (current && ['QUEUED', 'RUNNING'].includes(current.status))
      ) {
        void recover();
      }
    }, 4_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [activeJobId, setSnapshot]);
}
