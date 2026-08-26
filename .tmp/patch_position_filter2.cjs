const fs = require('fs');
const p = 'apps/web/src/components/RosterScheduleView.tsx';
let t = fs.readFileSync(p, 'utf8');
const re = /(\);\r?\n  const \[draggedRecord, setDraggedRecord\] = useState<UserLeaveRecord \| null>\(null\);)/;
const insert = `);\n  useEffect(() => {\n    if (!positionFilter && positionOptions.length > 0) {\n      setPositionFilter(positionOptions[0]);\n    }\n  }, [positionFilter, positionOptions]);\n  const [draggedRecord, setDraggedRecord] = useState<UserLeaveRecord | null>(null);`;
if (!re.test(t)) { console.error('NO MATCH'); process.exit(1); }
t = t.replace(re, insert);
fs.writeFileSync(p, t);
console.log('OK');
