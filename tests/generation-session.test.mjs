import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generationKeyboardAction,generationCloseAction,generationQuoteReset} from '../src/generation-session.mjs';

test('generation composer keyboard: Esc dismisses, Cmd/Ctrl+Enter submits, IME is ignored', () => {
  assert.equal(generationKeyboardAction({key:'Escape'}),'dismiss');
  assert.equal(generationKeyboardAction({key:'Enter',metaKey:true}),'submit');
  assert.equal(generationKeyboardAction({key:'Enter',ctrlKey:true}),'submit');
  assert.equal(generationKeyboardAction({key:'Enter'}),null);
  assert.equal(generationKeyboardAction({key:'Enter',metaKey:true,isComposing:true}),null);
  assert.equal(generationKeyboardAction({key:'a',metaKey:true}),null);
  assert.equal(generationKeyboardAction(null),null);
});

test('dismissing a running generation keeps the submitted task in the background', () => {
  assert.equal(generationCloseAction({busy:false,submitted:false}),'close');
  assert.equal(generationCloseAction({busy:true,submitted:false}),'close');
  assert.equal(generationCloseAction({busy:true,submitted:true}),'background');
});

test('failed or stopped generation discards the consumed quote so the next click re-quotes', () => {
  assert.deepEqual(generationQuoteReset(),{quote:null,price:'',runLabel:'查看费用'});
});

test('generation panel wires focus, composer-level shortcuts and retry reset in the shipped renderer', () => {
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(source,/q\('#genPrompt'\)\.focus\(\{preventScroll:true\}\)/);
  assert.match(source,/document\.addEventListener\('keydown',composerKey,true\)/);
  assert.match(source,/resetQuote\(\);if\(live\(\)\)loadHistory\(\);\}/);
  // Esc must be handled before the generic modal/global shortcuts when the panel owns focus.
  assert.match(source,/generationKeyboardAction\(event\)/);
  // Script reference and shot sheet save shortcuts are bound once, on the modal itself.
  assert.match(source,/\$\('#modalRoot \.modal'\)\?\.addEventListener\('keydown',saveKey\)/);
  assert.ok(source.includes(`$('#modalRoot .modal')?.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!e.isComposing){e.preventDefault();$('#shotSheetSave').click();}});`));
  assert.doesNotMatch(source,/\$\('#shotSheetRows'\)\.addEventListener\('keydown'/);
});
