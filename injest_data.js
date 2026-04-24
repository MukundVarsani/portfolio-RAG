import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Pinecone } from '@pinecone-database/pinecone';
import 'dotenv/config';
 
// ─────────────────────────────────────────────────────────────
// 1. Pinecone Init
// ─────────────────────────────────────────────────────────────
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);
 
// ─────────────────────────────────────────────────────────────
// 2. ID Generator
// ─────────────────────────────────────────────────────────────
function makeId(candidate, category, subcategory, label = '') {
    const base = `${candidate}__${category}__${subcategory}`
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    const suffix = label
        ? '__' + label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)
        : '';
    return base + suffix;
}
 
// ─────────────────────────────────────────────────────────────
// 3. Text Builders
// ─────────────────────────────────────────────────────────────
 
function buildPersonalInfoText(d) {
    return `
Personal Info — ${d.full_name}
Title: ${d.title}
Location: ${d.location}
Email: ${d.email} | Mobile: ${d.mobile}
Preferred Roles: ${d.preferred_roles?.join(', ')}
Open to Remote: ${d.open_to_remote ? 'Yes' : 'No'}
Availability: ${d.availability}
 
Objective:
${d.objective}
 
Personality:
${d.personality}
`.trim();
}
 
function buildSkillText(s) {
    return `
Skill: ${s.name}
Category: ${s.subcategory}
Proficiency: ${s.proficiency || 'N/A'}
Years of Experience: ${s.years_of_experience || 'N/A'}
 
About this skill:
${s.context}
`.trim();
}
 
function buildEducationText(e) {
    return `
Education: ${e.degree}
Institution: ${e.institution}, ${e.location}
Duration: ${e.duration}
${e.cgpa ? `CGPA: ${e.cgpa}` : `Percentage: ${e.percentage}`}
 
Story:
${e.story}
 
${e.key_learnings ? `Key Learnings:\n${e.key_learnings}` : ''}
`.trim();
}
 
function buildExperienceText(e) {
    return `
Experience: ${e.role} at ${e.company}
Type: ${e.type}
Location: ${e.location}
Duration: ${e.duration}
 
Summary:
${e.summary}
 
Work Story:
${e.work_story}
 
Responsibilities:
${e.responsibilities?.map(r => `- ${r}`).join('\n')}
 
Challenges Faced:
${e.challenges_faced}
 
How I Solved It:
${e.how_i_solved_it}
 
What I Learned:
${e.what_i_learned}
`.trim();
}
 
function buildProjectText(p) {
    const links = p.links ? `
App Store: ${p.links.app_store || 'N/A'}
Play Store: ${p.links.play_store || 'N/A'}
GitHub: ${p.links.github || 'N/A'}
Live URL: ${p.links.live_url || 'N/A'}
`.trim() : '';
 
    return `
Project: ${p.name}
Type: ${p.type}
Tech Stack: ${p.tech_stack?.join(', ')}
Platform: ${p.platform?.join(', ')}
Duration: ${p.duration}
Published: ${p.published ? `Yes — ${p.stores?.join(', ')}` : 'No'}
 
Links:
${links}
 
What It Is:
${p.what_it_is}
 
Why I Built It:
${p.why_i_built_it}
 
Story:
${p.story || ''}
 
Tech Decisions:
${p.tech_decisions || ''}
 
Problems Faced:
${p.problems_faced}
 
How I Solved It:
${p.how_i_solved_it}
 
What I Learned:
${p.what_i_learned}
 
${p.architecture   ? `Architecture:\n${p.architecture}`   : ''}
${p.mentoring      ? `Mentoring:\n${p.mentoring}`         : ''}
${p.current_status ? `Current Status:\n${p.current_status}` : ''}
`.trim();
}
 
// ── Dedicated links-only text for a project ──────────────────
function buildProjectLinksText(p) {
    const l = p.links || {};
    return `
Project Links — ${p.name}
Type: ${p.type}
Published: Yes — ${p.stores?.join(', ')}
 
App Store Link: ${l.app_store || 'N/A'}
Play Store Link: ${l.play_store || 'N/A'}
GitHub Link: ${l.github || 'N/A'}
Live URL: ${l.live_url || 'N/A'}
`.trim();
}
 
// ── Combined all-published-apps links summary ─────────────────
function buildAllLinksText(projects, candidate) {
    const published = projects.filter(p => p.published && p.links);
    const lines = published.map(p => {
        const l = p.links;
        return `${p.name} (${p.type}):
  App Store:  ${l.app_store  || 'N/A'}
  Play Store: ${l.play_store || 'N/A'}
  GitHub:     ${l.github     || 'N/A'}
  Live URL:   ${l.live_url   || 'N/A'}`;
    }).join('\n\n');
 
    return `All Published App Links for ${candidate}:\n\n${lines}`;
}
 
function buildFeatureProjectText(p) {
    return `
Feature Project: ${p.name}
Tech Stack: ${p.tech_stack?.join(', ')}
Category: ${p.subcategory}
 
What It Is:
${p.what_it_is}
 
Story:
${p.story}
 
Problem:
${p.problem}
 
Solution:
${p.solution}
 
What I Learned:
${p.what_i_learned}
 
${p.current_status ? `Current Status:\n${p.current_status}` : ''}
`.trim();
}
 
function buildSelfLearningText(p) {
    return `
Self Learning Project: ${p.name}
Tech Stack: ${p.tech_stack?.join(', ')}
 
What It Is:
${p.what_it_is}
 
Story:
${p.story}
 
What I Learned:
${p.what_i_learned}
`.trim();
}
 
function buildCertificationText(c) {
    return `
Certification: ${c.name}
Platform: ${c.platform || 'N/A'}
Year: ${c.year || 'N/A'}
 
What I Learned:
${c.what_i_learned}
`.trim();
}
 
function buildSoftSkillsText(d) {
    const stories = Object.entries(d.stories || {})
        .map(([skill, story]) => `${skill.replace(/_/g, ' ')}:\n${story}`)
        .join('\n\n');
    return `
Soft Skills: ${d.skills?.join(', ')}
 
Stories & Examples:
${stories}
`.trim();
}
 
// ─────────────────────────────────────────────────────────────
// 4. Master Record Builder
// ─────────────────────────────────────────────────────────────
function buildAllRecords(kb) {
    const candidate = kb.meta.candidate;
    const updated = kb.meta.last_updated;
    const records = [];
 
    // ── PERSONAL INFO ──────────────────────────────────────
    const pi = kb.personal_info;
    records.push({
        id: makeId(candidate, pi.category, pi.subcategory, 'main'),
        text: buildPersonalInfoText(pi),
        candidate, category: pi.category, subcategory: pi.subcategory,
        label: 'Personal Info', last_updated: updated,
    });
 
    // ── SKILLS ─────────────────────────────────────────────
    for (const skill of kb.skills) {
        records.push({
            id: makeId(candidate, skill.category, skill.subcategory, skill.name),
            text: buildSkillText(skill),
            candidate, category: skill.category, subcategory: skill.subcategory,
            label: skill.name, proficiency: skill.proficiency || '', last_updated: updated,
        });
    }
    const allSkillsSummary = kb.skills
        .map(s => `${s.name} (${s.proficiency || 'N/A'}): ${s.context}`)
        .join('\n\n');
    records.push({
        id: makeId(candidate, 'skills', 'all', 'summary'),
        text: `All Skills Summary for ${candidate}:\n\n${allSkillsSummary}`,
        candidate, category: 'skills', subcategory: 'all',
        label: 'All Skills Summary', last_updated: updated,
    });
 
    // ── EDUCATION ──────────────────────────────────────────
    for (const edu of kb.education) {
        records.push({
            id: makeId(candidate, edu.category, edu.subcategory, edu.institution),
            text: buildEducationText(edu),
            candidate, category: edu.category, subcategory: edu.subcategory,
            label: edu.institution, last_updated: updated,
        });
    }
 
    // ── EXPERIENCE ─────────────────────────────────────────
    for (const exp of kb.experience) {
        records.push({
            id: makeId(candidate, exp.category, exp.subcategory, `${exp.role}_${exp.company}`),
            text: buildExperienceText(exp),
            candidate, category: exp.category, subcategory: exp.subcategory,
            label: `${exp.role} at ${exp.company}`, type: exp.type, last_updated: updated,
        });
    }
 
    // ── PROJECTS ───────────────────────────────────────────
    for (const project of kb.projects) {
        // Main full project record
        records.push({
            id: makeId(candidate, project.category, project.subcategory, project.name),
            text: buildProjectText(project),
            candidate, category: project.category, subcategory: project.subcategory,
            label: project.name, type: project.type,
            tech_stack: project.tech_stack?.join(', '),
            published: project.published ? 'true' : 'false',
            last_updated: updated,
        });
 
        // Dedicated links-only record per published project
        if (project.published && project.links) {
            records.push({
                id: makeId(candidate, 'project_links', project.type, project.name),
                text: buildProjectLinksText(project),
                candidate,
                category: 'project_links',
                subcategory: project.type,
                label: `${project.name} links`,
                published: 'true',
                last_updated: updated,
            });
        }
    }
 
    // All-projects summary
    const allProjectsSummary = kb.projects
        .map(p => `${p.name} (${p.type}): ${p.what_it_is}`)
        .join('\n\n');
    records.push({
        id: makeId(candidate, 'projects', 'all', 'summary'),
        text: `All Projects Summary for ${candidate}:\n\n${allProjectsSummary}`,
        candidate, category: 'projects', subcategory: 'all',
        label: 'All Projects Summary', last_updated: updated,
    });
 
    // ONE combined record with every published app's links — most important for broad link queries
    records.push({
        id: makeId(candidate, 'project_links', 'all', 'summary'),
        text: buildAllLinksText(kb.projects, candidate),
        candidate,
        category: 'project_links',
        subcategory: 'all',
        label: 'All Published App Links',
        last_updated: updated,
    });
 
    // ── FEATURE PROJECTS ───────────────────────────────────
    for (const fp of kb.feature_projects) {
        records.push({
            id: makeId(candidate, fp.category, fp.subcategory, fp.name),
            text: buildFeatureProjectText(fp),
            candidate, category: fp.category, subcategory: fp.subcategory,
            label: fp.name, tech_stack: fp.tech_stack?.join(', '), last_updated: updated,
        });
    }
    const allFeatureSummary = kb.feature_projects
        .map(p => `${p.name}: ${p.what_it_is}`)
        .join('\n\n');
    records.push({
        id: makeId(candidate, 'feature_projects', 'all', 'summary'),
        text: `All Feature Projects Summary for ${candidate}:\n\n${allFeatureSummary}`,
        candidate, category: 'feature_projects', subcategory: 'all',
        label: 'All Feature Projects Summary', last_updated: updated,
    });
 
    // ── SELF LEARNING PROJECTS ─────────────────────────────
    for (const slp of kb.self_learning_projects) {
        records.push({
            id: makeId(candidate, slp.category, slp.subcategory, slp.name),
            text: buildSelfLearningText(slp),
            candidate, category: slp.category, subcategory: slp.subcategory,
            label: slp.name, tech_stack: slp.tech_stack?.join(', '), last_updated: updated,
        });
    }
 
    // ── CERTIFICATIONS ─────────────────────────────────────
    for (const cert of kb.certifications) {
        records.push({
            id: makeId(candidate, cert.category, cert.subcategory, cert.name),
            text: buildCertificationText(cert),
            candidate, category: cert.category, subcategory: cert.subcategory,
            label: cert.name, last_updated: updated,
        });
    }
 
    // ── SOFT SKILLS ────────────────────────────────────────
    const ss = kb.soft_skills;
    records.push({
        id: makeId(candidate, ss.category, ss.subcategory, 'main'),
        text: buildSoftSkillsText(ss),
        candidate, category: ss.category, subcategory: ss.subcategory,
        label: 'Soft Skills', last_updated: updated,
    });
 
    return records;
}
 
// ─────────────────────────────────────────────────────────────
// 5. Upsert in batches
// ─────────────────────────────────────────────────────────────
async function upsertInBatches(records, batchSize = 50) {
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await index.upsertRecords({ records: batch });
        console.log(`  ✅ Batch ${Math.floor(i / batchSize) + 1} — ${batch.length} records upserted`);
    }
}
 
// ─────────────────────────────────────────────────────────────
// 6. Main
// ─────────────────────────────────────────────────────────────
async function run() {
    const KB_PATH = './data.json';
 
    if (!existsSync(KB_PATH)) {
        console.error(`❌ Cannot find ${KB_PATH}. Make sure it's in the same folder.`);
        return;
    }
 
    console.log('📖 Reading data.json...');
    const raw = await readFile(KB_PATH, 'utf-8');
    const kb = JSON.parse(raw);
 
    console.log(`\n🧩 Building records for: ${kb.meta.candidate}`);
    const records = buildAllRecords(kb);
 
    console.log(`\nBuilt ${records.length} records:`);
    records.forEach(r => console.log(`  [${r.category} > ${r.subcategory}] — ${r.label}`));
 
    console.log(`\n📤 Upserting to Pinecone index: ${process.env.PINECONE_INDEX_NAME}...`);
    await upsertInBatches(records);
 
    console.log(`\n🎉 Done! ${records.length} records stored for ${kb.meta.candidate}.`);
}
 
async function deleteAllDataFromIndex(params) {
    await index.deleteAll();
    console.log(`\n🎉 Done! Deleted all data from index: ${process.env.PINECONE_INDEX_NAME}.`);
}

// Run the script
run().catch(console.error);
// deleteAllDataFromIndex().catch(console.error); 