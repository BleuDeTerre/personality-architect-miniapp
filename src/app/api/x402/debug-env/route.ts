// src/app/api/x402/debug-env/route.ts
// Диагностический endpoint для проверки переменных окружения
// ⚠️ ВАЖНО: Работает ТОЛЬКО в development режиме и только для localhost
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Безопасность: работаем ТОЛЬКО в development и только для localhost
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Not available in production' }, { status: 403 });
  }
  
  // Проверяем, что запрос с localhost
  const host = req.headers.get('host') || '';
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    return Response.json({ error: 'Only available on localhost' }, { status: 403 });
  }

  // Собираем все переменные, связанные с x402
  const x402Vars: Record<string, string | undefined> = {};
  const allEnvKeys = Object.keys(process.env);
  
  // Фильтруем переменные x402
  const relevantKeys = allEnvKeys.filter(
    k => k.startsWith('X402_') || 
         k.startsWith('EVM_') || 
         k.includes('FACILITATOR') ||
         k.includes('CDP_') ||
         k === 'NODE_ENV'
  );
  
  for (const key of relevantKeys) {
    const value = process.env[key];
    // Показываем только первые 20 символов для безопасности
    x402Vars[key] = value ? (value.length > 20 ? value.substring(0, 20) + '...' : value) : undefined;
  }
  
  // Безопасность: НЕ возвращаем содержимое файла, только проверяем наличие ключей
  const fs = await import('fs');
  const path = await import('path');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envLocalExists = fs.existsSync(envLocalPath);
  
  let envLocalKeys: string[] = [];
  const allKeys: string[] = []; // Все ключи из файла (для диагностики парсинга)
  if (envLocalExists) {
    try {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      const lines = content.split('\n');
      // Извлекаем только КЛЮЧИ (без значений) для диагностики
      // Улучшенный парсинг: учитываем пробелы, табы, разные форматы
      envLocalKeys = lines
        .map((line, index) => {
          // Убираем BOM и другие невидимые символы
          let trimmed = line.trim().replace(/^\uFEFF/, '');
          // Убираем все невидимые символы в начале
          trimmed = trimmed.replace(/^[\u200B-\u200D\uFEFF]/, '');
          if (!trimmed || trimmed.startsWith('#')) return null;
          
          // Более гибкий regex: учитывает пробелы вокруг =, может быть пустое значение
          // Пробуем разные варианты парсинга
          let match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*/);
          if (!match) {
            // Пробуем без пробелов
            match = trimmed.match(/^([A-Za-z0-9_]+)=/);
          }
          if (!match) {
            // Пробуем с табами
            match = trimmed.match(/^([A-Za-z0-9_]+)\t*=/);
          }
          
          const key = match ? match[1].trim() : null;
          if (key) {
            allKeys.push(key); // Сохраняем все ключи для диагностики
            // Логируем проблемные строки для отладки
            if (key.startsWith('X402_') || key.startsWith('EVM_') || key.includes('FACILITATOR')) {
              console.log(`[debug-env] Found key: ${key} from line ${index + 1}: ${trimmed.substring(0, 50)}`);
            }
          }
          return key;
        })
        .filter((key): key is string => {
          if (!key) return false;
          // Проверяем все возможные варианты
          return (
            key.startsWith('X402_') ||
            key.startsWith('EVM_') ||
            key.includes('FACILITATOR') ||
            key.includes('CDP_')
          );
        });
    } catch (e) {
      // Игнорируем ошибки чтения
    }
  }
  
  return Response.json({
    message: 'Диагностика переменных окружения x402 (только development, только localhost)',
    nodeEnv: process.env.NODE_ENV,
    envLocalExists,
    processEnv: x402Vars, // Значения обрезаны до 20 символов
    envLocalKeys, // Только ключи из файла (без значений)
    allX402Keys: relevantKeys, // Ключи, которые видит process.env
    missingKeys: envLocalKeys.filter(k => !relevantKeys.includes(k)), // Ключи из файла, которых нет в process.env
    allKeysFromFile: allKeys, // Все ключи из файла (для диагностики парсинга)
    note: '⚠️ БЕЗОПАСНОСТЬ: Полные значения НЕ возвращаются. Этот endpoint работает только в development на localhost.',
  }, { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
