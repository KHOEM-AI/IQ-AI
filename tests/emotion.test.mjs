import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEmotion } from '../src/emotion/analyze.mjs';

test('joy', () => assert.equal(analyzeEmotion('ខ្ញុំសប្បាយណាស់ អរគុណ').emotion, 'joy'));
test('anger', () => assert.equal(analyzeEmotion('ខ្ញុំខឹងហើយ មិនពេញចិត្តសោះ').emotion, 'anger'));
test('fear', () => assert.equal(analyzeEmotion('ខ្ញុំខ្លាចណាស់').emotion, 'fear'));
test('neutral', () => assert.equal(analyzeEmotion('សួស្ដី').emotion, 'neutral'));
test('non-string is neutral', () => assert.equal(analyzeEmotion(null).emotion, 'neutral'));
