import {vocabulary,normalizeWord} from './vocabulary.js';
// The searchable text of a word never changes, so it is normalised once per word object and kept in
// a WeakMap. With a few thousand base words this is the difference between a smooth and a stuttering
// search box: collection names are the only part that can change, so they are matched separately.
const haystacks=new WeakMap();
function haystack(word){let text=haystacks.get(word);if(text===undefined){text=normalizeWord([word.word,word.translation,word.ipa,word.pos,word.level,word.usage,word.usageMn,...word.synonyms,...word.antonyms].join(' '));haystacks.set(word,text);}return text;}
export function searchDictionary(state,query='',filters={}){
 const q=normalizeWord(query),collections=state.advanced.collections,
  members=filters.collection?new Set(collections.find(c=>c.id===filters.collection)?.wordIds||[]):null,
  named=q?collections.filter(c=>normalizeWord(c.name).includes(q)):[];
 const found=vocabulary(state).filter(w=>(!filters.level||w.level===filters.level)&&(!filters.pos||w.pos===filters.pos)
  &&(!members||members.has(w.id))
  &&(!q||haystack(w).includes(q)||named.some(c=>c.wordIds.includes(w.id))));
 return q?found.sort((a,b)=>relevance(a,q)-relevance(b,q)):found;
}

/** How closely a word answers the query. The word you typed comes first, then the words that begin
 *  with it, then its meaning, then anything that merely mentions it somewhere. Sorting is stable, so
 *  words sharing a rank keep the vocabulary's own A1-upwards order. */
function relevance(word,q){
 const name=normalizeWord(word.word),meaning=normalizeWord(word.translation);
 if(name===q)return 0;
 if(name.startsWith(q))return 1;
 if(meaning===q||meaning.split(/[;,]\s*/).includes(q))return 2;
 if(name.includes(q))return 3;
 if(meaning.startsWith(q))return 4;
 if(meaning.includes(q))return 5;
 return 6;
}
export function rememberSearch(state,query){const q=String(query).trim().slice(0,100);if(!q)return;state.advanced.searchHistory=[q,...state.advanced.searchHistory.filter(v=>v!==q)].slice(0,12);}
export function rememberWord(state,id){if(!vocabulary(state).some(w=>w.id===id))return;state.advanced.recentWords=[id,...state.advanced.recentWords.filter(v=>v!==id)].slice(0,12);}
