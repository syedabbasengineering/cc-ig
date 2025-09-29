import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redisConnection.on('connect', () => {
  console.log('Connected to Redis')
})

export default redisConnection