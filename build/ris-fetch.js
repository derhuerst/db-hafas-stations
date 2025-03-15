'use strict'

import fs from 'node:fs';
import {join as pathJoin} from 'node:path'
import {stringify} from 'qs'
import {TMP_PATH, STADA_FILE} from './util.js';

const BBOX = { // should be approx. quadratic
    north: 70.0,
    west: -10.0,
    south: 35.0,
    east: 40.0,
}

const LIMIT_RESULTS = 10000; // maximum number of results allowed by RIS::Stations
const PADDING_RATIO = 1.1;
const MAX_DEPTH = 8;
const MAX_REQUESTS = 1000;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const requestJson = async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) {
        const err = new Error(`Failed to fetch from API: ${response.status}`);
        err.url = url;
        err.fetchOptions = options;
        err.response = response;
        throw err;
    }
    return await response.json();
}

const doRisStationsRequest = async (latitude, longitude, radius, groupBy) => {
    const query = {
        latitude,
        longitude,
        radius,
        groupBy,
        onlyActive: false,
        limit: LIMIT_RESULTS
    }
    const options = {
        headers: {
            'DB-Client-Id': process.env.DB_CLIENT_ID,
            'DB-Api-Key': process.env.DB_API_KEY,
        },
    };
    const url = 'https://apis.deutschebahn.com/db-api-marketplace/apis/ris-stations/v1/stop-places/by-position?' + stringify(query);
    return await requestJson(url, options);
}

const fetchRisStationsInRadius = async (depth, bbox, center, radius, grouped) => {
    const fileName = pathJoin(TMP_PATH, depth + '_' + Object.values(bbox).join('_') + (grouped ? '_grouped' : '_single') + '.json');
    const result = await doRisStationsRequest(center.lat, center.lon, radius, grouped ? 'SALES' : 'NONE');
    await fs.promises.writeFile(fileName, JSON.stringify(result));
    console.error(result.stopPlaces.length, 'stopPlaces found');
    return result;
}

const doStadaRequest = async () => {
    const options = {
        headers: {
            'DB-Client-Id': process.env.DB_CLIENT_ID,
            'DB-Api-Key': process.env.DB_API_KEY,
            'Accept': 'application/json'
        },
    };
    const url = 'https://apis.deutschebahn.com/db-api-marketplace/apis/station-data/v2/stations';
    return requestJson(url, options);
}

const geodistMeters = (lat1, lon1, lat2, lon2) => {
    const l1 = lat1 * Math.PI / 180, l2 = lat2 * Math.PI / 180, delta = (lon2 - lon1) * Math.PI / 180, R = 6371e3;
    return Math.acos(Math.sin(l1) * Math.sin(l2) + Math.cos(l1) * Math.cos(l2) * Math.cos(delta)) * R;
}

const halfBboxSize = (bbox) => {
    const halfX = (bbox.east - bbox.west) / 2;
    const halfY = (bbox.north - bbox.south) / 2;
    return [halfX, halfY];
}

const centerOfBbox = (bbox) => {
    const [halfX, halfY] = halfBboxSize(bbox);
    return {
        lat: halfY + bbox.south,
        lon: halfX + bbox.west
    }
}

const quarterBbox = (bbox, quadrant) => {
    const [halfX, halfY] = halfBboxSize(bbox);
    return {
        north: bbox.north - Math.floor(quadrant / 2) * halfY,
        west: bbox.west + (quadrant % 2) * halfX,
        south: bbox.south + (1 - Math.floor(quadrant / 2)) * halfY,
        east: bbox.east - (1 - (quadrant % 2)) * halfX,
    }
}

const discoverRisStations = async (bbox, depth, num_requests) => {
    if (depth > MAX_DEPTH) {
        const err = new Error('Emerg: Max depth reached');
        err.bbox = bbox;
        err.depth = depth;
        throw err;
    }
    await sleep(5000 * Math.random());

    const center = centerOfBbox(bbox);
    const radius = Math.round(geodistMeters(center.lat, center.lon, bbox.south, bbox.east) * PADDING_RATIO);
    const dx = geodistMeters(center.lat, center.lon, center.lat, bbox.east), dy = geodistMeters(center.lat, center.lon, bbox.south, center.lon);
    console.error('Descending to depth', depth, 'with bbox', bbox, 'and radius', radius, 'and center', center.lat, center.lon, 'and ratio', dx, dy, dx / dy);

    const single = await fetchRisStationsInRadius(depth, bbox, center, radius, false);
    num_requests += 1;

    if (single.stopPlaces.length < LIMIT_RESULTS) {
        // fetch station groups (we need both single and grouped because in grouped, details of group children are not contained)
        await fetchRisStationsInRadius(depth, bbox, center, radius, true);
        num_requests += 1;
    } else {
        for (let i = 0; i < 4; i++) {
            num_requests = await discoverRisStations(quarterBbox(bbox, i), depth + 1, num_requests);

            if (num_requests > MAX_REQUESTS) {
                throw new Error('Emerg: Max requests reached: ' + num_requests);
            }
        }
    }
    console.error('Total requests so far', num_requests);
    return num_requests;
}

const discoverStadaStations = async () => {
    console.error('Fetching Stada...');
    const stada = await doStadaRequest();
    await fs.promises.writeFile(pathJoin(TMP_PATH, STADA_FILE), JSON.stringify(stada));
}

const run = async () => {
    console.error('Ensuring', TMP_PATH, 'does not exist yet...');
    await fs.promises.mkdir(TMP_PATH);
    await discoverStadaStations();
    await discoverRisStations(BBOX, 0, 0);
    console.error('Discovering done.');
}

await run();
