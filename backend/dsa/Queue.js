class Queue {
    constructor() {
        this.items = [];
    }

    enqueue(team) {
        this.items.push(team);
    }

    dequeue() {
        if (this.items.length === 0) {
            return null;
        }

        return this.items.shift();
    }

    peek() {
        if (this.items.length === 0) {
            return null;
        }

        return this.items[0];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    getAll() {
        return this.items;
    }
}

module.exports = Queue;