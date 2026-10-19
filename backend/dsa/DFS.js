function dfs(graph, start, visited = {}, result = []) {
    visited[start] = true;

    result.push(start);

    for (let edge of graph[start]) {
        if (!visited[edge.node]) {
            dfs(graph, edge.node, visited, result);
        }
    }

    return result;
}

module.exports = dfs;