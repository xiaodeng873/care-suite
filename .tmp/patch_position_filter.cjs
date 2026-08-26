const fs = require('fs');
const p = 'apps/web/src/components/RosterScheduleView.tsx';
let t = fs.readFileSync(p, 'utf8');
const olds = [
  `  const [positionFilter, setPositionFilter] = useState<string>(() => {\n    const first = getRosterGroupOptions(users)[0] ?? '';\n    return first;\n  });\n  const [draggedRecord, setDraggedRecord] = useState<UserLeaveRecord | null>(null);`,
  `  const [positionFilter, setPositionFilter] = useState<string>(() => {\r\n    const first = getRosterGroupOptions(users)[0] ?? '';\r\n    return first;\r\n  });\r\n  const [draggedRecord, setDraggedRecord] = useState<UserLeaveRecord | null>(null);`,
];
const newStr = `  const [positionFilter, setPositionFilter] = useState<string>(() => {\n    const first = getRosterGroupOptions(users)[0] ?? '';\n    return first;\n  });\n  useEffect(() => {\n    if (!positionFilter && positionOptions.length > 0) {\n      setPositionFilter(positionOptions[0]);\n    }\n  }, [positionFilter, positionOptions]);\n  const [draggedRecord, setDraggedRecord] = useState<UserLeaveRecord | null>(null);`;
let done = false;
for (const o of olds) {
  if (t.includes(o)) {
    t = t.replace(o, newStr);
    done = true;
    break;
  }
}
if (!done) {
  console.error('MISS');
  process.exit(1);
}
fs.writeFileSync(p, t);
console.log('OK');
