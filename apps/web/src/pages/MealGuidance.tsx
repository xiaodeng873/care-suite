import React, { useState } from 'react';
import { 
  Utensils, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter,
  Download,
  User,
  Calendar,
  FileText,
  Droplets,
  ChevronUp,
  ChevronDown,
  X,
  BarChart3
} from 'lucide-react';
import { usePatients, type MealGuidance, type MealCombinationType, type SpecialDietType } from '../context/PatientContext';
import MealGuidanceModal from '../components/MealGuidanceModal';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';

type SortField = '院友姓名' | 'meal_combination' | 'guidance_date' | 'guidance_source' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  meal_combination: string;
  special_diets: string;
  needs_thickener: string;
  guidance_source: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const MealGuidance: React.FC = () => {
  const { mealGuidances, patients, deleteMealGuidance, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedGuidance, setSelectedGuidance] = useState<MealGuidance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    meal_combination: '',
    special_diets: '',
    needs_thickener: '',
    guidance_source: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showStatistics, setShowStatistics] = useState(false);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  const filteredGuidances = mealGuidances.filter(guidance => {
    const patient = patients.find(p => p.院友id === guidance.patient_id);
    
    // 確保院友存在
    if (!patient) {
      return false;
    }
    
    // 先應用進階篩選
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !patient?.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !patient?.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
      return false;
    }
    if (advancedFilters.meal_combination && guidance.meal_combination !== advancedFilters.meal_combination) {
      return false;
    }
    if (advancedFilters.special_diets && !guidance.special_diets.includes(advancedFilters.special_diets as SpecialDietType)) {
      return false;
    }
    if (advancedFilters.needs_thickener) {
      const needsThickener = guidance.needs_thickener;
      if (advancedFilters.needs_thickener === '是' && !needsThickener) return false;
      if (advancedFilters.needs_thickener === '否' && needsThickener) return false;
    }
    if (advancedFilters.guidance_source && !guidance.guidance_source?.toLowerCase().includes(advancedFilters.guidance_source.toLowerCase())) {
      return false;
    }
    
    // 日期區間篩選
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const guidanceDate = guidance.guidance_date ? new Date(guidance.guidance_date) : null;
      if (guidanceDate) {
        if (advancedFilters.startDate && guidanceDate < new Date(advancedFilters.startDate)) {
          return false;
        }
        if (advancedFilters.endDate && guidanceDate > new Date(advancedFilters.endDate)) {
          return false;
        }
      }
    }
    
    // 然後應用搜索條件
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = patient?.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guidance.meal_combination.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guidance.special_diets.some(diet => diet.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         guidance.guidance_source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guidance.thickener_amount?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         false;
    }
    
    return matchesSearch;
  });

  const hasAdvancedFilters = () => {
    return Object.values(advancedFilters).some(value => value !== '');
  };

  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({
      床號: '',
      中文姓名: '',
      meal_combination: '',
      special_diets: '',
      needs_thickener: '',
      guidance_source: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };

  const getUniqueOptions = (field: string) => {
    const values = new Set<string>();
    mealGuidances.forEach(guidance => {
      let value = '';
      
      switch (field) {
        case 'guidance_source':
          value = guidance.guidance_source || '';
          break;
        default:
          return;
      }
      
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  const sortedGuidances = [...filteredGuidances].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);
    
    let valueA: string | number = '';
    let valueB: string | number = '';
    
    switch (sortField) {
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case 'meal_combination':
        valueA = a.meal_combination;
        valueB = b.meal_combination;
        break;
      case 'guidance_date':
        valueA = a.guidance_date ? new Date(a.guidance_date).getTime() : 0;
        valueB = b.guidance_date ? new Date(b.guidance_date).getTime() : 0;
        break;
      case 'guidance_source':
        valueA = a.guidance_source || '';
        valueB = b.guidance_source || '';
        break;
      case 'created_at':
        valueA = new Date(a.created_at).getTime();
        valueB = new Date(b.created_at).getTime();
        break;
    }
    
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });

  // Pagination logic
  const totalItems = sortedGuidances.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGuidances = sortedGuidances.slice(startIndex, endIndex);

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleEdit = (guidance: MealGuidance) => {
    setSelectedGuidance(guidance);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const guidance = mealGuidances.find(g => g.id === id);
    const patient = patients.find(p => p.院友id === guidance?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 的餐膳指引嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteMealGuidance(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除餐膳指引失敗，請重試');
      } finally {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRows.size === 0) {
      alert('請先選擇要刪除的記錄');
      return;
    }

    const selectedGuidances = sortedGuidances.filter(g => selectedRows.has(g.id));
    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆餐膳指引嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const guidanceId of deletingArray) {
        await deleteMealGuidance(guidanceId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆餐膳指引`);
    } catch (error) {
      console.error('批量刪除餐膳指引失敗:', error);
      alert('批量刪除餐膳指引失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (guidanceId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(guidanceId)) {
      newSelected.delete(guidanceId);
    } else {
      newSelected.add(guidanceId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedGuidances.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedGuidances.map(g => g.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    paginatedGuidances.forEach(guidance => {
      if (!selectedRows.has(guidance.id)) {
        newSelected.add(guidance.id);
      }
    });
    setSelectedRows(newSelected);
  };

  const handleExportSelected = () => {
    const selectedGuidances = paginatedGuidances.filter(g => selectedRows.has(g.id));
    
    if (selectedGuidances.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }

    const exportData = selectedGuidances.map(guidance => {
      const patient = patients.find(p => p.院友id === guidance.patient_id);
      return {
        床號: patient?.床號 || '',
        中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
        餐膳組合: guidance.meal_combination,
        特殊餐膳: guidance.special_diets.join(', ') || '無',
        需要凝固粉: guidance.needs_thickener ? '是' : '否',
        凝固粉分量: guidance.thickener_amount || '',
        雞蛋數目: guidance.egg_quantity || '',
        備註: guidance.remarks || '',
        指引日期: guidance.guidance_date ? new Date(guidance.guidance_date).toLocaleDateString('zh-TW') : '',
        指引出處: guidance.guidance_source || '',
        建立日期: new Date(guidance.created_at).toLocaleDateString('zh-TW')
      };
    });

    const headers = ['床號', '中文姓名', '餐膳組合', '特殊餐膳', '需要凝固粉', '凝固粉分量', '雞蛋數目', '備註', '指引日期', '指引出處', '建立日期'];
    const csvContent = [
      `"餐膳指引記錄"`,
      `"生成日期: ${new Date().toLocaleDateString('zh-TW')}"`,
      `"總記錄數: ${exportData.length}"`,
      '',
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `餐膳指引記錄_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMealCombinationColor = (combination: MealCombinationType) => {
    if (combination.includes('正飯')) return 'bg-green-100 text-green-800';
    if (combination.includes('軟飯')) return 'bg-yellow-100 text-yellow-800';
    if (combination.includes('糊飯')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getSpecialDietColor = (diet: SpecialDietType) => {
    switch (diet) {
      case '糖尿餐': return 'bg-blue-100 text-blue-800';
      case '痛風餐': return 'bg-purple-100 text-purple-800';
      case '低鹽餐': return 'bg-green-100 text-green-800';
      case '雞蛋': return 'bg-yellow-100 text-yellow-800';
      case '素食': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </th>
  );

  // 統計數據
  const statistics = {
    // 餐膳總數
    總餐膳數: filteredGuidances.length,
    
    // 餐膳組合統計
    正飯正餸: filteredGuidances.filter(g => g.meal_combination === '正飯+正餸').length,
    正飯碎餸: filteredGuidances.filter(g => g.meal_combination === '正飯+碎餸').length,
    正飯糊餸: filteredGuidances.filter(g => g.meal_combination === '正飯+糊餸').length,
    軟飯正餸: filteredGuidances.filter(g => g.meal_combination === '軟飯+正餸').length,
    軟飯碎餸: filteredGuidances.filter(g => g.meal_combination === '軟飯+碎餸').length,
    軟飯糊餸: filteredGuidances.filter(g => g.meal_combination === '軟飯+糊餸').length,
    糊飯糊餸: filteredGuidances.filter(g => g.meal_combination === '糊飯+糊餸').length,
    
    // 分類統計
    正飯: filteredGuidances.filter(g => g.meal_combination.includes('正飯')).length,
    軟飯: filteredGuidances.filter(g => g.meal_combination.includes('軟飯')).length,
    糊飯: filteredGuidances.filter(g => g.meal_combination.includes('糊飯')).length,
    正餸: filteredGuidances.filter(g => g.meal_combination.includes('正餸')).length,
    碎餸: filteredGuidances.filter(g => g.meal_combination.includes('碎餸')).length,
    糊餸: filteredGuidances.filter(g => g.meal_combination.includes('糊餸')).length,
    
    // 特殊餐膳統計
    糖尿餐: filteredGuidances.filter(g => g.special_diets.includes('糖尿餐')).length,
    痛風餐: filteredGuidances.filter(g => g.special_diets.includes('痛風餐')).length,
    低鹽餐: filteredGuidances.filter(g => g.special_diets.includes('低鹽餐')).length,
    雞蛋: filteredGuidances.filter(g => g.special_diets.includes('雞蛋')).length,
    雞蛋總數: filteredGuidances
      .filter(g => g.special_diets.includes('雞蛋') && g.egg_quantity)
      .reduce((sum, g) => sum + (g.egg_quantity || 0), 0),
    
    // 凝固粉統計
    需要凝固粉: filteredGuidances.filter(g => g.needs_thickener).length
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">餐膳指引</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowStatistics(!showStatistics)}
              className="btn-secondary flex items-center space-x-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span>廚房統計</span>
            </button>
            {selectedRows.size > 0 && (
              <button
                onClick={handleExportSelected}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>匯出選定記錄</span>
              </button>
            )}
            <button
              onClick={() => {
                setSelectedGuidance(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增餐膳指引</span>
            </button>
          </div>
        </div>
      </div>

      {/* 廚房統計 */}
      {showStatistics && (
        <div className="sticky top-16 bg-white z-25 shadow-sm">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">廚房準備統計</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 總數統計 */}
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">總數統計</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">餐膳總數</span>
                  <span className="font-bold text-blue-600 text-lg">{statistics.總餐膳數} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">需要凝固粉</span>
                  <span className="font-medium text-blue-600">{statistics.需要凝固粉} 份</span>
                </div>
              </div>
            </div>

            {/* 主食統計 */}
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">主食需求</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">正飯</span>
                  <span className="font-medium text-green-600">{statistics.正飯} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">軟飯</span>
                  <span className="font-medium text-yellow-600">{statistics.軟飯} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">糊飯</span>
                  <span className="font-medium text-orange-600">{statistics.糊飯} 份</span>
                </div>
              </div>
            </div>

            {/* 配菜統計 */}
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">配菜需求</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">正餸</span>
                  <span className="font-medium text-green-600">{statistics.正餸} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">碎餸</span>
                  <span className="font-medium text-yellow-600">{statistics.碎餸} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">糊餸</span>
                  <span className="font-medium text-orange-600">{statistics.糊餸} 份</span>
                </div>
              </div>
            </div>

            {/* 特殊餐膳統計 */}
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">特殊餐膳需求</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">糖尿餐</span>
                  <span className="font-medium text-blue-600">{statistics.糖尿餐} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">痛風餐</span>
                  <span className="font-medium text-purple-600">{statistics.痛風餐} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">低鹽餐</span>
                  <span className="font-medium text-green-600">{statistics.低鹽餐} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">雞蛋</span>
                  <span className="font-medium text-yellow-600">{statistics.雞蛋總數} 隻</span>
                </div>

              </div>
            </div>
          </div>

          {/* 詳細組合統計 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-md font-medium text-gray-700 mb-3">詳細組合統計</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{statistics.正飯正餸}</div>
                <div className="text-xs text-gray-600">正飯+正餸</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{statistics.正飯碎餸}</div>
                <div className="text-xs text-gray-600">正飯+碎餸</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{statistics.正飯糊餸}</div>
                <div className="text-xs text-gray-600">正飯+糊餸</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-bold text-yellow-600">{statistics.軟飯正餸}</div>
                <div className="text-xs text-gray-600">軟飯+正餸</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-bold text-yellow-600">{statistics.軟飯碎餸}</div>
                <div className="text-xs text-gray-600">軟飯+碎餸</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">{statistics.軟飯糊餸}</div>
                <div className="text-xs text-gray-600">軟飯+糊餸</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">{statistics.糊飯糊餸}</div>
                <div className="text-xs text-gray-600">糊飯+糊餸</div>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      <div className={`sticky ${showStatistics ? 'top-80' : 'top-16'} bg-white z-20 shadow-sm`}>
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友姓名、床號、餐膳組合、特殊餐膳、指引出處或凝固粉分量..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`btn-secondary flex items-center space-x-2 ${
                  showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''
                } ${hasAdvancedFilters() ? 'border-blue-300' : ''}`}
              >
                <Filter className="h-4 w-4" />
                <span>進階篩選</span>
                {hasAdvancedFilters() && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    已套用
                  </span>
                )}
              </button>
              
              {(searchTerm || hasAdvancedFilters()) && (
                <button
                  onClick={clearFilters}
                  className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  <span>清除</span>
                </button>
              )}
            </div>
          </div>
          
          {showAdvancedFilters && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">進階篩選</h3>
              
              <div className="mb-4">
                <label className="form-label">指引日期區間</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={advancedFilters.startDate}
                    onChange={(e) => updateAdvancedFilter('startDate', e.target.value)}
                    className="form-input"
                    placeholder="開始日期"
                  />
                  <span className="text-gray-500">至</span>
                  <input
                    type="date"
                    value={advancedFilters.endDate}
                    onChange={(e) => updateAdvancedFilter('endDate', e.target.value)}
                    className="form-input"
                    placeholder="結束日期"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">床號</label>
                  <input
                    type="text"
                    value={advancedFilters.床號}
                    onChange={(e) => updateAdvancedFilter('床號', e.target.value)}
                    className="form-input"
                    placeholder="搜索床號..."
                  />
                </div>
                
                <div>
                  <label className="form-label">中文姓名</label>
                  <input
                    type="text"
                    value={advancedFilters.中文姓名}
                    onChange={(e) => updateAdvancedFilter('中文姓名', e.target.value)}
                    className="form-input"
                    placeholder="搜索姓名..."
                  />
                </div>
                
                <div>
                  <label className="form-label">餐膳組合</label>
                  <select
                    value={advancedFilters.meal_combination}
                    onChange={(e) => updateAdvancedFilter('meal_combination', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有組合</option>
                    <option value="正飯+正餸">正飯+正餸</option>
                    <option value="正飯+碎餸">正飯+碎餸</option>
                    <option value="正飯+糊餸">正飯+糊餸</option>
                    <option value="軟飯+正餸">軟飯+正餸</option>
                    <option value="軟飯+碎餸">軟飯+碎餸</option>
                    <option value="軟飯+糊餸">軟飯+糊餸</option>
                    <option value="糊飯+糊餸">糊飯+糊餸</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">特殊餐膳</label>
                  <select
                    value={advancedFilters.special_diets}
                    onChange={(e) => updateAdvancedFilter('special_diets', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有類型</option>
                    <option value="糖尿餐">糖尿餐</option>
                    <option value="痛風餐">痛風餐</option>
                    <option value="低鹽餐">低鹽餐</option>
                    <option value="雞蛋">雞蛋</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">需要凝固粉</label>
                  <select
                    value={advancedFilters.needs_thickener}
                    onChange={(e) => updateAdvancedFilter('needs_thickener', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有類型</option>
                    <option value="是">需要</option>
                    <option value="否">不需要</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">指引出處</label>
                  <input
                    list="guidance-source-options"
                    value={advancedFilters.guidance_source}
                    onChange={(e) => updateAdvancedFilter('guidance_source', e.target.value)}
                    className="form-input"
                    placeholder="選擇或輸入指引出處..."
                  />
                  <datalist id="guidance-source-options">
                    {getUniqueOptions('guidance_source').map(option => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="form-label">在住狀態</label>
                  <select
                    value={advancedFilters.在住狀態}
                    onChange={(e) => updateAdvancedFilter('在住狀態', e.target.value)}
                    className="form-input"
                  >
                    <option value="在住">在住</option>
                    <option value="待入住">待入住</option>
                    <option value="已退住">已退住</option>
                    <option value="全部">全部</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
        </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 筆餐膳指引 (共 {mealGuidances.length} 筆)</span>
            {(searchTerm || hasAdvancedFilters()) && (
              <span className="text-blue-600">已套用篩選條件</span>
            )}
          </div>
        </div>
      </div>

      {totalItems > 0 && (
        <div className={`sticky ${showStatistics ? 'top-96' : 'top-40'} bg-white z-10 shadow-sm`}>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === paginatedGuidances.length ? '取消全選' : '全選'}
                </button>
                <button
                  onClick={handleInvertSelection}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  反選
                </button>
                {selectedRows.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                    disabled={deletingIds.size > 0}
                  >
                    刪除選定記錄 ({selectedRows.size})
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {totalItems} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {paginatedGuidances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedGuidances.length && paginatedGuidances.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <SortableHeader field="meal_combination">餐膳組合</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    特殊餐膳
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    凝固粉
                  </th>
                  <SortableHeader field="guidance_date">指引日期</SortableHeader>
                  <SortableHeader field="guidance_source">指引出處</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    備註
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedGuidances.map(guidance => {
                  const patient = patients.find(p => p.院友id === guidance.patient_id);
                  
                  return (
                    <tr 
                      key={guidance.id} 
                      className={`hover:bg-gray-50 ${selectedRows.has(guidance.id) ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(guidance)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(guidance.id)}
                          onChange={() => handleSelectRow(guidance.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                            {patient?.院友相片 ? (
                              <img 
                                src={patient.院友相片} 
                                alt={patient.中文姓名} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {patient ? (
                                <PatientTooltip patient={patient}>
                                  <span className="cursor-help hover:text-blue-600 transition-colors">
                                    {patient.中文姓氏}{patient.中文名字}
                                  </span>
                                </PatientTooltip>
                              ) : (
                                '-'
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{patient?.床號}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMealCombinationColor(guidance.meal_combination)}`}>
                          {guidance.meal_combination}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {guidance.special_diets.length > 0 ? (
                            guidance.special_diets.map(diet => (
                              <span key={diet} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSpecialDietColor(diet)}`}>
                                {diet}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 text-sm">無</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {guidance.needs_thickener ? (
                          <div className="flex items-center space-x-1">
                            <Droplets className="h-4 w-4 text-blue-600" />
                            <span className="text-blue-600 font-medium">
                              {guidance.thickener_amount || '是'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">否</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {guidance.guidance_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{new Date(guidance.guidance_date).toLocaleDateString('zh-TW')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {guidance.guidance_source ? (
                          <div className="flex items-center space-x-1">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span>{guidance.guidance_source}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={guidance.remarks || ''}>
                          {guidance.remarks || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(guidance)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(guidance.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(guidance.id)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={deletingIds.has(guidance.id)}
                          >
                            {deletingIds.has(guidance.id) ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Utensils className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的餐膳指引' : '暫無餐膳指引'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立餐膳指引'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增餐膳指引
              </button>
            ) : (
              <button
                onClick={clearFilters}
                className="btn-secondary"
              >
                清除所有篩選
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">每頁顯示:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="form-input text-sm w-20"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={150}>150</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={999999}>全部</option>
              </select>
              <span className="text-sm text-gray-700">筆記錄</span>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一頁
                </button>
                
                {generatePageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一頁
                </button>
              </div>
            )}
            
            <div className="text-sm text-gray-700">
              第 {currentPage} 頁，共 {totalPages} 頁
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <MealGuidanceModal
          guidance={selectedGuidance}
          onClose={() => {
            setShowModal(false);
            setSelectedGuidance(null);
          }}
        />
      )}
    </div>
  );
};

export default MealGuidance;