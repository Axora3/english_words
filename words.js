// Bilingual vocabulary shipped with the app. Learning and review records live separately.
// The 30 curated rows below keep the ids they have always had, so progress saved before the base
// vocabulary grew still points at the same words. The rest come from words-data.js.
import {extraRows} from './words-data.js';
const rows=[
['serendipity','азтай тохиолдол','/ˌser.ənˈdɪp.ə.ti/','noun','C1','Finding this book was pure serendipity.','Энэ номыг олсон нь цэвэр азтай тохиолдол байлаа.','chance, fortune','misfortune','An unexpected, fortunate discovery.','Санаандгүй тохиолдсон азтай нээлт.'],
['embrace','тэврэх; хүлээн авах','/ɪmˈbreɪs/','verb','B2','We should embrace new ideas.','Бид шинэ санааг хүлээн авах хэрэгтэй.','accept, welcome','reject','To accept something willingly; also to hold someone in your arms.','Аливаа зүйлийг дуртайяа хүлээн авах, мөн хэн нэгнийг тэврэх.'],
['resilient','бэрхшээлийг даван туулах чадвартай','/rɪˈzɪl.i.ənt/','adjective','C1','The community remained resilient after the storm.','Шуурганы дараа ч нутгийнхан бэрхшээлийг даван туулсан.','strong, adaptable','fragile','Able to recover after difficulty.','Хүндрэлийн дараа хурдан сэргэх чадвартай.'],
['curiosity','сониуч зан','/ˌkjʊr.iˈɑː.sə.ti/','noun','B2','Her curiosity led her to explore the city.','Сониуч зан нь түүнийг хотыг судлахад хүргэсэн.','interest, inquisitiveness','indifference','A strong desire to know or learn something.','Ямар нэг зүйлийг мэдэх, сурах хүчтэй хүсэл.'],
['thrive','цэцэглэн хөгжих','/θraɪv/','verb','C1','These plants thrive in sunlight.','Эдгээр ургамал нарны гэрэлд сайн ургадаг.','flourish, prosper','decline','To grow or develop very well.','Маш сайн ургаж, хөгжих.'],
['journey','аялал','/ˈdʒɜːr.ni/','noun','A2','The journey takes three hours.','Аялал гурван цаг үргэлжилнэ.','trip, voyage','stay','Travel from one place to another; also a process of development.','Нэг газраас нөгөө газар хүрэх аялал, мөн хөгжлийн үйл явц.'],
['achieve','хүрэх; биелүүлэх','/əˈtʃiːv/','verb','B1','You can achieve your goal with practice.','Дадлага хийснээр зорилгодоо хүрч чадна.','accomplish, attain','fail','To successfully reach a goal through effort.','Хичээл зүтгэлээр зорилгодоо амжилттай хүрэх.'],
['grateful','талархсан','/ˈɡreɪt.fəl/','adjective','B1','I am grateful for your help.','Таны тусламжид би талархаж байна.','thankful, appreciative','ungrateful','Feeling or showing thanks.','Талархал мэдрэх буюу илэрхийлэх.'],
['discover','нээх; олж мэдэх','/dɪˈskʌv.ər/','verb','A2','We discover something new every day.','Бид өдөр бүр шинэ зүйл олж мэддэг.','find, uncover','overlook','To find something for the first time.','Ямар нэг зүйлийг анх удаа олж мэдэх.'],
['balance','тэнцвэр','/ˈbæl.əns/','noun','B1','She found a balance between work and rest.','Тэр ажил, амралтын тэнцвэрийг олсон.','stability, equilibrium','imbalance','A steady state or a fair distribution between things.','Тогтвортой байдал буюу зүйлсийн зохистой харьцаа.'],
['breathe','амьсгалах','/briːð/','verb','A2','Breathe slowly and relax.','Удаан амьсгалж, тайвшраарай.','inhale, respire','suffocate','To take air into and out of the lungs.','Уушгинд агаар авч, гаргах.'],
['courage','зориг','/ˈkɜːr.ɪdʒ/','noun','B2','It takes courage to try something new.','Шинэ зүйл туршихад зориг хэрэгтэй.','bravery, boldness','cowardice','The ability to act despite fear.','Айдастай байсан ч үйлдэл хийх чадвар.'],
['gentle','зөөлөн; дөлгөөн','/ˈdʒen.təl/','adjective','B1','A gentle breeze moved the leaves.','Зөөлөн салхи навчисыг хөдөлгөв.','mild, tender','harsh','Kind, calm, or not forceful.','Эелдэг, тайван буюу хүчтэй бус.'],
['improve','сайжруулах','/ɪmˈpruːv/','verb','A2','Reading will improve your vocabulary.','Унших нь үгийн санг тань сайжруулна.','enhance, develop','worsen','To become better or make something better.','Илүү сайн болох эсвэл болгох.'],
['opportunity','боломж','/ˌɑː.pɚˈtuː.nə.ti/','noun','B1','This is an opportunity to learn.','Энэ бол суралцах боломж юм.','chance, opening','obstacle','A situation that makes it possible to do something.','Ямар нэг зүйл хийх боломж олгосон нөхцөл.'],
['purpose','зорилго','/ˈpɜːr.pəs/','noun','B1','Every lesson has a clear purpose.','Хичээл бүр тодорхой зорилготой.','aim, intention','aimlessness','The reason why something is done.','Ямар нэг үйлдэл хийх шалтгаан.'],
['wonder','гайхах','/ˈwʌn.dər/','verb','B1','I wonder what tomorrow will bring.','Маргааш юу болох бол гэж би боддог.','ponder, question','know','To think about something with curiosity.','Ямар нэг зүйлийг сониучирхан бодох.'],
['abundant','элбэг дэлбэг','/əˈbʌn.dənt/','adjective','C1','Fresh fruit is abundant in summer.','Зуны улиралд шинэ жимс элбэг байдаг.','plentiful, ample','scarce','Available in large quantities.','Их хэмжээгээр байгаа.'],
['essential','зайлшгүй чухал','/ɪˈsen.ʃəl/','adjective','B1','Sleep is essential for good health.','Нойр нь эрүүл мэндэд зайлшгүй чухал.','necessary, vital','optional','Completely necessary or very important.','Зайлшгүй шаардлагатай буюу маш чухал.'],
['reflect','эргэцүүлэх; тусгах','/rɪˈflekt/','verb','B2','Take a moment to reflect on your day.','Өдрөө эргэцүүлэхэд хэсэг хугацаа гаргаарай.','consider, contemplate','ignore','To think carefully; also to send back light.','Анхааралтай бодох, мөн гэрэл ойлгох.'],
['kindness','сайхан сэтгэл','/ˈkaɪnd.nəs/','noun','B1','Small acts of kindness matter.','Сайхан сэтгэлийн жижиг үйлдлүүд ч үнэ цэнтэй.','compassion, generosity','cruelty','The quality of being friendly and considerate.','Нөхөрсөг, бусдыг боддог чанар.'],
['adapt','дасан зохицох','/əˈdæpt/','verb','B2','Animals adapt to their environment.','Амьтад хүрээлэн буй орчиндоо дасан зохицдог.','adjust, modify','resist','To change to suit new conditions.','Шинэ нөхцөлд тохируулан өөрчлөгдөх.'],
['vivid','тод; амьд мэт','/ˈvɪv.ɪd/','adjective','B2','She has a vivid memory of that day.','Тэр өдрийг тэр маш тод санадаг.','bright, clear','dull','Very clear, bright, or detailed.','Маш тод, гэрэлтэй буюу дэлгэрэнгүй.'],
['wisdom','мэргэн ухаан','/ˈwɪz.dəm/','noun','B2','Experience can bring wisdom.','Туршлага мэргэн ухааныг авчирч болно.','insight, understanding','foolishness','Good judgment gained from knowledge and experience.','Мэдлэг, туршлагаас олсон зөв дүгнэлт.'],
['begin','эхлэх','/bɪˈɡɪn/','verb','A1','Let us begin the lesson.','Хичээлээ эхэлцгээе.','start, commence','finish','To start doing something.','Ямар нэг үйлдлийг эхлүүлэх.'],
['friend','найз','/frend/','noun','A1','My friend lives nearby.','Миний найз ойрхон амьдардаг.','companion, pal','enemy','Someone you know well and like.','Сайн таньдаг, дотно хүн.'],
['learn','сурах','/lɜːrn/','verb','A1','I learn a new word every day.','Би өдөр бүр шинэ үг сурдаг.','study, understand','forget','To gain knowledge or a skill.','Мэдлэг буюу ур чадвар эзэмших.'],
['meticulous','нягт нямбай','/məˈtɪk.jə.ləs/','adjective','C2','She keeps meticulous records.','Тэр маш нягт нямбай бүртгэл хөтөлдөг.','careful, precise','careless','Showing great attention to every detail.','Жижиг зүйл бүрт их анхаарал хандуулдаг.'],
['tranquil','амар тайван','/ˈtræŋ.kwɪl/','adjective','C1','The lake was tranquil at dawn.','Үүрээр нуур амар тайван байлаа.','peaceful, calm','turbulent','Quiet, peaceful, and undisturbed.','Чимээгүй, тайван, амгалан.'],
['perseverance','шантрашгүй зан','/ˌpɜːr.səˈvɪr.əns/','noun','C2','Her perseverance helped her succeed.','Шантрашгүй зан нь түүнд амжилтад хүрэхэд тусалсан.','persistence, determination','surrender','Continuing to try despite difficulties.','Бэрхшээлтэй байсан ч үргэлжлүүлэн хичээх.']
];
const entry=(id,r,list)=>({id,word:r[0],translation:r[1],ipa:r[2],pos:r[3],level:r[4],example:r[5],exampleMn:r[6],synonyms:list(r[7]),antonyms:list(r[8]),usage:r[9],usageMn:r[10]});
const split=value=>String(value).split(', ').filter(Boolean),keep=value=>Array.isArray(value)?value:split(value);
const rank={A1:0,A2:1,B1:2,B2:3,C1:4,C2:5};
/** Easiest first: CEFR level, then alphabetical. Daily words therefore start at A1. */
/** The 30 hand-written rows on their own: tools/import-words.mjs checks new words against these. */
export const curatedWords=rows.map((r,i)=>entry(String(i+1),r,split));
export const baseWords=[...curatedWords,...extraRows.map((r,i)=>entry('w'+(i+1),r,keep))]
 .sort((a,b)=>(rank[a.level]??9)-(rank[b.level]??9)||a.word.localeCompare(b.word,'en')||a.pos.localeCompare(b.pos));
export const words=[...baseWords];
export function setCustomWords(custom=[]){words.splice(0,words.length,...baseWords,...custom);}
