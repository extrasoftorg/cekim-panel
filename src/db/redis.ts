import Redis from 'ioredis';

export const redis = new Redis({
  port: 6379,
  host: 'localhost',
});

redis.on('connect', () => {
    console.log('Redis’e bağlanıldı');
});

redis.on('error', (err) => {
    console.error('Redis bağlantı hatası:', err);
});
  
export default redis;
