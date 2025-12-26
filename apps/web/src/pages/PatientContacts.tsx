import { useState, useEffect } from 'react';
import { Edit3, Trash2, User, ChevronUp, ChevronDown, Filter, X, Search } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { getPatientContacts, deletePatientContact, PatientContact } from '../lib/database';
import PatientContactModal from '../components/PatientContactModal';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';

type SortField = '床號' | '中文姓名' | '在住狀態';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  聯絡人姓名: string;
  關係: string;
  聯絡電話: string;
  電郵: string;
  在住狀態: string;
}

const PatientContacts: React.FC = () => {
  const { patients } = usePatients();
  const [contacts, setContacts] = useState<(PatientContact & { patient?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    聯絡人姓名: '',
    關係: '',
    聯絡電話: '',
    電郵: '',
    在住狀態: '在住',
  });
  const [selectedContact, setSelectedContact] = useState<(PatientContact & { patient?: any }) | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalPatientId, setModalPatientId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('床號');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      // 使用 Promise.all 並行請求所有院友的聯絡人資料
      const contactPromises = patients.map(p => 
        getPatientContacts(p.院友id).then(cts => 
          cts.map(c => ({ ...c, patient: p }))
        ).catch(error => {
          console.error(`Error fetching contacts for patient ${p.院友id}:`, error);
          return [];
        })
      );
      
      const contactsArrays = await Promise.all(contactPromises);
      const allContacts = contactsArrays.flat();
      setContacts(allContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patients.length > 0) {
      fetchContacts();
    }
  }, [patients]);

  const contactsByPatient = contacts.reduce((acc, contact) => {
    const pid = contact.院友id;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(contact);
    return acc;
  }, {} as Record<number, PatientContact[]>);

  const filteredPatients = patients.filter(patient => {
    if (advancedFilters.床號 && !patient.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !(
      patient.中文姓氏.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase()) ||
      patient.中文名字.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase()) ||
      patient.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())
    )) {
      return false;
    }
    if (advancedFilters.在住狀態 && patient.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }

    let matchesSearch = true;
    if (searchTerm) {
      const patientContacts = contactsByPatient[patient.院友id] || [];
      matchesSearch = patient.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      patient.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      patient.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (patient.英文姓氏?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                      (patient.英文名字?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                      patientContacts.some(c =>
                        c.聯絡人姓名?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.關係?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.聯絡電話?.includes(searchTerm) ||
                        c.電郵?.toLowerCase().includes(searchTerm.toLowerCase())
                      );
    }

    return matchesSearch;
  });

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    let valueA: string = '';
    let valueB: string = '';

    switch (sortField) {
      case '床號':
        valueA = a.床號;
        valueB = b.床號;
        break;
      case '中文姓名':
        valueA = `${a.中文姓氏 || ''}${a.中文名字 || ''}`;
        valueB = `${b.中文姓氏 || ''}${b.中文名字 || ''}`;
        break;
      case '在住狀態':
        valueA = a.在住狀態 || '';
        valueB = b.在住狀態 || '';
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
      聯絡人姓名: '',
      關係: '',
      聯絡電話: '',
      電郵: '',
      在住狀態: '在住',
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (contact: PatientContact) => {
    if (window.confirm(`確定要刪除聯絡人 ${contact.聯絡人姓名} 嗎？`)) {
      try {
        await deletePatientContact(contact.id);
        await fetchContacts();
      } catch (error) {
        console.error('Error deleting contact:', error);
        alert('刪除失敗');
      }
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">院友聯絡人</h1>
        </div>
      </div>

      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜尋院友姓名、床號、聯絡人、電話..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`btn-secondary flex items-center space-x-2 ${showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''} ${hasAdvancedFilters() ? 'border-blue-300' : ''}`}
                >
                  <Filter className="h-4 w-4" />
                  <span>進階篩選</span>
                  {hasAdvancedFilters() && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">已套用</span>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">在住狀態</label>
                    <select value={advancedFilters.在住狀態} onChange={e => updateAdvancedFilter('在住狀態', e.target.value)} className="form-input">
                      <option value="在住">在住</option>
                      <option value="待入住">待入住</option>
                      <option value="已退住">已退住</option>
                      <option value="">所有狀態</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">床號</label>
                    <input type="text" value={advancedFilters.床號} onChange={e => updateAdvancedFilter('床號', e.target.value)} className="form-input" placeholder="搜尋床號..." />
                  </div>
                  <div>
                    <label className="form-label">院友姓名</label>
                    <input type="text" value={advancedFilters.中文姓名} onChange={e => updateAdvancedFilter('中文姓名', e.target.value)} className="form-input" placeholder="搜尋姓名..." />
                  </div>
                  <div>
                    <label className="form-label">聯絡人姓名</label>
                    <input type="text" value={advancedFilters.聯絡人姓名} onChange={e => updateAdvancedFilter('聯絡人姓名', e.target.value)} className="form-input" placeholder="搜尋聯絡人..." />
                  </div>
                  <div>
                    <label className="form-label">關係</label>
                    <input type="text" value={advancedFilters.關係} onChange={e => updateAdvancedFilter('關係', e.target.value)} className="form-input" placeholder="如：子女、配偶..." />
                  </div>
                  <div>
                    <label className="form-label">聯絡電話</label>
                    <input type="text" value={advancedFilters.聯絡電話} onChange={e => updateAdvancedFilter('聯絡電話', e.target.value)} className="form-input" placeholder="搜尋電話..." />
                  </div>
                  <div>
                    <label className="form-label">電郵</label>
                    <input type="text" value={advancedFilters.電郵} onChange={e => updateAdvancedFilter('電郵', e.target.value)} className="form-input" placeholder="搜尋電郵..." />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="床號">床號</SortableHeader>
                <SortableHeader field="中文姓名">院友姓名</SortableHeader>
                <SortableHeader field="在住狀態">在住狀態</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">聯絡人姓名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">關係</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">電話</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">地址</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備註</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedPatients.map(patient => {
                const patientContacts = contactsByPatient[patient.院友id] || [];
                const filteredPatientContacts = patientContacts.filter(contact => {
                  if (advancedFilters.聯絡人姓名 && !contact.聯絡人姓名?.toLowerCase().includes(advancedFilters.聯絡人姓名.toLowerCase())) return false;
                  if (advancedFilters.關係 && !contact.關係?.toLowerCase().includes(advancedFilters.關係.toLowerCase())) return false;
                  if (advancedFilters.聯絡電話 && !contact.聯絡電話?.includes(advancedFilters.聯絡電話)) return false;
                  if (advancedFilters.電郵 && !contact.電郵?.toLowerCase().includes(advancedFilters.電郵.toLowerCase())) return false;
                  return true;
                });
                
                // 如果沒有聯絡人，顯示一行空資料
                if (filteredPatientContacts.length === 0) {
                  return (
                    <tr key={patient.院友id} className="hover:bg-blue-50 group">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 align-top border-r border-gray-100">
                        {patient.床號}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top border-r border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                            {patient.院友相片 ? (
                              <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <PatientTooltip patient={patient}>
                              <span className="text-sm font-medium text-gray-900 cursor-help hover:text-blue-600 transition-colors">{patient.中文姓名}</span>
                            </PatientTooltip>
                            <div className="text-xs text-gray-500">
                              {getFormattedEnglishName(patient.英文姓氏, patient.英文名字) || patient.英文姓名 || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top border-r border-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          patient.在住狀態 === '在住' ? 'bg-green-100 text-green-800' :
                          patient.在住狀態 === '已退住' ? 'bg-gray-100 text-gray-800' :
                          patient.在住狀態 === '待入住' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {patient.在住狀態 || '在住'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400" colSpan={6}>無聯絡人</td>
                    </tr>
                  );
                }
                
                // 有聯絡人時，每個聯絡人一行
                return filteredPatientContacts.map((contact, index) => (
                  <tr 
                    key={`${patient['院友 id']}-${contact.id}`} 
                    className="hover:bg-blue-50 group cursor-pointer"
                    onDoubleClick={() => {
                      setSelectedContact(contact);
                      setModalPatientId(patient['院友 id']);
                      setShowModal(true);
                    }}
                  >
                    {index === 0 ? (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 align-top border-r border-gray-100" rowSpan={filteredPatientContacts.length}>
                          {patient.床號}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top border-r border-gray-100" rowSpan={filteredPatientContacts.length}>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                              {patient.院友相片 ? (
                                <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <PatientTooltip patient={patient}>
                                <span className="text-sm font-medium text-gray-900 cursor-help hover:text-blue-600 transition-colors">{patient.中文姓名}</span>
                              </PatientTooltip>
                              <div className="text-xs text-gray-500">
                                {getFormattedEnglishName(patient.英文姓氏, patient.英文名字) || patient.英文姓名 || '-'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top border-r border-gray-100" rowSpan={filteredPatientContacts.length}>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            patient.在住狀態 === '在住' ? 'bg-green-100 text-green-800' :
                            patient.在住狀態 === '已退住' ? 'bg-gray-100 text-gray-800' :
                            patient.在住狀態 === '待入住' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {patient.在住狀態 || '在住'}
                          </span>
                        </td>
                      </>
                    ) : null}
                    <td className="px-4 py-3 text-sm text-gray-900">{contact.聯絡人姓名 || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.關係 || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{contact.聯絡電話 || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.地址 || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{contact.備註 || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContact(contact);
                            setModalPatientId(patient.院友id);
                            setShowModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="編輯"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(contact);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="刪除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <PatientContactModal
          contact={selectedContact}
          onClose={() => setShowModal(false)}
          onSaved={fetchContacts}
          defaultPatientId={modalPatientId || undefined}
        />
      )}
    </div>
  );
};

export default PatientContacts;
