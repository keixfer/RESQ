function bfs(graph, start) {
    const visited = {};
    const queue = [];
    const result = [];

    queue.push(start);
    visited[start] = true;

    while (queue.length > 0) {
        const current = queue.shift();

        result.push(current);

        for (let edge of graph[current]) {
            if (!visited[edge.node]) {
                visited[edge.node] = true;
                queue.push(edge.node);
            }
        }
    }

    return result;
}

module.exports = bfs;