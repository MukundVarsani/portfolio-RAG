import express from 'express';
import cors from 'cors';
import { ingestData, deleteAllDataFromIndex } from './injest_data.js';
import { ask } from './ask.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// CORS Middleware
app.use(cors({
    origin: true, // Reflects the request origin, allowing any origin
    credentials: true, // Allows sending cookies and authorization headers
}));

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// 1. Ingest Data
app.post('/api/ingest', async (req, res) => {
    try {
        await ingestData();
        res.status(200).json({ message: 'Data successfully ingested to Pinecone.' });
    } catch (error) {
        console.error('Error during ingestion:', error);
        res.status(500).json({ error: 'Failed to ingest data.', details: error.message });
    }
});

// 2. Delete All Data
app.delete('/api/delete', async (req, res) => {
    try {
        await deleteAllDataFromIndex();
        res.status(200).json({ message: 'All data successfully deleted from Pinecone index.' });
    } catch (error) {
        console.error('Error during deletion:', error);
        res.status(500).json({ error: 'Failed to delete data.', details: error.message });
    }
});

// 3. Ask Question
app.post('/api/ask', async (req, res) => {

    // curl -X POST http://localhost:3000/api/ask \
    //  -H "Content-Type: application/json" \
    //  -d '{"question": "What is your name?"}'

    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string') {
            return res.status(400).json({ error: 'Please provide a valid question in the request body.' });
        }

        const answer = await ask(question);

        if (!answer) {
            return res.status(404).json({ error: 'No relevant context found to answer the question.' });
        }

        res.status(200).json({ answer });
    } catch (error) {
        console.error('Error during ask:', error);
        res.status(500).json({ error: 'Failed to answer the question.', details: error.message });
    }
});

app.get('/', async (req, res) => {
    res.json({ message: "Hello World" });
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    // await ingestData();
    // await deleteAllDataFromIndex();
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
