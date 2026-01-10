import * as ai from 'ai';
console.log('Exports from ai:', Object.keys(ai));
try {
    await import('ai/react');
    console.log('ai/react found');
} catch (e) {
    console.log('ai/react NOT found:', e.message);
}
