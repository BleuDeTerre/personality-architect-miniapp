#!/usr/bin/env node
// Скрипт для генерации VAPID ключей для push-уведомлений
// Использование: node scripts/generate-vapid-keys.mjs

import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n✅ VAPID ключи успешно сгенерированы!\n');
console.log('Добавьте эти переменные в ваш .env.local файл:\n');
console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_EMAIL=mailto:your-email@example.com');
console.log('\n⚠️  Важно: Никогда не публикуйте VAPID_PRIVATE_KEY!');
console.log('⚠️  NEXT_PUBLIC_VAPID_PUBLIC_KEY нужен для браузера.\n');

