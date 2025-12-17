type BatchRequest<T> = {
  key: string;
  fetcher: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class BatchRequestManager {
  private queues: Map<string, BatchRequest<any>[]> = new Map();
  private processing: Set<string> = new Set();
  private batchDelay: number = 50;
  private maxConcurrent: number = 3;
  private activeRequests: number = 0;

  async addRequest<T>(
    category: string,
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queue = this.queues.get(category) || [];
      queue.push({ key, fetcher, resolve, reject });
      this.queues.set(category, queue);

      if (!this.processing.has(category)) {
        this.processing.add(category);
        setTimeout(() => this.processBatch(category), this.batchDelay);
      }
    });
  }

  private async processBatch(category: string): Promise<void> {
    const queue = this.queues.get(category) || [];
    this.queues.delete(category);
    this.processing.delete(category);

    if (queue.length === 0) {
      return;
    }

    const uniqueRequests = new Map<string, BatchRequest<any>>();
    const duplicateRequests = new Map<string, BatchRequest<any>[]>();

    queue.forEach(request => {
      if (!uniqueRequests.has(request.key)) {
        uniqueRequests.set(request.key, request);
        duplicateRequests.set(request.key, []);
      } else {
        duplicateRequests.get(request.key)!.push(request);
      }
    });

    const requests = Array.from(uniqueRequests.values());
    await this.executeRequests(requests, duplicateRequests);
  }

  private async executeRequests(
    requests: BatchRequest<any>[],
    duplicates: Map<string, BatchRequest<any>[]>
  ): Promise<void> {
    const batches: BatchRequest<any>[][] = [];
    for (let i = 0; i < requests.length; i += this.maxConcurrent) {
      batches.push(requests.slice(i, i + this.maxConcurrent));
    }

    for (const batch of batches) {
      await this.executeBatch(batch, duplicates);
    }
  }

  private async executeBatch(
    batch: BatchRequest<any>[],
    duplicates: Map<string, BatchRequest<any>[]>
  ): Promise<void> {
    this.activeRequests += batch.length;

    const promises = batch.map(async request => {
      try {
        const result = await request.fetcher();
        request.resolve(result);

        const dupes = duplicates.get(request.key) || [];
        dupes.forEach(dupe => dupe.resolve(result));
      } catch (error) {
        request.reject(error);

        const dupes = duplicates.get(request.key) || [];
        dupes.forEach(dupe => dupe.reject(error));
      }
    });

    await Promise.all(promises);
    this.activeRequests -= batch.length;
  }

  getActiveRequestCount(): number {
    return this.activeRequests;
  }

  clearQueue(category?: string): void {
    if (category) {
      this.queues.delete(category);
      this.processing.delete(category);
    } else {
      this.queues.clear();
      this.processing.clear();
    }
  }
}

export const batchRequestManager = new BatchRequestManager();

export const batchFetch = <T>(
  category: string,
  key: string,
  fetcher: () => Promise<T>
): Promise<T> => {
  return batchRequestManager.addRequest(category, key, fetcher);
};
