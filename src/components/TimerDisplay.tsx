import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  timeLimit: number; 
  isSaved: boolean;
  initialTime?: number;
  onTimeUp: (finalTime: number) => void;
  onChange?: (currentTime: number) => void; // Thêm để báo về App lưu tiến độ
}

export const TimerDisplay: React.FC<TimerProps> = React.memo(({ 
  timeLimit, 
  isSaved, 
  initialTime = 0,
  onTimeUp,
  onChange 
}) => {
  const [elapsed, setElapsed] = useState(initialTime);
  const limitInSeconds = timeLimit * 60;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Đồng bộ lại elapsed nếu initialTime thay đổi (khi khôi phục từ LocalStorage)
  useEffect(() => {
    setElapsed(initialTime);
  }, [initialTime]);

  useEffect(() => {
    if (!isSaved && elapsed < limitInSeconds) {
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const newTime = prev + 1;
          
          // --- PHẦN ĐIỀU CHỈNH: Báo về App 5 giây/lần để lưu tiến độ ---
          if (newTime % 5 === 0) {
            onChange?.(newTime);
          }

          if (newTime >= limitInSeconds) {
            if (timerRef.current) clearInterval(timerRef.current);
            onTimeUp(limitInSeconds); // Kích hoạt hàm thu bài ở App.tsx
            return limitInSeconds;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSaved, timeLimit]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  const isOverTime = elapsed >= limitInSeconds;

  return (
    <span className={`flex items-center gap-1 font-mono font-bold px-2 py-1 rounded ${
      isOverTime ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-blue-700'
    }`}>
      <Clock size={14} /> 
      {formatTime(elapsed)} / {timeLimit}:00
    </span>
  );
});