import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import express from 'express'
import { scrapingQueue, aiProcessingQueue, publishingQueue } from './queues'

// Create Bull Board server adapter
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

// Create Bull Board with our queues
export const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullAdapter(scrapingQueue),
    new BullAdapter(aiProcessingQueue),
    new BullAdapter(publishingQueue),
  ],
  serverAdapter,
})

// Express app for queue monitoring
export function createQueueMonitorApp() {
  const app = express()

  app.use('/admin/queues', serverAdapter.getRouter())

  return app
}

export { serverAdapter }