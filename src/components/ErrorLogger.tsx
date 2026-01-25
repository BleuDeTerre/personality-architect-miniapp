'use client';

import { useEffect, useState } from 'react';

export default function ErrorLogger() {
  const [errors, setErrors] = useState<Array<{ message: string; stack?: string; timestamp: number }>>([]);

  useEffect(() => {
    // Функция для проверки, является ли ошибка не критичной (можно игнорировать)
    const isIgnorableError = (message: string): boolean => {
      const ignorablePatterns = [
        'analyticsMiniAppRollup', // Ошибка аналитики Neynar (не критична)
        'analytics', // Общие ошибки аналитики
        'Failed to fetch', // Сетевые ошибки аналитики
        'MetaMask', // OnchainKit пытается найти MetaMask (не критично в Farcaster)
        'ethereum', // Wallet provider ошибки
        'wallet', // Общие ошибки кошелька при инициализации
        'connect', // Ошибки подключения кошельков
      ];
      return ignorablePatterns.some(pattern => 
        message.toLowerCase().includes(pattern.toLowerCase())
      );
    };

    // Ловим синхронные ошибки
    const handleError = (event: ErrorEvent) => {
      const message = event.message || String(event.error);
      
      // Игнорируем не критичные ошибки аналитики Neynar
      if (isIgnorableError(message)) {
        console.warn('[ErrorLogger] Ignoring non-critical analytics error:', message);
        return;
      }

      const errorInfo = {
        message,
        stack: event.error?.stack,
        timestamp: Date.now(),
      };
      console.error('[ErrorLogger] Caught error:', errorInfo);
      setErrors(prev => [...prev.slice(-1), errorInfo]); // Храним только последние 2 ошибки
    };

    // Ловим необработанные промисы
    const handleRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || String(event.reason) || 'Unhandled promise rejection';
      
      // Игнорируем не критичные ошибки аналитики Neynar
      if (isIgnorableError(message)) {
        console.warn('[ErrorLogger] Ignoring non-critical analytics rejection:', message);
        return;
      }

      const errorInfo = {
        message,
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

