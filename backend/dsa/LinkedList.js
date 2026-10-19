class Node {
    constructor(victim) {
        this.victim = victim;
        this.next = null;
    }
}

class LinkedList {
    constructor() {
        this.head = null;
    }

    add(victim) {
        const newNode = new Node(victim);

        if (this.head === null) {
            this.head = newNode;
            return;
        }

        let current = this.head;

        while (current.next !== null) {
            current = current.next;
        }

        current.next = newNode;
    }

    remove(victimId) {
        if (this.head === null) {
            return null;
        }

        if (this.head.victim.victimId === victimId) {
            const removed = this.head.victim;
            this.head = this.head.next;
            return removed;
        }

        let current = this.head;

        while (
            current.next !== null &&
            current.next.victim.victimId !== victimId
        ) {
            current = current.next;
        }

        if (current.next === null) {
            return null;
        }

        const removed = current.next.victim;

        current.next = current.next.next;

        return removed;
    }

    getAll() {
        const victims = [];

        let current = this.head;

        while (current !== null) {
            victims.push(current.victim);
            current = current.next;
        }

        return victims;
    }
}

module.exports = LinkedList;