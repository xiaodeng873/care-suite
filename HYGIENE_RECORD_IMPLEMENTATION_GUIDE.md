# Hygiene Record Implementation Guide

## Summary
This document provides guidance for completing the hygiene record form implementation in RecordDetailScreen.tsx.

## Completed Tasks ✅

1. ✅ Database migrations created:
   - `20251221000000_extend_patient_care_tabs_tracking.sql` - Adds `last_activated_at` field and trigger
   - `20251221000001_create_hygiene_records_table.sql` - Creates hygiene_records table

2. ✅ Database layer (database.ts):
   - Added `HygieneRecord` interface with 11 care items + 3 bowel fields
   - Updated `PatientCareTab` to include 'hygiene' and `last_activated_at`
   - Implemented CRUD functions: `getHygieneRecordsInDateRange`, `createHygieneRecord`, `updateHygieneRecord`, `deleteHygieneRecord`

3. ✅ Helper functions (careRecordHelper.ts):
   - Updated `isPastSlot` to handle 'daily' time slot (checks if past 23:59:59 of the date)

4. ✅ CareRecordsScreen.tsx:
   - Added hygiene to TAB_CONFIG with medical icon
   - Added hygieneRecords and careTabs state
   - Updated loadData and loadMonthData to fetch hygiene records
   - Implemented global red dot logic using `last_activated_at` from patient_care_tabs
   - Added `renderHygieneTable` function
   - Updated optimistic update handlers for hygiene records
   - Updated calendar date badge logic to use `last_activated_at`

5. ✅ Translations (i18n.ts):
   - Added all hygiene-related translations for zh-TW, zh-CN, and English
   - Includes: hygieneRecord, bath, faceWash, shave, oralCare, dentureCare, nailTrim, beddingChange, sheetPillowChange, cupWash, bedsideCabinet, wardrobe, bowelCount, bowelAmount, bowelConsistency, daily

6. ✅ RecordDetailScreen.tsx (Partial):
   - Updated RecordType to include 'hygiene'
   - Added 14 state variables for hygiene record (11 care items + 3 bowel fields)
   - Imported HygieneRecord type and CRUD functions

## Remaining Task: Complete RecordDetailScreen.tsx Hygiene Form

### Required Code Changes

The following sections in RecordDetailScreen.tsx need to be updated:

#### 1. Initialize State from Existing Record (useEffect)

Find the useEffect that initializes form fields from existingRecord and add hygiene case:

```typescript
useEffect(() => {
  // ... existing code for patrol, diaper, restraint, position ...
  
  if (recordType === 'hygiene' && existingRecord) {
    const rec = existingRecord as HygieneRecord;
    setHasBath(rec.has_bath || false);
    setHasFaceWash(rec.has_face_wash || false);
    setHasShave(rec.has_shave || false);
    setHasOralCare(rec.has_oral_care || false);
    setHasDentureCare(rec.has_denture_care || false);
    setHasNailTrim(rec.has_nail_trim || false);
    setHasBeddingChange(rec.has_bedding_change || false);
    setHasSheetPillowChange(rec.has_sheet_pillow_change || false);
    setHasCupWash(rec.has_cup_wash || false);
    setHasBedsideCabinet(rec.has_bedside_cabinet || false);
    setHasWardrobe(rec.has_wardrobe || false);
    setBowelCount(rec.bowel_count !== null ? String(rec.bowel_count) : '');
    setBowelAmount(rec.bowel_amount || '');
    setBowelConsistency(rec.bowel_consistency || '');
    setRecorder(rec.recorder || staffName || '');
    setNotes(rec.notes || '');
    if (isStatusNote(rec.notes)) setStatus(rec.notes);
  }
}, [existingRecord, recordType]);
```

#### 2. Add Status Change Handler for Hygiene

Find the handleStatusChange function and add hygiene case:

```typescript
const handleStatusChange = (newStatus: '' | '入院' | '渡假' | '外出') => {
  setStatus(newStatus);
  
  switch (recordType) {
    // ... existing cases ...
    case 'hygiene':
      if (newStatus) {
        // Clear all hygiene fields when status is set
        setHasBath(false);
        setHasFaceWash(false);
        setHasShave(false);
        setHasOralCare(false);
        setHasDentureCare(false);
        setHasNailTrim(false);
        setHasBeddingChange(false);
        setHasSheetPillowChange(false);
        setHasCupWash(false);
        setHasBedsideCabinet(false);
        setHasWardrobe(false);
        setBowelCount('');
        setBowelAmount('');
        setBowelConsistency('');
      }
      break;
  }
};
```

#### 3. Add Save Logic for Hygiene

Find the handleSave function and add hygiene case before the default case:

```typescript
case 'hygiene': {
  if (!recorder.trim()) {
    Alert.alert(t('inputError'), t('recorderRequired'));
    return;
  }
  
  // Validate bowel count if provided
  let parsedBowelCount: number | null = null;
  if (bowelCount.trim()) {
    parsedBowelCount = parseInt(bowelCount);
    if (isNaN(parsedBowelCount) || parsedBowelCount < 0) {
      Alert.alert(t('inputError'), '大便次數必須是非負整數');
      return;
    }
  }
  
  const hygieneData: Omit<HygieneRecord, 'id' | 'created_at' | 'updated_at'> = {
    patient_id: patient.院友id,
    record_date: date,
    time_slot: 'daily',
    has_bath: hasBath,
    has_face_wash: hasFaceWash,
    has_shave: hasShave,
    has_oral_care: hasOralCare,
    has_denture_care: hasDentureCare,
    has_nail_trim: hasNailTrim,
    has_bedding_change: hasBeddingChange,
    has_sheet_pillow_change: hasSheetPillowChange,
    has_cup_wash: hasCupWash,
    has_bedside_cabinet: hasBedsideCabinet,
    has_wardrobe: hasWardrobe,
    bowel_count: parsedBowelCount,
    bowel_amount: parsedBowelCount === 0 ? null : (bowelAmount.trim() || null),
    bowel_consistency: parsedBowelCount === 0 ? null : (bowelConsistency.trim() || null),
    notes: status ? status : (notes.trim() || undefined),
    recorder: recorder.trim(),
  };
  
  if (existingRecord) {
    result = await updateHygieneRecord({ ...hygieneData, id: existingRecord.id, created_at: existingRecord.created_at, updated_at: existingRecord.updated_at });
  } else {
    result = await createHygieneRecord(hygieneData);
  }
  
  eventBus.emit('recordSaved', { recordType: 'hygiene', record: result, patientId: patient.院友id });
  break;
}
```

#### 4. Add Delete Logic for Hygiene

Find the handleDelete function and add hygiene case:

```typescript
case 'hygiene':
  await deleteHygieneRecord(existingRecord.id);
  eventBus.emit('recordDeleted', { recordType: 'hygiene', recordId: existingRecord.id, patientId: patient.院友id });
  break;
```

#### 5. Create Hygiene Form Rendering Function

Add this function before the main renderFormFields switch statement:

```typescript
const renderHygieneForm = () => {
  const parsedCount = bowelCount.trim() ? parseInt(bowelCount) : null;
  const isBowelFieldsDisabled = parsedCount === 0 || parsedCount === null;
  
  return (
    <View>
      {/* Care Items Section */}
      <Text style={styles.sectionTitle}>{t('careItems') || '護理項目'}</Text>
      
      {[
        { label: t('bath'), value: hasBath, setter: setHasBath },
        { label: t('faceWash'), value: hasFaceWash, setter: setHasFaceWash },
        { label: t('shave'), value: hasShave, setter: setHasShave },
        { label: t('oralCare'), value: hasOralCare, setter: setHasOralCare },
        { label: t('dentureCare'), value: hasDentureCare, setter: setHasDentureCare },
        { label: t('nailTrim'), value: hasNailTrim, setter: setHasNailTrim },
        { label: t('beddingChange'), value: hasBeddingChange, setter: setHasBeddingChange },
        { label: t('sheetPillowChange'), value: hasSheetPillowChange, setter: setHasSheetPillowChange },
        { label: t('cupWash'), value: hasCupWash, setter: setHasCupWash },
        { label: t('bedsideCabinet'), value: hasBedsideCabinet, setter: setHasBedsideCabinet },
        { label: t('wardrobe'), value: hasWardrobe, setter: setHasWardrobe },
      ].map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.checkboxRow, status && styles.checkboxRowDisabled]}
          onPress={() => !status && item.setter(!item.value)}
          disabled={!!status}
        >
          <View style={[styles.checkbox, item.value && styles.checkboxChecked]}>
            {item.value && <Ionicons name="checkmark" size={18} color="#fff" />}
          </View>
          <Text style={[styles.checkboxLabel, item.value && styles.checkboxLabelChecked]}>
            {item.label}
          </Text>
          <Text style={styles.checkboxStatus}>
            {item.value ? t('completed') || '已執行' : t('pending') || '未執行'}
          </Text>
        </TouchableOpacity>
      ))}
      
      {/* Bowel Movement Section */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('bowelMovement') || '大便記錄'}</Text>
      
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{t('bowelCount')}</Text>
        <TextInput
          style={[styles.input, status && styles.inputDisabled]}
          value={bowelCount}
          onChangeText={setBowelCount}
          keyboardType="numeric"
          placeholder="0"
          editable={!status}
        />
        <Text style={styles.fieldUnit}>{t('times')}</Text>
      </View>
      
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, isBowelFieldsDisabled && styles.fieldLabelDisabled]}>
          {t('bowelAmount')}
        </Text>
        <View style={styles.pickerContainer}>
          {['少', '中', '多'].map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                bowelAmount === option && styles.optionButtonSelected,
                (status || isBowelFieldsDisabled) && styles.optionButtonDisabled,
              ]}
              onPress={() => !status && !isBowelFieldsDisabled && setBowelAmount(option)}
              disabled={!!status || isBowelFieldsDisabled}
            >
              <Text style={[
                styles.optionButtonText,
                bowelAmount === option && styles.optionButtonTextSelected
              ]}>
                {translateOption(option, t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, isBowelFieldsDisabled && styles.fieldLabelDisabled]}>
          {t('bowelConsistency')}
        </Text>
        <View style={styles.pickerContainer}>
          {['硬', '軟', '稀', '水狀'].map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                bowelConsistency === option && styles.optionButtonSelected,
                (status || isBowelFieldsDisabled) && styles.optionButtonDisabled,
              ]}
              onPress={() => !status && !isBowelFieldsDisabled && setBowelConsistency(option)}
              disabled={!!status || isBowelFieldsDisabled}
            >
              <Text style={[
                styles.optionButtonText,
                bowelConsistency === option && styles.optionButtonTextSelected
              ]}>
                {option === '水狀' ? t('wateryStools') : translateOption(option, t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};
```

#### 6. Add Hygiene Case to Form Render Switch

Find the renderFormFields function's switch statement and add:

```typescript
case 'hygiene': return renderHygieneForm();
```

### Styles to Add (if not present)

Add these styles to the StyleSheet if they don't exist:

```typescript
sectionTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#111827',
  marginBottom: 12,
  marginTop: 8,
},
checkboxRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#e5e7eb',
},
checkboxRowDisabled: {
  opacity: 0.5,
},
checkbox: {
  width: 24,
  height: 24,
  borderRadius: 4,
  borderWidth: 2,
  borderColor: '#d1d5db',
  marginRight: 12,
  alignItems: 'center',
  justifyContent: 'center',
},
checkboxChecked: {
  backgroundColor: '#10b981',
  borderColor: '#10b981',
},
checkboxLabel: {
  flex: 1,
  fontSize: 15,
  color: '#374151',
},
checkboxLabelChecked: {
  color: '#111827',
  fontWeight: '500',
},
checkboxStatus: {
  fontSize: 13,
  color: '#6b7280',
},
fieldRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},
fieldLabel: {
  width: 100,
  fontSize: 15,
  color: '#374151',
},
fieldLabelDisabled: {
  color: '#9ca3af',
},
fieldUnit: {
  marginLeft: 8,
  fontSize: 15,
  color: '#6b7280',
},
pickerContainer: {
  flex: 1,
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
optionButton: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: '#d1d5db',
  backgroundColor: '#fff',
},
optionButtonSelected: {
  backgroundColor: '#3b82f6',
  borderColor: '#3b82f6',
},
optionButtonDisabled: {
  opacity: 0.4,
},
optionButtonText: {
  fontSize: 14,
  color: '#374151',
},
optionButtonTextSelected: {
  color: '#fff',
  fontWeight: '500',
},
```

## Testing Checklist

After completing the implementation:

1. [ ] Run database migrations
2. [ ] Test creating new hygiene record with all fields
3. [ ] Test editing existing hygiene record
4. [ ] Test deleting hygiene record
5. [ ] Verify red dot appears when daily record is missing
6. [ ] Verify red dot does NOT appear for dates before tab's `last_activated_at`
7. [ ] Test status notes (入院/渡假/外出) disable form fields
8. [ ] Test bowel count = 0 clears/disables bowel amount and consistency
9. [ ] Verify translations work in all 3 languages (zh-TW, zh-CN, en)
10. [ ] Test tab visibility when hiding/showing hygiene tab
11. [ ] Verify optimistic updates work correctly

## Key Design Decisions

1. **Time Slot**: Fixed to 'daily' (one record per day)
2. **Bowel Count Logic**: 
   - `null` = not recorded
   - `0` = no bowel movement (amount/consistency disabled and cleared)
   - `>0` = bowel movement occurred (amount/consistency optional but recommended)
3. **Red Dot Logic**: Uses `last_activated_at` from patient_care_tabs to determine starting date for missing record calculation
4. **Care Items**: All 11 items are boolean toggle switches (completed/not completed)
