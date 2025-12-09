import React, { useEffect, useState } from 'react';
import { getTrialInfo } from '../services/geminiService';
import { AlertTriangle, Zap, X } from 'lucide-react';

export const TrialCountdown: React.FC = () => {
  const [trialInfo, setTrialInfo] = useState(getTrialInfo());
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Update trial info every hour
    const interval = setInterval(() => {
      setTrialInfo(getTrialInfo());
    }, 1000 * 60 * 60); // Update every hour

    return () => clearInterval(interval);
  }, []);

  if (!trialInfo.isTrialActive || isDismissed) {
    return null; // Don't show anything if trial is not active or dismissed
  }

  const isWarning = trialInfo.warningThreshold;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-sm ${
        isWarning ? 'bg-red-400' : 'bg-yellow-400'
      }`}
    >
      <button
        onClick={() => setIsDismissed(true)}
        className='absolute top-2 right-2 p-1 hover:bg-black/10 rounded transition-colors'
        aria-label='Tancar'
      >
        <X size={16} className='text-black' />
      </button>
      <div className='flex items-start gap-3 pr-4'>
        <div className='flex-shrink-0'>
          {isWarning ? (
            <AlertTriangle size={24} className='text-black' />
          ) : (
            <Zap size={24} className='text-black' />
          )}
        </div>
        <div className='flex-1'>
          <h3 className='font-bold font-mono text-sm uppercase mb-1'>
            {isWarning ? '⚠️ Avís: Trial expira aviat' : '🚀 Mode Trial Actiu'}
          </h3>
          <p className='font-mono text-xs mb-2'>
            {isWarning
              ? `Només queden ${trialInfo.daysRemaining} dies de crèdits gratuïts!`
              : `${trialInfo.daysRemaining} dies restants de $300 en crèdits`}
          </p>
          <div className='flex flex-col gap-1 text-xs font-mono'>
            <div className='flex justify-between'>
              <span className='opacity-70'>Límit actual:</span>
              <span className='font-bold'>{trialInfo.currentLimits.RPM} RPM</span>
            </div>
            <div className='flex justify-between'>
              <span className='opacity-70'>Data fi:</span>
              <span className='font-bold'>
                {trialInfo.trialEndDate.toLocaleDateString('ca-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
          {isWarning && (
            <p className='text-xs mt-2 font-bold'>
              Després del trial, els límits baixaran a {trialInfo.currentLimits.RPM === 2000 ? '5' : trialInfo.currentLimits.RPM} RPM
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
