import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  startTime: number;
  stageName: string;
}

export function CountdownTimer({ startTime, stageName }: CountdownTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    
    const update = () => {
      setElapsed(Date.now() - startTime);
      animationFrameId = requestAnimationFrame(update);
    };
    
    update();
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [startTime]);

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="mt-3 w-full" onClick={(e) => e.stopPropagation()}>
      <div className="text-xs font-mono text-indigo-300 flex items-center gap-1.5 bg-indigo-500/5 p-1.5 rounded">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        الوقت المستغرق: {formattedTime}
      </div>
    </div>
  );
}
