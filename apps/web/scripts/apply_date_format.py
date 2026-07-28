import os, re, sys
from pathlib import Path

# Run from repo root or apps/web
root = Path(__file__).resolve().parent.parent
src = root / 'src'

EXCEL_FILES = {
    'bedLayoutExcelGenerator.ts',
    'combinedScheduleExcelGenerator.ts',
    'healthRecordExcelGenerator.ts',
    'medicationRecordExcelGenerator.ts',
    'personalMedicationListExcelGenerator.ts',
    'prescriptionExcelGenerator.ts',
    'printFormExcelGenerator.ts',
    'restraintConsentExcelGenerator.ts',
    'restraintObservationChartExcelGenerator.ts',
    'waitingListExcelGenerator.ts',
}

SKIP_FILES = {
    'MonitoringTaskWorksheetModal.tsx',  # keeps Chinese date display
    'Reports.tsx',                       # has Chinese date display; handle manually
    'HealthAssessment.tsx',              # time-only display, leave
    'HealthRecordModal.tsx',               # internal timezone calc, leave
    'workflowStatusHelper.ts',             # internal timezone calc, leave
    'TemplateManagement.tsx.backup',       # backup file, ignore
    'dateFormat.ts',                     # the tool itself
}

def relative_utils_import(file_path: Path) -> str:
    rel = file_path.relative_to(src)
    depth = len(rel.parts) - 1
    if rel.parts[0] == 'utils':
        return "from './dateFormat'"
    prefix = '../' * depth
    return f"from '{prefix}utils/dateFormat'"

def add_imports(content: str, file_path: Path, needs_date: bool, needs_datetime: bool) -> str:
    if not needs_date and not needs_datetime:
        return content

    existing_import_match = re.search(
        r"import\s*\{[^}]*\bformatDisplayDate\b[^}]*\}\s*from\s*['"]\./dateFormat['"]" if file_path.name.endswith('.ts') and file_path.parent.name == 'utils' else r"import\s*\{[^}]*\bformatDisplayDate\b[^}]*\}\s*from\s*['"](?:\.\./)+utils/dateFormat['"]",
        content,
    )
    # More robust: search any import line containing formatDisplayDate
    existing_import_match = re.search(
        r"import\s*\{[^}]*\bformatDisplayDate\b[^}]*\}\s*from\s*['"][^'"]+dateFormat['"];?",
        content,
    )

    names = []
    if needs_date:
        names.append('formatDisplayDate')
    if needs_datetime:
        names.append('formatDisplayDateTime')

    if existing_import_match:
        line = existing_import_match.group(0)
        new_line = line
        for name in names:
            if name not in line:
                # insert before the closing brace
                new_line = re.sub(r'(\}\s*from)', f', {name}\\1', new_line, count=1)
        if new_line != line:
            content = content.replace(line, new_line, 1)
        return content

    # Insert new import after the last existing import
    import_block = re.search(r"^(import\s+.*?;\s*\r?\n)+", content, re.MULTILINE)
    new_import = f"import {{ {', '.join(names)} }} {relative_utils_import(file_path)};\n"
    if import_block:
        end = import_block.end()
        content = content[:end] + new_import + content[end:]
    else:
        content = new_import + content
    return content

def transform_file(file_path: Path) -> bool:
    name = file_path.name
    if name in SKIP_FILES or name in EXCEL_FILES:
        return False

    content = file_path.read_text(encoding='utf-8', newline='')
    original = content

    needs_date = False
    needs_datetime = False

    # 1. new Date(EXPR).toLocaleDateString('zh-TW'|'zh-HK'[, opts])
    # Use a stack-based matcher to allow parentheses in EXPR.
    def replace_new_date_locale(match: re.Match) -> str:
        nonlocal needs_date
        needs_date = True
        expr = match.group(1)
        return f"formatDisplayDate({expr})"

    # pattern for simple cases without nested parens: covers most
    content = re.sub(
        r"new Date\(([^()]+)\)\.toLocaleDateString\(['\"](zh-TW|zh-HK)['\"](?:,[^)]*)?\)",
        replace_new_date_locale,
        content,
    )

    # 2. new Date().toLocaleDateString(...)
    content = re.sub(
        r"new Date\(\)\.toLocaleDateString\(['\"](zh-TW|zh-HK)['\"](?:,[^)]*)?\)",
        lambda m: (needs_date := True) and "formatDisplayDate(new Date())",
        content,
    )

    # 3. identifier.toLocaleDateString(...)
    content = re.sub(
        r"(\w+)\.toLocaleDateString\(['\"](zh-TW|zh-HK)['\"](?:,[^)]*)?\)",
        lambda m: (needs_date := True) and f"formatDisplayDate({m.group(1)})",
        content,
    )

    # 4. new Date(EXPR).toLocaleString('zh-TW'|'zh-HK'[, opts])
    content = re.sub(
        r"new Date\(([^()]+)\)\.toLocaleString\(['\"](zh-TW|zh-HK)['\"](?:,[^)]*)?\)",
        lambda m: (needs_datetime := True) and f"formatDisplayDateTime({m.group(1)})",
        content,
    )

    # 5. new Date().toLocaleString(...)
    content = re.sub(
        r"new Date\(\)\.toLocaleString\(['\"](zh-TW|zh-HK)['\"](?:,[^)]*)?\)",
        lambda m: (needs_datetime := True) and "formatDisplayDateTime(new Date())",
        content,
    )

    # 6. identifier.toLocaleString(...)
    content = re.sub(
        r"(\w+)\.toLocaleString\(['\"](zh-TW|zh-HK)['\"](?:,[^)]*)?\)",
        lambda m: (needs_datetime := True) and f"formatDisplayDateTime({m.group(1)})",
        content,
    )

    # manual special replacements for nested call cases the simple regex missed
    # these will be handled by the next manual pass if they still exist, but we can include safe explicit ones
    # (none here; we will rely on post-grep)

    if content != original:
        content = add_imports(content, file_path, needs_date, needs_datetime)
        file_path.write_text(content, encoding='utf-8', newline='')
        return True
    return False

def main():
    changed = []
    for ext in ('*.ts', '*.tsx'):
        for p in src.rglob(ext):
            if p.is_file() and p.name not in EXCEL_FILES and p.name not in SKIP_FILES:
                if transform_file(p):
                    changed.append(str(p.relative_to(root)))
    print(f"Changed {len(changed)} files:")
    for c in changed:
        print('  ', c)

if __name__ == '__main__':
    main()
