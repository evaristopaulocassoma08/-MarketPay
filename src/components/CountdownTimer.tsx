import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endDate: string;
  onEnd?: () => void;
}

export const CountdownTimer = ({ endDate, onEnd }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(endDate) - +new Date();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft(null);
        if (onEnd) onEnd();
      }
    };

    const timer = setInterval(calculateTimeLeft, 1000);
    calculateTimeLeft();

    return () => clearInterval(timer);
  }, [endDate, onEnd]);

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-1 text-market-red font-bold text-[10px] uppercase tracking-widest">
        <Clock className="w-3 h-3" />
        <span>Encerrado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-market-green font-mono text-[10px] font-bold uppercase tracking-widest">
      <Clock className="w-3 h-3" />
      <div className="flex gap-1">
        {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
        <span>{timeLeft.hours.toString().padStart(2, '0')}h</span>
        <span>{timeLeft.minutes.toString().padStart(2, '0')}m</span>
        <span>{timeLeft.seconds.toString().padStart(2, '0')}s</span>
      </div>
    </div>
  );
};
