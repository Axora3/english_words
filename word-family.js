const rows=[
 ['educate',[
 ['educate','verb','/ˈedʒəkeɪt/','сургах','Schools educate children.','Сургуулиуд хүүхдийг сургадаг.'],['education','noun','/ˌedʒəˈkeɪʃən/','боловсрол','Education opens new opportunities.','Боловсрол шинэ боломж нээдэг.'],['educational','adjective','/ˌedʒəˈkeɪʃənəl/','боловсролын; сургалтын','We watched an educational film.','Бид сургалтын кино үзсэн.'],['educator','noun','/ˈedʒəkeɪtər/','сурган хүмүүжүүлэгч','She is an experienced educator.','Тэр туршлагатай сурган хүмүүжүүлэгч.']]],
 ['curious',[
 ['curious','adjective','/ˈkjʊriəs/','сониуч','Children are curious about the world.','Хүүхдүүд ертөнцийг сониучирхдаг.'],['curiosity','noun','/ˌkjʊriˈɑːsəti/','сониуч зан','Curiosity helps us learn.','Сониуч зан сурахад тусалдаг.'],['curiously','adverb','/ˈkjʊriəsli/','сониучирхан','The child looked at the machine curiously.','Хүүхэд машиныг сониучирхан харсан.']]],
 ['adapt',[
 ['adapt','verb','/əˈdæpt/','дасан зохицох','We adapt to new situations.','Бид шинэ нөхцөлд дасан зохицдог.'],['adaptation','noun','/ˌædæpˈteɪʃən/','дасан зохицол','Adaptation takes time.','Дасан зохицоход хугацаа хэрэгтэй.'],['adaptable','adjective','/əˈdæptəbəl/','дасан зохицох чадвартай','An adaptable team welcomes change.','Дасан зохицох чадвартай баг өөрчлөлтийг хүлээн авдаг.']]],
 ['resilient',[
 ['resilient','adjective','/rɪˈzɪliənt/','бэрхшээл даван туулах чадвартай','She remained resilient after the setback.','Тэр бүтэлгүйтлийн дараа ч тэсвэртэй хэвээр байсан.'],['resilience','noun','/rɪˈzɪliəns/','сэргэх чадвар; тэсвэр','The team showed resilience.','Баг тэсвэр хатуужил харуулсан.']]],
 ['grateful',[
 ['grateful','adjective','/ˈɡreɪtfəl/','талархсан','I am grateful for your help.','Тусалсанд тань би талархаж байна.'],['gratitude','noun','/ˈɡrætɪtuːd/','талархал','She expressed her gratitude.','Тэр талархлаа илэрхийлсэн.'],['gratefully','adverb','/ˈɡreɪtfəli/','талархан','He accepted the gift gratefully.','Тэр бэлгийг талархан хүлээн авсан.']]],
 ['kind',[
 ['kind','adjective','/kaɪnd/','сайхан сэтгэлтэй','She is kind to everyone.','Тэр хүн бүрд сайхан сэтгэлээр ханддаг.'],['kindness','noun','/ˈkaɪndnəs/','сайхан сэтгэл','Your kindness means a lot.','Таны сайхан сэтгэл их үнэ цэнтэй.'],['kindly','adverb','/ˈkaɪndli/','эелдгээр','He spoke kindly to the child.','Тэр хүүхэдтэй эелдгээр ярьсан.']]],
 ['learn',[
 ['learn','verb','/lɜːrn/','сурах','We learn through practice.','Бид дадлагаар сурдаг.'],['learner','noun','/ˈlɜːrnər/','суралцагч','Every learner has different needs.','Суралцагч бүр өөр хэрэгцээтэй.'],['learning','noun','/ˈlɜːrnɪŋ/','суралцах үйл явц','Learning continues throughout life.','Суралцах үйл явц насан туршид үргэлжилдэг.']]],
 ['improve',[
 ['improve','verb','/ɪmˈpruːv/','сайжруулах','Daily practice can improve your skills.','Өдрийн дадлага ур чадварыг сайжруулж чадна.'],['improvement','noun','/ɪmˈpruːvmənt/','сайжрал','There has been a clear improvement.','Тодорхой сайжрал гарсан.']]],
 ['discover',[
 ['discover','verb','/dɪˈskʌvər/','олж мэдэх','Scientists discover new facts.','Эрдэмтэд шинэ баримт олж мэддэг.'],['discovery','noun','/dɪˈskʌvəri/','нээлт','The discovery changed our understanding.','Нээлт бидний ойлголтыг өөрчилсөн.']]],
 ['breathe',[
 ['breathe','verb','/briːð/','амьсгалах','Breathe slowly and relax.','Удаан амьсгалж тайвшраарай.'],['breath','noun','/breθ/','амьсгал','Take a deep breath.','Гүнзгий амьсгаа аваарай.']]],
];
export const wordFamilies=rows.map(([root,forms])=>({root,forms:forms.map((r,i)=>({id:root+'-'+i,word:r[0],pos:r[1],ipa:r[2],meaning:r[3],example:r[4],exampleMn:r[5]}))}));
export const familyFor=word=>wordFamilies.find(f=>f.forms.some(node=>node.word.toLowerCase()===word.toLowerCase()))||null;
