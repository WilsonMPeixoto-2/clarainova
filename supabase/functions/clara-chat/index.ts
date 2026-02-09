// Import crypto for UUID generation
import { randomUUID } from 'crypto';

// Response function for success and error payloads
const createResponse = (data, request_id, isSuccess = true) => {
    const { answer, provider, sources, metrics } = data;
    return { answer, provider, sources, metrics, request_id };
};

// CORS handling for OPTIONS requests
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.sendStatus(204);
});

app.get('/endpoint', (req, res) => {
    const request_id = randomUUID();
    // Your handler logic here
    const successData = { answer: '...', provider: '...', sources: '...', metrics: '...' };
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.header('Cache-Control', 'no-store');
    res.status(200).json(createResponse(successData, request_id));
});

app.get('/error-endpoint', (req, res) => {
    const request_id = randomUUID();
    // Your error handling logic here
    const errorData = { answer: '...', provider: '...', sources: '...', metrics: '...' };
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.header('Cache-Control', 'no-store');
    res.status(500).json(createResponse(errorData, request_id, false));
});
