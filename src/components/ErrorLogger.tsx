'use client';

import { useEffect, useState } from 'react';

export default function ErrorLogger() {
  const [errors, setErrors] = useState<Array<{ message: string; stack?: string; timestamp: number }>>([]);

  useEffect(() => {
    // Ловим синхронные ошибки
    const handleError = (event: ErrorEvent) => {
      const errorInfo = {
        message: event.message || String(event.error),
        stack: event.error?.stack,
        timestamp: Date.now(),
      };
      console.error('[ErrorLogger] Caught error:', errorInfo);
      setErrors(prev => [...prev.slice(-1), errorInfo]); // Храним только последние 2 ошибки
    };

    // Ловим необработанные промисы
    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorInfo = {
        message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: Date.now(),
      };
      console.error('[ErrorLogger] Caught unhandled rejection:', errorInfo);
      setErrors(prev => [...prev.slice(-1), errorInfo]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Логируем что компонент вообще загрузился
    console.log('[ErrorLogger] Error logger initialized');

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Не показываем если нет ошибок
  if (errors.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#ff4444',
        padding: '12px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 99999,
        maxHeight: '200px',
        overflow: 'auto',
        borderTop: '2px solid #ff4444',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>⚠️ Errors caught:</div>
      {errors.map((err, idx) => (
        <div key={idx} style={{ marginBottom: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <div style={{ color: '#ff8888' }}>{err.message}</div>
          {err.stack && (
            <div style={{ color: '#ffaaaa', fontSize: '10px', marginTop: '4px' }}>
              {err.stack.split('\n').slice(0, 3).join('\n')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

