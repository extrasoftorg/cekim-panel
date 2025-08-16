import React from 'react';
import { Clock } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Yükleniyor...", 
  size = 'md',
  className = ""
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex flex-col justify-center items-center p-8 ${className}`}>
      <Clock className={`${sizeClasses[size]} text-[color:var(--primary)] animate-spin mb-4`} />
      <div className="text-sm text-[color:var(--muted-foreground)] text-center animate-pulse">
        {message}
      </div>
    </div>
  );
};

export default LoadingSpinner;