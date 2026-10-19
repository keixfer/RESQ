class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    insert(emergency) {
        this.heap.push(emergency);
        this.heapifyUp();
    }

    heapifyUp() {
        let index = this.heap.length - 1;

        while (index > 0) {
            let parent = Math.floor((index - 1) / 2);

            if (this.heap[parent].priority >= this.heap[index].priority) {
                break;
            }

            [this.heap[parent], this.heap[index]] =
            [this.heap[index], this.heap[parent]];

            index = parent;
        }
    }

    extractMax() {
        if (this.heap.length === 0) {
            return null;
        }

        if (this.heap.length === 1) {
            return this.heap.pop();
        }

        const max = this.heap[0];

        this.heap[0] = this.heap.pop();

        this.heapifyDown();

        return max;
    }

    heapifyDown() {
        let index = 0;

        while (true) {
            let left = 2 * index + 1;
            let right = 2 * index + 2;
            let largest = index;

            if (
                left < this.heap.length &&
                this.heap[left].priority > this.heap[largest].priority
            ) {
                largest = left;
            }

            if (
                right < this.heap.length &&
                this.heap[right].priority > this.heap[largest].priority
            ) {
                largest = right;
            }

            if (largest === index) {
                break;
            }

            [this.heap[index], this.heap[largest]] =
            [this.heap[largest], this.heap[index]];

            index = largest;
        }
    }

    getAll() {
        return this.heap;
    }
}

module.exports = PriorityQueue;