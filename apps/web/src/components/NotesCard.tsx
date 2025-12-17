import React, { useState, useMemo } from 'react';
import { StickyNote, Plus, Check, Trash2, ChevronDown, ChevronUp, User, Calendar, Edit } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import NoteModal from './NoteModal';

const NotesCard: React.FC = () => {
  const { patients, patientNotes, completePatientNote, deletePatientNote } = usePatients();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);

  const { uncompletedNotes, completedNotes } = useMemo(() => {
    const uncompleted = patientNotes
      .filter(n => !n.is_completed)
      .sort((a, b) => new Date(b.note_date).getTime() - new Date(a.note_date).getTime());

    const completed = patientNotes
      .filter(n => n.is_completed)
      .sort((a, b) => {
        const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return timeB - timeA;
      });

    return { uncompletedNotes: uncompleted, completedNotes: completed };
  }, [patientNotes]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = date.toDateString();
    const todayOnly = today.toDateString();
    const yesterdayOnly = yesterday.toDateString();

    if (dateOnly === todayOnly) return '今天';
    if (dateOnly === yesterdayOnly) return '昨天';

    const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff < 7) return `${diff}天前`;

    return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  };

  const getPatientInfo = (patientId?: number) => {
    if (!patientId) return null;
    return patients.find(p => p.院友id === patientId);
  };

  const handleComplete = async (noteId: string) => {
    if (confirm('確定要標記為已完成嗎？')) {
      try {
        await completePatientNote(noteId);
      } catch (error) {
        console.error('Error completing note:', error);
        alert('完成便條失敗，請重試');
      }
    }
  };

  const handleDelete = async (noteId: string) => {
    if (confirm('確定要刪除這個便條嗎？')) {
      try {
        await deletePatientNote(noteId);
      } catch (error) {
        console.error('Error deleting note:', error);
        alert('刪除便條失敗，請重試');
      }
    }
  };

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <StickyNote className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">便條</h2>
              <p className="text-sm text-gray-600">
                未完成 {uncompletedNotes.length} · 已完成 {completedNotes.length}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNoteModal(true)}
            className="btn-primary text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            
          </button>
        </div>

        <div className="space-y-4">
          {uncompletedNotes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <StickyNote className="h-4 w-4" />
                <span>未完成 ({uncompletedNotes.length})</span>
              </div>
              {uncompletedNotes.map(note => {
                const patient = getPatientInfo(note.patient_id);
                return (
                  <div key={note.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {patient ? (
                          <>
                            {patient.院友相片 ? (
                              <img
                                src={patient.院友相片}
                                alt={patient.中文姓名}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                            )}
                            <span className="font-medium text-gray-900">
                              {patient.床號} - {patient.中文姓氏}{patient.中文名字}
                            </span>
                          </>
                        ) : (
                          <span className="font-medium text-gray-600 flex items-center">
                            <StickyNote className="h-4 w-4 mr-1" />
                            (無指定院友)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(note.note_date)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingNote(note)}
                        className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        編輯
                      </button>
                      <button
                        onClick={() => handleComplete(note.id)}
                        className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        完成
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        刪除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <StickyNote className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>目前沒有未完成的便條</p>
            </div>
          )}

          {completedNotes.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4" />
                  <span>已完成 ({completedNotes.length})</span>
                </div>
                {showCompleted ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showCompleted && (
                <div className="mt-3 space-y-2">
                  {completedNotes.map(note => {
                    const patient = getPatientInfo(note.patient_id);
                    return (
                      <div key={note.id} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-700">
                            {patient ? `${patient.床號} ${patient.中文姓氏}${patient.中文名字}` : '(無院友)'}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatDate(note.note_date)}
                            {note.completed_at && ` (${formatDate(note.completed_at)}完成)`}
                          </span>
                        </div>
                        <p className="text-gray-600 line-clamp-2 mb-1">{note.content}</p>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          刪除
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showNoteModal && (
        <NoteModal onClose={() => setShowNoteModal(false)} />
      )}

      {editingNote && (
        <NoteModal
          note={editingNote}
          onClose={() => setEditingNote(null)}
        />
      )}
    </>
  );
};

export default NotesCard;
