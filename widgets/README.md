# iPhone Home Screen widget

This is a real Scriptable Home Screen widget, not a Safari shortcut. Install the **Scriptable** app on your iPhone before adding it. No Mac or Xcode is required. The source has been tested with a controlled Scriptable API harness, but has not been run on a physical iPhone in this environment.

## Монгол заавар

1. iPhone-ийн App Store-оос **Scriptable** суулгана.
2. Вэб апп → **Тохиргоо → Виджет ба нүүр дэлгэц → iPhone · iPad** хэсэгт орж өөрийн ахицтай кодыг татах эсвэл хуулна. Энэ хавтасны `English Words.js` нь шинэ, ахицгүй хэрэглэгчийн анхны хувилбар. Windows-оос файлаа iCloud Drive, OneDrive эсвэл өөрийн дамжуулах аргаар iPhone руу хүргэнэ.
3. Scriptable → **+** → файлын кодыг бүхлээр нь хуулж оруулаад **English Words** гэж нэрлэнэ. Нэг удаа ажиллуулж **Виджет харах** сонгоно.
4. iPhone-ийн нүүр дэлгэцийн хоосон зайг удаан дарах → **Edit → Add Widget** (эсвэл **+**) → **Scriptable** → **Small / Medium** хэмжээг нэмнэ.
5. Виджетийг удаан дарах → **Edit Widget → Script → English Words**. **When Interacting → Run Script** сонгоно.

Жижиг виджет дээр дарахад тухайн үгийн дуудлагыг Scriptable нээж уншина. Дунд хэмжээтэй дээр **Дуудлага / Сурлаа** тусдаа товчтой. Дуудлага виджет дотроо шууд тоглохгүй. Шинэ үгс хэрэглэгчийн хуваарийн дагуу нэг нэгээрээ нээгдэнэ; хугацаа болоогүй бол дараагийн цаг харагдана. Өдрийн үгс дууссан бол ✓ төлөв харуулна.

**iOS шинэчлэх цагийг удирддаг.** Скрипт нь хамгийн эрт шинэчилж болох цагийг хүсдэг бөгөөд яг 10 минут тутам шинэчлэгдэнэ гэсэн баталгаа байхгүй. Дарж скриптийг ажиллуулахад одоогийн цаг, ахицыг дахин тооцно.

## Progress and manual sync

- The exported script includes the current web app snapshot, every word your progress refers to, and the next 150 words of the schedule (not the whole vocabulary, which is thousands of entries — re-export every few weeks so the widget never runs out). It makes no network requests and does not depend on `localhost` being reachable from your phone.
- Widget progress lives in Scriptable’s local Documents directory under `EnglishWordsWidget/progress.json`. Marking learned creates the same record shape as the app and cannot mark future/stale words.
- **Widget → app:** run the script inside Scriptable, choose **Save a backup to import into the app** / **Аппд оруулах нөөц хуулбар хадгалах**, save the JSON to Files, transfer it if needed, then use the web app’s **Settings → Import backup**. App import replaces that browser’s state after confirmation.
- **App → widget:** export updated script code and replace the code in the same Scriptable script. Run it and choose **Use the new snapshot**. Export the widget’s backup first if it contains changes you want to keep. Background refresh never silently replaces existing progress with a newly exported seed.
- There is no automatic cloud sync. Exported scripts and backups contain personal learning history and preferences; keep them private. A corrupted cache is not silently erased.

## Official references

- [Scriptable](https://scriptable.app/)
- [ListWidget and system-controlled refresh](https://docs.scriptable.app/listwidget/)
- [Widget tap targets and small-widget restrictions](https://docs.scriptable.app/widgetstack/)
- [Speech](https://docs.scriptable.app/speech/)

The browser setup page is a preview of the layout and generated script. Actual iPhone Home Screen installation remains a manual step on the user’s device.
