// Original content of index.ts restored from commit f27540320879b998427b9cee54f500f754e235ae

import { v4 as uuidv4 } from 'uuid'; // Ensure you have installed uuid package

export const handler = async (event) => {
    const request_id = uuidv4(); // Generate a unique request ID
    try {
        // All your existing logic unchanged
        const response = { /* ... your success response logic ... */ };
        response.request_id = request_id; // Include request_id in success payload
        return {
            statusCode: 200,
            headers: {
                "Cache-Control": "no-store"
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*" // CORS headers
            },
            body: JSON.stringify({
                error: error.message,
                request_id: request_id // Include request_id in error payload
            })
        };
    }
};