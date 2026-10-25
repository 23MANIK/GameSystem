/**
 * manual-client.mjs — a stand-in for the Claude API where a person (or another
 * Claude) answers each call by hand. For testing the pipeline without an API key.
 *
 * Every call the pipeline makes is written to <dir>/<name>.request.md (system
 * prompt, messages and settings). If <dir>/<name>.answer.md exists, its text is
 * returned as the model's reply; if not, the call throws a ManualPending error
 * so the runner can stop and wait. Names come from a hash of the request, so
 * running the same step again finds the same answer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class ManualPending extends Error {
  constructor(files) {
    super(`Waiting for ${files.length} answer${files.length === 1 ? '' : 's'}.`);
    this.code = 'manual_pending';
    this.files = files;
  }
}

const systemText = s => (Array.isArray(s) ? s.map(b => b.text).join('\n') : String(s || ''));
const contentText = c => (typeof c === 'string' ? c : c.filter(b => b.type === 'text').map(b => b.text).join('\n'));

function label(req) {
  const sys = systemText(req.system);
  if (req.output_config?.format) return 'check';
  if (req.tools) return 'research';
  if (sys.includes('OUTLINE')) return req.messages.length > 1 ? `repair${(req.messages.length - 1) / 2}` : 'plan';
  const n = contentText(req.messages.at(-1).content).match(/details for level (\d+)/)?.[1];
  return n ? `details-L${n}` : 'call';
}

export function makeManualClient(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const pending = [];

  const answer = req => {
    const body = JSON.stringify({ model: req.model, system: systemText(req.system), messages: req.messages.map(m => [m.role, contentText(m.content)]) });
    const name = `${label(req)}-${createHash('sha256').update(body).digest('hex').slice(0, 8)}`;
    const reqFile = path.join(dir, `${name}.request.md`);
    const ansFile = path.join(dir, `${name}.answer.md`);
    if (!fs.existsSync(reqFile)) {
      const tools = req.tools ? `\nTools: ${req.tools.map(t => `${t.name} (max ${t.max_uses})`).join(', ')}` : '';
      const schema = req.output_config?.format ? `\nAnswer as JSON matching:\n\`\`\`json\n${JSON.stringify(req.output_config.format.schema)}\n\`\`\`` : '';
      fs.writeFileSync(reqFile, `# ${name}\n\nModel: ${req.model} · effort: ${req.output_config?.effort || '-'} · max_tokens: ${req.max_tokens}${tools}${schema}\n\n## System\n\n${systemText(req.system)}\n\n`
        + req.messages.map(m => `## ${m.role}\n\n${contentText(m.content)}`).join('\n\n') + '\n');
    }
    if (!fs.existsSync(ansFile)) {
      pending.push(ansFile);
      return null;
    }
    const text = fs.readFileSync(ansFile, 'utf8');
    return { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } };
  };

  const reply = async req => {
    const msg = answer(req);
    // Let parallel calls (one per level) all write their requests before stopping
    await new Promise(r => setTimeout(r, 0));
    if (!msg) throw new ManualPending([...pending]);
    return msg;
  };

  return {
    pending,
    messages: { create: reply },
    beta: { messages: { stream: req => ({ finalMessage: () => reply(req) }) } }
  };
}
