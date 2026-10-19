const express = require("express");
const Graph = require("../dsa/Graph");
const bfs = require("../dsa/BFS");
const dfs = require("../dsa/DFS");

const router = express.Router();

// POST /api/traversal/bfs
// Body: { "start": "A", "edges": [{ "from": "A", "to": "B", "weight": 5 }, ...] }
// If no edges provided, a default sample graph is used.
router.post("/bfs", (req, res) => {
    const { start, edges } = req.body;

    if (!start) {
        return res.status(400).json({ message: "\"start\" node is required." });
    }

    const graph = new Graph();

    if (edges && Array.isArray(edges) && edges.length > 0) {
        edges.forEach(({ from, to, weight }) => {
            graph.addEdge(from, to, weight ?? 1);
        });
    } else {
        // Default sample graph (same nodes as /api/routes/find)
        graph.addEdge("A", "B", 5);
        graph.addEdge("A", "C", 8);
        graph.addEdge("B", "C", 3);
        graph.addEdge("B", "D", 6);
        graph.addEdge("C", "D", 4);
    }

    const graphData = graph.getGraph();

    if (!graphData[start]) {
        return res.status(400).json({ message: `Start node "${start}" not found in the graph.` });
    }

    const visitedOrder = bfs(graphData, start);

    res.json({ algorithm: "BFS", start, visitedOrder });
});

// POST /api/traversal/dfs
// Body: { "start": "A", "edges": [{ "from": "A", "to": "B", "weight": 5 }, ...] }
// If no edges provided, a default sample graph is used.
router.post("/dfs", (req, res) => {
    const { start, edges } = req.body;

    if (!start) {
        return res.status(400).json({ message: "\"start\" node is required." });
    }

    const graph = new Graph();

    if (edges && Array.isArray(edges) && edges.length > 0) {
        edges.forEach(({ from, to, weight }) => {
            graph.addEdge(from, to, weight ?? 1);
        });
    } else {
        // Default sample graph (same nodes as /api/routes/find)
        graph.addEdge("A", "B", 5);
        graph.addEdge("A", "C", 8);
        graph.addEdge("B", "C", 3);
        graph.addEdge("B", "D", 6);
        graph.addEdge("C", "D", 4);
    }

    const graphData = graph.getGraph();

    if (!graphData[start]) {
        return res.status(400).json({ message: `Start node "${start}" not found in the graph.` });
    }

    const visitedOrder = dfs(graphData, start);

    res.json({ algorithm: "DFS", start, visitedOrder });
});

module.exports = router;
