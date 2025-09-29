const express = require('express')
const { createBullBoard } = require('@bull-board/api')
const { BullAdapter } = require('@bull-board/api/bullAdapter')
const { ExpressAdapter } = require('@bull-board/express')
const { Queue } = require('bullmq')
const Redis = require('ioredis')

// Create Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Create queues
const scrapingQueue = new Queue('scraping', { connection: redisConnection })
const aiProcessingQueue = new Queue('ai-processing', { connection: redisConnection })
const publishingQueue = new Queue('publishing', { connection: redisConnection })

// Create Bull Board
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/')

createBullBoard({
  queues: [
    new BullAdapter(scrapingQueue),
    new BullAdapter(aiProcessingQueue),
    new BullAdapter(publishingQueue),
  ],
  serverAdapter,
})

// Create Express app
const app = express()
const PORT = process.env.QUEUE_MONITOR_PORT || 3001

app.use('/', serverAdapter.getRouter())

app.listen(PORT, () => {
  console.log(`🔍 Queue Monitor running at http://localhost:${PORT}`)
  console.log('Available queues: scraping, ai-processing, publishing')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down queue monitor...')
  redisConnection.disconnect()
  process.exit(0)
})