import re
import sys
from pathlib import Path

ROOT = Path('C:/Users/Admin/Desktop/care-suite')

REPLS = {
    'apps/web/src/utils/carePlanPrintGenerator.ts': [
        (r'\.page \{\s*page: icp;\s*page-break-after: always;\s*break-after: page;\s*position: relative;\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '''    .page {
      page: icp;
      page-break-after: always;
      break-after: page;
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 275mm;
    }'''),
    ],
    'apps/web/src/utils/followUpBagCoverGenerator.ts': [
        (r'\.page \{\s*width: 100%;\s*min-height: 100vh;\s*display: flex;\s*flex-direction: column;\s*position: relative;\s*padding: 5mm;\s*\}',
         '''        .page {
          width: 100%;
          min-height: 190mm;
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 5mm;
        }'''),
        (r'\.grid \{\s*display: grid;\s*grid-template-columns: 1fr 1fr;\s*grid-template-rows: 1fr 1fr;\s*gap: 8mm;\s*flex: 1;\s*width: 100%;\s*height: calc\(100vh - 15mm\);\s*\}',
         '''        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 8mm;
          flex: 1;
          width: 100%;
        }'''),
    ],
    'apps/web/src/utils/followUpRecordWorksheetGenerator.ts': [
        (r'\.page \{\s*width: 100%;\s*min-height: 100vh;\s*display: flex;\s*flex-direction: column;\s*position: relative;\s*\}',
         '''        .page {
          width: 100%;
          min-height: 180mm;
          display: flex;
          flex-direction: column;
          position: relative;
        }'''),
    ],
    'apps/web/src/utils/woundAssessmentPrintGenerator.ts': [
        (r'\.container \{\s*width:100%; box-sizing:border-box; display:flex; flex-direction:column; min-height:100vh; \}',
         '.container { width:100%; box-sizing:border-box; display:flex; flex-direction:column; min-height:276mm; }'),
    ],
    'apps/web/src/utils/medicationListHtmlGenerator.ts': [
        (r'\.print-page \{\s*width: 100%;\s*box-sizing: border-box;\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '.print-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; }'),
        (r'\.print-page \.container \{\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '.print-page .container { display: flex; flex-direction: column; }'),
    ],
    'apps/web/src/utils/intakeOutputHtmlGenerator.ts': [
        (r'\.pw \{\s*min-height: 100vh;\s*display: flex;\s*justify-content: center;\s*align-items: flex-start;\s*\}',
         '.pw { min-height: 287mm; display: flex; justify-content: center; align-items: flex-start; }'),
        (r'\.page \{\s*width: 200mm;\s*background: #fff;\s*flex-shrink: 0;\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '''.page {
  width: 200mm;
  background: #fff;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 287mm;
}'''),
    ],
    'apps/web/src/utils/restraintUsageRecordPrintGenerator.ts': [
        (r'\.page \{\s*width: 100%;\s*box-sizing: border-box;\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '''.page {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 277mm;
}'''),
    ],
    'doc_html/領回託管財物證明書.html': [
        (r'\.a4-container \{\s*width: 210mm;\s*min-height: 100vh;\s*padding: 10mm 15mm 0 15mm; /\* 底部 padding 由絕對定位控制 \*/\s*box-sizing: border-box;\s*display: flex;\s*flex-direction: column;\s*position: relative;\s*overflow: hidden;\s*\}',
         '''        .a4-container {
            width: 210mm;
            min-height: 297mm;
            padding: 10mm 15mm 0 15mm; /* 底部 padding 由絕對定位控制 */
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
        }'''),
    ],
    'doc_html/ICP print sample/icp-header-all-info-preview.html': [
        (r'\.page \{\s*page: icp;\s*page-break-after: always;\s*break-after: page;\s*position: relative;\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '''    .page {
      page: icp;
      page-break-after: always;
      break-after: page;
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 275mm;
    }'''),
    ],
    'doc_html/ICP print sample/icp-header-layout-options.html': [
        (r'\.page \{\s*page: icp;\s*page-break-after: always;\s*break-after: page;\s*position: relative;\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '''    .page {
      page: icp;
      page-break-after: always;
      break-after: page;
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 275mm;
    }'''),
    ],
    'doc_html/ICP print sample/icp-layout-preview.html': [
        (r'\.page \{\s*page: icp;\s*page-break-after: always;\s*break-after: page;\s*position: relative;\s*display: flex;\s*flex-direction: column;\s*min-height: 100vh;\s*\}',
         '''    .page {
      page: icp;
      page-break-after: always;
      break-after: page;
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 275mm;
    }'''),
    ],
}

changed = 0
for rel_path, rules in REPLS.items():
    path = ROOT / rel_path
    if not path.exists():
        print(f'SKIP (not found): {rel_path}', file=sys.stderr)
        continue
    with open(path, 'r', encoding='utf-8', newline='') as f:
        original = f.read()
    text = original
    for pat, repl in rules:
        text, n = re.subn(pat, repl, text, flags=re.DOTALL)
        if n:
            print(f'CHANGED {n} in {rel_path}')
            changed += n
        else:
            print(f'NO MATCH for pattern in {rel_path}', file=sys.stderr)
    if text != original:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(text)

print(f'Total replacements: {changed}')
