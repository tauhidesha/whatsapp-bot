// File: src/ai/utils/debounceQueue.js
// Utility to manage per-sender debounce timers with auto-flush on inactivity.

const DEFAULT_DELAY_MS = parseInt(process.env.DEBOUNCE_DELAY_MS || '10000', 10);

class DebounceQueue {
  constructor(delayMs = DEFAULT_DELAY_MS, onFlush) {
    this.delayMs = delayMs;
    this.onFlush = onFlush;
    this.timers = new Map();
    this.queues = new Map();
  }

  schedule(senderNumber, message) {
    const existingQueue = this.queues.get(senderNumber) || [];
    existingQueue.push(message);
    this.queues.set(senderNumber, existingQueue);

    if (this.timers.has(senderNumber)) {
      clearTimeout(this.timers.get(senderNumber));
    }

    const timerId = setTimeout(() => {
      this.flush(senderNumber);
    }, this.delayMs);

    this.timers.set(senderNumber, timerId);
  }

  async flush(senderNumber) {
    const queue = this.queues.get(senderNumber);
    if (!queue || queue.length === 0) {
      return;
    }

    this.queues.delete(senderNumber);

    if (this.timers.has(senderNumber)) {
      clearTimeout(this.timers.get(senderNumber));
      this.timers.delete(senderNumber);
    }

    try {
      await this.onFlush(senderNumber, queue);
    } catch (error) {
      console.error(`[DebounceQueue] Error flushing messages for ${senderNumber}:`, error);
    }
  }

  async flushAll() {
    const senders = Array.from(this.queues.keys());
    for (const sender of senders) {
      await this.flush(sender);
    }
  }
}

module.exports = {
  DebounceQueue,
  DEFAULT_DELAY_MS,
};
