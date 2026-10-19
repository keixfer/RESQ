class Stack {
    constructor() {
        this.items = [];
    }

    push(action) {
        this.items.push(action);
    }

    pop() {
        if (this.items.length === 0) {
            return null;
        }

        return this.items.pop();
    }

    peek() {
        if (this.items.length === 0) {
            return null;
        }

        return this.items[this.items.length - 1];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    getAll() {
        return [...this.items].reverse();
    }
}

module.exports = Stack;