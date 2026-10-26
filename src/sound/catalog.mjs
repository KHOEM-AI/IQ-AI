// Sound library taxonomy: 10 categories and 4 growth stages.
// See docs/SOUND_LIBRARY_PLAN.md.

export const CATEGORIES = Object.freeze([
  { id: 1, slug: 'animals', km: 'សត្វ និងជីវិតរស់នៅ', en: 'Animals and wildlife', examples: ['dog', 'cat', 'bird', 'insect'] },
  { id: 2, slug: 'human', km: 'មនុស្ស និងសំឡេងនិយាយ', en: 'Humans and speech', examples: ['speech', 'laugh', 'cry', 'singing'] },
  { id: 3, slug: 'vehicles', km: 'យានយន្ត និងការដឹកជញ្ជូន', en: 'Vehicles and transport', examples: ['engine', 'brake', 'horn', 'airplane'] },
  { id: 4, slug: 'machines', km: 'ម៉ាស៊ីន និងឧបករណ៍', en: 'Machines and tools', examples: ['fan', 'motor', 'pump', 'kitchen'] },
  { id: 5, slug: 'nature', km: 'ធម្មជាតិ និងអាកាសធាតុ', en: 'Nature and weather', examples: ['rain', 'thunder', 'wind', 'forest'] },
  { id: 6, slug: 'music', km: 'តន្ត្រី និងឧបករណ៍ភ្លេង', en: 'Music and instruments', examples: ['instrument', 'beat', 'melody'] },
  { id: 7, slug: 'objects', km: 'វត្ថុ និងសកម្មភាព', en: 'Objects and actions', examples: ['door', 'knock', 'impact', 'falling'] },
  { id: 8, slug: 'signals', km: 'អេឡិចត្រូនិក និងសញ្ញា', en: 'Electronics and signals', examples: ['alert', 'alarm', 'ui', 'system'] },
  { id: 9, slug: 'ambience', km: 'បរិយាកាស និងទីកន្លែង', en: 'Ambience and places', examples: ['market', 'school', 'office', 'city'] },
  { id: 10, slug: 'synthetic', km: 'សំឡេងសំយោគ និងបែបផែនពិសេស', en: 'Synthetic and special effects', examples: ['computer', 'game', 'film', 'generated'] },
]);

export const STAGES = Object.freeze([
  { stage: 1, targetFiles: 10_000, goal: 'Base library' },
  { stage: 2, targetFiles: 100_000, goal: 'More types and contexts' },
  { stage: 3, targetFiles: 1_000_000, goal: 'Large-scale library' },
  { stage: 4, targetFiles: 10_000_000, goal: 'Continuous growth with data and resources' },
]);

export const FORMATS = Object.freeze(['wav', 'mp3', 'ogg', 'webm']);

export const categorySlugs = () => CATEGORIES.map((c) => c.slug);
export const getCategory = (slug) => CATEGORIES.find((c) => c.slug === slug) || null;
