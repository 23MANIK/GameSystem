/**
 * fake-client.mjs — a stand-in for the Claude API that "generates" the URL
 * Shortener, for tests and for trying the Create screen without an API key.
 *
 *   makeFakeClient({ delayMs, breakFirstPlan })
 *
 * breakFirstPlan: the first outline has a bad goal, so a repair round runs.
 */
import fs from 'node:fs';
import { splitPack } from './split.mjs';

const pack = JSON.parse(fs.readFileSync(new URL('./url-shortener.pack.json', import.meta.url), 'utf8'));

export function makeFakeClient({ delayMs = 0, breakFirstPlan = false } = {}) {
  const { outline, details } = splitPack(pack);
  const broken = JSON.parse(JSON.stringify(outline));
  broken.goals[2][1] = { type: 'teleport' };
  const plans = breakFirstPlan ? [broken, outline] : [outline];
  const stats = { detailCalls: 0, planCalls: 0 };
  const sleep = () => new Promise(r => setTimeout(r, delayMs));
  const usage = { input_tokens: 2000, output_tokens: 800 };
  const msg = (content) => ({ content, stop_reason: 'end_turn', usage });
  const text = t => msg([{ type: 'text', text: t }]);
  const json = x => text('```json\n' + JSON.stringify(x) + '\n```');
  return {
    stats,
    messages: {
      create: async () => { await sleep(); return text(JSON.stringify({ ok: true, reason: 'A classic design problem.', name: 'URL Shortener', likeWhat: 'like bit.ly', icon: '🔗', slug: 'url_shortener' })); }
    },
    beta: {
      messages: {
        stream: req => ({
          finalMessage: async () => {
            await sleep();
            if (req.tools) {
              return msg([
                { type: 'web_search_tool_result', content: [{ url: 'https://example.com/url-shortener', title: 'Example: designing a URL shortener' }] },
                { type: 'text', text: 'Stand-in research notes. '.repeat(30) + ' https://example.com/url-shortener' }
              ]);
            }
            if (req.system[0].text.includes('OUTLINE')) {
              stats.planCalls += 1;
              return json(plans.length > 1 ? plans.shift() : plans[0]);
            }
            stats.detailCalls += 1;
            const n = Number(req.messages[0].content.match(/details for level (\d+)/)[1]);
            return json(details.find(d => d.level === n));
          }
        })
      }
    }
  };
}
