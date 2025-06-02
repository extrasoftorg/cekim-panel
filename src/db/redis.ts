import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL tanımlı değil');
}

const redis = new Redis(redisUrl, {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
    ? { rejectUnauthorized: false }
    : undefined,
});

redis.on('connect', () => {
  console.log('Redis’e bağlanıldı');
});

redis.on('error', (err) => {
  console.error('Redis bağlantı hatası:', err);
});

export default redis;