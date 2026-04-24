import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ─────────────────────────────────────────────────────────────
// 1. Init
// ─────────────────────────────────────────────────────────────
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CANDIDATE = 'Mukund Varsani';

// ─────────────────────────────────────────────────────────────
// 2. Intent Detector
//    IMPORTANT: order matters — more specific checks first.
// ─────────────────────────────────────────────────────────────
function detectIntent(query) {
    const q = query.toLowerCase();

    // ── LINKS — always check first ────────────────────────
    // Any question about links, URLs, store pages, downloads
    if (/link|url|app store|play store|download|where.*find|where.*download|published.*app|store.*link|github.*link/i.test(q)) {
        return { category: 'project_links', subcategory: null };
    }

    // ── FEATURE PROJECTS ──────────────────────────────────
    if (/browser|url extrac|dll|vbs|task scheduler|auto.?restart|tracker|brick|image sim|poc|native integr|windows script|c#/i.test(q)) {
        return { category: 'feature_projects', subcategory: null };
    }

    // ── SELF LEARNING PROJECTS ────────────────────────────
    if (/instagram|haptic|vibrat|n8n|automation|self.?learn/i.test(q)) {
        return { category: 'self_learning_projects', subcategory: null };
    }

    // ── PROJECTS ──────────────────────────────────────────
    if (/project|built|made|developed|app|clone|capsule|chat|go\s*meds|dare|fiverr|health app|future capsule|vitacoach/i.test(q)) {
        if (/professional|client|company|binstellar/i.test(q)) return { category: 'projects', subcategory: 'professional' };
        if (/personal|side|own/i.test(q))                      return { category: 'projects', subcategory: 'personal' };
        if (/learn|practice|clone|tutorial/i.test(q))          return { category: 'projects', subcategory: 'learning' };
        return { category: 'projects', subcategory: null };
    }

    // ── EXPERIENCE ────────────────────────────────────────
    if (/experience|work|job|intern|company|binstellar|role|healthkit|health connect|passio|in.?app purchase/i.test(q)) {
        if (/intern/i.test(q))              return { category: 'experience', subcategory: 'internship' };
        if (/full.?time|job|employed/i.test(q)) return { category: 'experience', subcategory: 'full_time' };
        return { category: 'experience', subcategory: null };
    }

    // ── SKILLS ────────────────────────────────────────────
    if (/skill|tech|know|flutter|dart|node|react|firebase|bloc|getx|language|framework|tool|database|pinecone|rag|llm|ai|vector|n8n|healthkit|health connect|passio|in.?app/i.test(q)) {
        if (/language/i.test(q))                         return { category: 'skills', subcategory: 'languages' };
        if (/framework|library|state/i.test(q))          return { category: 'skills', subcategory: 'frameworks_and_libraries' };
        if (/database|db|mongo|firebase|pinecone/i.test(q)) return { category: 'skills', subcategory: 'databases' };
        if (/tool|ide|git|vscode/i.test(q))              return { category: 'skills', subcategory: 'dev_tools' };
        if (/ai|llm|rag|automation|n8n|vector/i.test(q)) return { category: 'skills', subcategory: 'ai_and_automation' };
        if (/healthkit|health connect|passio|in.?app|platform/i.test(q)) return { category: 'skills', subcategory: 'platform_integrations' };
        return { category: 'skills', subcategory: null };
    }

    // ── EDUCATION ─────────────────────────────────────────
    if (/education|study|degree|university|college|cgpa|grade|academic/i.test(q)) {
        return { category: 'education', subcategory: null };
    }

    // ── PERSONAL INFO ─────────────────────────────────────
    if (/contact|email|phone|location|available|hire|remote|role|objective|about|who is|introduce/i.test(q)) {
        return { category: 'personal_info', subcategory: null };
    }

    // ── SOFT SKILLS ───────────────────────────────────────
    if (/soft|teamwork|leadership|communication|adaptab|problem.solv|fast learn|ownership/i.test(q)) {
        return { category: 'soft_skills', subcategory: null };
    }

    // ── CERTIFICATIONS ────────────────────────────────────
    if (/certif|course|mern/i.test(q)) {
        return { category: 'certifications', subcategory: null };
    }

    // No specific intent — broad search, no filter
    return { category: null, subcategory: null };
}

// ─────────────────────────────────────────────────────────────
// 3. Build Pinecone Filter
// ─────────────────────────────────────────────────────────────
function buildFilter(intent) {
    const filter = { candidate: CANDIDATE };
    if (intent.category)    filter.category    = intent.category;
    if (intent.subcategory) filter.subcategory = intent.subcategory;
    return filter;
}

// ─────────────────────────────────────────────────────────────
// 4. Two-pass Retrieval
//    Pass 1: filtered search (precise)
//    Pass 2: wider fallback if pass 1 returns < 2 hits
// ─────────────────────────────────────────────────────────────
async function retrieve(userQuery) {
    const intent = detectIntent(userQuery);
    console.log(`\n🔍 Intent detected:`, intent);

    const filter = buildFilter(intent);
    console.log(`   Filter:`, filter);

    let hits = [];

    // Pass 1 — filtered
    try {
        const result = await index.searchRecords({
            query: { inputs: { text: userQuery }, topK: 8 },
            filter,
            fields: ['text', 'category', 'subcategory', 'label', 'type'],
        });
        hits = result.result?.hits || result.hits || [];
    } catch (err) {
        console.error('Search error (pass 1):', err);
    }

    // Pass 2 — fallback: drop subcategory filter
    if (hits.length < 2 && intent.subcategory) {
        console.log('   ⚠️  Low results — running broad fallback...');
        try {
            const fallback = await index.searchRecords({
                query: { inputs: { text: userQuery }, topK: 8 },
                filter: { candidate: CANDIDATE, ...(intent.category ? { category: intent.category } : {}) },
                fields: ['text', 'category', 'subcategory', 'label', 'type'],
            });
            hits = fallback.result?.hits || fallback.hits || [];
        } catch (err) {
            console.error('Search error (pass 2):', err);
        }
    }

    console.log(`   Retrieved ${hits.length} chunks:`);
    hits.forEach(h => console.log(`     → [${h.fields?.category} > ${h.fields?.subcategory}] ${h.fields?.label}`));

    return hits.map(h => h.fields?.text || '').filter(Boolean).join('\n\n---\n\n');
}

// ─────────────────────────────────────────────────────────────
// 5. Generation
// ─────────────────────────────────────────────────────────────
async function generate(userQuestion, context) {
    const prompt = `
You are an AI assistant answering questions about ${CANDIDATE} based strictly on the provided context.

Rules:
- Use ONLY the provided context. Do not make up or assume any information.
- If the question asks to list items (projects, skills, links), list ALL of them found in the context — do not omit any.
- If a link value is "N/A" it means it is not available — say so clearly.
- If the answer is not in the context, say: "I don't have enough information to answer that."
- Be concise, direct, and factual.
- Answer in first person as if you are ${CANDIDATE} unless the question is clearly third-person.

CONTEXT:
${context}

QUESTION:
${userQuestion}

ANSWER:
`.trim();

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return response.text;
}

// ─────────────────────────────────────────────────────────────
// 6. Main Ask Function
// ─────────────────────────────────────────────────────────────
async function ask(userQuestion) {

    console.log(`\n❓ Question: "${userQuestion}"`);
    
    const context = await retrieve(userQuestion);
    
    if (!context) {
        console.log('\n⚠️  No relevant context found.');
        return;
    }
    
    console.log('\n🤖 Generating answer...');
    const answer = await generate(userQuestion, context);
    
    // console.log('\n════════════════════════════════');
    // console.log(answer);
    return `Answer for: ${answer}`;
    // console.log('════════════════════════════════\n');
}

// ─────────────────────────────────────────────────────────────
// Test Queries
// ─────────────────────────────────────────────────────────────
// await ask("give all links of apps published in any store");
// await ask("give link of all production apps for app and play store");
// await ask("give all play store links");
// await ask("What projects did Mukund build?");
// await ask("Tell me about the brick image similarity POC");
// await ask("What problem did Mukund face in Future Capsule?");
// await ask("What AI skills does Mukund have?");
// await ask("Tell me about Mukund's internship");
// await ask("Is Mukund open to remote work?");

// Export for API usage
export { ask };