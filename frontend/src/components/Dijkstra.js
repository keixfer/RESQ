
const EARTH_RADIUS = 6371000;

export function haversineMeters(a, b) {
    const toRad = (degrees) => degrees * Math.PI / 180;

    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);

    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS *
        Math.asin(Math.sqrt(Math.min(1, h)));
}

function pointSegmentDistance(point, a, b) {
    const lat0 = point[0] * Math.PI / 180;
    const scaleX = 111320 * Math.cos(lat0);
    const scaleY = 110540;

    const px = point[1] * scaleX;
    const py = point[0] * scaleY;

    const ax = a[1] * scaleX;
    const ay = a[0] * scaleY;
    const bx = b[1] * scaleX;
    const by = b[0] * scaleY;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        return Math.hypot(px - ax, py - ay);
    }

    const t = Math.max(
        0,
        Math.min(
            1,
            ((px - ax) * dx + (py - ay) * dy) /
            lengthSquared
        )
    );

    return Math.hypot(
        px - (ax + t * dx),
        py - (ay + t * dy)
    );
}

export function buildRoadGraph(
    osmElements,
    hazards = [],
    hazardRadius = 1200
) {
    const nodes = new Map();
    const graph = new Map();
    const positions = new Map();

    const ways = osmElements.filter(
        (element) =>
            element.type === "way" &&
            element.nodes?.length > 1
    );

    for (const element of osmElements) {
        if (
            element.type === "node" &&
            Number.isFinite(element.lat) &&
            Number.isFinite(element.lon)
        ) {
            nodes.set(element.id, [
                element.lat,
                element.lon
            ]);
        }
    }

    let acceptedEdges = 0;
    let skippedHazardEdges = 0;

    function addEdge(from, to, weight) {
        if (!graph.has(from)) {
            graph.set(from, []);
        }

        graph.get(from).push({ to, weight });
    }

    for (const way of ways) {
        const tags = way.tags || {};

        if (
            tags.access === "no" ||
            tags.access === "private" ||
            tags.foot === "no"
        ) {
            continue;
        }

        const oneWay =
            tags.oneway === "yes" ||
            tags.junction === "roundabout";

        const reverseOnly = tags.oneway === "-1";

        for (let i = 0; i < way.nodes.length - 1; i++) {
            const idA = way.nodes[i];
            const idB = way.nodes[i + 1];

            const a = nodes.get(idA);
            const b = nodes.get(idB);

            if (!a || !b) continue;

            // Avoid road segments near reported hazard locations.
            const blocked = hazards.some(
                (hazard) =>
                    pointSegmentDistance(hazard, a, b) <=
                    hazardRadius
            );

            if (blocked) {
                skippedHazardEdges++;
                continue;
            }

            const distance = haversineMeters(a, b);

            if (distance <= 0) continue;

            positions.set(idA, a);
            positions.set(idB, b);

            addEdge(idA, idB, distance);

            if (!oneWay || reverseOnly) {
                addEdge(idB, idA, distance);
            }

            acceptedEdges++;
        }
    }

    return {
        graph,
        positions,
        acceptedEdges,
        skippedHazardEdges
    };
}

function closestNode(positions, target) {
    let closestId = null;
    let minimumDistance = Infinity;

    for (const [id, coords] of positions) {
        const distance = haversineMeters(coords, target);

        if (distance < minimumDistance) {
            minimumDistance = distance;
            closestId = id;
        }
    }

    if (closestId === null) return null;

    return {
        id: closestId,
        distance: minimumDistance
    };
}

export function dijkstraRoute(graph, startId, endId) {
    if (
        startId == null ||
        endId == null ||
        !graph.has(startId) ||
        !graph.has(endId)
    ) {
        return {
            path: [],
            distanceMeters: 0,
            reachable: false
        };
    }

    const distances = new Map([[startId, 0]]);
    const previous = new Map();
    const unvisited = new Set(graph.keys());

    while (unvisited.size > 0) {
        let current = null;
        let bestDistance = Infinity;

        for (const nodeId of unvisited) {
            const distance =
                distances.get(nodeId) ?? Infinity;

            if (distance < bestDistance) {
                bestDistance = distance;
                current = nodeId;
            }
        }

        if (current === null) break;
        if (current === endId) break;

        unvisited.delete(current);

        for (const edge of graph.get(current) || []) {
            if (!unvisited.has(edge.to)) continue;

            const newDistance =
                bestDistance + edge.weight;

            if (
                newDistance <
                (distances.get(edge.to) ?? Infinity)
            ) {
                distances.set(edge.to, newDistance);
                previous.set(edge.to, current);
            }
        }
    }

    if (!distances.has(endId)) {
        return {
            path: [],
            distanceMeters: 0,
            reachable: false
        };
    }

    const path = [];
    let current = endId;

    while (current !== undefined) {
        path.push(current);

        if (current === startId) break;

        current = previous.get(current);
    }

    path.reverse();

    return {
        path,
        distanceMeters: distances.get(endId),
        reachable: path[0] === startId
    };
}

export function findSafestRoadRoute(
    osmElements,
    start,
    end,
    hazards = [],
    hazardRadius = 1200
) {
    const {
        graph,
        positions,
        acceptedEdges,
        skippedHazardEdges
    } = buildRoadGraph(
        osmElements,
        hazards,
        hazardRadius
    );

    const nearestStart = closestNode(positions, start);
    const nearestEnd = closestNode(positions, end);

    if (!nearestStart || !nearestEnd) {
        return {
            reachable: false,
            path: [],
            coordinates: [],
            distanceMeters: 0,
            reason: "No usable road network found."
        };
    }

    const result = dijkstraRoute(
        graph,
        nearestStart.id,
        nearestEnd.id
    );

    const coordinates = result.path
        .map((id) => positions.get(id))
        .filter(Boolean);

    return {
        ...result,
        coordinates,
        snappedStart: positions.get(nearestStart.id),
        snappedEnd: positions.get(nearestEnd.id),
        snapStartMeters: nearestStart.distance,
        snapEndMeters: nearestEnd.distance,
        acceptedEdges,
        skippedHazardEdges,
        reason: result.reachable
            ? ""
            : "No route found that avoids the reported caution zones."
    };
}
