// Scriptable-only APIs are used inside this serialised function, never by the web app.
export async function runScriptableWidget(seed, model) {
  const words = seed.words;
  const fm = FileManager.local();
  const directory = fm.joinPath(fm.documentsDirectory(), 'EnglishWordsWidget');
  const path = fm.joinPath(directory, 'progress.json');
  const dictionaries = {
    mn: { ready:'ШИНЭ ҮГ', waiting:'ДАРААГИЙН ҮГ', done:'ӨНӨӨДӨР ДУУСЛАА', listen:'♪ Дуудлага', learned:'✓ Сурлаа',
      progress:'Өдрийн ахиц', tap:'Дуудлагыг сонсохын тулд дар', later:'Үг хугацаандаа нээгдэнэ', finished:'Өнөөдрийн үгээ сурч дууслаа.',
      menu:'English Words', preview:'Виджет харах', speak:'Үгийн дуудлага сонсох', mark:'Одоогийн үгийг сурсан гэж тэмдэглэх',
      backup:'Аппд оруулах нөөц хуулбар хадгалах', cancel:'Болих', ok:'За',
      update:'Шинэ хуулбар байна', updateBody:'Аппын шинэ хуулбараар виджетийн мэдээллийг солих уу? Виджет дээрх өөрчлөлтөө хадгалах бол эхлээд нөөц хуулбар гаргаарай.',
      replace:'Шинэ хуулбарыг ашиглах', keep:'Одоогийн мэдээллийг хадгалах', stale:'Энэ үг өөрчлөгдсөн эсвэл хугацаа нь болоогүй байна. Виджетийг дахин нээгээрэй.',
      saved:'Үгийг сурсан гэж хадгаллаа. iOS зөвшөөрөх үед нүүр дэлгэцийн виджет шинэчлэгдэнэ.',
      error:'Виджетийн мэдээллийг уншиж чадсангүй.', recover:'progress.json файлыг нөөцөлж аваад Scriptable дотроос скриптээ дахин тохируулна уу. Мэдээллийг автоматаар устгаагүй.' },
    en: { ready:'NEW WORD', waiting:'NEXT WORD', done:'ALL DONE TODAY', listen:'♪ Listen', learned:'✓ Learned',
      progress:'Daily progress', tap:'Tap to hear pronunciation', later:'Your word unlocks on schedule', finished:'You have finished today’s words.',
      menu:'English Words', preview:'Preview widget', speak:'Hear the current word', mark:'Mark the current word learned',
      backup:'Save a backup to import into the app', cancel:'Cancel', ok:'OK',
      update:'A new snapshot is available', updateBody:'Replace the widget’s data with the new app snapshot? Export a backup first if you want to keep changes made in the widget.',
      replace:'Use the new snapshot', keep:'Keep current progress', stale:'This word has changed or is not due yet. Open the widget again.',
      saved:'Word saved as learned. The Home Screen widget will refresh when iOS allows it.',
      error:'Could not read widget data.', recover:'Back up progress.json and check the script in Scriptable. Your data was not automatically deleted.' },
  };
  let state = JSON.parse(JSON.stringify(seed.state));
  let exportId = seed.exportId;
  let seenExportId = seed.exportId;
  let t = dictionaries[state.settings.language] || dictionaries.mn;
  const alert = async (title,message) => {const item = new Alert();item.title=title;item.message=message;item.addAction(t.ok);await item.presentAlert();};
  const save = () => fm.writeString(path, JSON.stringify({exportId,seenExportId,state}));
  const time = timestamp => {const date=new Date(timestamp);return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;};
  const link = (action, id = '', day = '') => {
    const base = URLScheme.forRunningScript();
    return base + (base.includes('?') ? '&' : '?') + `action=${encodeURIComponent(action)}&id=${encodeURIComponent(id)}&day=${encodeURIComponent(day)}`;
  };
  try {
    if (!model.valid(state, words)) throw Error('Invalid seed');
    if (!fm.fileExists(directory)) fm.createDirectory(directory,true);
    if (fm.fileExists(path)) {
      const cache = JSON.parse(fm.readString(path));
      if (!model.valid(cache.state, words) || typeof cache.exportId !== 'string') throw Error('Invalid cache');
      seenExportId=cache.seenExportId || cache.exportId;
      if (seenExportId !== seed.exportId && !config.runsInWidget) {
        const prompt = new Alert();prompt.title=t.update;prompt.message=t.updateBody;
        prompt.addAction(t.replace);prompt.addCancelAction(t.keep);
        if (await prompt.presentAlert() !== 0) {state=cache.state;exportId=cache.exportId;}
        seenExportId=seed.exportId;
      } else {state=cache.state;exportId=cache.exportId;}
    }
    t = dictionaries[state.settings.language] || dictionaries.mn;
    let current = model.view(state,words);
    save();
    const params = args.queryParameters || {};
    let showPreview = !config.runsInWidget && (!params.action || params.action === 'menu');
    if (!config.runsInWidget && params.action === 'speak') {
      const word = words.find(item => item.id === params.id);
      if (word) await Speech.speak(word.word);
    }
    if (!config.runsInWidget && params.action === 'learn') {
      if (model.mark(state,words,params.id,params.day)) {save();await alert(t.menu,t.saved);}
      else await alert(t.menu,t.stale);
    }
    if (showPreview) {
      const menu = new Alert();menu.title=t.menu;menu.message=t.progress+`: ${current.done}/${current.total}`;
      menu.addAction(t.preview);
      if (current.word) {menu.addAction(t.speak);menu.addAction(t.mark);}
      menu.addAction(t.backup);menu.addCancelAction(t.cancel);
      const choice = await menu.presentSheet();
      const backupIndex = current.word ? 3 : 1;
      if (choice === backupIndex) {
        await DocumentPicker.exportString(JSON.stringify(state,null,2),`english-words-backup-${model.dayKey()}.json`);
        showPreview=false;
      } else if (current.word && choice === 1) {await Speech.speak(current.word.word);showPreview=false;}
      else if (current.word && choice === 2) {
        model.mark(state,words,current.word.id,current.day);save();await alert(t.menu,t.saved);
      } else if (choice < 0) showPreview=false;
    }
    current=model.view(state,words);save();
    const widget = new ListWidget();
    widget.backgroundColor=new Color('0b1020');widget.setPadding(13,15,12,15);
    widget.url=current.word?link('speak',current.word.id,current.day):link('menu');
    // iOS decides the actual refresh time; this is only the earliest requested date.
    widget.refreshAfterDate=new Date(Math.min(Date.now()+15*60000,Math.max(Date.now()+60000,current.refreshAt)));
    const small=config.widgetFamily==='small';
    const text=(container,value,size,color='f4f6fb',bold=false,limit=1)=>{
      const item=container.addText(value);item.font=bold?Font.boldSystemFont(size):Font.systemFont(size);
      item.textColor=new Color(color);item.lineLimit=limit;item.minimumScaleFactor=.65;return item;
    };
    const header=widget.addStack();header.layoutHorizontally();header.centerAlignContent();
    text(header,'ENGLISH WORDS',9,'a79dff',true);header.addSpacer();
    text(header,`${current.done}/${current.total}`,10,'9aa3c0',true);
    widget.addSpacer(small?8:6);
    if (current.word) {
      text(widget,`${current.word.level} · ${t.ready}`,9,'40d9b0',true);
      widget.addSpacer(4);
      text(widget,current.word.word,small?24:27,'f4f6fb',true);
      text(widget,current.word.ipa,9,'9aa3c0');
      widget.addSpacer(4);
      text(widget,current.word.translation,small?11:12,'40d9b0',false,2);
      widget.addSpacer();
      if (!small) {
        const row=widget.addStack();row.layoutHorizontally();row.spacing=10;
        for (const [label,action,color] of [[t.listen,'speak','a79dff'],[t.learned,'learn','40d9b0']]) {
          const button=row.addStack();button.setPadding(6,10,6,10);button.cornerRadius=10;
          button.backgroundColor=new Color('171e32');button.url=link(action,current.word.id,current.day);
          text(button,label,10,color,true);
        }
      } else text(widget,t.tap,8,'9aa3c0');
    } else {
      text(widget,t[current.status],9,'a79dff',true);widget.addSpacer(10);
      text(widget,current.status==='waiting'?time(current.nextAt):'✓',small?29:36,'f4f6fb',true);
      widget.addSpacer(6);text(widget,current.status==='waiting'?t.later:t.finished,12,'9aa3c0',false,2);
    }
    Script.setWidget(widget);
    if (!config.runsInWidget && showPreview) await widget.presentMedium();
    Script.complete();
  } catch (error) {
    const widget=new ListWidget();widget.backgroundColor=new Color('0b1020');widget.setPadding(16,16,16,16);
    const title=widget.addText(t.error);title.font=Font.boldSystemFont(13);title.textColor=new Color('f4f6fb');
    widget.addSpacer(8);const note=widget.addText(t.recover);note.font=Font.systemFont(10);note.textColor=new Color('9aa3c0');
    widget.url=link('menu');Script.setWidget(widget);
    if (!config.runsInWidget) await alert(t.error,t.recover);
    Script.complete();
  }
}
