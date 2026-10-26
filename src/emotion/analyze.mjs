const LEXICON = {
  joy: ['សប្បាយចិត្ត', 'សប្បាយ', 'រីករាយ', 'ត្រេកអរ', 'ពេញចិត្ត', 'ល្អណាស់', 'អរគុណ', 'សើច', 'ជោគជ័យ', 'ឡូយ', '😀', '😊', '😄', '😁'],
  sadness: ['ស្រងូតស្រងាត់', 'សោកសៅ', 'ក្រៀមក្រំ', 'កើតទុក្ខ', 'ឈឺចាប់', 'អផ្សុក', 'សោកស្ដាយ', 'សោកស្តាយ', 'ឯកកោ', 'ខកចិត្ត', 'ទុក្ខ', 'យំ', '😢', '😭'],
  anger: ['មិនពេញចិត្ត', 'ឆ្អេះឆ្អន់', 'ឆេវឆាវ', 'ខឹង', 'ក្រោធ', 'ស្អប់', 'ឆ្កួត', '😡', '😠'],
  fear: ['តក់ស្លុត', 'ព្រួយបារម្ភ', 'បារម្ភ', 'ខ្លាច', 'ភ័យ', 'ញ័រ', '😨', '😱'],
  love: ['នឹករលឹក', 'ស្រឡាញ់', 'ស្រលាញ់', 'ចូលចិត្ត', '❤', '😍', '🥰'],
  surprise: ['ភ្ញាក់ផ្អើល', 'អស្ចារ្យ', 'ឆ្ងល់', 'មិនគិតថា', '😮', '😲'],
};

const EXTRA = {
  joy: ['សុខសប្បាយ', 'សប្បាយរីករាយ', 'រំភើប', 'ញញឹម', 'ក្តីសុខ', 'ល្អ', '😆', '😂', '🤣', '🎉'],
  sadness: ['សោកសង្រេង', 'ក្តុកក្តួល', 'ធ្លាក់ទឹកចិត្ត', 'អស់សង្ឃឹម', 'ឈឺចិត្ត', 'ពិបាកចិត្ត', 'កំសត់', 'ស្រណោះ', 'ខូចចិត្ត', 'ទឹកភ្នែក', '😔', '😞', '💔'],
  anger: ['ខឹងសម្បារ', 'ឆាប់ខឹង', 'ទ្រាំមិនបាន', 'ស្អប់ខ្ពើម', 'ខ្ពើម', 'ក្តៅក្រហាយ', 'មួម៉ៅ', 'ជេរ', '🤬', '😤'],
  fear: ['ភ័យខ្លាច', 'ភិតភ័យ', 'ញាប់ញ័រ', 'ព្រឺ', 'ស្ញើច', 'ព្រួយ', '😰', '😧'],
  love: ['ស្នេហា', 'អាឡោះអាល័យ', 'អាល័យ', 'នឹក', 'គួរឱ្យស្រលាញ់', '💕', '💖', '💗'],
  surprise: ['គួរឱ្យភ្ញាក់ផ្អើល', 'ហួសចិត្ត', 'មិនគួរជឿ', '😳', '🤯'],
};
for (const [k, ws] of Object.entries(EXTRA)) {
  for (const w of ws) if (!LEXICON[k].includes(w)) LEXICON[k].push(w);
}

const NEGATORS = ['មិន', 'គ្មាន', 'កុំ', 'ពុំ'];
const FLIP = { joy: 'sadness', love: 'sadness' };

const ENTRIES = Object.entries(LEXICON)
  .flatMap(([emotion, words]) => words.map((w) => ({ emotion, w })))
  .sort((a, b) => b.w.length - a.w.length);

export const EMOTIONS = [...Object.keys(LEXICON), 'neutral'];

function isNegated(text, i) {
  const before = text.slice(0, i).trimEnd();
  return NEGATORS.some((n) => before.endsWith(n));
}

export function analyzeEmotion(input) {
  const text = typeof input === 'string' ? input : '';
  let rest = text;
  const scores = Object.fromEntries(Object.keys(LEXICON).map((k) => [k, 0]));
  const matched = [];
  for (const { emotion, w } of ENTRIES) {
    let i = rest.indexOf(w);
    while (i !== -1) {
      if (isNegated(text, i)) {
        const to = FLIP[emotion];
        if (to) scores[to] += 1;
        matched.push({ emotion: to || 'neutral', word: w, negated: true });
      } else {
        scores[emotion] += 1;
        matched.push({ emotion, word: w });
      }
      rest = rest.slice(0, i) + ' '.repeat(w.length) + rest.slice(i + w.length);
      i = rest.indexOf(w);
    }
  }
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return { emotion: 'neutral', confidence: 0, scores, matched };
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return {
    emotion: top[0],
    confidence: Math.round((top[1] / total) * 100) / 100,
    scores,
    matched,
  };
}
