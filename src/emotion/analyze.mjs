const LEXICON = {
  joy: ['សប្បាយ', 'រីករាយ', 'ត្រេកអរ', 'ពេញចិត្ត', 'ល្អណាស់', 'អរគុណ', 'សើច', 'ជោគជ័យ', 'ឡូយ', '😀', '😊', '😄', '😁'],
  sadness: ['ស្រងូតស្រងាត់', 'សោកសៅ', 'ក្រៀមក្រំ', 'កើតទុក្ខ', 'ឈឺចាប់', 'អផ្សុក', 'សោកស្ដាយ', 'សោកស្តាយ', 'ឯកកោ', 'យំ', '😢', '😭'],
  anger: ['មិនពេញចិត្ត', 'ឆ្អេះឆ្អន់', 'ខឹង', 'ក្រោធ', 'ស្អប់', 'ឆ្កួត', '😡', '😠'],
  fear: ['តក់ស្លុត', 'ព្រួយបារម្ភ', 'បារម្ភ', 'ខ្លាច', 'ភ័យ', '😨', '😱'],
  love: ['នឹករលឹក', 'ស្រឡាញ់', 'ស្រលាញ់', 'ចូលចិត្ត', '❤', '😍', '🥰'],
  surprise: ['ភ្ញាក់ផ្អើល', 'អស្ចារ្យ', 'ឆ្ងល់', 'មិនគិតថា', '😮', '😲'],
};

const ENTRIES = Object.entries(LEXICON)
  .flatMap(([emotion, words]) => words.map((w) => ({ emotion, w })))
  .sort((a, b) => b.w.length - a.w.length);

export const EMOTIONS = [...Object.keys(LEXICON), 'neutral'];

export function analyzeEmotion(input) {
  const text = typeof input === 'string' ? input : '';
  let rest = text;
  const scores = Object.fromEntries(Object.keys(LEXICON).map((k) => [k, 0]));
  const matched = [];
  for (const { emotion, w } of ENTRIES) {
    let i = rest.indexOf(w);
    while (i !== -1) {
      scores[emotion] += 1;
      matched.push({ emotion, word: w });
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
