class HashTable {
    constructor(size = 10) {
        this.size = size;
        this.table = new Array(size);
    }

    hash(key) {
        let hash = 0;

        for (let char of key) {
            hash += char.charCodeAt(0);
        }

        return hash % this.size;
    }

    set(key, value) {
        const index = this.hash(key);

        if (!this.table[index]) {
            this.table[index] = [];
        }

        for (let item of this.table[index]) {
            if (item.key === key) {
                item.value = value;
                return;
            }
        }

        this.table[index].push({
            key: key,
            value: value
        });
    }

    get(key) {
        const index = this.hash(key);

        if (!this.table[index]) {
            return null;
        }

        for (let item of this.table[index]) {
            if (item.key === key) {
                return item.value;
            }
        }

        return null;
    }

    remove(key) {
        const index = this.hash(key);

        if (!this.table[index]) {
            return false;
        }

        const position = this.table[index].findIndex(
            item => item.key === key
        );

        if (position === -1) {
            return false;
        }

        this.table[index].splice(position, 1);
        return true;
    }

    getAll() {
        const result = [];

        for (let bucket of this.table) {
            if (bucket) {
                for (let item of bucket) {
                    result.push({
                        key: item.key,
                        value: item.value
                    });
                }
            }
        }

        return result;
    }
}

module.exports = HashTable;