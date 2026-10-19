class Graph {
    constructor() {
        this.graph = {};
    }

    addNode(node) {
        if (!this.graph[node]) {
            this.graph[node] = [];
        }
    }

    addEdge(node1, node2, weight) {
        this.addNode(node1);
        this.addNode(node2);

        this.graph[node1].push({
            node: node2,
            weight: weight
        });

        this.graph[node2].push({
            node: node1,
            weight: weight
        });
    }

    getGraph() {
        return this.graph;
    }
}

module.exports = Graph;