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
