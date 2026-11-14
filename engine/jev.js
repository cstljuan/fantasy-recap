// The play caller's link to Jev (TypeSafe AI), a decision model: it gets a state and questions
// with fixed options and returns a probability for every option. It writes no text.
// The key is read from the environment or from .env at the repository root. It is never
// written to a file in the repository, and the app in the browser never calls this.
'use strict';
const fs = require('fs');
const path = require('path');

const URL_ = 'https://api.typesafe.ai/v1/systemone';

function key() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*TYPESAFE_API_KEY\s*=\s*"?([^"\s]+)"?\s*$/);
      if (m) return m[1];
    }
  }
  return '';
}

let calls = 0, inputTokens = 0;

// state: any JSON. questions: { name: { type: 'choice' | 'score' | 'noul', instructions, criteria } }
// Returns the `answers` object from Jev. Throws when there is no key or the call fails.
async function decide(state, questions, opts) {
  const k = key();
  if (!k) throw new Error('No TYPESAFE_API_KEY in the environment or in .env');
  const body = { model: (opts && opts.model) || 'jev-latest', state: state, questions: questions };
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(URL_, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 300);
        if (res.status === 429 || res.status >= 500) { lastErr = new Error('Jev ' + res.status + ': ' + text); await new Promise(r => setTimeout(r, 800 * (attempt + 1))); continue; }
        throw new Error('Jev ' + res.status + ': ' + text);
      }
      const json = await res.json();
      calls += 1; inputTokens += (json.usage && json.usage.input_tokens) || 0;
      return { answers: json.answers, model: json.model };
    } catch (err) {
      lastErr = err;
      if (String(err.message).startsWith('Jev 4')) throw err;
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

module.exports = { decide: decide, hasKey: function () { return !!key(); }, usage: function () { return { calls: calls, inputTokens: inputTokens }; } };
