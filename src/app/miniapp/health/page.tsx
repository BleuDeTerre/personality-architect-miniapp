'use client';

export default function MiniappHealthPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1b2e',
      color: '#ffffff',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '600px',
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '16px',
          background: 'linear-gradient(to right, #8a5df5, #a183f9)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ✅ Health Check OK
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#c3c8d4',
          marginBottom: '24px',
        }}>
          Mini App is loading correctly
        </p>
        <div style={{
          backgroundColor: '#252640',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '24px',
        }}>
          <p style={{
            fontSize: '14px',
            color: '#8d92a3',
            marginBottom: '8px',
          }}>
            <strong>Timestamp:</strong> {new Date().toISOString()}
          </p>
          <p style={{
            fontSize: '14px',
            color: '#8d92a3',
            marginBottom: '8px',
          }}>
            <strong>User Agent:</strong> {typeof window !== 'undefined' ? navigator.userAgent : 'N/A'}
          </p>
          <p style={{
            fontSize: '14px',
            color: '#8d92a3',
          }}>
            <strong>URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}

