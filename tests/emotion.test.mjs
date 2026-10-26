import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEmotion } from '../src/emotion/analyze.mjs';

test('joy', () => assert.equal(analyzeEmotion('ខ្ញុំសប្បាយណាស់ អរគុណ').emotion, 'joy'));
test('anger', () => assert.equal(analyzeEmotion('ខ្ញុំខឹងហើយ មិនពេញចិត្តសោះ').emotion, 'anger'));
test('fear', () => assert.equal(analyzeEmotion('ខ្ញុំខ្លាចណាស់').emotion, 'fear'));
test('neutral', () => assert.equal(analyzeEmotion('សួស្ដី').emotion, 'neutral'));
test('non-string is neutral', () => assert.equal(analyzeEmotion(null).emotion, 'neutral'));

test('negated joy becomes sadness', () => assert.equal(analyzeEmotion('ខ្ញុំមិនសប្បាយ').emotion, 'sadness'));
test('negated fear becomes neutral', () => assert.equal(analyzeEmotion('ខ្ញុំមិនខ្លាច').emotion, 'neutral'));
test('មិនពេញចិត្ត stays anger', () => assert.equal(analyzeEmotion('ខ្ញុំមិនពេញចិត្តសោះ').emotion, 'anger'));
test('longer word wins', () => assert.equal(analyzeEmotion('ខ្ញុំសប្បាយចិត្ត').emotion, 'joy'));
test('new word ខកចិត្ត', () => assert.equal(analyzeEmotion('ខ្ញុំខកចិត្តណាស់').emotion, 'sadness'));

test('word អផ្សុក', () => assert.equal(analyzeEmotion('ខ្ញុំអផ្សុកណាស់').emotion, 'sadness'));
test('word ឆ្កួត', () => assert.equal(analyzeEmotion('អ្នកឆ្កួតហើយ').emotion, 'anger'));

test('extra joy emoji', () => assert.equal(analyzeEmotion('😂😂').emotion, 'joy'));
test('extra sadness ធ្លាក់ទឹកចិត្ត', () => assert.equal(analyzeEmotion('ខ្ញុំធ្លាក់ទឹកចិត្ត').emotion, 'sadness'));
test('extra anger ឆាប់ខឹង', () => assert.equal(analyzeEmotion('គាត់ឆាប់ខឹង').emotion, 'anger'));
test('extra fear ភ័យខ្លាច', () => assert.equal(analyzeEmotion('ខ្ញុំភ័យខ្លាច').emotion, 'fear'));
test('extra love ស្នេហា', () => assert.equal(analyzeEmotion('ស្នេហា').emotion, 'love'));
test('extra surprise ហួសចិត្ត', () => assert.equal(analyzeEmotion('ហួសចិត្តណាស់').emotion, 'surprise'));
test('negated extra: មិនល្អ', () => assert.equal(analyzeEmotion('មិនល្អ').emotion, 'sadness'));

test('word ក្តៅក្រហាយ', () => assert.equal(analyzeEmotion('ខ្ញុំក្តៅក្រហាយ').emotion, 'anger'));
test('emoji 💖', () => assert.equal(analyzeEmotion('💖').emotion, 'love'));
