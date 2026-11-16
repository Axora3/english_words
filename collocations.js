const rows=[
 ['make a decision','collocation','B1','choose after thinking','шийдвэр гаргах','We need to make a decision today.','Бид өнөөдөр шийдвэр гаргах хэрэгтэй.',['16','24']],
 ['take a break','collocation','A2','stop an activity briefly to rest','түр завсарлах','Let us take a break after this lesson.','Энэ хичээлийн дараа түр завсарлая.',['10','11']],
 ['pay attention','collocation','A2','listen or watch carefully','анхаарал хандуулах','Please pay attention to the instructions.','Зааварт анхаарлаа хандуулна уу.',['27','20']],
 ['heavy rain','collocation','A2','a large amount of rain','ширүүн бороо','Heavy rain delayed our journey.','Ширүүн бороо аяллыг маань саатуулсан.',['6','29']],
 ['strong coffee','collocation','A2','coffee with an intense flavour','өтгөн кофе','He drinks strong coffee in the morning.','Тэр өглөө өтгөн кофе уудаг.',['25']],
 ['achieve a goal','collocation','B1','successfully reach an intended result','зорилгодоо хүрэх','Daily practice helps you achieve a goal.','Өдөр бүрийн дадлага зорилгодоо хүрэхэд тусална.',['7','16']],
 ['express gratitude','collocation','B2','show or say that you are thankful','талархал илэрхийлэх','I wrote to express gratitude for their kindness.','Тэдний сайхан сэтгэлд талархлаа илэрхийлж бичсэн.',['8','21']],
 ['spark curiosity','collocation','B2','cause a desire to discover or understand','сониуч зан төрүүлэх','The experiment can spark curiosity in students.','Туршилт сурагчдын сониуч занг төрүүлж болно.',['4','9']],
 ['maintain balance','collocation','B2','keep different parts in a steady relationship','тэнцвэрийг хадгалах','She tries to maintain balance between work and rest.','Тэр ажил, амралтын тэнцвэрийг хадгалахыг хичээдэг.',['10']],
 ['seize an opportunity','collocation','C1','take advantage of a favourable chance','боломжийг ашиглах','He decided to seize an opportunity to study abroad.','Тэр гадаадад сурах боломжийг ашиглахаар шийдсэн.',['15','12']],
 ['give up','phrasal','B1','stop trying or doing something','бууж өгөх; болих','Do not give up when learning feels difficult.','Суралцахад хэцүү санагдсан ч бүү бууж өгөөрэй.',['3','30']],
 ['look after','phrasal','A2','take care of someone or something','асрах; харж хандах','Can you look after my plants this weekend?','Энэ амралтын өдрүүдэд ургамлыг минь харж өгөх үү?',['21','13']],
 ['find out','phrasal','A2','discover information','олж мэдэх','I want to find out how the machine works.','Машин хэрхэн ажилладгийг олж мэдмээр байна.',['9','27']],
 ['carry on','phrasal','B1','continue an activity','үргэлжлүүлэх','We will carry on practising tomorrow.','Бид маргааш дадлагаа үргэлжлүүлнэ.',['30','14']],
 ['look forward to','phrasal','B1','feel pleased about a future event','тэсэн ядан хүлээх','I look forward to meeting your team.','Би танай багтай уулзахыг тэсэн ядан хүлээж байна.',['6','15']],
 ['set up','phrasal','B1','establish or prepare something','байгуулах; тохируулах','They plan to set up a study group.','Тэд суралцах бүлэг байгуулахаар төлөвлөж байна.',['24','27']],
 ['work out','phrasal','B1','solve or understand something by thinking','учрыг олох; бодож гаргах','We worked out the answer together.','Бид хамтдаа хариултыг нь олсон.',['23','24']],
 ['bring up','phrasal','B2','mention a topic in conversation','сэдэв хөндөх','She will bring up the issue at the meeting.','Тэр хурал дээр асуудлыг хөндөнө.',['16','12']],
 ['put off','phrasal','B1','delay an action or event','хойшлуулах','Do not put off the work until tomorrow.','Ажлаа маргааш хүртэл бүү хойшлуулаарай.',['7','30']],
 ['come across','phrasal','B2','find or meet by chance','санаандгүй тааралдах','I came across an interesting book in the library.','Номын санд сонирхолтой номтой санаандгүй таарсан.',['1','9']],
];
export const phrases=rows.map((r,i)=>({id:'phrase-'+(i+1),text:r[0],kind:r[1],level:r[2],definition:r[3],meaning:r[4],example:r[5],exampleMn:r[6],related:r[7]}));
export const phraseSearch=(query='',kind='')=>phrases.filter(p=>(!kind||p.kind===kind)&&`${p.text} ${p.meaning} ${p.definition}`.toLowerCase().includes(query.toLowerCase()));
export const relatedPhrases=id=>phrases.filter(p=>p.related.includes(id));
