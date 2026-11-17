// Local documents and sync metadata belong to an account, never to the browser as a whole.
import {emptyState} from './core.js';
const PREFIX='english-words-account:';
const MIGRATED=PREFIX+'legacy-migrated';
const LEGACY_KEYS=['english-words-sync','english-words-sync-base','english-words-presync'];
export function createAccountStorage({storage=globalThis.localStorage,validate}){
 let owner=null;
 const key=(name,id=owner)=>PREFIX+(id?encodeURIComponent(id):'signed-out')+':'+name;
 const parse=(name,fallback=null)=>{try{return JSON.parse(storage.getItem(name)||'null')??fallback;}catch{return fallback;}};
 // Recover a legacy document only when the old sync metadata identifies its owner.
 // Unowned legacy progress stays untouched at lexi-v1; it is never offered to a new account.
 try{if(!storage.getItem(MIGRATED)){
  const legacyOwner=parse(LEGACY_KEYS[0],{}).userId;
  if(legacyOwner&&!storage.getItem(key('state',legacyOwner))){
   const legacy=parse('lexi-v1');
   if(legacy&&validate(legacy)){
    storage.setItem(key('state',legacyOwner),JSON.stringify(legacy));
    for(const name of LEGACY_KEYS){const raw=storage.getItem(name);if(raw!==null)storage.setItem(key(name,legacyOwner),raw);}
   }
  }
  storage.setItem(MIGRATED,'1');
 }}catch{/* Originals remain intact if local storage is full. */}
 return {
  get userId(){return owner;},
  get stateKey(){return key('state');},
  select(userId){
   owner=userId||null;
   const raw=storage.getItem(key('state'));
   if(raw===null)return emptyState();
   const document=JSON.parse(raw);if(!validate(document))throw Error('Invalid account document');
   return document;
  },
  save(document){storage.setItem(key('state'),JSON.stringify(document));},
  raw(){return storage.getItem(key('state'));},
  clear(userId){for(const name of ['state',...LEGACY_KEYS])storage.removeItem(key(name,userId));},
  syncStorage:{
   getItem:name=>storage.getItem(key(name)),
   setItem:(name,value)=>storage.setItem(key(name),value),
   removeItem:name=>storage.removeItem(key(name))
  }
 };
}
