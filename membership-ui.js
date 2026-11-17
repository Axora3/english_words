import {membership} from './cloud.js';
import {button,esc,notice} from './ui.js';
export class MembershipUI{
 constructor(ctx){this.ctx=ctx;this.reset();}
 reset(){this.status=null;this.checkedAt=0;this.lastAttempt=0;this.operation={};this.busy=false;this.error='';this.request=null;}
 async load(){if(!this.ctx.user()||this.busy)return;const owner=this.ctx.user().id,op=this.operation;this.busy=true;this.lastAttempt=Date.now();try{const s=await membership.status(owner);if(this.ctx.user()?.id===owner&&this.operation===op){this.status=s;this.checkedAt=Date.now();this.error='';}}catch(e){if(this.operation===op)this.error=['PGRST202','42P01'].includes(e.code)?'Эрхийн шинэчлэл хараахан идэвхжээгүй байна.':e.message;}finally{if(this.operation===op){this.busy=false;this.ctx.render();}}}
 /** The paywall only closes on a definite answer from the server: this account is banned, or the
  *  gate is switched on and the account has no live membership. An unknown status — the first
  *  seconds after sign-in, a request that failed, an offline device, or a project where the
  *  membership migration has not been run yet — leaves the app open, because locking a local-first
  *  app out of its own offline data is never the right answer to a network problem.
  *  An expiry that passed while the page stayed open is caught by the refresh below. */
 blocked(){const s=this.status;if(!s)return false;
  if(s.gate_enabled&&!this.busy&&Date.now()-this.checkedAt>600000)setTimeout(()=>this.load(),0);
  if(s.banned)return true;
  if(!s.gate_enabled||s.unlimited)return false;
  return !s.active||Boolean(s.expires_at)&&new Date(s.expires_at)<=new Date();}
 view(){const s=this.status,mn=this.ctx.state().settings.language==='mn',L=(a,b)=>mn?a:b;const attrs=this.busy?'disabled aria-busy="true"':'';
 const url=s?.purchase_url;const safeUrl=typeof url==='string'&&/^https:\/\//.test(url);
 return `<section class="panel learning-summary"><p class="eyebrow">ENGLISH WORDS MEMBERSHIP</p><h2>${L('Миний ашиглах эрх','My membership')}</h2>${this.error?notice(esc(this.error),{tone:'tone-danger',role:'alert'}):''}${s?`<p>${s.banned?L('Таны эрхийг админ хориглосон.','Your account is banned.'):s.active?L('Идэвхтэй','Active'):L('Эрх авах / сунгах шаардлагатай','Purchase or renew your membership')}</p><p>${s.unlimited?L('Хязгааргүй эрх','Unlimited access'):s.expires_at?L('Дуусах өдөр','Expires')+': '+esc(new Date(s.expires_at).toLocaleDateString()):L('Төлбөр баталгаажсаны дараа 1 сарын эрх нээгдэнэ.','Your month starts after payment confirmation.')}</p><div class="plan-metrics"><div><strong>${Number(s.price).toLocaleString()}₮</strong><span>${L('1 сарын эрх','1 calendar month')}</span></div><div><strong>${Number(s.coins).toLocaleString()}</strong><span>coin</span></div><div><strong>${s.streak} / ${s.streak_days}</strong><span>${L('Тасралтгүй өдрийн сорил','Daily quiz streak')}</span></div></div><p>${s.discount_percent?`${s.discount_percent}% · ${Math.round(s.price*(100-s.discount_percent)/100).toLocaleString()}₮`:L('Өдрийн сорилд 6/10 авсан өдрүүд тасралтгүй идэвхэд тооцогдоно.','Score 6/10 on the daily quiz to build your activity streak.')}</p><p>${Number(s.coin_price).toLocaleString()} coin = ${L('1 сарын эрх','1 month')}</p><div class="form-actions">${safeUrl?button(L('Axora-аас эрх авах / сунгах','Buy / renew on Axora'),{href:url,kind:'secondary'}):`<p>${L('Axora худалдан авах холбоосыг тохируулж байна.','The Axora checkout link is being configured.')}</p>`}${button(L('Coin-оор 1 сар авах','Redeem coins for 1 month'),{action:'membership-redeem',attrs:this.busy||s.banned||s.unlimited||s.coins<s.coin_price?'disabled':''})}</div>`:`<p role="status">${L('Эрхийг шалгаж байна…','Checking membership…')}</p>`}<div class="form-actions">${button(L('Эрхээ шалгах','Refresh membership'),{action:'membership-refresh',kind:'ghost',attrs})}${button(L('Гарах','Sign out'),{action:'a-signout',kind:'ghost',attrs})}</div></section>`;
 }
 async click(action){if(action==='membership-refresh'){await this.load();return true;}if(action!=='membership-redeem')return false;
  if(this.busy)return true;const s=this.status;if(!s||s.banned||s.unlimited||s.coins<s.coin_price)return true;
  if(!confirm(`${s.coin_price.toLocaleString()} coin зарцуулж 1 сарын эрх авах уу?`))return true;
  const owner=this.ctx.user()?.id,op=this.operation;this.busy=true;this.ctx.render();this.request??=crypto.randomUUID();try{await membership.redeem(this.request,owner);if(op===this.operation)this.request=null;}catch(e){if(op===this.operation)this.error=e.message;}finally{if(op===this.operation){this.busy=false;await this.load();}}return true;
 }
}
