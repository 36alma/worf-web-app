import {useEffect, useMemo, useState} from 'react';
import Modal from '@/components/ui/Modal';
import FieldError from '@/components/ui/FieldError';
import {TaskCategory} from './types';
import {getTaskCategories, createTaskCategory, deleteTaskCategory} from '@/lib/api/tasks';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {requiredText} from '@/lib/validation';
import {Trash2, Plus} from 'lucide-react';
import toast from 'react-hot-toast';

export interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  permissions: {
    read: boolean;
    create: boolean;
    modify: boolean;
    delete: boolean;
  };
}

export default function CategoryManagerModal({open, onClose, groupId, permissions}: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#f97316'); // default orange
  const schemas = useMemo(() => ({name: requiredText(100)}), []);
  const {errors, validateField, validateAll, clearError} = useFieldValidation(schemas);

  useEffect(() => {
    if (open && permissions.read) {
      setLoading(true);
      getTaskCategories({group_id: groupId})
        .then((res: any) => {
          const data = res.data?.data || res.data || [];
          setCategories(Array.isArray(data) ? data : []);
        })
        .catch(() => toast.error('Kategóriák betöltése sikertelen'))
        .finally(() => setLoading(false));
    }
  }, [open, groupId, permissions.read]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.create) return;
    if (!validateAll({name: newName})) return;

    try {
      const res = await createTaskCategory({
        group_id: groupId,
        name: newName,
        color: newColor,
        is_global: false
      });
      setCategories((prev) => [...prev, res.data?.data || res.data]);
      setNewName('');
      toast.success('Kategória létrehozva');
    } catch {
      toast.error('Hiba a létrehozás során');
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!permissions.delete) return;
    try {
      await deleteTaskCategory({group_id: groupId, task_category_id: categoryId});
      setCategories((prev) => prev.filter(c => c.task_category_id !== categoryId));
      toast.success('Kategória törölve');
    } catch {
      toast.error('Hiba a törlés során');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Címkék Kezelése">
      <div className="flex flex-col gap-6">
        {!permissions.read ? (
          <p className="text-sm text-[var(--text-secondary)]">Nincs jogosultságod a kategóriák olvasásához.</p>
        ) : loading ? (
          <div className="h-20 animate-pulse rounded bg-[var(--bg-elevated)]" />
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <div key={cat.task_category_id} className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full" style={{backgroundColor: cat.color}} />
                  <span className="text-sm font-medium text-[var(--text-primary)]">{cat.name}</span>
                </div>
                {permissions.delete && (
                  <button onClick={() => handleDelete(cat.task_category_id)} className="text-[var(--text-tertiary)] hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-[var(--text-secondary)] italic">Nincsenek még címkék.</p>}
          </div>
        )}

        {permissions.create && (
          <form onSubmit={handleCreate} className="mt-2 flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Új címke</h4>
            <div className="flex gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded bg-transparent p-1"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  clearError('name');
                }}
                onBlur={(e) => validateField('name', e.target.value)}
                placeholder="Címke neve"
                className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
            <FieldError messages={errors.name} />
          </form>
        )}
      </div>
    </Modal>
  );
}
