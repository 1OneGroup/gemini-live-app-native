const db = require('./db');
const store = require('./call-store');

const CAMPAIGN_ID = 'abd405b7-aa5d-4897-ae2b-3c1579d6b0fd';
const BATCH = 1;
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function main() {
  // Delete old analysis
  db.db.prepare('DELETE FROM batch_analyses WHERE campaign_id = ? AND batch_number = ?').run(CAMPAIGN_ID, BATCH);
  console.log('Deleted stale batch 1 analysis');

  // Get corrected stats and contacts
  const batchStats = db.getBatchStats(CAMPAIGN_ID, BATCH);
  console.log('Corrected batch stats:', JSON.stringify(batchStats));

  const contacts = db.getContacts(CAMPAIGN_ID, { batchNumber: BATCH, limit: 200 });

  // Collect transcripts
  const transcripts = [];
  for (const contact of contacts) {
    if (contact.call_uuid) {
      const call = store.getCall(contact.call_uuid);
      if (call?.transcript?.length > 0) {
        transcripts.push({
          name: contact.name || 'Unknown',
          phone: contact.phone,
          outcome: contact.outcome,
          duration: call.duration,
          transcript: call.transcript.map(t => `${t.role}: ${t.text}`).join('\n'),
        });
      }
    }
  }

  console.log(`Found ${transcripts.length} transcripts`);

  const prompt = `You are an AI telecalling campaign analyst. Analyze the following batch of cold calls for a real estate project.

## Campaign: Mohali Disqualified Leads 03.04.26
## Batch 1 Results (CORRECTED — outcomes were re-classified after fixing voicemail/no-conversation detection)

### Stats
- Total calls: ${batchStats.total}
- Completed: ${batchStats.completed}
- Failed: ${batchStats.failed}
- Interested: ${batchStats.interested}
- Not interested: ${batchStats.not_interested}
- Callbacks: ${batchStats.callback}
- No answer: ${batchStats.no_answer}
- Busy: ${batchStats.busy}
- Brochure requests: ${batchStats.brochure_sent}

### Key Context
- These are "disqualified" leads — previously contacted people who didn't convert.
- 90% no-answer rate is expected for this lead quality tier.
- Of the ~10 people who actually answered, 6 showed genuine interest (60% of answered calls).
- The AI agent is "Ritu" calling about The Clermont (3BHK floors, Sector 98, Mohali, starting Rs 1.60 Cr).

### Call Transcripts (${transcripts.length} available, showing top 20)
${transcripts.slice(0, 20).map((t, i) => `
--- Call ${i + 1}: ${t.name} (${t.outcome}, ${t.duration}s) ---
${t.transcript}
`).join('\n')}

## Your Analysis

Provide:
1. **Summary**: 2-3 sentence overview of batch performance
2. **Key Patterns**: What objections are most common? What's working in the pitch? What fails?
3. **Recommendations**: Specific, actionable improvements for the next batch's prompt
4. **Prompt Adjustments**: Concrete changes to the system instruction that would improve outcomes

Format as JSON:
{
  "summary": "...",
  "recommendations": "...",
  "prompt_adjustments": "..."
}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let analysis = { summary: text, recommendations: '', prompt_adjustments: '' };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis = {
        summary: parsed.summary || text,
        recommendations: parsed.recommendations || '',
        prompt_adjustments: parsed.prompt_adjustments || ''
      };
    }
  } catch { /* Use raw text */ }

  const activePrompt = db.getActivePrompt();
  db.createAnalysis(CAMPAIGN_ID, BATCH, {
    summary: analysis.summary,
    recommendations: analysis.recommendations,
    promptAdjustments: analysis.prompt_adjustments,
    stats: batchStats,
    promptId: activePrompt?.id || null,
  });

  console.log('\n=== NEW ANALYSIS ===');
  console.log('Summary:', analysis.summary);
  console.log('\nRecommendations:', analysis.recommendations);
  console.log('\nPrompt Adjustments:', analysis.prompt_adjustments);
  console.log('\nPrompt ID:', activePrompt?.id);
}

main().catch(e => console.error(e));
